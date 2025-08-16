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
    characterId,
  }: {
    id: string;
    userId: string;
    title: string;
    visibility: VisibilityType;
    characterId?: string | null;
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
        character_id: characterId,
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

// Character services

// Helper function to validate that all provided tag IDs exist
async function validateTagIds(
  supabase: SupabaseInstance,
  tagIds: string[],
): Promise<void> {
  if (tagIds.length === 0) return;

  // Validate input array
  if (!Array.isArray(tagIds)) {
    throw new ChatSDKError('bad_request:database', 'Tag IDs must be an array');
  }

  // Filter out invalid tag IDs
  const validTagIds = tagIds.filter(
    (id) => id && typeof id === 'string' && id.trim().length > 0,
  );

  if (validTagIds.length !== tagIds.length) {
    throw new ChatSDKError(
      'bad_request:database',
      'Invalid tag ID format detected',
    );
  }

  const { data: existingTags, error: tagsError } = await supabase
    .from('tags')
    .select('id')
    .in('id', validTagIds);

  if (tagsError) throw tagsError;

  if (existingTags.length !== validTagIds.length) {
    const foundTagIds = existingTags.map((tag) => tag.id);
    const missingTagIds = validTagIds.filter((id) => !foundTagIds.includes(id));
    throw new ChatSDKError(
      'bad_request:database',
      `Tags not found: ${missingTagIds.join(', ')}`,
    );
  }
}

// Helper function to insert character tags
async function insertCharacterTags(
  supabase: SupabaseInstance,
  characterId: string,
  tagIds: string[],
): Promise<void> {
  if (tagIds.length === 0) return;

  // Validate inputs
  if (!characterId || typeof characterId !== 'string') {
    throw new ChatSDKError('bad_request:database', 'Invalid character ID');
  }

  const characterTags = tagIds.map((tagId) => ({
    character_id: characterId,
    tag_id: tagId,
    created_at: new Date().toISOString(),
  }));

  const { error: insertError } = await supabase
    .from('character_tags')
    .insert(characterTags);

  if (insertError) throw insertError;
}

// Helper function to efficiently sync tags to desired state
async function syncCharacterTags(
  supabase: SupabaseInstance,
  characterId: string,
  desiredTagIds: string[],
) {
  try {
    // Validate that all desired tags exist
    await validateTagIds(supabase, desiredTagIds);

    // Get current tags
    const { data: currentTags, error: currentTagsError } = await supabase
      .from('character_tags')
      .select('tag_id')
      .eq('character_id', characterId);

    if (currentTagsError) throw currentTagsError;

    const currentTagIds = currentTags?.map((ct) => ct.tag_id) || [];

    // Calculate what needs to be added/removed
    const tagsToAdd = desiredTagIds.filter((id) => !currentTagIds.includes(id));
    const tagsToRemove = currentTagIds.filter(
      (id) => !desiredTagIds.includes(id),
    );

    // Remove tags that are no longer wanted
    if (tagsToRemove.length > 0) {
      const { error: removeError } = await supabase
        .from('character_tags')
        .delete()
        .eq('character_id', characterId)
        .in('tag_id', tagsToRemove);

      if (removeError) throw removeError;
    }

    // Add new tags
    await insertCharacterTags(supabase, characterId, tagsToAdd);
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to sync character tags',
    );
  }
}

export async function getCharacterById(
  supabase: SupabaseInstance,
  { id }: { id: string },
) {
  try {
    const { data, error } = await supabase
      .from('characters')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get character by id',
    );
  }
}

export async function getCharactersByUserId(
  supabase: SupabaseInstance,
  {
    userId,
    limit,
    startingAfter,
    endingBefore,
  }: {
    userId: string;
    limit: number;
    startingAfter: string | null;
    endingBefore: string | null;
  },
) {
  try {
    const extendedLimit = limit + 1;

    let query = supabase
      .from('characters')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(extendedLimit);

    if (startingAfter) {
      const { data: selectedCharacter } = await supabase
        .from('characters')
        .select('created_at')
        .eq('id', startingAfter)
        .single();

      if (!selectedCharacter) {
        throw new ChatSDKError(
          'not_found:database',
          `Character with id ${startingAfter} not found`,
        );
      }

      query = query.gt('created_at', selectedCharacter.created_at);
    } else if (endingBefore) {
      const { data: selectedCharacter } = await supabase
        .from('characters')
        .select('created_at')
        .eq('id', endingBefore)
        .single();

      if (!selectedCharacter) {
        throw new ChatSDKError(
          'not_found:database',
          `Character with id ${endingBefore} not found`,
        );
      }

      query = query.lt('created_at', selectedCharacter.created_at);
    }

    const { data: filteredCharacters, error } = await query;

    if (error) throw error;

    const hasMore = (filteredCharacters || []).length > limit;

    return {
      characters: hasMore
        ? filteredCharacters?.slice(0, limit)
        : filteredCharacters || [],
      hasMore,
    };
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get characters by user id',
    );
  }
}

