const MIN_PASSWORD_LENGTH = 4;
const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,32}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validation-only auth helpers.
 *
 * Canonical authentication, sessions, profile updates, password changes, and
 * admin user management live in NextAuth/Postgres-backed API routes. This file
 * intentionally does not export legacy localStorage/Dexie auth mutations.
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateUsername(username: string): ValidationResult {
  if (!username || !username.trim()) {
    return { valid: false, error: "Username is required" };
  }
  if (!USERNAME_REGEX.test(username.trim())) {
    return { valid: false, error: "Username must be 3–32 characters (letters, numbers, underscores, hyphens)" };
  }
  return { valid: true };
}

export function validatePassword(password: string): ValidationResult {
  if (!password) {
    return { valid: false, error: "Password is required" };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` };
  }
  return { valid: true };
}

export function validateEmail(email: string): ValidationResult {
  if (!email || !email.trim()) {
    return { valid: false, error: "Email is required" };
  }
  if (!EMAIL_REGEX.test(email.trim())) {
    return { valid: false, error: "Please enter a valid email address" };
  }
  return { valid: true };
}
