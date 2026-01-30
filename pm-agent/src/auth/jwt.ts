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

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production-please";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

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
