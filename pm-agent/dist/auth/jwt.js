/**
 * JWT utilities for authentication
 */
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production-please";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
/**
 * Sign a new JWT token
 */
export function signToken(payload) {
    const jti = randomUUID();
    return jwt.sign({ ...payload, jti }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}
/**
 * Verify and decode a JWT token
 * Throws if token is invalid or expired
 */
export function verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
}
/**
 * Decode a JWT token without verification
 * Returns null if token is malformed
 */
export function decodeToken(token) {
    return jwt.decode(token);
}
//# sourceMappingURL=jwt.js.map