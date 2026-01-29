/**
 * JWT utilities for authentication
 */

import jwt, { type SignOptions } from "jsonwebtoken";
import { randomUUID } from "crypto";

export interface JWTPayload {
  sub: string; // access_code_id
  name: string; // Display name
  role: string; // admin | user | readonly
  jti: string; // Unique token ID
  iat: number; // Issued at
  exp: number; // Expires at
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// Validate JWT_SECRET is set
if (!JWT_SECRET) {
  throw new Error(
    "JWT_SECRET environment variable is required for authentication. " +
    "Please set a secure random string in your .env file.\n" +
    "Example: JWT_SECRET=$(openssl rand -base64 32)"
  );
}

// Warn if using a weak or default secret
if (JWT_SECRET.length < 32) {
  console.warn(
    "⚠️  WARNING: JWT_SECRET is too short (< 32 characters). " +
    "Use a strong random secret for production.\n" +
    "Generate one with: openssl rand -base64 32"
  );
}

/**
 * Sign a new JWT token
 */
export function signToken(
  payload: Omit<JWTPayload, "jti" | "iat" | "exp">
): string {
  const jti = randomUUID();
  return jwt.sign(
    { ...payload, jti },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] }
  );
}

/**
 * Verify and decode a JWT token
 * Throws if token is invalid or expired
 */
export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

/**
 * Decode a JWT token without verification
 * Returns null if token is malformed
 */
export function decodeToken(token: string): JWTPayload | null {
  return jwt.decode(token) as JWTPayload | null;
}
