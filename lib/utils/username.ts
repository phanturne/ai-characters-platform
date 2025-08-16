import { generateFromEmail, generateUsername } from 'unique-username-generator';

/**
 * Generates a username from an email address
 * @param email - The email address to generate username from
 * @returns A unique username based on the email
 */
export function generateUsernameFromEmail(email: string): string {
  return generateFromEmail(email, {
    randomDigits: 2,
    stripLeadingDigits: true,
    leadingFallback: 'user',
  });
}

/**
 * Generates a random username when no email is provided
 * @returns A randomly generated username
 */
export function generateRandomUsername(): string {
  return generateUsername('-', 2, 20);
}

/**
 * Generates a username, preferring email-based generation if available
 * @param email - Optional email address
 * @returns A generated username
 */
export function generateUsernameForProfile(email?: string): string {
  if (email) {
    return generateUsernameFromEmail(email);
  }
  return generateRandomUsername();
}
