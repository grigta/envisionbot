import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StateRepository } from './state.repository';
import type { DatabaseSync, CacheClient, PubSubClient } from '../db/index';

describe('StateRepository', () => {
  let repository: StateRepository;
  let mockDb: DatabaseSync;
  let mockCache: CacheClient;
  let mockPubsub: PubSubClient;
  let mockPrepare: ReturnType<typeof vi.fn>;
  let mockStmt: {
    get: ReturnType<typeof vi.fn>;
    run: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockStmt = {
      get: vi.fn(),
      run: vi.fn(),
    };

    mockPrepare = vi.fn().mockReturnValue(mockStmt);

    mockDb = {
      prepare: mockPrepare,
      exec: vi.fn(),
    } as unknown as DatabaseSync;

    mockCache = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn(),
      setex: vi.fn(),
      del: vi.fn(),
      keys: vi.fn().mockResolvedValue([]),
    } as unknown as CacheClient;

    mockPubsub = {
      publish: vi.fn(),
      subscribe: vi.fn(),
    } as unknown as PubSubClient;

    repository = new StateRepository({
      db: mockDb,
      cache: mockCache,
      pubsub: mockPubsub,
    });
  });

  describe('get', () => {
    it('should return value from database', async () => {
      mockStmt.get.mockReturnValue({ value: '"test-value"' });

      const result = await repository.get<string>('test-key');

      expect(result).toBe('test-value');
      expect(mockPrepare).toHaveBeenCalledWith(
        'SELECT value FROM agent_state WHERE key = ?'
      );
      expect(mockStmt.get).toHaveBeenCalledWith('test-key');
    });

    it('should return cached value if available', async () => {
      vi.mocked(mockCache.get).mockResolvedValue('"cached-value"');

      const result = await repository.get<string>('test-key');

      expect(result).toBe('cached-value');
      expect(mockPrepare).not.toHaveBeenCalled();
    });

    it('should return undefined when key not found', async () => {
      mockStmt.get.mockReturnValue(undefined);

      const result = await repository.get('nonexistent');

      expect(result).toBeUndefined();
    });

    it('should cache value after fetching', async () => {
      mockStmt.get.mockReturnValue({ value: '"test-value"' });

      await repository.get('test-key');

      expect(mockCache.setex).toHaveBeenCalledWith(
        'pm:state:test-key',
        60,
        '"test-value"'
      );
    });

    it('should handle complex objects', async () => {
      const complexObject = { nested: { data: [1, 2, 3] } };
      mockStmt.get.mockReturnValue({ value: JSON.stringify(complexObject) });

      const result = await repository.get<typeof complexObject>('test-key');

      expect(result).toEqual(complexObject);
    });
  });

  describe('set', () => {
    it('should set value in database', async () => {
      mockStmt.run.mockReturnValue({ changes: 1 });
      const timestamp = Date.now();

      await repository.set('test-key', 'test-value');

      expect(mockPrepare).toHaveBeenCalled();
      const sql = mockPrepare.mock.calls[0][0];
      expect(sql).toContain('INSERT INTO agent_state');
      expect(sql).toContain('ON CONFLICT(key) DO UPDATE');

      expect(mockStmt.run).toHaveBeenCalled();
      const [key, value, updatedAt] = mockStmt.run.mock.calls[0];
      expect(key).toBe('test-key');
      expect(value).toBe('"test-value"');
      expect(updatedAt).toBeGreaterThanOrEqual(timestamp);
    });

    it('should invalidate cache after set', async () => {
      mockStmt.run.mockReturnValue({ changes: 1 });

      await repository.set('test-key', 'test-value');

      expect(mockCache.del).toHaveBeenCalledWith('pm:state:test-key');
    });

    it('should handle complex objects', async () => {
      mockStmt.run.mockReturnValue({ changes: 1 });
      const complexObject = { nested: { data: [1, 2, 3] } };

      await repository.set('test-key', complexObject);

      expect(mockStmt.run).toHaveBeenCalled();
      const [, value] = mockStmt.run.mock.calls[0];
      expect(JSON.parse(value)).toEqual(complexObject);
    });
  });

  describe('delete', () => {
    it('should delete key from database', async () => {
      mockStmt.run.mockReturnValue({ changes: 1 });

      const result = await repository.delete('test-key');

      expect(result).toBe(true);
      expect(mockPrepare).toHaveBeenCalledWith(
        'DELETE FROM agent_state WHERE key = ?'
      );
      expect(mockStmt.run).toHaveBeenCalledWith('test-key');
    });

    it('should return false when key not found', async () => {
      mockStmt.run.mockReturnValue({ changes: 0 });

      const result = await repository.delete('nonexistent');

      expect(result).toBe(false);
    });

    it('should invalidate cache after delete', async () => {
      mockStmt.run.mockReturnValue({ changes: 1 });

      await repository.delete('test-key');

      expect(mockCache.del).toHaveBeenCalledWith('pm:state:test-key');
    });

    it('should not invalidate cache when key not found', async () => {
      mockStmt.run.mockReturnValue({ changes: 0 });

      await repository.delete('nonexistent');

      expect(mockCache.del).not.toHaveBeenCalled();
    });
  });

  describe('Convenience methods', () => {
    describe('lastHealthCheck', () => {
      it('should get last health check timestamp', async () => {
        mockStmt.get.mockReturnValue({ value: '1640000000000' });

        const result = await repository.getLastHealthCheck();

        expect(result).toBe(1640000000000);
        expect(mockStmt.get).toHaveBeenCalledWith('lastHealthCheck');
      });

      it('should set last health check timestamp', async () => {
        mockStmt.run.mockReturnValue({ changes: 1 });

        await repository.setLastHealthCheck(1640000000000);

        expect(mockStmt.run).toHaveBeenCalled();
        const [key] = mockStmt.run.mock.calls[0];
        expect(key).toBe('lastHealthCheck');
      });
    });

    describe('lastDeepAnalysis', () => {
      it('should get last deep analysis timestamp', async () => {
        mockStmt.get.mockReturnValue({ value: '1640000000000' });

        const result = await repository.getLastDeepAnalysis();

        expect(result).toBe(1640000000000);
        expect(mockStmt.get).toHaveBeenCalledWith('lastDeepAnalysis');
      });

      it('should set last deep analysis timestamp', async () => {
        mockStmt.run.mockReturnValue({ changes: 1 });

        await repository.setLastDeepAnalysis(1640000000000);

        expect(mockStmt.run).toHaveBeenCalled();
        const [key] = mockStmt.run.mock.calls[0];
        expect(key).toBe('lastDeepAnalysis');
      });
    });

    describe('migration', () => {
      it('should return false when migration not completed', async () => {
        mockStmt.get.mockReturnValue(undefined);

        const result = await repository.isMigrationCompleted();

        expect(result).toBe(false);
      });

      it('should return true when migration completed', async () => {
        mockStmt.get.mockReturnValue({ value: '"true"' });

        const result = await repository.isMigrationCompleted();

        expect(result).toBe(true);
      });

      it('should set migration completed', async () => {
        mockStmt.run.mockReturnValue({ changes: 1 });

        await repository.setMigrationCompleted();

        expect(mockStmt.run).toHaveBeenCalled();
        const [key, value] = mockStmt.run.mock.calls[0];
        expect(key).toBe('migration_completed');
        expect(value).toBe('"true"');
      });
    });

    describe('currentChatSessionId', () => {
      it('should get current chat session id', async () => {
        mockStmt.get.mockReturnValue({ value: '"session-123"' });

        const result = await repository.getCurrentChatSessionId();

        expect(result).toBe('session-123');
        expect(mockStmt.get).toHaveBeenCalledWith('currentChatSessionId');
      });

      it('should set current chat session id', async () => {
        mockStmt.run.mockReturnValue({ changes: 1 });

        await repository.setCurrentChatSessionId('session-123');

        expect(mockStmt.run).toHaveBeenCalled();
        const [key, value] = mockStmt.run.mock.calls[0];
        expect(key).toBe('currentChatSessionId');
        expect(JSON.parse(value)).toBe('session-123');
      });
    });
  });

  describe('getStats', () => {
    it('should return stats with timestamps', async () => {
      mockStmt.get
        .mockReturnValueOnce({ value: '1640000000000' }) // lastHealthCheck
        .mockReturnValueOnce({ value: '1640001000000' }); // lastDeepAnalysis

      const result = await repository.getStats({
        projectCount: 5,
        taskCount: 10,
        pendingActionsCount: 3,
        ideaCount: 7,
        activeIdeasCount: 2,
      });

      expect(result).toEqual({
        projectCount: 5,
        taskCount: 10,
        pendingActionsCount: 3,
        ideaCount: 7,
        activeIdeasCount: 2,
        lastHealthCheck: 1640000000000,
        lastDeepAnalysis: 1640001000000,
      });
    });

    it('should handle missing timestamps', async () => {
      mockStmt.get.mockReturnValue(undefined);

      const result = await repository.getStats({
        projectCount: 5,
        taskCount: 10,
        pendingActionsCount: 3,
        ideaCount: 7,
        activeIdeasCount: 2,
      });

      expect(result).toEqual({
        projectCount: 5,
        taskCount: 10,
        pendingActionsCount: 3,
        ideaCount: 7,
        activeIdeasCount: 2,
        lastHealthCheck: undefined,
        lastDeepAnalysis: undefined,
      });
    });
  });
});