export async function getPublicCharacters(
  supabase: SupabaseInstance,
  {
    limit,
    startingAfter,
    endingBefore,
  }: {
    limit: number;
    startingAfter: string | null;
    endingBefore: string | null;
  },
) {
  try {
    const extendedLimit = limit + 1;

    let query = supabase
      .from('characters')
      .select('*')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(extendedLimit);

    if (startingAfter) {
      const { data: selectedCharacter } = await supabase
        .from('characters')
        .select('created_at')
        .eq('id', startingAfter)
        .single();

      if (!selectedCharacter) {
        throw new ChatSDKError(
          'not_found:database',
          `Character with id ${startingAfter} not found`,
        );
      }

      query = query.gt('created_at', selectedCharacter.created_at);
    } else if (endingBefore) {
      const { data: selectedCharacter } = await supabase
        .from('characters')
        .select('created_at')
        .eq('id', endingBefore)
        .single();

      if (!selectedCharacter) {
        throw new ChatSDKError(
          'not_found:database',
          `Character with id ${endingBefore} not found`,
        );
      }

      query = query.lt('created_at', selectedCharacter.created_at);
    }

    const { data: filteredCharacters, error } = await query;

    if (error) throw error;

    const hasMore = (filteredCharacters || []).length > limit;

    return {
      characters: hasMore
        ? filteredCharacters?.slice(0, limit)
        : filteredCharacters || [],
      hasMore,
    };
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get public characters',
    );
  }
}

export async function updateCharacter(
  supabase: SupabaseInstance,
  {
    id,
    updates,
    tagIds,
    enhancedErrorHandling = false,
  }: {
    id: string;
    updates: Partial<Database['public']['Tables']['characters']['Update']>;
    tagIds?: string[];
    enhancedErrorHandling?: boolean;
  },
) {
  try {
    // Update the character first
    const { data: character, error: characterError } = await supabase
      .from('characters')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (characterError) throw characterError;

    // If tags are provided, sync to the desired state
    if (tagIds !== undefined) {
      await syncCharacterTags(supabase, id, tagIds);
    }

    return character;
  } catch (error) {
    if (enhancedErrorHandling && error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to update character',
    );
  }
}

export async function deleteCharacterById(
  supabase: SupabaseInstance,
  { id }: { id: string },
) {
  try {
    // Delete related character tags first
    await supabase.from('character_tags').delete().eq('character_id', id);

    // Delete the character
    const { data, error } = await supabase
      .from('characters')
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete character by id',
    );
  }
}

// Tag services
export async function getAllTags(supabase: SupabaseInstance) {
  try {
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to get all tags');
  }
}

export async function getTagsByCharacterId(
  supabase: SupabaseInstance,
  { characterId }: { characterId: string },
) {
  try {
    if (!characterId || typeof characterId !== 'string') {
      throw new ChatSDKError('bad_request:database', 'Invalid character ID');
    }

    const { data, error } = await supabase
      .from('character_tags')
      .select(`
        tag_id,
        tags (
          id,
          name,
          description,
          is_system
        )
      `)
      .eq('character_id', characterId);

    if (error) throw error;
    return data || [];
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get tags by character id',
    );
  }
}

// Character tag junction services
export async function addTagsToCharacter(
  supabase: SupabaseInstance,
  {
    characterId,
    tagIds,
  }: {
    characterId: string;
    tagIds: string[];
  },
) {
  try {
    // Validate that all tags exist
    await validateTagIds(supabase, tagIds);

    // Insert the tags
    await insertCharacterTags(supabase, characterId, tagIds);

    // Return the inserted data for backward compatibility
    const { data, error } = await supabase
      .from('character_tags')
      .select('*')
      .eq('character_id', characterId)
      .in('tag_id', tagIds);

    if (error) throw error;
    return data;
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to add tags to character',
    );
  }
}

