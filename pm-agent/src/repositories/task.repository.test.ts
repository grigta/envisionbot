import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskRepository } from './task.repository';
import type { Task, RepositoryDeps } from '../types';
import type { DatabaseSync, CacheClient, PubSubClient } from '../db/index';

describe('TaskRepository', () => {
  let mockDb: DatabaseSync;
  let mockCache: CacheClient;
  let mockPubsub: PubSubClient;
  let deps: RepositoryDeps;
  let repository: TaskRepository;

  const mockTask: Task = {
    id: 'task-1',
    projectId: 'proj-1',
    type: 'feature',
    priority: 'high',
    title: 'Implement user authentication',
    description: 'Add JWT-based authentication',
    context: 'Security requirement',
    suggestedActions: [
      { type: 'implement', description: 'Add JWT library', payload: {} },
    ],
    relatedIssues: [123, 456],
    relatedPRs: [78, 90],
    status: 'pending',
    kanbanStatus: 'backlog',
    generatedAt: 1609459200000,
    completedAt: undefined,
    approvedBy: undefined,
    generatedBy: 'agent',
    githubIssueNumber: undefined,
    githubIssueUrl: undefined,
    githubIssueState: undefined,
    githubIssueCreatedAt: undefined,
    githubIssueSyncedAt: undefined,
  };

  const mockTaskRow = {
    id: 'task-1',
    project_id: 'proj-1',
    type: 'feature',
    priority: 'high',
    title: 'Implement user authentication',
    description: 'Add JWT-based authentication',
    context: 'Security requirement',
    suggested_actions: JSON.stringify([
      { type: 'implement', description: 'Add JWT library', payload: {} },
    ]),
    related_issues: JSON.stringify([123, 456]),
    related_prs: JSON.stringify([78, 90]),
    status: 'pending',
    kanban_status: 'backlog',
    generated_at: 1609459200000,
    completed_at: null,
    approved_by: null,
    generated_by: 'agent',
    github_issue_number: null,
    github_issue_url: null,
    github_issue_state: null,
    github_issue_created_at: null,
    github_issue_synced_at: null,
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

    repository = new TaskRepository(deps);
  });

  describe('getAll', () => {
    it('should return all tasks ordered by priority', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.all).mockReturnValue([mockTaskRow]);

      const result = await repository.getAll();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'task-1',
        title: 'Implement user authentication',
        priority: 'high',
        status: 'pending',
      });
    });

    it('should filter by projectId', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.all).mockReturnValue([mockTaskRow]);

      await repository.getAll({ projectId: 'proj-1' });

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('AND project_id = ?')
      );
      expect(mockStatement.all).toHaveBeenCalledWith('proj-1');
    });

    it('should filter by status', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.all).mockReturnValue([mockTaskRow]);

      await repository.getAll({ status: 'pending' });

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('AND status = ?')
      );
      expect(mockStatement.all).toHaveBeenCalledWith('pending');
    });

    it('should filter by kanbanStatus', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.all).mockReturnValue([mockTaskRow]);

      await repository.getAll({ kanbanStatus: 'backlog' });

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('AND kanban_status = ?')
      );
      expect(mockStatement.all).toHaveBeenCalledWith('backlog');
    });

    it('should filter by multiple criteria', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.all).mockReturnValue([mockTaskRow]);

      await repository.getAll({
        projectId: 'proj-1',
        status: 'pending',
        kanbanStatus: 'backlog',
      });

      expect(mockStatement.all).toHaveBeenCalledWith('proj-1', 'pending', 'backlog');
    });

    it('should order by priority (critical > high > medium > low)', async () => {
      const mockStatement = mockDb.prepare('') as any;

      await repository.getAll();

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining(
          "CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END"
        )
      );
    });

    it('should parse JSON fields correctly', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.all).mockReturnValue([mockTaskRow]);

      const result = await repository.getAll();

      expect(result[0].suggestedActions).toEqual([
        { type: 'implement', description: 'Add JWT library', payload: {} },
      ]);
      expect(result[0].relatedIssues).toEqual([123, 456]);
      expect(result[0].relatedPRs).toEqual([78, 90]);
    });

    it('should handle null values correctly', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.all).mockReturnValue([mockTaskRow]);

      const result = await repository.getAll();

      expect(result[0].completedAt).toBeUndefined();
      expect(result[0].approvedBy).toBeUndefined();
      expect(result[0].githubIssueNumber).toBeUndefined();
    });
  });

  describe('getPending', () => {
    it('should return pending tasks from cache', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(JSON.stringify([mockTask]));

      const result = await repository.getPending();

      expect(result).toEqual([mockTask]);
      expect(mockDb.prepare).not.toHaveBeenCalled();
    });

    it('should fetch pending tasks from database if not cached', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null);
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.all).mockReturnValue([mockTaskRow]);

      const result = await repository.getPending();

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('pending');
    });

    it('should cache pending tasks after fetching', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null);
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.all).mockReturnValue([mockTaskRow]);

      await repository.getPending();

      expect(mockCache.setex).toHaveBeenCalledWith(
        'pm:tasks:pending',
        30,
        expect.any(String)
      );
    });
  });

  describe('getById', () => {
    it('should return task from cache', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(JSON.stringify(mockTask));

      const result = await repository.getById('task-1');

      expect(result).toEqual(mockTask);
      expect(mockDb.prepare).not.toHaveBeenCalled();
    });

    it('should fetch task from database if not cached', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null);
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.get).mockReturnValue(mockTaskRow);

      const result = await repository.getById('task-1');

      expect(result).toMatchObject({
        id: 'task-1',
        title: 'Implement user authentication',
      });
    });

    it('should return undefined for non-existent task', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null);
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.get).mockReturnValue(undefined);

      const result = await repository.getById('non-existent');

      expect(result).toBeUndefined();
    });

    it('should cache task after fetching', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null);
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.get).mockReturnValue(mockTaskRow);

      await repository.getById('task-1');

      expect(mockCache.setex).toHaveBeenCalledWith(
        'pm:task:task-1',
        120,
        expect.any(String)
      );
    });
  });

  describe('upsert', () => {
    it('should insert new task', async () => {
      const mockStatement = mockDb.prepare('') as any;

      const result = await repository.upsert(mockTask);

      expect(result).toEqual(mockTask);
      expect(mockStatement.run).toHaveBeenCalled();
    });

    it('should update existing task', async () => {
      const updatedTask = { ...mockTask, title: 'Updated Task' };
      const mockStatement = mockDb.prepare('') as any;

      const result = await repository.upsert(updatedTask);

      expect(result).toEqual(updatedTask);
    });

    it('should invalidate cache after upsert', async () => {
      await repository.upsert(mockTask);

      expect(mockCache.del).toHaveBeenCalledWith(
        'pm:task:task-1',
        'pm:tasks:pending',
        expect.stringContaining('pm:tasks:project:proj-1')
      );
    });

    it('should publish task_upserted event', async () => {
      await repository.upsert(mockTask);

      expect(mockPubsub.publish).toHaveBeenCalledTimes(1);
      const [channel, message] = vi.mocked(mockPubsub.publish).mock.calls[0];

      expect(channel).toBe('pm:events:tasks');

      const parsed = JSON.parse(message as string);
      expect(parsed.type).toBe('task_upserted');
      expect(parsed.data).toMatchObject({
        id: 'task-1',
        title: 'Implement user authentication',
      });
    });

    it('should handle all task types', async () => {
      const types: Task['type'][] = ['feature', 'bug', 'test', 'refactor', 'docs', 'chore'];

      for (const type of types) {
        const task = { ...mockTask, type };
        await repository.upsert(task);
      }

      expect(mockPubsub.publish).toHaveBeenCalledTimes(types.length);
    });

    it('should handle all priority levels', async () => {
      const priorities: Task['priority'][] = ['critical', 'high', 'medium', 'low'];

      for (const priority of priorities) {
        const task = { ...mockTask, priority };
        await repository.upsert(task);
      }

      expect(mockPubsub.publish).toHaveBeenCalledTimes(priorities.length);
    });
  });

  describe('updateStatus', () => {
    it('should update task status', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.run).mockReturnValue({ changes: 1 } as any);

      const result = await repository.updateStatus('task-1', 'in-progress');

      expect(result).toBe(true);
      expect(mockStatement.run).toHaveBeenCalledWith('in-progress', 'task-1');
    });

    it('should return false for non-existent task', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.run).mockReturnValue({ changes: 0 } as any);

      const result = await repository.updateStatus('non-existent', 'in-progress');

      expect(result).toBe(false);
    });

    it('should invalidate cache after status update', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.run).mockReturnValue({ changes: 1 } as any);

      await repository.updateStatus('task-1', 'completed');

      expect(mockCache.keys).toHaveBeenCalledWith('pm:task:*');
    });

    it('should publish status_updated event', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.run).mockReturnValue({ changes: 1 } as any);

      await repository.updateStatus('task-1', 'completed');

      expect(mockPubsub.publish).toHaveBeenCalledTimes(1);
      const parsed = JSON.parse(vi.mocked(mockPubsub.publish).mock.calls[0][1] as string);
      expect(parsed.type).toBe('status_updated');
      expect(parsed.data).toEqual({ id: 'task-1', status: 'completed' });
    });
  });

  describe('delete', () => {
    it('should delete existing task', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.run).mockReturnValue({ changes: 1 } as any);

      const result = await repository.delete('task-1');

      expect(result).toBe(true);
    });

    it('should return false for non-existent task', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.run).mockReturnValue({ changes: 0 } as any);

      const result = await repository.delete('non-existent');

      expect(result).toBe(false);
    });

    it('should invalidate cache after delete', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.run).mockReturnValue({ changes: 1 } as any);

      await repository.delete('task-1');

      expect(mockCache.keys).toHaveBeenCalledWith('pm:task:*');
    });

    it('should publish task_deleted event', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.run).mockReturnValue({ changes: 1 } as any);

      await repository.delete('task-1');

      const parsed = JSON.parse(vi.mocked(mockPubsub.publish).mock.calls[0][1] as string);
      expect(parsed.type).toBe('task_deleted');
      expect(parsed.data).toEqual({ id: 'task-1' });
    });
  });

  describe('Row to Task Conversion', () => {
    it('should handle completed task with completedAt', async () => {
      const completedRow = {
        ...mockTaskRow,
        status: 'completed',
        completed_at: 1609545600000,
      };

      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockCache.get).mockResolvedValue(null);
      vi.mocked(mockStatement.get).mockReturnValue(completedRow);

      const result = await repository.getById('task-1');

      expect(result?.status).toBe('completed');
      expect(result?.completedAt).toBe(1609545600000);
    });

    it('should handle task with GitHub integration', async () => {
      const githubRow = {
        ...mockTaskRow,
        github_issue_number: 123,
        github_issue_url: 'https://github.com/user/repo/issues/123',
        github_issue_state: 'open',
        github_issue_created_at: 1609459200000,
        github_issue_synced_at: 1609545600000,
      };

      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockCache.get).mockResolvedValue(null);
      vi.mocked(mockStatement.get).mockReturnValue(githubRow);

      const result = await repository.getById('task-1');

      expect(result?.githubIssueNumber).toBe(123);
      expect(result?.githubIssueUrl).toBe('https://github.com/user/repo/issues/123');
      expect(result?.githubIssueState).toBe('open');
    });
  });
});
