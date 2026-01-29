import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActionRepository } from './action.repository';
import type { PendingAction } from '../types';
import type { DatabaseSync, CacheClient, PubSubClient } from '../db/index';

describe('ActionRepository', () => {
  let repository: ActionRepository;
  let mockDb: DatabaseSync;
  let mockCache: CacheClient;
  let mockPubsub: PubSubClient;
  let mockPrepare: ReturnType<typeof vi.fn>;
  let mockStmt: {
    all: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    run: ReturnType<typeof vi.fn>;
  };

  const mockAction: PendingAction = {
    id: 'action-1',
    taskId: 'task-1',
    action: {
      type: 'create_github_issue',
      description: 'Create GitHub issue',
      payload: { title: 'Test Issue', body: 'Test body' },
    },
    createdAt: 1640000000000,
    expiresAt: 1640003600000,
    status: 'pending',
  };

  const mockActionRow = {
    id: 'action-1',
    task_id: 'task-1',
    action_type: 'create_github_issue',
    action_description: 'Create GitHub issue',
    action_payload: '{"title":"Test Issue","body":"Test body"}',
    created_at: 1640000000000,
    expires_at: 1640003600000,
    status: 'pending',
    telegram_message_id: null,
  };

  beforeEach(() => {
    mockStmt = {
      all: vi.fn(),
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

    repository = new ActionRepository({
      db: mockDb,
      cache: mockCache,
      pubsub: mockPubsub,
    });
  });

  describe('getAll', () => {
    it('should return all actions ordered by created_at', async () => {
      mockStmt.all.mockReturnValue([mockActionRow]);

      const result = await repository.getAll();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'action-1',
        taskId: 'task-1',
        status: 'pending',
      });
      expect(mockPrepare).toHaveBeenCalledWith(
        'SELECT * FROM pending_actions ORDER BY created_at DESC'
      );
    });

    it('should return empty array when no actions exist', async () => {
      mockStmt.all.mockReturnValue([]);

      const result = await repository.getAll();

      expect(result).toEqual([]);
    });

    it('should parse action payload correctly', async () => {
      mockStmt.all.mockReturnValue([mockActionRow]);

      const result = await repository.getAll();

      expect(result[0].action.payload).toEqual({
        title: 'Test Issue',
        body: 'Test body',
      });
    });
  });

  describe('getPending', () => {
    it('should return only pending actions', async () => {
      mockStmt.all.mockReturnValue([mockActionRow]);

      const result = await repository.getPending();

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('pending');
      expect(mockPrepare).toHaveBeenCalledWith(
        "SELECT * FROM pending_actions WHERE status = 'pending' ORDER BY created_at DESC"
      );
    });

    it('should return cached pending actions if available', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(JSON.stringify([mockAction]));

      const result = await repository.getPending();

      expect(result).toEqual([mockAction]);
      expect(mockPrepare).not.toHaveBeenCalled();
    });

    it('should cache pending actions', async () => {
      mockStmt.all.mockReturnValue([mockActionRow]);

      await repository.getPending();

      expect(mockCache.setex).toHaveBeenCalledWith(
        'pm:actions:pending',
        30,
        expect.any(String)
      );
    });
  });

  describe('getById', () => {
    it('should return action by id', async () => {
      mockStmt.get.mockReturnValue(mockActionRow);

      const result = await repository.getById('action-1');

      expect(result).toMatchObject({
        id: 'action-1',
        taskId: 'task-1',
      });
      expect(mockStmt.get).toHaveBeenCalledWith('action-1');
    });

    it('should return cached action if available', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(JSON.stringify(mockAction));

      const result = await repository.getById('action-1');

      expect(result).toEqual(mockAction);
      expect(mockPrepare).not.toHaveBeenCalled();
    });

    it('should return undefined when action not found', async () => {
      mockStmt.get.mockReturnValue(undefined);

      const result = await repository.getById('nonexistent');

      expect(result).toBeUndefined();
    });

    it('should cache action after fetching', async () => {
      mockStmt.get.mockReturnValue(mockActionRow);

      await repository.getById('action-1');

      expect(mockCache.setex).toHaveBeenCalledWith(
        'pm:action:action-1',
        60,
        expect.any(String)
      );
    });
  });

  describe('getByTaskId', () => {
    it('should return actions for a task', async () => {
      mockStmt.all.mockReturnValue([mockActionRow]);

      const result = await repository.getByTaskId('task-1');

      expect(result).toHaveLength(1);
      expect(result[0].taskId).toBe('task-1');
      expect(mockStmt.all).toHaveBeenCalledWith('task-1');
    });

    it('should return empty array when no actions for task', async () => {
      mockStmt.all.mockReturnValue([]);

      const result = await repository.getByTaskId('task-1');

      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    it('should create new action', async () => {
      mockStmt.run.mockReturnValue({ changes: 1 });

      const result = await repository.create(mockAction);

      expect(result).toEqual(mockAction);
      expect(mockStmt.run).toHaveBeenCalledWith(
        'action-1',
        'task-1',
        'create_github_issue',
        'Create GitHub issue',
        '{"title":"Test Issue","body":"Test body"}',
        1640000000000,
        1640003600000,
        'pending',
        null
      );
    });

    it('should create action with telegram message id', async () => {
      mockStmt.run.mockReturnValue({ changes: 1 });
      const actionWithTelegram = {
        ...mockAction,
        telegramMessageId: 12345,
      };

      await repository.create(actionWithTelegram);

      expect(mockStmt.run).toHaveBeenCalledWith(
        'action-1',
        'task-1',
        'create_github_issue',
        'Create GitHub issue',
        '{"title":"Test Issue","body":"Test body"}',
        1640000000000,
        1640003600000,
        'pending',
        12345
      );
    });

    it('should invalidate cache after create', async () => {
      mockStmt.run.mockReturnValue({ changes: 1 });

      await repository.create(mockAction);

      expect(mockCache.del).toHaveBeenCalledWith('pm:actions:pending', 'pm:stats');
    });

    it('should publish event after create', async () => {
      mockStmt.run.mockReturnValue({ changes: 1 });

      await repository.create(mockAction);

      expect(mockPubsub.publish).toHaveBeenCalledTimes(1);
      const [channel, message] = vi.mocked(mockPubsub.publish).mock.calls[0];

      expect(channel).toBe('pm:events:actions');

      const parsedMessage = JSON.parse(message);
      expect(parsedMessage.type).toBe('action_pending');
      expect(parsedMessage.data).toMatchObject({ id: 'action-1' });
    });
  });

  describe('updateStatus', () => {
    it('should update action status to approved', async () => {
      mockStmt.get.mockReturnValue(mockActionRow);
      mockStmt.run.mockReturnValue({ changes: 1 });

      const result = await repository.updateStatus('action-1', 'approved');

      expect(result).toBeDefined();
      expect(result?.status).toBe('approved');
      expect(mockStmt.run).toHaveBeenCalledWith('approved', null, 'action-1');
    });

    it('should update action status to rejected', async () => {
      mockStmt.get.mockReturnValue(mockActionRow);
      mockStmt.run.mockReturnValue({ changes: 1 });

      const result = await repository.updateStatus('action-1', 'rejected');

      expect(result).toBeDefined();
      expect(result?.status).toBe('rejected');
    });

    it('should update telegram message id if provided', async () => {
      mockStmt.get.mockReturnValue(mockActionRow);
      mockStmt.run.mockReturnValue({ changes: 1 });

      const result = await repository.updateStatus('action-1', 'approved', 12345);

      expect(result).toBeDefined();
      expect(result?.telegramMessageId).toBe(12345);
      expect(mockStmt.run).toHaveBeenCalledWith('approved', 12345, 'action-1');
    });

    it('should return undefined when action not found', async () => {
      mockStmt.get.mockReturnValue(undefined);

      const result = await repository.updateStatus('nonexistent', 'approved');

      expect(result).toBeUndefined();
    });

    it('should invalidate cache after update', async () => {
      mockStmt.get.mockReturnValue(mockActionRow);
      mockStmt.run.mockReturnValue({ changes: 1 });

      await repository.updateStatus('action-1', 'approved');

      expect(mockCache.del).toHaveBeenCalledWith(
        'pm:action:action-1',
        'pm:actions:pending',
        'pm:stats'
      );
    });

    it('should publish approved event when status is approved', async () => {
      mockStmt.get.mockReturnValue(mockActionRow);
      mockStmt.run.mockReturnValue({ changes: 1 });

      await repository.updateStatus('action-1', 'approved');

      expect(mockPubsub.publish).toHaveBeenCalledTimes(1);
      const [, message] = vi.mocked(mockPubsub.publish).mock.calls[0];

      const parsedMessage = JSON.parse(message);
      expect(parsedMessage.type).toBe('action_approved');
    });

    it('should publish rejected event when status is rejected', async () => {
      mockStmt.get.mockReturnValue(mockActionRow);
      mockStmt.run.mockReturnValue({ changes: 1 });

      await repository.updateStatus('action-1', 'rejected');

      expect(mockPubsub.publish).toHaveBeenCalledTimes(1);
      const [, message] = vi.mocked(mockPubsub.publish).mock.calls[0];

      const parsedMessage = JSON.parse(message);
      expect(parsedMessage.type).toBe('action_rejected');
    });
  });

  describe('expireOld', () => {
    it('should expire pending actions past expiration time', async () => {
      mockStmt.run.mockReturnValue({ changes: 3 });

      const result = await repository.expireOld();

      expect(result).toBe(3);
      expect(mockPrepare).toHaveBeenCalled();
      const sql = mockPrepare.mock.calls[0][0];
      expect(sql).toContain("SET status = 'expired'");
      expect(sql).toContain("WHERE status = 'pending' AND expires_at < ?");
    });

    it('should return 0 when no actions to expire', async () => {
      mockStmt.run.mockReturnValue({ changes: 0 });

      const result = await repository.expireOld();

      expect(result).toBe(0);
    });

    it('should invalidate cache when actions expired', async () => {
      mockStmt.run.mockReturnValue({ changes: 3 });

      await repository.expireOld();

      expect(mockCache.del).toHaveBeenCalledWith('pm:actions:pending', 'pm:stats');
    });

    it('should not invalidate cache when no changes', async () => {
      mockStmt.run.mockReturnValue({ changes: 0 });

      await repository.expireOld();

      expect(mockCache.del).not.toHaveBeenCalled();
    });
  });
});
