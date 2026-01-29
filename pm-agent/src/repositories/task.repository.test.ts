import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskRepository } from './task.repository';
import type { Task } from '../types';
import type { DatabaseSync, CacheClient, PubSubClient } from '../db/index';

describe('TaskRepository', () => {
  let repository: TaskRepository;
  let mockDb: DatabaseSync;
  let mockCache: CacheClient;
  let mockPubsub: PubSubClient;
  let mockPrepare: ReturnType<typeof vi.fn>;
  let mockStmt: {
    all: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    run: ReturnType<typeof vi.fn>;
  };

  const mockTask: Task = {
    id: 'task-1',
    projectId: 'proj-1',
    type: 'feature',
    priority: 'high',
    title: 'Test Task',
    description: 'Test description',
    context: 'Test context',
    suggestedActions: [
      { action: 'Create file', command: 'touch file.ts' },
    ],
    relatedIssues: ['#1', '#2'],
    relatedPRs: ['#10'],
    status: 'pending',
    kanbanStatus: 'backlog',
    generatedAt: 1640000000000,
    completedAt: undefined,
    approvedBy: undefined,
    generatedBy: 'agent',
  };

  const mockTaskRow = {
    id: 'task-1',
    project_id: 'proj-1',
    type: 'feature',
    priority: 'high',
    title: 'Test Task',
    description: 'Test description',
    context: 'Test context',
    suggested_actions: '[{"action":"Create file","command":"touch file.ts"}]',
    related_issues: '["#1","#2"]',
    related_prs: '["#10"]',
    status: 'pending',
    kanban_status: 'backlog',
    generated_at: 1640000000000,
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

    repository = new TaskRepository({
      db: mockDb,
      cache: mockCache,
      pubsub: mockPubsub,
    });
  });

  describe('getAll', () => {
    it('should return all tasks ordered by priority', async () => {
      mockStmt.all.mockReturnValue([mockTaskRow]);

      const result = await repository.getAll();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'task-1',
        title: 'Test Task',
        priority: 'high',
      });
    });

    it('should filter tasks by projectId', async () => {
      mockStmt.all.mockReturnValue([mockTaskRow]);

      await repository.getAll({ projectId: 'proj-1' });

      expect(mockStmt.all).toHaveBeenCalled();
      const sql = mockPrepare.mock.calls[0][0];
      expect(sql).toContain('project_id = ?');
    });

    it('should filter tasks by status', async () => {
      mockStmt.all.mockReturnValue([mockTaskRow]);

      await repository.getAll({ status: 'pending' });

      const sql = mockPrepare.mock.calls[0][0];
      expect(sql).toContain('status = ?');
    });

    it('should filter tasks by kanbanStatus', async () => {
      mockStmt.all.mockReturnValue([mockTaskRow]);

      await repository.getAll({ kanbanStatus: 'backlog' });

      const sql = mockPrepare.mock.calls[0][0];
      expect(sql).toContain('kanban_status = ?');
    });

    it('should apply multiple filters', async () => {
      mockStmt.all.mockReturnValue([mockTaskRow]);

      await repository.getAll({
        projectId: 'proj-1',
        status: 'pending',
        kanbanStatus: 'backlog',
      });

      const sql = mockPrepare.mock.calls[0][0];
      expect(sql).toContain('project_id = ?');
      expect(sql).toContain('status = ?');
      expect(sql).toContain('kanban_status = ?');
    });
  });

  describe('getPending', () => {
    it('should return pending tasks', async () => {
      mockStmt.all.mockReturnValue([mockTaskRow]);

      const result = await repository.getPending();

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('pending');
    });

    it('should return cached pending tasks if available', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(JSON.stringify([mockTask]));

      const result = await repository.getPending();

      expect(result).toEqual([mockTask]);
    });

    it('should cache pending tasks', async () => {
      mockStmt.all.mockReturnValue([mockTaskRow]);

      await repository.getPending();

      expect(mockCache.setex).toHaveBeenCalledWith(
        'pm:tasks:pending',
        30,
        expect.any(String)
      );
    });
  });

  describe('getByProjectId', () => {
    it('should return tasks for a project', async () => {
      mockStmt.all.mockReturnValue([mockTaskRow]);

      const result = await repository.getByProjectId('proj-1');

      expect(result).toHaveLength(1);
      expect(result[0].projectId).toBe('proj-1');
    });

    it('should cache project tasks', async () => {
      mockStmt.all.mockReturnValue([mockTaskRow]);

      await repository.getByProjectId('proj-1');

      expect(mockCache.setex).toHaveBeenCalledWith(
        'pm:tasks:project:proj-1',
        60,
        expect.any(String)
      );
    });
  });

  describe('getById', () => {
    it('should return task by id', async () => {
      mockStmt.get.mockReturnValue(mockTaskRow);

      const result = await repository.getById('task-1');

      expect(result).toMatchObject({
        id: 'task-1',
        title: 'Test Task',
      });
      expect(mockStmt.get).toHaveBeenCalledWith('task-1');
    });

    it('should return cached task if available', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(JSON.stringify(mockTask));

      const result = await repository.getById('task-1');

      expect(result).toEqual(mockTask);
      expect(mockPrepare).not.toHaveBeenCalled();
    });

    it('should return undefined when task not found', async () => {
      mockStmt.get.mockReturnValue(undefined);

      const result = await repository.getById('nonexistent');

      expect(result).toBeUndefined();
    });
  });

  describe('findNextExecutableTask', () => {
    it('should return highest priority approved task in backlog', async () => {
      const approvedTask = {
        ...mockTaskRow,
        status: 'approved',
        kanban_status: 'backlog',
        priority: 'critical',
      };
      mockStmt.get.mockReturnValue(approvedTask);

      const result = await repository.findNextExecutableTask();

      expect(result).not.toBeNull();
      expect(result?.status).toBe('approved');
      expect(result?.priority).toBe('critical');

      const sql = mockPrepare.mock.calls[0][0];
      expect(sql).toContain("status = 'approved'");
      expect(sql).toContain("kanban_status IN ('backlog', 'not_started')");
      expect(sql).toContain('LIMIT 1');
    });

    it('should return null when no executable tasks exist', async () => {
      mockStmt.get.mockReturnValue(undefined);

      const result = await repository.findNextExecutableTask();

      expect(result).toBeNull();
    });
  });

  describe('getTasksWithGitHubIssues', () => {
    it('should return tasks with open GitHub issues', async () => {
      const taskWithGitHub = {
        ...mockTaskRow,
        github_issue_number: 123,
        github_issue_state: 'open',
        github_issue_synced_at: 1640000000000,
      };
      mockStmt.all.mockReturnValue([taskWithGitHub]);

      const result = await repository.getTasksWithGitHubIssues();

      expect(result).toHaveLength(1);
      expect(result[0].githubIssueNumber).toBe(123);

      const sql = mockPrepare.mock.calls[0][0];
      expect(sql).toContain('github_issue_number IS NOT NULL');
      expect(sql).toContain("github_issue_state = 'open'");
    });

    it('should return empty array when no tasks have GitHub issues', async () => {
      mockStmt.all.mockReturnValue([]);

      const result = await repository.getTasksWithGitHubIssues();

      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update task fields', async () => {
      mockStmt.get.mockReturnValue(mockTaskRow);
      mockStmt.run.mockReturnValue({ changes: 1 });

      const result = await repository.update('task-1', {
        status: 'approved',
        approvedBy: 'user-1',
      });

      expect(result).toBeDefined();
      expect(result?.status).toBe('approved');
      expect(result?.approvedBy).toBe('user-1');
    });

    it('should return undefined when task not found', async () => {
      mockStmt.get.mockReturnValue(undefined);

      const result = await repository.update('nonexistent', { status: 'approved' });

      expect(result).toBeUndefined();
    });
  });

  describe('upsert', () => {
    it('should insert new task', async () => {
      mockStmt.run.mockReturnValue({ changes: 1 });

      const result = await repository.upsert(mockTask);

      expect(result).toEqual(mockTask);
      expect(mockStmt.run).toHaveBeenCalled();
    });

    it('should invalidate cache after upsert', async () => {
      mockStmt.run.mockReturnValue({ changes: 1 });

      await repository.upsert(mockTask);

      expect(mockCache.del).toHaveBeenCalledWith(
        'pm:task:task-1',
        'pm:tasks:pending',
        'pm:tasks:project:proj-1',
        'pm:stats'
      );
    });

    it('should publish event after upsert', async () => {
      mockStmt.run.mockReturnValue({ changes: 1 });

      await repository.upsert(mockTask);

      expect(mockPubsub.publish).toHaveBeenCalledTimes(1);
      const [channel, message] = vi.mocked(mockPubsub.publish).mock.calls[0];

      expect(channel).toBe('pm:events:tasks');

      const parsedMessage = JSON.parse(message);
      expect(parsedMessage.type).toBe('task_upserted');
      expect(parsedMessage.data).toMatchObject({ id: 'task-1' });
    });
  });

  describe('updateStatus', () => {
    it('should update task status fields', async () => {
      mockStmt.get.mockReturnValue(mockTaskRow);
      mockStmt.run.mockReturnValue({ changes: 1 });

      const result = await repository.updateStatus('task-1', {
        status: 'completed',
        kanbanStatus: 'done',
        completedAt: 1640001000000,
      });

      expect(result).toBeDefined();
      expect(result?.status).toBe('completed');
      expect(result?.kanbanStatus).toBe('done');
    });

    it('should return undefined when task not found', async () => {
      mockStmt.get.mockReturnValue(undefined);

      const result = await repository.updateStatus('nonexistent', {
        status: 'completed',
      });

      expect(result).toBeUndefined();
    });
  });

  describe('delete', () => {
    it('should delete task by id', async () => {
      mockStmt.get.mockReturnValue(mockTaskRow);
      mockStmt.run.mockReturnValue({ changes: 1 });

      const result = await repository.delete('task-1');

      expect(result).toBe(true);
      expect(mockStmt.run).toHaveBeenCalledWith('task-1');
    });

    it('should return false when task not found', async () => {
      mockStmt.get.mockReturnValue(undefined);

      const result = await repository.delete('nonexistent');

      expect(result).toBe(false);
    });

    it('should invalidate cache after delete', async () => {
      mockStmt.get.mockReturnValue(mockTaskRow);
      mockStmt.run.mockReturnValue({ changes: 1 });

      await repository.delete('task-1');

      expect(mockCache.del).toHaveBeenCalledWith(
        'pm:task:task-1',
        'pm:tasks:pending',
        'pm:tasks:project:proj-1',
        'pm:stats'
      );
    });

    it('should publish event after delete', async () => {
      mockStmt.get.mockReturnValue(mockTaskRow);
      mockStmt.run.mockReturnValue({ changes: 1 });

      await repository.delete('task-1');

      expect(mockPubsub.publish).toHaveBeenCalledTimes(1);
      const [channel, message] = vi.mocked(mockPubsub.publish).mock.calls[0];

      expect(channel).toBe('pm:events:tasks');

      const parsedMessage = JSON.parse(message);
      expect(parsedMessage.type).toBe('task_deleted');
      expect(parsedMessage.data).toEqual({ id: 'task-1' });
    });
  });
});
