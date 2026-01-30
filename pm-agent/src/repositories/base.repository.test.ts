/**
 * Tests for BaseRepository
 * Tests cache helpers, transaction wrappers, and pub/sub functionality
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { BaseRepository, type RepositoryDeps, type PubSubChannel } from "./base.repository.js";
import type { DatabaseSync, CacheClient, PubSubClient } from "../db/index.js";

// Test implementation of BaseRepository
class TestRepository extends BaseRepository<{ id: string; name: string }> {
  protected readonly tableName = "test_table";
  protected readonly cachePrefix = "test:entity";
  protected readonly cacheTTL = 300;
  protected readonly pubsubChannel: PubSubChannel = "pm:events:projects";

  // Expose protected methods for testing
  public async testGetFromCache<R>(key: string): Promise<R | null> {
    return this.getFromCache<R>(key);
  }

  public async testSetCache(key: string, value: unknown, ttl?: number): Promise<void> {
    return this.setCache(key, value, ttl);
  }

  public async testInvalidateCache(...keys: string[]): Promise<void> {
    return this.invalidateCache(...keys);
  }

  public async testInvalidateCachePattern(pattern: string): Promise<void> {
    return this.invalidateCachePattern(pattern);
  }

  public testTransaction<R>(fn: () => R): R {
    return this.transaction(fn);
  }

  public async testTransactionAsync<R>(fn: () => Promise<R>): Promise<R> {
    return this.transactionAsync(fn);
  }

  public async testPublishEvent(eventType: string, data: unknown): Promise<void> {
    return this.publishEvent(eventType, data);
  }

  public testEntityCacheKey(id: string): string {
    return this.entityCacheKey(id);
  }

  public testListCacheKey(suffix?: string): string {
    return this.listCacheKey(suffix);
  }
}

describe("BaseRepository", () => {
  let mockDb: DatabaseSync;
  let mockCache: CacheClient;
  let mockPubSub: PubSubClient;
  let repository: TestRepository;

  beforeEach(() => {
    // Create mock database
    mockDb = {
      prepare: vi.fn(() => ({
        run: vi.fn(),
        get: vi.fn(),
        all: vi.fn(() => []),
      })),
      exec: vi.fn(),
      close: vi.fn(),
    } as unknown as DatabaseSync;

    // Create mock cache
    mockCache = {
      get: vi.fn(),
      set: vi.fn(),
      setex: vi.fn(),
      del: vi.fn(),
      keys: vi.fn(),
    } as unknown as CacheClient;

    // Create mock pub/sub
    mockPubSub = {
      publish: vi.fn(),
      subscribe: vi.fn(),
      on: vi.fn(),
    } as unknown as PubSubClient;

    const deps: RepositoryDeps = {
      db: mockDb,
      cache: mockCache,
      pubsub: mockPubSub,
    };

    repository = new TestRepository(deps);
  });

  describe("Cache Helpers", () => {
    describe("getFromCache", () => {
      it("should return cached data when available", async () => {
        const testData = { id: "1", name: "Test" };
        vi.mocked(mockCache.get).mockResolvedValue(JSON.stringify(testData));

        const result = await repository.testGetFromCache<typeof testData>("test:key");

        expect(result).toEqual(testData);
        expect(mockCache.get).toHaveBeenCalledWith("test:key");
      });

      it("should return null when cache is empty", async () => {
        vi.mocked(mockCache.get).mockResolvedValue(null);

        const result = await repository.testGetFromCache("test:key");

        expect(result).toBeNull();
      });

      it("should return null on cache error", async () => {
        vi.mocked(mockCache.get).mockRejectedValue(new Error("Cache error"));

        const result = await repository.testGetFromCache("test:key");

        expect(result).toBeNull();
      });

      it("should return null on invalid JSON", async () => {
        vi.mocked(mockCache.get).mockResolvedValue("invalid json{");

        const result = await repository.testGetFromCache("test:key");

        expect(result).toBeNull();
      });
    });

    describe("setCache", () => {
      it("should set cache with TTL", async () => {
        const testData = { id: "1", name: "Test" };

        await repository.testSetCache("test:key", testData, 60);

        expect(mockCache.setex).toHaveBeenCalledWith("test:key", 60, JSON.stringify(testData));
      });

      it("should use default TTL when not specified", async () => {
        const testData = { id: "1", name: "Test" };

        await repository.testSetCache("test:key", testData);

        expect(mockCache.setex).toHaveBeenCalledWith("test:key", 300, JSON.stringify(testData));
      });

      it("should use set without TTL when TTL is 0", async () => {
        const testData = { id: "1", name: "Test" };

        await repository.testSetCache("test:key", testData, 0);

        expect(mockCache.set).toHaveBeenCalledWith("test:key", JSON.stringify(testData));
        expect(mockCache.setex).not.toHaveBeenCalled();
      });

      it("should handle cache write errors gracefully", async () => {
        vi.mocked(mockCache.setex).mockRejectedValue(new Error("Cache error"));
        const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        await repository.testSetCache("test:key", { id: "1" });

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });

    describe("invalidateCache", () => {
      it("should delete single cache key", async () => {
        await repository.testInvalidateCache("test:key");

        expect(mockCache.del).toHaveBeenCalledWith("test:key");
      });

      it("should delete multiple cache keys", async () => {
        await repository.testInvalidateCache("test:key1", "test:key2", "test:key3");

        expect(mockCache.del).toHaveBeenCalledWith("test:key1", "test:key2", "test:key3");
      });

      it("should not call del with empty keys", async () => {
        await repository.testInvalidateCache();

        expect(mockCache.del).not.toHaveBeenCalled();
      });

      it("should handle cache invalidation errors gracefully", async () => {
        vi.mocked(mockCache.del).mockRejectedValue(new Error("Cache error"));
        const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        await repository.testInvalidateCache("test:key");

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });

    describe("invalidateCachePattern", () => {
      it("should find and delete keys matching pattern", async () => {
        vi.mocked(mockCache.keys).mockResolvedValue(["test:1", "test:2", "test:3"]);

        await repository.testInvalidateCachePattern("test:*");

        expect(mockCache.keys).toHaveBeenCalledWith("test:*");
        expect(mockCache.del).toHaveBeenCalledWith("test:1", "test:2", "test:3");
      });

      it("should not call del when no keys found", async () => {
        vi.mocked(mockCache.keys).mockResolvedValue([]);

        await repository.testInvalidateCachePattern("test:*");

        expect(mockCache.del).not.toHaveBeenCalled();
      });

      it("should handle errors gracefully", async () => {
        vi.mocked(mockCache.keys).mockRejectedValue(new Error("Cache error"));
        const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        await repository.testInvalidateCachePattern("test:*");

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });
  });

  describe("Transaction Helpers", () => {
    describe("transaction (synchronous)", () => {
      it("should execute function and commit", () => {
        const fn = vi.fn(() => "result");

        const result = repository.testTransaction(fn);

        expect(mockDb.exec).toHaveBeenNthCalledWith(1, "BEGIN TRANSACTION");
        expect(fn).toHaveBeenCalled();
        expect(mockDb.exec).toHaveBeenNthCalledWith(2, "COMMIT");
        expect(result).toBe("result");
      });

      it("should rollback on error", () => {
        const fn = vi.fn(() => {
          throw new Error("Test error");
        });

        expect(() => repository.testTransaction(fn)).toThrow("Test error");
        expect(mockDb.exec).toHaveBeenNthCalledWith(1, "BEGIN TRANSACTION");
        expect(mockDb.exec).toHaveBeenNthCalledWith(2, "ROLLBACK");
      });

      it("should return function result", () => {
        const result = repository.testTransaction(() => 42);

        expect(result).toBe(42);
      });
    });

    describe("transactionAsync (asynchronous)", () => {
      it("should execute async function and commit", async () => {
        const fn = vi.fn(async () => "result");

        const result = await repository.testTransactionAsync(fn);

        expect(mockDb.exec).toHaveBeenNthCalledWith(1, "BEGIN TRANSACTION");
        expect(fn).toHaveBeenCalled();
        expect(mockDb.exec).toHaveBeenNthCalledWith(2, "COMMIT");
        expect(result).toBe("result");
      });

      it("should rollback on async error", async () => {
        const fn = vi.fn(async () => {
          throw new Error("Async error");
        });

        await expect(repository.testTransactionAsync(fn)).rejects.toThrow("Async error");
        expect(mockDb.exec).toHaveBeenNthCalledWith(1, "BEGIN TRANSACTION");
        expect(mockDb.exec).toHaveBeenNthCalledWith(2, "ROLLBACK");
      });

      it("should return async function result", async () => {
        const result = await repository.testTransactionAsync(async () => 42);

        expect(result).toBe(42);
      });
    });
  });

  describe("Pub/Sub Helpers", () => {
    describe("publishEvent", () => {
      it("should publish event with correct structure", async () => {
        const data = { id: "1", name: "Test" };

        await repository.testPublishEvent("test_event", data);

        expect(mockPubSub.publish).toHaveBeenCalledWith(
          "pm:events:projects",
          expect.stringContaining('"type":"test_event"')
        );

        const publishCall = vi.mocked(mockPubSub.publish).mock.calls[0];
        const publishedData = JSON.parse(publishCall[1] as string);

        expect(publishedData).toMatchObject({
          type: "test_event",
          data,
        });
        expect(publishedData.timestamp).toBeDefined();
        expect(typeof publishedData.timestamp).toBe("number");
      });

      it("should handle publish errors gracefully", async () => {
        vi.mocked(mockPubSub.publish).mockRejectedValue(new Error("Publish error"));
        const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        await repository.testPublishEvent("test_event", { id: "1" });

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });
  });

  describe("Cache Key Builders", () => {
    describe("entityCacheKey", () => {
      it("should build entity cache key", () => {
        const key = repository.testEntityCacheKey("123");

        expect(key).toBe("test:entity:123");
      });

      it("should handle different IDs", () => {
        expect(repository.testEntityCacheKey("abc-123")).toBe("test:entity:abc-123");
        expect(repository.testEntityCacheKey("uuid-v4")).toBe("test:entity:uuid-v4");
      });
    });

    describe("listCacheKey", () => {
      it("should build list cache key without suffix", () => {
        const key = repository.testListCacheKey();

        expect(key).toBe("test:entity:list:all");
      });

      it("should build list cache key with suffix", () => {
        const key = repository.testListCacheKey("pending");

        expect(key).toBe("test:entity:list:pending");
      });

      it("should handle different suffixes", () => {
        expect(repository.testListCacheKey("active")).toBe("test:entity:list:active");
        expect(repository.testListCacheKey("project:123")).toBe("test:entity:list:project:123");
      });
    });
  });
});
