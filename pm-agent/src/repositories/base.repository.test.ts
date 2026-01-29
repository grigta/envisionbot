import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseRepository, type RepositoryDeps } from './base.repository';
import type { DatabaseSync, CacheClient, PubSubClient } from '../db/index';

// Create a concrete implementation for testing
class TestRepository extends BaseRepository<{ id: string; name: string }> {
  protected readonly tableName = 'test_table';
  protected readonly cachePrefix = 'test';
  protected readonly cacheTTL = 60;
  protected readonly pubsubChannel = 'pm:events:tasks' as const;

  // Expose protected methods for testing
  public async testGetFromCache<R>(key: string) {
    return this.getFromCache<R>(key);
  }

  public async testSetCache(key: string, value: unknown, ttl?: number) {
    return this.setCache(key, value, ttl);
  }

  public async testInvalidateCache(...keys: string[]) {
    return this.invalidateCache(...keys);
  }

  public async testInvalidateCachePattern(pattern: string) {
    return this.invalidateCachePattern(pattern);
  }

  public testTransaction<R>(fn: () => R): R {
    return this.transaction(fn);
  }

  public async testTransactionAsync<R>(fn: () => Promise<R>): Promise<R> {
    return this.transactionAsync(fn);
  }

  public async testPublishEvent(eventType: string, data: unknown) {
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
  let repository: TestRepository;
  let mockDb: DatabaseSync;
  let mockCache: CacheClient;
  let mockPubsub: PubSubClient;

  beforeEach(() => {
    // Mock DatabaseSync
    mockDb = {
      prepare: vi.fn(),
      exec: vi.fn(),
    } as unknown as DatabaseSync;

    // Mock CacheClient
    mockCache = {
      get: vi.fn(),
      set: vi.fn(),
      setex: vi.fn(),
      del: vi.fn(),
      keys: vi.fn().mockResolvedValue([]),
    } as unknown as CacheClient;

    // Mock PubSubClient
    mockPubsub = {
      publish: vi.fn(),
      subscribe: vi.fn(),
    } as unknown as PubSubClient;

    const deps: RepositoryDeps = {
      db: mockDb,
      cache: mockCache,
      pubsub: mockPubsub,
    };

    repository = new TestRepository(deps);
  });

  describe('Cache operations', () => {
    describe('getFromCache', () => {
      it('should return parsed data from cache', async () => {
        const testData = { id: '1', name: 'test' };
        vi.mocked(mockCache.get).mockResolvedValue(JSON.stringify(testData));

        const result = await repository.testGetFromCache<typeof testData>('test-key');

        expect(result).toEqual(testData);
        expect(mockCache.get).toHaveBeenCalledWith('test-key');
      });

      it('should return null if cache is empty', async () => {
        vi.mocked(mockCache.get).mockResolvedValue(null);

        const result = await repository.testGetFromCache('test-key');

        expect(result).toBeNull();
      });

      it('should return null on cache error', async () => {
        vi.mocked(mockCache.get).mockRejectedValue(new Error('Cache error'));

        const result = await repository.testGetFromCache('test-key');

        expect(result).toBeNull();
      });
    });

    describe('setCache', () => {
      it('should set cache with TTL', async () => {
        const testData = { id: '1', name: 'test' };

        await repository.testSetCache('test-key', testData);

        expect(mockCache.setex).toHaveBeenCalledWith(
          'test-key',
          60,
          JSON.stringify(testData)
        );
      });

      it('should set cache with custom TTL', async () => {
        const testData = { id: '1', name: 'test' };

        await repository.testSetCache('test-key', testData, 120);

        expect(mockCache.setex).toHaveBeenCalledWith(
          'test-key',
          120,
          JSON.stringify(testData)
        );
      });

      it('should use set without TTL when TTL is 0', async () => {
        const testData = { id: '1', name: 'test' };

        await repository.testSetCache('test-key', testData, 0);

        expect(mockCache.set).toHaveBeenCalledWith(
          'test-key',
          JSON.stringify(testData)
        );
      });

      it('should handle cache set errors gracefully', async () => {
        vi.mocked(mockCache.setex).mockRejectedValue(new Error('Cache error'));
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await repository.testSetCache('test-key', { id: '1' });

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });

    describe('invalidateCache', () => {
      it('should delete cache keys', async () => {
        await repository.testInvalidateCache('key1', 'key2', 'key3');

        expect(mockCache.del).toHaveBeenCalledWith('key1', 'key2', 'key3');
      });

      it('should not call del with empty keys', async () => {
        await repository.testInvalidateCache();

        expect(mockCache.del).not.toHaveBeenCalled();
      });

      it('should handle cache deletion errors gracefully', async () => {
        vi.mocked(mockCache.del).mockRejectedValue(new Error('Cache error'));
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await repository.testInvalidateCache('key1');

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });

    describe('invalidateCachePattern', () => {
      it('should find and delete keys matching pattern', async () => {
        vi.mocked(mockCache.keys).mockResolvedValue(['test:1', 'test:2']);

        await repository.testInvalidateCachePattern('test:*');

        expect(mockCache.keys).toHaveBeenCalledWith('test:*');
        expect(mockCache.del).toHaveBeenCalledWith('test:1', 'test:2');
      });

      it('should not call del when no keys match', async () => {
        vi.mocked(mockCache.keys).mockResolvedValue([]);

        await repository.testInvalidateCachePattern('test:*');

        expect(mockCache.del).not.toHaveBeenCalled();
      });

      it('should handle pattern errors gracefully', async () => {
        vi.mocked(mockCache.keys).mockRejectedValue(new Error('Cache error'));
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await repository.testInvalidateCachePattern('test:*');

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });
  });

  describe('Transaction operations', () => {
    describe('transaction', () => {
      it('should execute function and commit', () => {
        const fn = vi.fn().mockReturnValue('result');

        const result = repository.testTransaction(fn);

        expect(mockDb.exec).toHaveBeenCalledWith('BEGIN TRANSACTION');
        expect(fn).toHaveBeenCalled();
        expect(mockDb.exec).toHaveBeenCalledWith('COMMIT');
        expect(result).toBe('result');
      });

      it('should rollback on error', () => {
        const fn = vi.fn().mockImplementation(() => {
          throw new Error('Test error');
        });

        expect(() => repository.testTransaction(fn)).toThrow('Test error');
        expect(mockDb.exec).toHaveBeenCalledWith('BEGIN TRANSACTION');
        expect(mockDb.exec).toHaveBeenCalledWith('ROLLBACK');
      });
    });

    describe('transactionAsync', () => {
      it('should execute async function and commit', async () => {
        const fn = vi.fn().mockResolvedValue('result');

        const result = await repository.testTransactionAsync(fn);

        expect(mockDb.exec).toHaveBeenCalledWith('BEGIN TRANSACTION');
        expect(fn).toHaveBeenCalled();
        expect(mockDb.exec).toHaveBeenCalledWith('COMMIT');
        expect(result).toBe('result');
      });

      it('should rollback on error', async () => {
        const fn = vi.fn().mockRejectedValue(new Error('Test error'));

        await expect(repository.testTransactionAsync(fn)).rejects.toThrow('Test error');
        expect(mockDb.exec).toHaveBeenCalledWith('BEGIN TRANSACTION');
        expect(mockDb.exec).toHaveBeenCalledWith('ROLLBACK');
      });
    });
  });

  describe('Pub/sub operations', () => {
    describe('publishEvent', () => {
      it('should publish event with correct format', async () => {
        const eventData = { id: '1', status: 'completed' };
        const beforeTimestamp = Date.now();

        await repository.testPublishEvent('test_event', eventData);

        const afterTimestamp = Date.now();

        expect(mockPubsub.publish).toHaveBeenCalledTimes(1);
        const [channel, message] = vi.mocked(mockPubsub.publish).mock.calls[0];

        expect(channel).toBe('pm:events:tasks');

        const parsedMessage = JSON.parse(message);
        expect(parsedMessage.type).toBe('test_event');
        expect(parsedMessage.data).toEqual(eventData);
        expect(parsedMessage.timestamp).toBeGreaterThanOrEqual(beforeTimestamp);
        expect(parsedMessage.timestamp).toBeLessThanOrEqual(afterTimestamp);
      });

      it('should handle publish errors gracefully', async () => {
        vi.mocked(mockPubsub.publish).mockRejectedValue(new Error('Pubsub error'));
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await repository.testPublishEvent('test_event', { id: '1' });

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });
  });

  describe('Cache key builders', () => {
    describe('entityCacheKey', () => {
      it('should build entity cache key', () => {
        const key = repository.testEntityCacheKey('123');

        expect(key).toBe('test:123');
      });
    });

    describe('listCacheKey', () => {
      it('should build list cache key without suffix', () => {
        const key = repository.testListCacheKey();

        expect(key).toBe('test:list:all');
      });

      it('should build list cache key with suffix', () => {
        const key = repository.testListCacheKey('active');

        expect(key).toBe('test:list:active');
      });
    });
  });
});
