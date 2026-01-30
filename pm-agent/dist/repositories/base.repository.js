/**
 * Base Repository with common functionality
 * - Cache helpers (get/set/invalidate)
 * - Transaction wrappers
 * - Pub/sub event publishing
 */
export class BaseRepository {
    db;
    cache;
    pubsub;
    constructor(deps) {
        this.db = deps.db;
        this.cache = deps.cache;
        this.pubsub = deps.pubsub;
    }
    // ==========================================
    // Cache helpers
    // ==========================================
    async getFromCache(key) {
        try {
            const cached = await this.cache.get(key);
            return cached ? JSON.parse(cached) : null;
        }
        catch {
            return null;
        }
    }
    async setCache(key, value, ttl) {
        try {
            const serialized = JSON.stringify(value);
            const effectiveTTL = ttl ?? this.cacheTTL;
            if (effectiveTTL > 0) {
                await this.cache.setex(key, effectiveTTL, serialized);
            }
            else {
                await this.cache.set(key, serialized);
            }
        }
        catch (error) {
            console.warn(`Cache set failed for ${key}:`, error);
        }
    }
    async invalidateCache(...keys) {
        try {
            if (keys.length > 0) {
                await this.cache.del(...keys);
            }
        }
        catch (error) {
            console.warn("Cache invalidation failed:", error);
        }
    }
    async invalidateCachePattern(pattern) {
        try {
            const keys = await this.cache.keys(pattern);
            if (keys.length > 0) {
                await this.cache.del(...keys);
            }
        }
        catch (error) {
            console.warn(`Cache pattern invalidation failed for ${pattern}:`, error);
        }
    }
    // ==========================================
    // Transaction helpers
    // ==========================================
    transaction(fn) {
        this.db.exec("BEGIN TRANSACTION");
        try {
            const result = fn();
            this.db.exec("COMMIT");
            return result;
        }
        catch (error) {
            this.db.exec("ROLLBACK");
            throw error;
        }
    }
    async transactionAsync(fn) {
        this.db.exec("BEGIN TRANSACTION");
        try {
            const result = await fn();
            this.db.exec("COMMIT");
            return result;
        }
        catch (error) {
            this.db.exec("ROLLBACK");
            throw error;
        }
    }
    // ==========================================
    // Pub/sub helpers
    // ==========================================
    async publishEvent(eventType, data) {
        try {
            const event = {
                type: eventType,
                timestamp: Date.now(),
                data,
            };
            await this.pubsub.publish(this.pubsubChannel, JSON.stringify(event));
        }
        catch (error) {
            console.warn(`Publish event failed for ${eventType}:`, error);
        }
    }
    // ==========================================
    // Common cache key builders
    // ==========================================
    entityCacheKey(id) {
        return `${this.cachePrefix}:${id}`;
    }
    listCacheKey(suffix) {
        return suffix ? `${this.cachePrefix}:list:${suffix}` : `${this.cachePrefix}:list:all`;
    }
}
//# sourceMappingURL=base.repository.js.map