import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActionRepository } from './action.repository';
import type { PendingAction, RepositoryDeps } from '../types';
import type { DatabaseSync, CacheClient, PubSubClient } from '../db/index';

describe('ActionRepository', () => {
  let mockDb: DatabaseSync;
  let mockCache: CacheClient;
  let mockPubsub: PubSubClient;
  let deps: RepositoryDeps;
  let repository: ActionRepository;

  const mockAction: PendingAction = {
    id: 'action-1',
    taskId: 'task-1',
    action: {
      type: 'github_create_issue',
      description: 'Create GitHub issue for bug fix',
      payload: {
        repo: 'user/repo',
        title: 'Fix authentication bug',
        body: 'Description of the bug',
      },
    },
    createdAt: 1609459200000,
    expiresAt: 1609545600000,
    status: 'pending',
    telegramMessageId: undefined,
  };

  const mockActionRow = {
    id: 'action-1',
    task_id: 'task-1',
    action_type: 'github_create_issue',
    action_description: 'Create GitHub issue for bug fix',
    action_payload: JSON.stringify({
      repo: 'user/repo',
      title: 'Fix authentication bug',
      body: 'Description of the bug',
    }),
    created_at: 1609459200000,
    expires_at: 1609545600000,
    status: 'pending',
    telegram_message_id: null,
  };

  beforeEach(() => {
    const mockStatement = {
      all: vi.fn(),
      get: vi.fn(),
      run: vi.fn(() => ({ changes: 1 })),
    };

    mockDb = {
      prepare: vi.fn(() => mockStatement),
      exec: vi.fn(),
    } as any;

    mockCache = {
      get: vi.fn(),
      set: vi.fn(),
      setex: vi.fn(),
      del: vi.fn(),
      keys: vi.fn(),
    } as any;

    mockPubsub = {
      publish: vi.fn(),
    } as any;

    deps = {
      db: mockDb,
      cache: mockCache,
      pubsub: mockPubsub,
    };

    repository = new ActionRepository(deps);
  });

  describe('getAll', () => {
    it('should return all actions ordered by created_at DESC', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.all).mockReturnValue([mockActionRow]);

      const result = await repository.getAll();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'action-1',
        taskId: 'task-1',
        status: 'pending',
      });
      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT * FROM pending_actions ORDER BY created_at DESC'
      );
    });

    it('should parse action payload correctly', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.all).mockReturnValue([mockActionRow]);

      const result = await repository.getAll();

      expect(result[0].action).toEqual({
        type: 'github_create_issue',
        description: 'Create GitHub issue for bug fix',
        payload: {
          repo: 'user/repo',
          title: 'Fix authentication bug',
          body: 'Description of the bug',
        },
      });
    });

    it('should handle empty result set', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.all).mockReturnValue([]);

      const result = await repository.getAll();

      expect(result).toEqual([]);
    });

    it('should handle null telegram_message_id', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.all).mockReturnValue([mockActionRow]);

      const result = await repository.getAll();

      expect(result[0].telegramMessageId).toBeUndefined();
    });
  });

  describe('getPending', () => {
    it('should return pending actions from cache', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(JSON.stringify([mockAction]));

      const result = await repository.getPending();

      expect(result).toEqual([mockAction]);
      expect(mockDb.prepare).not.toHaveBeenCalled();
    });

    it('should fetch pending actions from database if not cached', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null);
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.all).mockReturnValue([mockActionRow]);

      const result = await repository.getPending();

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('pending');
      expect(mockDb.prepare).toHaveBeenCalledWith(
        "SELECT * FROM pending_actions WHERE status = 'pending' ORDER BY created_at DESC"
      );
    });

    it('should cache pending actions after fetching', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null);
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.all).mockReturnValue([mockActionRow]);

      await repository.getPending();

      expect(mockCache.setex).toHaveBeenCalledWith(
        'pm:actions:pending',
        30,
        expect.any(String)
      );
    });
  });

  describe('getById', () => {
    it('should return action from cache', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(JSON.stringify(mockAction));

      const result = await repository.getById('action-1');

      expect(result).toEqual(mockAction);
      expect(mockDb.prepare).not.toHaveBeenCalled();
    });

    it('should fetch action from database if not cached', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null);
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.get).mockReturnValue(mockActionRow);

      const result = await repository.getById('action-1');

      expect(result).toMatchObject({
        id: 'action-1',
        taskId: 'task-1',
      });
    });

    it('should return undefined for non-existent action', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null);
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.get).mockReturnValue(undefined);

      const result = await repository.getById('non-existent');

      expect(result).toBeUndefined();
    });

    it('should cache action after fetching', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null);
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.get).mockReturnValue(mockActionRow);

      await repository.getById('action-1');

      expect(mockCache.setex).toHaveBeenCalledWith(
        'pm:action:action-1',
        60,
        expect.any(String)
      );
    });
  });

  describe('create', () => {
    it('should insert new action', async () => {
      const mockStatement = mockDb.prepare('') as any;

      const result = await repository.create(mockAction);

      expect(result).toEqual(mockAction);
      expect(mockStatement.run).toHaveBeenCalled();
    });

    it('should serialize action payload', async () => {
      const mockStatement = mockDb.prepare('') as any;

      await repository.create(mockAction);

      expect(mockStatement.run).toHaveBeenCalledWith(
        'action-1',
        'task-1',
        'github_create_issue',
        'Create GitHub issue for bug fix',
        JSON.stringify({
          repo: 'user/repo',
          title: 'Fix authentication bug',
          body: 'Description of the bug',
        }),
        1609459200000,
        1609545600000,
        'pending',
        null
      );
    });

    it('should invalidate cache after create', async () => {
      await repository.create(mockAction);

      expect(mockCache.del).toHaveBeenCalledWith('pm:actions:pending');
    });

    it('should publish action_created event', async () => {
      await repository.create(mockAction);

      expect(mockPubsub.publish).toHaveBeenCalledTimes(1);
      const [channel, message] = vi.mocked(mockPubsub.publish).mock.calls[0];

      expect(channel).toBe('pm:events:actions');

      const parsed = JSON.parse(message as string);
      expect(parsed.type).toBe('action_created');
      expect(parsed.data).toMatchObject({
        id: 'action-1',
        status: 'pending',
      });
    });

    it('should handle action with telegram_message_id', async () => {
      const actionWithTelegram = {
        ...mockAction,
        telegramMessageId: 12345,
      };
      const mockStatement = mockDb.prepare('') as any;

      await repository.create(actionWithTelegram);

      expect(mockStatement.run).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        12345
      );
    });
  });

  describe('updateStatus', () => {
    it('should update action status to approved', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.run).mockReturnValue({ changes: 1 } as any);

      const result = await repository.updateStatus('action-1', 'approved');

      expect(result).toBe(true);
      expect(mockStatement.run).toHaveBeenCalledWith('approved', 'action-1');
    });

    it('should update action status to rejected', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.run).mockReturnValue({ changes: 1 } as any);

      const result = await repository.updateStatus('action-1', 'rejected');

      expect(result).toBe(true);
    });

    it('should return false for non-existent action', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.run).mockReturnValue({ changes: 0 } as any);

      const result = await repository.updateStatus('non-existent', 'approved');

      expect(result).toBe(false);
    });

    it('should invalidate cache after status update', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.run).mockReturnValue({ changes: 1 } as any);

      await repository.updateStatus('action-1', 'approved');

      expect(mockCache.del).toHaveBeenCalledWith(
        'pm:action:action-1',
        'pm:actions:pending'
      );
    });

    it('should publish status_updated event', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.run).mockReturnValue({ changes: 1 } as any);

      await repository.updateStatus('action-1', 'approved');

      expect(mockPubsub.publish).toHaveBeenCalledTimes(1);
      const parsed = JSON.parse(vi.mocked(mockPubsub.publish).mock.calls[0][1] as string);
      expect(parsed.type).toBe('status_updated');
      expect(parsed.data).toEqual({ id: 'action-1', status: 'approved' });
    });
  });

  describe('delete', () => {
    it('should delete existing action', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.run).mockReturnValue({ changes: 1 } as any);

      const result = await repository.delete('action-1');

      expect(result).toBe(true);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        'DELETE FROM pending_actions WHERE id = ?'
      );
    });

    it('should return false for non-existent action', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.run).mockReturnValue({ changes: 0 } as any);

      const result = await repository.delete('non-existent');

      expect(result).toBe(false);
    });

    it('should invalidate cache after delete', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.run).mockReturnValue({ changes: 1 } as any);

      await repository.delete('action-1');

      expect(mockCache.del).toHaveBeenCalledWith(
        'pm:action:action-1',
        'pm:actions:pending'
      );
    });

    it('should publish action_deleted event', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.run).mockReturnValue({ changes: 1 } as any);

      await repository.delete('action-1');

      const parsed = JSON.parse(vi.mocked(mockPubsub.publish).mock.calls[0][1] as string);
      expect(parsed.type).toBe('action_deleted');
      expect(parsed.data).toEqual({ id: 'action-1' });
    });
  });

  describe('cleanupExpired', () => {
    it('should delete expired actions', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.run).mockReturnValue({ changes: 3 } as any);

      const result = await repository.cleanupExpired();

      expect(result).toBe(3);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        "DELETE FROM pending_actions WHERE status = 'pending' AND expires_at < ?"
      );
    });

    it('should return 0 when no expired actions', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.run).mockReturnValue({ changes: 0 } as any);

      const result = await repository.cleanupExpired();

      expect(result).toBe(0);
    });

    it('should invalidate cache after cleanup', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.run).mockReturnValue({ changes: 2 } as any);

      await repository.cleanupExpired();

      expect(mockCache.del).toHaveBeenCalledWith('pm:actions:pending');
    });

    it('should publish cleanup_completed event', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.run).mockReturnValue({ changes: 2 } as any);

      await repository.cleanupExpired();

      const parsed = JSON.parse(vi.mocked(mockPubsub.publish).mock.calls[0][1] as string);
      expect(parsed.type).toBe('cleanup_completed');
      expect(parsed.data).toEqual({ deletedCount: 2 });
    });
  });

  describe('Action Types', () => {
    it('should handle github_create_issue action type', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.all).mockReturnValue([mockActionRow]);

      const result = await repository.getAll();

      expect(result[0].action.type).toBe('github_create_issue');
    });

    it('should handle github_comment_issue action type', async () => {
      const commentRow = {
        ...mockActionRow,
        action_type: 'github_comment_issue',
        action_payload: JSON.stringify({
          repo: 'user/repo',
          issue_number: 123,
          body: 'Comment body',
        }),
      };

      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.all).mockReturnValue([commentRow]);

      const result = await repository.getAll();

      expect(result[0].action.type).toBe('github_comment_issue');
      expect(result[0].action.payload).toEqual({
        repo: 'user/repo',
        issue_number: 123,
        body: 'Comment body',
      });
    });

    it('should handle idea_create_repo action type', async () => {
      const ideaRow = {
        ...mockActionRow,
        action_type: 'idea_create_repo',
        action_payload: JSON.stringify({
          ideaId: 'idea-1',
          repoName: 'new-project',
          description: 'Project description',
        }),
      };

      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.all).mockReturnValue([ideaRow]);

      const result = await repository.getAll();

      expect(result[0].action.type).toBe('idea_create_repo');
    });
  });

  describe('Row to Action Conversion', () => {
    it('should correctly convert all fields', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null);
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.get).mockReturnValue(mockActionRow);

      const result = await repository.getById('action-1');

      expect(result).toMatchObject({
        id: 'action-1',
        taskId: 'task-1',
        action: {
          type: 'github_create_issue',
          description: 'Create GitHub issue for bug fix',
          payload: {
            repo: 'user/repo',
            title: 'Fix authentication bug',
            body: 'Description of the bug',
          },
        },
        createdAt: 1609459200000,
        expiresAt: 1609545600000,
        status: 'pending',
      });
    });
  });
});
