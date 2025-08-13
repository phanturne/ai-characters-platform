import { createBrowserClient } from '@supabase/ssr';
import { hasSupabaseEnvVars } from './env';

export function createClient() {
  if (!hasSupabaseEnvVars()) {
    throw new Error('Missing Supabase environment variables');
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
