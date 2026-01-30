/**
 * Auth Repository
 * Manages access codes and authentication sessions
 */
import { BaseRepository, type PubSubChannel } from "./base.repository.js";
export interface AccessCode {
    id: string;
    codeHash: string;
    name: string;
    role: "admin" | "user" | "readonly";
    isActive: boolean;
    lastUsedAt?: number;
    createdAt: number;
    expiresAt?: number;
}
export interface AuthSession {
    id: string;
    accessCodeId: string;
    tokenJti: string;
    ipAddress?: string;
    userAgent?: string;
    createdAt: number;
    expiresAt: number;
    revokedAt?: number;
}
export declare class AuthRepository extends BaseRepository<AccessCode> {
    protected readonly tableName = "access_codes";
    protected readonly cachePrefix = "auth:codes";
    protected readonly cacheTTL = 300;
    protected readonly pubsubChannel: PubSubChannel;
    /**
     * Validate an access code and return the matching record
     * Returns null if code is invalid, expired, or inactive
     */
    validateCode(code: string): Promise<AccessCode | null>;
    /**
     * Create a new access code
     */
    createCode(name: string, role: "admin" | "user" | "readonly", code: string, expiresAt?: number): Promise<AccessCode>;
    /**
     * Get all access codes (without hashes for security)
     */
    getAll(): Omit<AccessCode, "codeHash">[];
    /**
     * Deactivate an access code
     */
    deactivateCode(id: string): Promise<boolean>;
    /**
     * Create an auth session record
     */
    createSession(session: Omit<AuthSession, "id">): Promise<AuthSession>;
    /**
     * Check if a token (by JTI) has been revoked
     */
    isTokenRevoked(jti: string): Promise<boolean>;
    /**
     * Revoke a token (logout)
     */
    revokeToken(jti: string): Promise<void>;
    /**
     * Clean up expired sessions (can be run periodically)
     */
    cleanupExpiredSessions(): number;
    private mapRow;
}
//# sourceMappingURL=auth.repository.d.ts.map