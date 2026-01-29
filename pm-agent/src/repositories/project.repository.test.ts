import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectRepository } from './project.repository';
import type { Project, RepositoryDeps } from '../types';
import type { DatabaseSync, CacheClient, PubSubClient } from '../db/index';

describe('ProjectRepository', () => {
  let mockDb: DatabaseSync;
  let mockCache: CacheClient;
  let mockPubsub: PubSubClient;
  let deps: RepositoryDeps;
  let repository: ProjectRepository;

  const mockProject: Project = {
    id: 'proj-1',
    name: 'Test Project',
    repo: 'user/test-repo',
    phase: 'mvp',
    monitoringLevel: 'standard',
    goals: ['Build feature', 'Fix bugs'],
    focusAreas: ['backend', 'api'],
    createdAt: 1609459200000,
    updatedAt: 1609459200000,
  };

  const mockProjectRow = {
    id: 'proj-1',
    name: 'Test Project',
    repo: 'user/test-repo',
    phase: 'mvp',
    monitoring_level: 'standard',
    goals: JSON.stringify(['Build feature', 'Fix bugs']),
    focus_areas: JSON.stringify(['backend', 'api']),
    created_at: 1609459200000,
    updated_at: 1609459200000,
  };

  beforeEach(() => {
    // Mock database with statement chaining
    const mockStatement = {
      all: vi.fn(),
      get: vi.fn(),
      run: vi.fn(() => ({ changes: 1 })),
    };

    mockDb = {
      prepare: vi.fn(() => mockStatement),
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

    repository = new ProjectRepository(deps);
  });

  describe('getAll', () => {
    it('should return all projects from database', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null);
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.all).mockReturnValue([mockProjectRow]);

      const result = await repository.getAll();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockProject);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT * FROM projects ORDER BY updated_at DESC'
      );
    });

    it('should return cached projects if available', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(JSON.stringify([mockProject]));

      const result = await repository.getAll();

      expect(result).toEqual([mockProject]);
      expect(mockDb.prepare).not.toHaveBeenCalled();
    });

    it('should cache results after fetching from database', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null);
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.all).mockReturnValue([mockProjectRow]);

      await repository.getAll();

      expect(mockCache.setex).toHaveBeenCalledWith(
        'pm:project:list:all',
        60,
        JSON.stringify([mockProject])
      );
    });

    it('should handle empty result set', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null);
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.all).mockReturnValue([]);

      const result = await repository.getAll();

      expect(result).toEqual([]);
    });

    it('should parse JSON fields correctly', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null);
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.all).mockReturnValue([mockProjectRow]);

      const result = await repository.getAll();

      expect(result[0].goals).toEqual(['Build feature', 'Fix bugs']);
      expect(result[0].focusAreas).toEqual(['backend', 'api']);
    });
  });

  describe('getById', () => {
    it('should return project by ID from database', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null);
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.get).mockReturnValue(mockProjectRow);

      const result = await repository.getById('proj-1');

      expect(result).toEqual(mockProject);
      expect(mockDb.prepare).toHaveBeenCalledWith('SELECT * FROM projects WHERE id = ?');
      expect(mockStatement.get).toHaveBeenCalledWith('proj-1');
    });

    it('should return cached project if available', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(JSON.stringify(mockProject));

      const result = await repository.getById('proj-1');

      expect(result).toEqual(mockProject);
      expect(mockDb.prepare).not.toHaveBeenCalled();
    });

    it('should return undefined for non-existent project', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null);
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.get).mockReturnValue(undefined);

      const result = await repository.getById('non-existent');

      expect(result).toBeUndefined();
    });

    it('should cache result after fetching from database', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null);
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.get).mockReturnValue(mockProjectRow);

      await repository.getById('proj-1');

      expect(mockCache.setex).toHaveBeenCalledWith(
        'pm:project:proj-1',
        300,
        JSON.stringify(mockProject)
      );
    });
  });

  describe('getByName', () => {
    it('should find project by name (case-insensitive)', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.get).mockReturnValue(mockProjectRow);

      const result = await repository.getByName('Test Project');

      expect(result).toEqual(mockProject);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT * FROM projects WHERE LOWER(name) = LOWER(?)'
      );
      expect(mockStatement.get).toHaveBeenCalledWith('Test Project');
    });

    it('should return undefined for non-existent project', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.get).mockReturnValue(undefined);

      const result = await repository.getByName('Non-existent Project');

      expect(result).toBeUndefined();
    });

    it('should match case-insensitively', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.get).mockReturnValue(mockProjectRow);

      const result = await repository.getByName('TEST PROJECT');

      expect(result).toEqual(mockProject);
    });
  });

  describe('getByRepo', () => {
    it('should find project by repo (case-insensitive)', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.get).mockReturnValue(mockProjectRow);

      const result = await repository.getByRepo('user/test-repo');

      expect(result).toEqual(mockProject);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT * FROM projects WHERE LOWER(repo) = LOWER(?)'
      );
      expect(mockStatement.get).toHaveBeenCalledWith('user/test-repo');
    });

    it('should return undefined for non-existent repo', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.get).mockReturnValue(undefined);

      const result = await repository.getByRepo('user/non-existent');

      expect(result).toBeUndefined();
    });

    it('should match case-insensitively', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.get).mockReturnValue(mockProjectRow);

      const result = await repository.getByRepo('USER/TEST-REPO');

      expect(result).toEqual(mockProject);
    });
  });

  describe('upsert', () => {
    it('should insert new project', async () => {
      const mockStatement = mockDb.prepare('') as any;

      const result = await repository.upsert(mockProject);

      expect(result).toEqual(mockProject);
      expect(mockStatement.run).toHaveBeenCalledWith(
        'proj-1',
        'Test Project',
        'user/test-repo',
        'mvp',
        'standard',
        JSON.stringify(['Build feature', 'Fix bugs']),
        JSON.stringify(['backend', 'api']),
        1609459200000,
        1609459200000
      );
    });

    it('should update existing project', async () => {
      const updatedProject = { ...mockProject, name: 'Updated Project' };
      const mockStatement = mockDb.prepare('') as any;

      const result = await repository.upsert(updatedProject);

      expect(result).toEqual(updatedProject);
      expect(mockStatement.run).toHaveBeenCalledWith(
        'proj-1',
        'Updated Project',
        'user/test-repo',
        'mvp',
        'standard',
        JSON.stringify(['Build feature', 'Fix bugs']),
        JSON.stringify(['backend', 'api']),
        1609459200000,
        1609459200000
      );
    });

    it('should invalidate cache after upsert', async () => {
      await repository.upsert(mockProject);

      expect(mockCache.del).toHaveBeenCalledWith(
        'pm:project:proj-1',
        'pm:project:list:all',
        'pm:stats'
      );
    });

    it('should publish project_upserted event', async () => {
      await repository.upsert(mockProject);

      expect(mockPubsub.publish).toHaveBeenCalledTimes(1);
      const [channel, message] = vi.mocked(mockPubsub.publish).mock.calls[0];

      expect(channel).toBe('pm:events:projects');

      const parsed = JSON.parse(message as string);
      expect(parsed.type).toBe('project_upserted');
      expect(parsed.data).toEqual(mockProject);
    });

    it('should handle all project phases', async () => {
      const phases: Project['phase'][] = [
        'idea',
        'planning',
        'mvp',
        'beta',
        'launch',
        'growth',
        'maintenance',
      ];

      for (const phase of phases) {
        const project = { ...mockProject, phase };
        const mockStatement = mockDb.prepare('') as any;

        await repository.upsert(project);

        expect(mockStatement.run).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          expect.anything(),
          phase,
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything()
        );
      }
    });
  });

  describe('delete', () => {
    it('should delete existing project', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.run).mockReturnValue({ changes: 1 } as any);

      const result = await repository.delete('proj-1');

      expect(result).toBe(true);
      expect(mockDb.prepare).toHaveBeenCalledWith('DELETE FROM projects WHERE id = ?');
      expect(mockStatement.run).toHaveBeenCalledWith('proj-1');
    });

    it('should return false for non-existent project', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.run).mockReturnValue({ changes: 0 } as any);

      const result = await repository.delete('non-existent');

      expect(result).toBe(false);
    });

    it('should invalidate cache after delete', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.run).mockReturnValue({ changes: 1 } as any);

      await repository.delete('proj-1');

      expect(mockCache.del).toHaveBeenCalledWith(
        'pm:project:proj-1',
        'pm:project:list:all',
        'pm:stats'
      );
    });

    it('should publish project_deleted event on successful delete', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.run).mockReturnValue({ changes: 1 } as any);

      await repository.delete('proj-1');

      expect(mockPubsub.publish).toHaveBeenCalledTimes(1);
      const [channel, message] = vi.mocked(mockPubsub.publish).mock.calls[0];

      expect(channel).toBe('pm:events:projects');

      const parsed = JSON.parse(message as string);
      expect(parsed.type).toBe('project_deleted');
      expect(parsed.data).toEqual({ id: 'proj-1' });
    });

    it('should not publish event if delete failed', async () => {
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.run).mockReturnValue({ changes: 0 } as any);

      await repository.delete('non-existent');

      expect(mockPubsub.publish).not.toHaveBeenCalled();
    });
  });

  describe('Row to Project Conversion', () => {
    it('should correctly convert all fields', async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null);
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.get).mockReturnValue(mockProjectRow);

      const result = await repository.getById('proj-1');

      expect(result).toMatchObject({
        id: 'proj-1',
        name: 'Test Project',
        repo: 'user/test-repo',
        phase: 'mvp',
        monitoringLevel: 'standard',
        goals: ['Build feature', 'Fix bugs'],
        focusAreas: ['backend', 'api'],
        createdAt: 1609459200000,
        updatedAt: 1609459200000,
      });
    });

    it('should handle empty arrays in JSON fields', async () => {
      const rowWithEmptyArrays = {
        ...mockProjectRow,
        goals: JSON.stringify([]),
        focus_areas: JSON.stringify([]),
      };

      vi.mocked(mockCache.get).mockResolvedValue(null);
      const mockStatement = mockDb.prepare('') as any;
      vi.mocked(mockStatement.get).mockReturnValue(rowWithEmptyArrays);

      const result = await repository.getById('proj-1');

      expect(result?.goals).toEqual([]);
      expect(result?.focusAreas).toEqual([]);
    });
  });
});
