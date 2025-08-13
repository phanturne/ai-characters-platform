import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { hasSupabaseEnvVars } from './env';

export async function createClient() {
  const cookieStore = await cookies();

  if (!hasSupabaseEnvVars()) {
    throw new Error(
      'Missing Supabase environment variables. Please check your .env.local file.',
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
}
