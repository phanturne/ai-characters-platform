import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database';

// Extract table types from the Supabase database schema
export type Chat = Database['public']['Tables']['chat']['Row'];
export type ChatInsert = Database['public']['Tables']['chat']['Insert'];
export type ChatUpdate = Database['public']['Tables']['chat']['Update'];

export type Document = Database['public']['Tables']['document']['Row'];
export type DocumentInsert = Database['public']['Tables']['document']['Insert'];
export type DocumentUpdate = Database['public']['Tables']['document']['Update'];

export type Message = Database['public']['Tables']['message']['Row'];
export type MessageInsert = Database['public']['Tables']['message']['Insert'];
export type MessageUpdate = Database['public']['Tables']['message']['Update'];

export type Vote = Database['public']['Tables']['vote']['Row'];
export type VoteInsert = Database['public']['Tables']['vote']['Insert'];
export type VoteUpdate = Database['public']['Tables']['vote']['Update'];

export type Suggestion = Database['public']['Tables']['suggestion']['Row'];
export type SuggestionInsert =
  Database['public']['Tables']['suggestion']['Insert'];
export type SuggestionUpdate =
  Database['public']['Tables']['suggestion']['Update'];

export type Stream = Database['public']['Tables']['stream']['Row'];
export type StreamInsert = Database['public']['Tables']['stream']['Insert'];
export type StreamUpdate = Database['public']['Tables']['stream']['Update'];

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

// Legacy type aliases for backward compatibility
export type DBMessage = Message;
export type User = Profile;

// Common utility types
export type { SupabaseClient };
export type SupabaseInstance = SupabaseClient<Database>;
// Re-export the Database type for convenience
export type { Database };
