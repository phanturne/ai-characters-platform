import type { VisibilityType } from '@/components/visibility-selector';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import type { ChatModel } from '@/lib/ai/models';
import {
  systemPrompt,
  type CharacterInfo,
  type RequestHints,
} from '@/lib/ai/prompts';
import { myProvider } from '@/lib/ai/providers';
import { createDocument } from '@/lib/ai/tools/create-document';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { isProductionEnvironment } from '@/lib/constants';
import { ChatSDKError } from '@/lib/errors';
import type { Json } from '@/lib/supabase/database';
import type { Chat } from '@/lib/supabase/schema';
import { createClient } from '@/lib/supabase/server';
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
} from '@/lib/supabase/services';
import { getCharacterById } from '@/lib/supabase/services/queries';
import type { UserType } from '@/lib/supabase/types';
import type { ChatMessage } from '@/lib/types';
import { convertToUIMessages, generateUUID, getUserType } from '@/lib/utils';
import { geolocation } from '@vercel/functions';
import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
} from 'ai';
import { after } from 'next/server';
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from 'resumable-stream';
import { generateTitleFromUserMessage } from '../../actions';
import { postRequestBodySchema, type PostRequestBody } from './schema';

export const maxDuration = 60;

let globalStreamContext: ResumableStreamContext | null = null;

export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes('REDIS_URL')) {
        console.log(
          ' > Resumable streams are disabled due to missing REDIS_URL',
        );
      } else {
        console.error(error);
      }
    }
  }

  return globalStreamContext;
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (error) {
    console.error('Chat API validation failed:', error);
    return new ChatSDKError('bad_request:api').toResponse();
  }

  try {
    const {
      id,
      message,
      selectedChatModel,
      selectedVisibilityType,
      characterId,
    }: {
      id: string;
      message: ChatMessage;
      selectedChatModel: ChatModel['id'];
      selectedVisibilityType: VisibilityType;
      characterId?: string;
    } = requestBody;

    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    // Determine user type based on JWT claim instead of email pattern
    const userType: UserType = getUserType(session.user);

    const messageCount = await getMessageCountByUserId(supabase, {
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError('rate_limit:chat').toResponse();
    }

    let chat: Chat | null = null;
    try {
      chat = await getChatById(supabase, { id });
    } catch (error) {
      chat = null;
    }

    if (!chat) {
      const title = await generateTitleFromUserMessage({
        message,
      });

      try {
        await saveChat(supabase, {
          id,
          userId: session.user.id,
          title,
          visibility: selectedVisibilityType,
          characterId: characterId || null,
        });
      } catch (error) {
        console.error('Failed to save chat:', error);
        return new ChatSDKError(
          'bad_request:database',
          'Failed to create new chat',
        ).toResponse();
      }
    } else {
      if (chat.user_id !== session.user.id) {
        return new ChatSDKError('forbidden:chat').toResponse();
      }
    }

    const messagesFromDb = await getMessagesByChatId(supabase, { id });
    const uiMessages = [...convertToUIMessages(messagesFromDb), message];

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    await saveMessages(supabase, {
      messages: [
        {
          chat_id: id,
          id: message.id,
          role: 'user',
          parts: message.parts as Json,
          attachments: [],
          created_at: new Date().toISOString(),
        },
      ],
    });

    const streamId = generateUUID();
    await createStreamId(supabase, { streamId, chatId: id });

    // Fetch character information if this is a character chat
    let characterInfo: CharacterInfo | undefined;
    if (characterId) {
      try {
        const character = await getCharacterById(supabase, { id: characterId });

        if (character) {
          characterInfo = {
            name: character.name,
            personality: character.personality || '',
            scenario: character.scenario || '',
            systemPrompt: character.system_prompt,
            postHistoryInstructions:
              character.post_history_instructions || undefined,
          };
        }
      } catch (error) {
        console.error('Failed to fetch character info:', error);
      }
    }

    const stream = createUIMessageStream({
      execute: ({ writer: dataStream }) => {
        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: systemPrompt({
            selectedChatModel,
            requestHints,
            character: characterInfo,
          }),
          messages: convertToModelMessages(uiMessages),
          stopWhen: stepCountIs(5),
          experimental_activeTools:
            selectedChatModel === 'chat-model-reasoning'
              ? []
              : [
                  'getWeather',
                  'createDocument',
                  'updateDocument',
                  'requestSuggestions',
                ],
          experimental_transform: smoothStream({ chunking: 'word' }),
          tools: {
            getWeather,
            createDocument: createDocument({ session, dataStream, supabase }),
            updateDocument: updateDocument({ session, dataStream, supabase }),
            requestSuggestions: requestSuggestions({
              session,
              dataStream,
              supabase,
            }),
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: 'stream-text',
          },
        });

        result.consumeStream();

        dataStream.merge(
          result.toUIMessageStream({
            sendReasoning: true,
          }),
        );
      },
      generateId: generateUUID,
      onFinish: async ({ messages }) => {
        await saveMessages(supabase, {
          messages: messages.map((message) => ({
            id: message.id,
            role: message.role,
            parts: message.parts as Json,
            created_at: new Date().toISOString(),
            attachments: [],
            chat_id: id,
          })),
        });
      },
      onError: () => {
        return 'Oops, an error occurred!';
      },
    });

    const streamContext = getStreamContext();

    if (streamContext) {
      return new Response(
        await streamContext.resumableStream(streamId, () =>
          stream.pipeThrough(new JsonToSseTransformStream()),
        ),
      );
    } else {
      return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
    }
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    // Log the error for debugging
    console.error('Unexpected error in chat POST:', error);

    // Return a generic error response
    return new ChatSDKError(
      'bad_request:database',
      'An unexpected error occurred',
    ).toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const chat = await getChatById(supabase, { id });

  if (chat.user_id !== session.user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const deletedChat = await deleteChatById(supabase, { id });

  return Response.json(deletedChat, { status: 200 });
}
