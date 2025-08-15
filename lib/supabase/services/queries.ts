import type { ArtifactKind } from '@/components/artifact';
import type { VisibilityType } from '@/components/visibility-selector';
import { ChatSDKError } from '../../errors';
import type { Database, SupabaseInstance } from '../schema';

// Chat services
export async function saveChat(
  supabase: SupabaseInstance,
  {
    id,
    userId,
    title,
    visibility,
  }: {
    id: string;
    userId: string;
    title: string;
    visibility: VisibilityType;
  },
) {
  try {
    const { data, error } = await supabase
      .from('chat')
      .insert({
        id,
        user_id: userId,
        title,
        visibility,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save chat');
  }
}

export async function deleteChatById(
  supabase: SupabaseInstance,
  { id }: { id: string },
) {
  try {
    // Delete related records first
    await supabase.from('vote').delete().eq('chat_id', id);
    await supabase.from('message').delete().eq('chat_id', id);
    await supabase.from('stream').delete().eq('chat_id', id);

    // Delete the chat
    const { data, error } = await supabase
      .from('chat')
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete chat by id',
    );
  }
}

export async function getChatsByUserId(
  supabase: SupabaseInstance,
  {
    id,
    limit,
    startingAfter,
    endingBefore,
  }: {
    id: string;
    limit: number;
    startingAfter: string | null;
    endingBefore: string | null;
  },
) {
  try {
    const extendedLimit = limit + 1;

    let query = supabase
      .from('chat')
      .select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(extendedLimit);

    if (startingAfter) {
      const { data: selectedChat } = await supabase
        .from('chat')
        .select('created_at')
        .eq('id', startingAfter)
        .single();

      if (!selectedChat) {
        throw new ChatSDKError(
          'not_found:database',
          `Chat with id ${startingAfter} not found`,
        );
      }

      query = query.gt('created_at', selectedChat.created_at);
    } else if (endingBefore) {
      const { data: selectedChat } = await supabase
        .from('chat')
        .select('created_at')
        .eq('id', endingBefore)
        .single();

      if (!selectedChat) {
        throw new ChatSDKError(
          'not_found:database',
          `Chat with id ${endingBefore} not found`,
        );
      }

      query = query.lt('created_at', selectedChat.created_at);
    }

    const { data: filteredChats, error } = await query;

    if (error) throw error;

    const hasMore = (filteredChats || []).length > limit;

    return {
      chats: hasMore ? filteredChats?.slice(0, limit) : filteredChats || [],
      hasMore,
    };
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get chats by user id',
    );
  }
}

export async function getChatById(
  supabase: SupabaseInstance,
  { id }: { id: string },
) {
  try {
    const { data, error } = await supabase
      .from('chat')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to get chat by id');
  }
}

// Message services
export async function saveMessages(
  supabase: SupabaseInstance,
  {
    messages,
  }: {
    messages: Array<Database['public']['Tables']['message']['Insert']>;
  },
) {
  try {
    const { data, error } = await supabase
      .from('message')
      .insert(messages)
      .select();

    if (error) throw error;
    return data;
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save messages');
  }
}

export async function getMessagesByChatId(
  supabase: SupabaseInstance,
  { id }: { id: string },
) {
  try {
    const { data, error } = await supabase
      .from('message')
      .select('*')
      .eq('chat_id', id)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get messages by chat id',
    );
  }
}

export async function getMessageById(
  supabase: SupabaseInstance,
  { id }: { id: string },
) {
  try {
    const { data, error } = await supabase
      .from('message')
      .select('*')
      .eq('id', id);

    if (error) throw error;
    return data || [];
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get message by id',
    );
  }
}

export async function deleteMessagesByChatIdAfterTimestamp(
  supabase: SupabaseInstance,
  {
    chatId,
    timestamp,
  }: {
    chatId: string;
    timestamp: Date;
  },
) {
  try {
    // Get messages to delete
    const { data: messagesToDelete } = await supabase
      .from('message')
      .select('id')
      .eq('chat_id', chatId)
      .gte('created_at', timestamp.toISOString());

    if (messagesToDelete && messagesToDelete.length > 0) {
      const messageIds = messagesToDelete.map((message) => message.id);

      // Delete related votes
      await supabase
        .from('vote')
        .delete()
        .eq('chat_id', chatId)
        .in('message_id', messageIds);

      // Delete messages
      const { data, error } = await supabase
        .from('message')
        .delete()
        .eq('chat_id', chatId)
        .in('id', messageIds)
        .select();

      if (error) throw error;
      return data;
    }
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete messages by chat id after timestamp',
    );
  }
}

