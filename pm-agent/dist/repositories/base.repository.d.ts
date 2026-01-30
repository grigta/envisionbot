/**
 * Base Repository with common functionality
 * - Cache helpers (get/set/invalidate)
 * - Transaction wrappers
 * - Pub/sub event publishing
 */
import type { RepositoryDeps, DatabaseSync, CacheClient, PubSubClient } from "../db/index.js";
export type PubSubChannel = "pm:events:projects" | "pm:events:tasks" | "pm:events:actions" | "pm:events:ideas" | "pm:events:chat" | "pm:events:analysis" | "pm:events:news";
export declare abstract class BaseRepository<T> {
    protected readonly db: DatabaseSync;
    protected readonly cache: CacheClient;
    protected readonly pubsub: PubSubClient;
    protected abstract readonly tableName: string;
    protected abstract readonly cachePrefix: string;
    protected abstract readonly cacheTTL: number;
    protected abstract readonly pubsubChannel: PubSubChannel;
    constructor(deps: RepositoryDeps);
    protected getFromCache<R>(key: string): Promise<R | null>;
    protected setCache(key: string, value: unknown, ttl?: number): Promise<void>;
    protected invalidateCache(...keys: string[]): Promise<void>;
    protected invalidateCachePattern(pattern: string): Promise<void>;
    protected transaction<R>(fn: () => R): R;
    protected transactionAsync<R>(fn: () => Promise<R>): Promise<R>;
    protected publishEvent(eventType: string, data: unknown): Promise<void>;
    protected entityCacheKey(id: string): string;
    protected listCacheKey(suffix?: string): string;
}
export type { RepositoryDeps };
//# sourceMappingURL=base.repository.d.ts.map