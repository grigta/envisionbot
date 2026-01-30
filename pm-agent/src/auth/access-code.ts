/**
 * Access code utilities for authentication
 */

import bcrypt from "bcrypt";

const SALT_ROUNDS = 12;

// Characters for code generation (excluding confusing chars: 0,O,1,I,L)
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/**
 * Validate access code format: XXXX-XXXX-XXXX (alphanumeric)
 */
export function validateAccessCodeFormat(code: string): boolean {
  const pattern = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i;
  return pattern.test(code);
}

/**
 * Normalize access code: uppercase, ensure dashes
 * Returns empty string if code is invalid length
 */
export function normalizeAccessCode(code: string): string {
  // Remove all non-alphanumeric, uppercase
  const clean = code.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  if (clean.length !== 12) return "";
  return `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}`;
}

/**
 * Hash an access code using bcrypt
 */
export async function hashAccessCode(code: string): Promise<string> {
  const normalized = normalizeAccessCode(code);
  if (!normalized) {
    throw new Error("Invalid access code format");
  }
  return bcrypt.hash(normalized, SALT_ROUNDS);
}

/**
 * Compare a plain access code with a bcrypt hash
 */
export async function compareAccessCode(
  code: string,
  hash: string
): Promise<boolean> {
  const normalized = normalizeAccessCode(code);
  if (!normalized) return false;
  return bcrypt.compare(normalized, hash);
}

/**
 * Generate a random access code in XXXX-XXXX-XXXX format
 */
export function generateAccessCode(): string {
  let code = "";
  for (let i = 0; i < 12; i++) {
    code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
  }
  return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`;
}
