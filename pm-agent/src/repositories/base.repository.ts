/**
 * Base Repository with common functionality
 * - Cache helpers (get/set/invalidate)
 * - Transaction wrappers
 * - Pub/sub event publishing
 */

import type { RepositoryDeps, DatabaseSync, CacheClient, PubSubClient } from "../db/index.js";
import type Database from "better-sqlite3";

export type PubSubChannel =
  | "pm:events:projects"
  | "pm:events:tasks"
  | "pm:events:actions"
  | "pm:events:ideas"
  | "pm:events:chat"
  | "pm:events:analysis";

export abstract class BaseRepository<T> {
  protected readonly db: DatabaseSync;
  protected readonly cache: CacheClient;
  protected readonly pubsub: PubSubClient;

  protected abstract readonly tableName: string;
  protected abstract readonly cachePrefix: string;
  protected abstract readonly cacheTTL: number; // seconds
  protected abstract readonly pubsubChannel: PubSubChannel;

  constructor(deps: RepositoryDeps) {
    this.db = deps.db;
    this.cache = deps.cache;
    this.pubsub = deps.pubsub;
  }

  // ==========================================
  // Cache helpers
  // ==========================================

  protected async getFromCache<R>(key: string): Promise<R | null> {
    try {
      const cached = await this.cache.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  }

  protected async setCache(key: string, value: unknown, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      const effectiveTTL = ttl ?? this.cacheTTL;
      if (effectiveTTL > 0) {
        await this.cache.setex(key, effectiveTTL, serialized);
      } else {
        await this.cache.set(key, serialized);
      }
    } catch (error) {
      console.warn(`Cache set failed for ${key}:`, error);
    }
  }

  protected async invalidateCache(...keys: string[]): Promise<void> {
    try {
      if (keys.length > 0) {
        await this.cache.del(...keys);
      }
    } catch (error) {
      console.warn("Cache invalidation failed:", error);
    }
  }

  protected async invalidateCachePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.cache.keys(pattern);
      if (keys.length > 0) {
        await this.cache.del(...keys);
      }
    } catch (error) {
      console.warn(`Cache pattern invalidation failed for ${pattern}:`, error);
    }
  }

  // ==========================================
  // Transaction helpers
  // ==========================================

  protected transaction<R>(fn: () => R): R {
    this.db.exec("BEGIN TRANSACTION");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  protected async transactionAsync<R>(fn: () => Promise<R>): Promise<R> {
    this.db.exec("BEGIN TRANSACTION");
    try {
      const result = await fn();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  // ==========================================
  // Pub/sub helpers
  // ==========================================

  protected async publishEvent(
    eventType: string,
    data: unknown
  ): Promise<void> {
    try {
      const event = {
        type: eventType,
        timestamp: Date.now(),
        data,
      };
      await this.pubsub.publish(this.pubsubChannel, JSON.stringify(event));
    } catch (error) {
      console.warn(`Publish event failed for ${eventType}:`, error);
    }
  }

  // ==========================================
  // Common cache key builders
  // ==========================================

  protected entityCacheKey(id: string): string {
    return `${this.cachePrefix}:${id}`;
  }

  protected listCacheKey(suffix?: string): string {
    return suffix ? `${this.cachePrefix}:list:${suffix}` : `${this.cachePrefix}:list:all`;
  }
}

export type { RepositoryDeps };
