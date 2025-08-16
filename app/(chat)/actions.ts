'use server';

import type { VisibilityType } from '@/components/visibility-selector';
import { myProvider } from '@/lib/ai/providers';
import { createClient } from '@/lib/supabase/server';
import {
  deleteMessagesByChatIdAfterTimestamp,
  getMessageById,
  updateChatVisiblityById,
} from '@/lib/supabase/services';
import {
  getCharacterById,
  saveChat,
  saveMessages,
} from '@/lib/supabase/services/queries';
import { generateUUID } from '@/lib/utils';
import { generateText, type UIMessage } from 'ai';
import { cookies } from 'next/headers';

export async function saveChatModelAsCookie(model: string) {
  const cookieStore = await cookies();
  cookieStore.set('chat-model', model);
}

export async function createCharacterChat(characterId: string) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    throw new Error('User not authenticated');
  }

  // Get character details using service function
  const character = await getCharacterById(supabase, { id: characterId });

  if (!character) {
    throw new Error('Character not found');
  }

  // Create new chat
  const chatId = generateUUID();
  const chatTitle = `Chat with ${character.name}`;

  await saveChat(supabase, {
    id: chatId,
    userId: session.user.id,
    title: chatTitle,
    visibility: 'private',
    characterId: characterId,
  });

  // Create initial message from character if they have a first message
  if (character.first_message) {
    await saveMessages(supabase, {
      messages: [
        {
          id: generateUUID(),
          chat_id: chatId,
          role: 'assistant',
          parts: [{ type: 'text', text: character.first_message }],
          attachments: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    });
  }

  return { chatId, title: chatTitle };
}

export async function generateTitleFromUserMessage({
  message,
}: {
  message: UIMessage;
}) {
  const { text: title } = await generateText({
    model: myProvider.languageModel('title-model'),
    system: `\n
    - you will generate a short title based on the first message a user begins a conversation with
    - ensure it is not more than 80 characters long
    - the title should be a summary of the user's message
    - do not use quotes or colons`,
    prompt: JSON.stringify(message),
  });

  return title;
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  const supabase = await createClient();
  const [message] = await getMessageById(supabase, { id });

  await deleteMessagesByChatIdAfterTimestamp(supabase, {
    chatId: message.chat_id,
    timestamp: new Date(message.created_at),
  });
}

export async function updateChatVisibility({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: VisibilityType;
}) {
  const supabase = await createClient();
  await updateChatVisiblityById(supabase, { chatId, visibility });
}
