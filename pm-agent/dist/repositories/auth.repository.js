/**
 * Auth Repository
 * Manages access codes and authentication sessions
 */
import { BaseRepository, } from "./base.repository.js";
import { compareAccessCode, hashAccessCode } from "../auth/access-code.js";
export class AuthRepository extends BaseRepository {
    tableName = "access_codes";
    cachePrefix = "auth:codes";
    cacheTTL = 300; // 5 minutes
    pubsubChannel = "pm:events:analysis"; // Reuse existing channel
    /**
     * Validate an access code and return the matching record
     * Returns null if code is invalid, expired, or inactive
     */
    async validateCode(code) {
        const rows = this.db
            .prepare("SELECT * FROM access_codes WHERE is_active = 1")
            .all();
        for (const row of rows) {
            const match = await compareAccessCode(code, row.code_hash);
            if (match) {
                // Check expiration
                if (row.expires_at && row.expires_at < Date.now()) {
                    return null;
                }
                // Update last used timestamp
                this.db
                    .prepare("UPDATE access_codes SET last_used_at = ? WHERE id = ?")
                    .run(Date.now(), row.id);
                return this.mapRow(row);
            }
        }
        return null;
    }
    /**
     * Create a new access code
     */
    async createCode(name, role, code, expiresAt) {
        const id = `ac-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const codeHash = await hashAccessCode(code);
        const now = Date.now();
        this.db
            .prepare(`
      INSERT INTO access_codes (id, code_hash, name, role, is_active, created_at, expires_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `)
            .run(id, codeHash, name, role, now, expiresAt || null);
        await this.invalidateCachePattern(`${this.cachePrefix}:*`);
        return {
            id,
            codeHash,
            name,
            role,
            isActive: true,
            createdAt: now,
            expiresAt,
        };
    }
    /**
     * Get all access codes (without hashes for security)
     */
    getAll() {
        const rows = this.db
            .prepare("SELECT * FROM access_codes ORDER BY created_at DESC")
            .all();
        return rows.map((row) => ({
            id: row.id,
            name: row.name,
            role: row.role,
            isActive: row.is_active === 1,
            lastUsedAt: row.last_used_at || undefined,
            createdAt: row.created_at,
            expiresAt: row.expires_at || undefined,
        }));
    }
    /**
     * Deactivate an access code
     */
    async deactivateCode(id) {
        const result = this.db
            .prepare("UPDATE access_codes SET is_active = 0 WHERE id = ?")
            .run(id);
        await this.invalidateCachePattern(`${this.cachePrefix}:*`);
        return result.changes > 0;
    }
    /**
     * Create an auth session record
     */
    async createSession(session) {
        const id = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        this.db
            .prepare(`
      INSERT INTO auth_sessions (id, access_code_id, token_jti, ip_address, user_agent, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
            .run(id, session.accessCodeId, session.tokenJti, session.ipAddress || null, session.userAgent || null, session.createdAt, session.expiresAt);
        return { id, ...session };
    }
    /**
     * Check if a token (by JTI) has been revoked
     */
    async isTokenRevoked(jti) {
        // Check cache first
        const cacheKey = `auth:revoked:${jti}`;
        const cached = await this.getFromCache(cacheKey);
        if (cached !== null) {
            return cached;
        }
        const row = this.db
            .prepare("SELECT revoked_at FROM auth_sessions WHERE token_jti = ?")
            .get(jti);
        const isRevoked = row?.revoked_at != null;
        // Cache the result
        await this.setCache(cacheKey, isRevoked, 60); // 1 minute cache
        return isRevoked;
    }
    /**
     * Revoke a token (logout)
     */
    async revokeToken(jti) {
        this.db
            .prepare("UPDATE auth_sessions SET revoked_at = ? WHERE token_jti = ?")
            .run(Date.now(), jti);
        // Update cache
        const cacheKey = `auth:revoked:${jti}`;
        await this.setCache(cacheKey, true, 3600); // 1 hour cache
    }
    /**
     * Clean up expired sessions (can be run periodically)
     */
    cleanupExpiredSessions() {
        const result = this.db
            .prepare("DELETE FROM auth_sessions WHERE expires_at < ?")
            .run(Date.now());
        return result.changes;
    }
    mapRow(row) {
        return {
            id: row.id,
            codeHash: row.code_hash,
            name: row.name,
            role: row.role,
            isActive: row.is_active === 1,
            lastUsedAt: row.last_used_at || undefined,
            createdAt: row.created_at,
            expiresAt: row.expires_at || undefined,
        };
    }
}
//# sourceMappingURL=auth.repository.js.map