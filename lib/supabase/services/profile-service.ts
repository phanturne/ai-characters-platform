import type { ProfileInsert } from '@/lib/supabase/schema';
import { createClient } from '@/lib/supabase/server';
import { generateUsernameForProfile } from '@/lib/utils/username';

/**
 * Creates a profile for a newly registered user
 * @param userId - The user's ID from auth.users
 * @param email - The user's email address
 * @returns The created profile or null if creation failed
 */
export async function createProfileForUser(
  userId: string,
  email: string,
): Promise<ProfileInsert | null> {
  try {
    const supabase = await createClient();

    // Generate unique username from email
    const username = await generateUniqueUsername(email);

    // Extract display name from email (everything before @)
    const displayName = email.split('@')[0];

    // Create profile data
    const profileData: ProfileInsert = {
      user_id: userId,
      username,
      display_name: displayName,
      bio: '',
      avatar_url: null,
    };

    // Insert the profile
    const { data: profile, error } = await supabase
      .from('profiles')
      .insert(profileData)
      .select()
      .single();

    if (error) {
      console.error('Error creating profile:', error);
      return null;
    }

    return profile;
  } catch (error) {
    console.error('Error in createProfileForUser:', error);
    return null;
  }
}

/**
 * Checks if a username is already taken
 * @param username - The username to check
 * @returns True if username is available, false if taken
 */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', username)
      .single();

    if (error && error.code === 'PGRST116') {
      // No rows returned, username is available
      return true;
    }

    if (error) {
      console.error('Error checking username availability:', error);
      return false;
    }

    // Username exists, not available
    return false;
  } catch (error) {
    console.error('Error in isUsernameAvailable:', error);
    return false;
  }
}

/**
 * Generates a unique username by checking availability and retrying if needed
 * @param email - The email to base the username on
 * @param maxAttempts - Maximum number of attempts to generate a unique username
 * @returns A unique username
 */
export async function generateUniqueUsername(
  email: string,
  maxAttempts = 5,
): Promise<string> {
  let username = generateUsernameForProfile(email);
  let attempts = 0;

  while (attempts < maxAttempts) {
    if (await isUsernameAvailable(username)) {
      return username;
    }

    // Generate a new username with more random digits
    username = generateUsernameForProfile(email);
    attempts++;
  }

  // If all attempts failed, add timestamp to ensure uniqueness
  const timestamp = Date.now().toString().slice(-4);
  return `${username}${timestamp}`;
}
