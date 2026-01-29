import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectRepository } from './project.repository';
import type { Project } from '../types';
import type { DatabaseSync, CacheClient, PubSubClient } from '../db/index';

describe('ProjectRepository', () => {
  let repository: ProjectRepository;
  let mockDb: DatabaseSync;
  let mockCache: CacheClient;
  let mockPubsub: PubSubClient;
  let mockPrepare: ReturnType<typeof vi.fn>;
  let mockStmt: {
    all: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    run: ReturnType<typeof vi.fn>;
  };

  const mockProject: Project = {
    id: 'proj-1',
    name: 'Test Project',
    repo: 'owner/repo',
    phase: 'mvp',
    monitoringLevel: 'standard',
    goals: ['Goal 1', 'Goal 2'],
    focusAreas: ['ci-cd', 'issues'],
    createdAt: 1640000000000,
    updatedAt: 1640000000000,
  };

  const mockProjectRow = {
    id: 'proj-1',
    name: 'Test Project',
    repo: 'owner/repo',
    phase: 'mvp',
    monitoring_level: 'standard',
    goals: '["Goal 1","Goal 2"]',
    focus_areas: '["ci-cd","issues"]',
    created_at: 1640000000000,
    updated_at: 1640000000000,
  };

  beforeEach(() => {
    // Reset mocks
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

    repository = new ProjectRepository({
      db: mockDb,
      cache: mockCache,
      pubsub: mockPubsub,
    });
  });

  describe('getAll', () => {
    it('should return all projects from database', async () => {
      mockStmt.all.mockReturnValue([mockProjectRow]);

      const result = await repository.getAll();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockProject);
      expect(mockPrepare).toHaveBeenCalledWith('SELECT * FROM projects ORDER BY updated_at DESC');
    });

    it('should return cached projects if available', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(JSON.stringify([mockProject]));

      const result = await repository.getAll();

      expect(result).toEqual([mockProject]);
      expect(mockPrepare).not.toHaveBeenCalled();
    });

    it('should cache projects after fetching', async () => {
      mockStmt.all.mockReturnValue([mockProjectRow]);

      await repository.getAll();

      expect(mockCache.setex).toHaveBeenCalledWith(
        'pm:project:list:all',
        60,
        JSON.stringify([mockProject])
      );
    });

    it('should return empty array when no projects exist', async () => {
      mockStmt.all.mockReturnValue([]);

      const result = await repository.getAll();

      expect(result).toEqual([]);
    });
  });

  describe('getById', () => {
    it('should return project by id', async () => {
      mockStmt.get.mockReturnValue(mockProjectRow);

      const result = await repository.getById('proj-1');

      expect(result).toEqual(mockProject);
      expect(mockPrepare).toHaveBeenCalledWith('SELECT * FROM projects WHERE id = ?');
      expect(mockStmt.get).toHaveBeenCalledWith('proj-1');
    });

    it('should return cached project if available', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(JSON.stringify(mockProject));

      const result = await repository.getById('proj-1');

      expect(result).toEqual(mockProject);
      expect(mockPrepare).not.toHaveBeenCalled();
    });

    it('should return undefined when project not found', async () => {
      mockStmt.get.mockReturnValue(undefined);

      const result = await repository.getById('nonexistent');

      expect(result).toBeUndefined();
    });

    it('should cache project after fetching', async () => {
      mockStmt.get.mockReturnValue(mockProjectRow);

      await repository.getById('proj-1');

      expect(mockCache.setex).toHaveBeenCalledWith(
        'pm:project:proj-1',
        300,
        JSON.stringify(mockProject)
      );
    });
  });

  describe('getByName', () => {
    it('should return project by name (case-insensitive)', async () => {
      mockStmt.get.mockReturnValue(mockProjectRow);

      const result = await repository.getByName('Test Project');

      expect(result).toEqual(mockProject);
      expect(mockPrepare).toHaveBeenCalledWith(
        'SELECT * FROM projects WHERE LOWER(name) = LOWER(?)'
      );
      expect(mockStmt.get).toHaveBeenCalledWith('Test Project');
    });

    it('should return undefined when project not found', async () => {
      mockStmt.get.mockReturnValue(undefined);

      const result = await repository.getByName('Nonexistent');

      expect(result).toBeUndefined();
    });
  });

  describe('getByRepo', () => {
    it('should return project by repo (case-insensitive)', async () => {
      mockStmt.get.mockReturnValue(mockProjectRow);

      const result = await repository.getByRepo('owner/repo');

      expect(result).toEqual(mockProject);
      expect(mockPrepare).toHaveBeenCalledWith(
        'SELECT * FROM projects WHERE LOWER(repo) = LOWER(?)'
      );
      expect(mockStmt.get).toHaveBeenCalledWith('owner/repo');
    });

    it('should return undefined when project not found', async () => {
      mockStmt.get.mockReturnValue(undefined);

      const result = await repository.getByRepo('nonexistent/repo');

      expect(result).toBeUndefined();
    });
  });

  describe('upsert', () => {
    it('should insert new project', async () => {
      mockStmt.run.mockReturnValue({ changes: 1 });

      const result = await repository.upsert(mockProject);

      expect(result).toEqual(mockProject);
      expect(mockPrepare).toHaveBeenCalled();
      expect(mockStmt.run).toHaveBeenCalledWith(
        mockProject.id,
        mockProject.name,
        mockProject.repo,
        mockProject.phase,
        mockProject.monitoringLevel,
        JSON.stringify(mockProject.goals),
        JSON.stringify(mockProject.focusAreas),
        mockProject.createdAt,
        mockProject.updatedAt
      );
    });

    it('should invalidate cache after upsert', async () => {
      mockStmt.run.mockReturnValue({ changes: 1 });

      await repository.upsert(mockProject);

      expect(mockCache.del).toHaveBeenCalledWith(
        'pm:project:proj-1',
        'pm:project:list:all',
        'pm:stats'
      );
    });

    it('should publish event after upsert', async () => {
      mockStmt.run.mockReturnValue({ changes: 1 });

      await repository.upsert(mockProject);

      expect(mockPubsub.publish).toHaveBeenCalledTimes(1);
      const [channel, message] = vi.mocked(mockPubsub.publish).mock.calls[0];

      expect(channel).toBe('pm:events:projects');

      const parsedMessage = JSON.parse(message);
      expect(parsedMessage.type).toBe('project_upserted');
      expect(parsedMessage.data).toEqual(mockProject);
    });
  });

  describe('delete', () => {
    it('should delete project by id', async () => {
      mockStmt.run.mockReturnValue({ changes: 1 });

      const result = await repository.delete('proj-1');

      expect(result).toBe(true);
      expect(mockPrepare).toHaveBeenCalledWith('DELETE FROM projects WHERE id = ?');
      expect(mockStmt.run).toHaveBeenCalledWith('proj-1');
    });

    it('should return false when project not found', async () => {
      mockStmt.run.mockReturnValue({ changes: 0 });

      const result = await repository.delete('nonexistent');

      expect(result).toBe(false);
    });

    it('should invalidate cache after delete', async () => {
      mockStmt.run.mockReturnValue({ changes: 1 });

      await repository.delete('proj-1');

      expect(mockCache.del).toHaveBeenCalledWith(
        'pm:project:proj-1',
        'pm:project:list:all',
        'pm:stats'
      );
    });

    it('should publish event after delete', async () => {
      mockStmt.run.mockReturnValue({ changes: 1 });

      await repository.delete('proj-1');

      expect(mockPubsub.publish).toHaveBeenCalledTimes(1);
      const [channel, message] = vi.mocked(mockPubsub.publish).mock.calls[0];

      expect(channel).toBe('pm:events:projects');

      const parsedMessage = JSON.parse(message);
      expect(parsedMessage.type).toBe('project_deleted');
      expect(parsedMessage.data).toEqual({ id: 'proj-1' });
    });
  });
});
