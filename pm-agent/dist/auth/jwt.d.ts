/**
 * JWT utilities for authentication
 */
export interface JWTPayload {
    sub: string;
    name: string;
    role: string;
    jti: string;
    iat: number;
    exp: number;
}
/**
 * Sign a new JWT token
 */
export declare function signToken(payload: Omit<JWTPayload, "jti" | "iat" | "exp">): string;
/**
 * Verify and decode a JWT token
 * Throws if token is invalid or expired
 */
export declare function verifyToken(token: string): JWTPayload;
/**
 * Decode a JWT token without verification
 * Returns null if token is malformed
 */
export declare function decodeToken(token: string): JWTPayload | null;
//# sourceMappingURL=jwt.d.ts.map