export async function removeTagsFromCharacter(
  supabase: SupabaseInstance,
  {
    characterId,
    tagIds,
  }: {
    characterId: string;
    tagIds: string[];
  },
) {
  try {
    if (tagIds.length === 0) return { removedCount: 0 };

    const { error } = await supabase
      .from('character_tags')
      .delete()
      .eq('character_id', characterId)
      .in('tag_id', tagIds);

    if (error) throw error;

    return { removedCount: tagIds.length };
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to remove tags from character',
    );
  }
}

export async function getChatsByCharacterId(
  supabase: SupabaseInstance,
  {
    characterId,
    limit,
    startingAfter,
    endingBefore,
  }: {
    characterId: string;
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
      .eq('character_id', characterId)
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
      'Failed to get chats by character id',
    );
  }
}

export async function createCharacterWithTagValidation(
  supabase: SupabaseInstance,
  {
    userId,
    name,
    description,
    personality,
    scenario,
    firstMessage,
    messageExample,
    creatorNotes,
    systemPrompt,
    postHistoryInstructions,
    alternateGreetings,
    avatarUrl,
    characterVersion,
    isNsfw,
    visibility,
    tagIds,
  }: {
    userId: string;
    name: string;
    description?: string | null;
    personality?: string | null;
    scenario?: string | null;
    firstMessage?: string | null;
    messageExample?: string | null;
    creatorNotes?: string | null;
    systemPrompt: string;
    postHistoryInstructions?: string | null;
    alternateGreetings?: string[] | null;
    avatarUrl?: string | null;
    characterVersion?: number;
    isNsfw?: boolean;
    visibility?: string;
    tagIds?: string[];
  },
) {
  try {
    // Validate that all provided tags exist
    if (tagIds && tagIds.length > 0) {
      await validateTagIds(supabase, tagIds);
    }

    // Create the character
    const { data: character, error: characterError } = await supabase
      .from('characters')
      .insert({
        user_id: userId,
        name,
        description,
        personality,
        scenario,
        first_message: firstMessage,
        message_example: messageExample,
        creator_notes: creatorNotes,
        system_prompt: systemPrompt,
        post_history_instructions: postHistoryInstructions,
        alternate_greetings: alternateGreetings,
        avatar_url: avatarUrl,
        character_version: characterVersion || 1,
        is_nsfw: isNsfw || false,
        visibility: visibility || 'private',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (characterError) throw characterError;

    // Add the tags to the character
    if (tagIds && tagIds.length > 0) {
      await insertCharacterTags(supabase, character.id, tagIds);
    }

    return character;
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to create character with tags',
    );
  }
}

export async function modifyCharacterTags(
  supabase: SupabaseInstance,
  {
    characterId,
    addTagIds,
    removeTagIds,
  }: {
    characterId: string;
    addTagIds?: string[];
    removeTagIds?: string[];
  },
) {
  try {
    // Validate that all tags to add exist
    if (addTagIds && addTagIds.length > 0) {
      await validateTagIds(supabase, addTagIds);
    }

    // Remove specified tags
    if (removeTagIds && removeTagIds.length > 0) {
      const { error: removeError } = await supabase
        .from('character_tags')
        .delete()
        .eq('character_id', characterId)
        .in('tag_id', removeTagIds);

      if (removeError) throw removeError;
    }

    // Add new tags (only if they don't already exist)
    if (addTagIds && addTagIds.length > 0) {
      // Check which tags already exist for this character
      const { data: existingCharacterTags } = await supabase
        .from('character_tags')
        .select('tag_id')
        .eq('character_id', characterId)
        .in('tag_id', addTagIds);

      const existingTagIds =
        existingCharacterTags?.map((ct) => ct.tag_id) || [];
      const newTagIds = addTagIds.filter((id) => !existingTagIds.includes(id));

      // Insert only the new tags
      await insertCharacterTags(supabase, characterId, newTagIds);
    }

    return { success: true };
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to modify character tags',
    );
  }
}