// Vote services
export async function voteMessage(
  supabase: SupabaseInstance,
  {
    chatId,
    messageId,
    type,
  }: {
    chatId: string;
    messageId: string;
    type: 'up' | 'down';
  },
) {
  try {
    // Check if vote already exists
    const { data: existingVote } = await supabase
      .from('vote')
      .select('*')
      .eq('message_id', messageId)
      .single();

    if (existingVote) {
      // Update existing vote
      const { data, error } = await supabase
        .from('vote')
        .update({ is_upvoted: type === 'up' })
        .eq('message_id', messageId)
        .eq('chat_id', chatId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      // Create new vote
      const { data, error } = await supabase
        .from('vote')
        .insert({
          chat_id: chatId,
          message_id: messageId,
          is_upvoted: type === 'up',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to vote message');
  }
}

export async function getVotesByChatId(
  supabase: SupabaseInstance,
  { id }: { id: string },
) {
  try {
    const { data, error } = await supabase
      .from('vote')
      .select('*')
      .eq('chat_id', id);

    if (error) throw error;
    return data || [];
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get votes by chat id',
    );
  }
}

// Document services
export async function saveDocument(
  supabase: SupabaseInstance,
  {
    id,
    title,
    kind,
    content,
    userId,
  }: {
    id: string;
    title: string;
    kind: ArtifactKind;
    content: string;
    userId: string;
  },
) {
  try {
    const { data, error } = await supabase
      .from('document')
      .insert({
        id,
        title,
        kind,
        content,
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select();

    if (error) throw error;
    return data;
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save document');
  }
}

export async function getDocumentsById(
  supabase: SupabaseInstance,
  { id }: { id: string },
) {
  try {
    const { data, error } = await supabase
      .from('document')
      .select('*')
      .eq('id', id)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get documents by id',
    );
  }
}

export async function getDocumentById(
  supabase: SupabaseInstance,
  { id }: { id: string },
) {
  try {
    const { data, error } = await supabase
      .from('document')
      .select('*')
      .eq('id', id)
      .order('created_at', { ascending: false })
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get document by id',
    );
  }
}

export async function deleteDocumentsByIdAfterTimestamp(
  supabase: SupabaseInstance,
  {
    id,
    timestamp,
  }: {
    id: string;
    timestamp: Date;
  },
) {
  try {
    // Delete related suggestions first
    await supabase
      .from('suggestion')
      .delete()
      .eq('document_id', id)
      .gt('document_created_at', timestamp.toISOString());

    // Delete documents
    const { data, error } = await supabase
      .from('document')
      .delete()
      .eq('id', id)
      .gt('created_at', timestamp.toISOString())
      .select();

    if (error) throw error;
    return data;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete documents by id after timestamp',
    );
  }
}

// Suggestion services
export async function saveSuggestions(
  supabase: SupabaseInstance,
  {
    suggestions,
  }: {
    suggestions: Array<Database['public']['Tables']['suggestion']['Insert']>;
  },
) {
  try {
    const { data, error } = await supabase
      .from('suggestion')
      .insert(suggestions)
      .select();

    if (error) throw error;
    return data;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to save suggestions',
    );
  }
}

export async function getSuggestionsByDocumentId(
  supabase: SupabaseInstance,
  {
    documentId,
  }: {
    documentId: string;
  },
) {
  try {
    const { data, error } = await supabase
      .from('suggestion')
      .select('*')
      .eq('document_id', documentId);

    if (error) throw error;
    return data || [];
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get suggestions by document id',
    );
  }
}

// Chat visibility services
export async function updateChatVisiblityById(
  supabase: SupabaseInstance,
  {
    chatId,
    visibility,
  }: {
    chatId: string;
    visibility: 'private' | 'public';
  },
) {
  try {
    const { data, error } = await supabase
      .from('chat')
      .update({ visibility })
      .eq('id', chatId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to update chat visibility by id',
    );
  }
}

// Message count services
export async function getMessageCountByUserId(
  supabase: SupabaseInstance,
  { id, differenceInHours }: { id: string; differenceInHours: number },
) {
  try {
    const twentyFourHoursAgo = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000,
    );

    const { count, error } = await supabase
      .from('message')
      .select('*', { count: 'exact', head: true })
      .eq('chat_id', id)
      .gte('created_at', twentyFourHoursAgo.toISOString())
      .eq('role', 'user');

    if (error) throw error;
    return count || 0;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get message count by user id',
    );
  }
}

// Stream services
export async function createStreamId(
  supabase: SupabaseInstance,
  {
    streamId,
    chatId,
  }: {
    streamId: string;
    chatId: string;
  },
) {
  try {
    const { error } = await supabase.from('stream').insert({
      id: streamId,
      chat_id: chatId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error) throw error;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to create stream id',
    );
  }
}

export async function getStreamIdsByChatId(
  supabase: SupabaseInstance,
  { chatId }: { chatId: string },
) {
  try {
    const { data, error } = await supabase
      .from('stream')
      .select('id')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []).map(({ id }) => id);
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get stream ids by chat id',
    );
  }
}
