import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseRepository, type RepositoryDeps } from './base.repository';
import type { DatabaseSync, CacheClient, PubSubClient } from '../db/index';

// Concrete implementation for testing
class TestRepository extends BaseRepository<{ id: string; name: string }> {
  protected readonly tableName = 'test_table';
  protected readonly cachePrefix = 'test';
  protected readonly cacheTTL = 60;
  protected readonly pubsubChannel = 'pm:events:projects' as const;

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

describe('BaseRepository', () => {
  let mockDb: DatabaseSync;
  let mockCache: CacheClient;
  let mockPubsub: PubSubClient;
  let deps: RepositoryDeps;
  let repository: TestRepository;

  beforeEach(() => {
    // Mock database
    mockDb = {
      prepare: vi.fn(),
      exec: vi.fn(),
    } as any;

    // Mock cache
    mockCache = {
      get: vi.fn(),
      set: vi.fn(),
      setex: vi.fn(),
      del: vi.fn(),
      keys: vi.fn(),
    } as any;

    // Mock pubsub
    mockPubsub = {
      publish: vi.fn(),
    } as any;

    deps = {
      db: mockDb,
      cache: mockCache,
      pubsub: mockPubsub,
    };

    repository = new TestRepository(deps);
  });

  describe('Cache Operations', () => {
    describe('getFromCache', () => {
      it('should return parsed value from cache', async () => {
        const testData = { id: '1', name: 'Test' };
        vi.mocked(mockCache.get).mockResolvedValue(JSON.stringify(testData));

        const result = await repository.testGetFromCache<typeof testData>('test-key');

        expect(result).toEqual(testData);
        expect(mockCache.get).toHaveBeenCalledWith('test-key');
      });

      it('should return null if cache returns null', async () => {
        vi.mocked(mockCache.get).mockResolvedValue(null);

        const result = await repository.testGetFromCache('test-key');

        expect(result).toBeNull();
      });

      it('should return null on cache error', async () => {
        vi.mocked(mockCache.get).mockRejectedValue(new Error('Cache error'));

        const result = await repository.testGetFromCache('test-key');

        expect(result).toBeNull();
      });

      it('should return null on invalid JSON', async () => {
        vi.mocked(mockCache.get).mockResolvedValue('invalid json {');

        const result = await repository.testGetFromCache('test-key');

        expect(result).toBeNull();
      });
    });

    describe('setCache', () => {
      it('should serialize and store value with TTL', async () => {
        const testData = { id: '1', name: 'Test' };

        await repository.testSetCache('test-key', testData);

        expect(mockCache.setex).toHaveBeenCalledWith(
          'test-key',
          60, // default TTL
          JSON.stringify(testData)
        );
      });

      it('should use custom TTL when provided', async () => {
        const testData = { id: '1', name: 'Test' };

        await repository.testSetCache('test-key', testData, 120);

        expect(mockCache.setex).toHaveBeenCalledWith(
          'test-key',
          120,
          JSON.stringify(testData)
        );
      });

      it('should use set without expiry for TTL = 0', async () => {
        const testData = { id: '1', name: 'Test' };

        await repository.testSetCache('test-key', testData, 0);

        expect(mockCache.set).toHaveBeenCalledWith(
          'test-key',
          JSON.stringify(testData)
        );
        expect(mockCache.setex).not.toHaveBeenCalled();
      });

      it('should handle cache errors gracefully', async () => {
        vi.mocked(mockCache.setex).mockRejectedValue(new Error('Cache error'));
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await repository.testSetCache('test-key', { data: 'test' });

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });

    describe('invalidateCache', () => {
      it('should delete specified cache keys', async () => {
        await repository.testInvalidateCache('key1', 'key2', 'key3');

        expect(mockCache.del).toHaveBeenCalledWith('key1', 'key2', 'key3');
      });

      it('should not call del when no keys provided', async () => {
        await repository.testInvalidateCache();

        expect(mockCache.del).not.toHaveBeenCalled();
      });

      it('should handle cache errors gracefully', async () => {
        vi.mocked(mockCache.del).mockRejectedValue(new Error('Delete error'));
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await repository.testInvalidateCache('key1');

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });

    describe('invalidateCachePattern', () => {
      it('should find and delete keys matching pattern', async () => {
        vi.mocked(mockCache.keys).mockResolvedValue(['test:1', 'test:2', 'test:3']);

        await repository.testInvalidateCachePattern('test:*');

        expect(mockCache.keys).toHaveBeenCalledWith('test:*');
        expect(mockCache.del).toHaveBeenCalledWith('test:1', 'test:2', 'test:3');
      });

      it('should not call del when no keys match pattern', async () => {
        vi.mocked(mockCache.keys).mockResolvedValue([]);

        await repository.testInvalidateCachePattern('test:*');

        expect(mockCache.del).not.toHaveBeenCalled();
      });

      it('should handle pattern matching errors gracefully', async () => {
        vi.mocked(mockCache.keys).mockRejectedValue(new Error('Pattern error'));
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await repository.testInvalidateCachePattern('test:*');

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });
  });

  describe('Transaction Operations', () => {
    describe('transaction', () => {
      it('should execute function within transaction and commit', () => {
        const fn = vi.fn(() => 'result');

        const result = repository.testTransaction(fn);

        expect(mockDb.exec).toHaveBeenCalledWith('BEGIN TRANSACTION');
        expect(fn).toHaveBeenCalled();
        expect(mockDb.exec).toHaveBeenCalledWith('COMMIT');
        expect(result).toBe('result');
      });

      it('should rollback on error', () => {
        const error = new Error('Transaction error');
        const fn = vi.fn(() => {
          throw error;
        });

        expect(() => repository.testTransaction(fn)).toThrow(error);
        expect(mockDb.exec).toHaveBeenCalledWith('BEGIN TRANSACTION');
        expect(mockDb.exec).toHaveBeenCalledWith('ROLLBACK');
        expect(mockDb.exec).not.toHaveBeenCalledWith('COMMIT');
      });

      it('should return value from transaction function', () => {
        const fn = () => ({ id: '1', value: 42 });

        const result = repository.testTransaction(fn);

        expect(result).toEqual({ id: '1', value: 42 });
      });
    });

    describe('transactionAsync', () => {
      it('should execute async function within transaction and commit', async () => {
        const fn = vi.fn(async () => 'result');

        const result = await repository.testTransactionAsync(fn);

        expect(mockDb.exec).toHaveBeenCalledWith('BEGIN TRANSACTION');
        expect(fn).toHaveBeenCalled();
        expect(mockDb.exec).toHaveBeenCalledWith('COMMIT');
        expect(result).toBe('result');
      });

      it('should rollback on async error', async () => {
        const error = new Error('Async transaction error');
        const fn = vi.fn(async () => {
          throw error;
        });

        await expect(repository.testTransactionAsync(fn)).rejects.toThrow(error);
        expect(mockDb.exec).toHaveBeenCalledWith('BEGIN TRANSACTION');
        expect(mockDb.exec).toHaveBeenCalledWith('ROLLBACK');
        expect(mockDb.exec).not.toHaveBeenCalledWith('COMMIT');
      });

      it('should return value from async transaction function', async () => {
        const fn = async () => ({ id: '1', value: 42 });

        const result = await repository.testTransactionAsync(fn);

        expect(result).toEqual({ id: '1', value: 42 });
      });
    });
  });

  describe('PubSub Operations', () => {
    describe('publishEvent', () => {
      it('should publish event with correct structure', async () => {
        const data = { id: '1', name: 'Test' };
        const beforeTime = Date.now();

        await repository.testPublishEvent('test_event', data);

        const afterTime = Date.now();

        expect(mockPubsub.publish).toHaveBeenCalledTimes(1);
        const [channel, message] = vi.mocked(mockPubsub.publish).mock.calls[0];

        expect(channel).toBe('pm:events:projects');

        const parsed = JSON.parse(message as string);
        expect(parsed.type).toBe('test_event');
        expect(parsed.data).toEqual(data);
        expect(parsed.timestamp).toBeGreaterThanOrEqual(beforeTime);
        expect(parsed.timestamp).toBeLessThanOrEqual(afterTime);
      });

      it('should handle publish errors gracefully', async () => {
        vi.mocked(mockPubsub.publish).mockRejectedValue(new Error('Publish error'));
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await repository.testPublishEvent('test_event', { data: 'test' });

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });
  });

  describe('Cache Key Builders', () => {
    describe('entityCacheKey', () => {
      it('should build entity cache key with prefix', () => {
        const key = repository.testEntityCacheKey('123');

        expect(key).toBe('test:123');
      });

      it('should handle special characters in ID', () => {
        const key = repository.testEntityCacheKey('project-123');

        expect(key).toBe('test:project-123');
      });
    });

    describe('listCacheKey', () => {
      it('should build list cache key without suffix', () => {
        const key = repository.testListCacheKey();

        expect(key).toBe('test:list:all');
      });

      it('should build list cache key with suffix', () => {
        const key = repository.testListCacheKey('pending');

        expect(key).toBe('test:list:pending');
      });

      it('should handle complex suffix', () => {
        const key = repository.testListCacheKey('project-123:pending');

        expect(key).toBe('test:list:project-123:pending');
      });
    });
  });

  describe('Repository Configuration', () => {
    it('should have correct table name', () => {
      expect((repository as any).tableName).toBe('test_table');
    });

    it('should have correct cache prefix', () => {
      expect((repository as any).cachePrefix).toBe('test');
    });

    it('should have correct cache TTL', () => {
      expect((repository as any).cacheTTL).toBe(60);
    });

    it('should have correct pubsub channel', () => {
      expect((repository as any).pubsubChannel).toBe('pm:events:projects');
    });
  });
});
