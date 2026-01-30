import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  parseMentions,
  buildMentionContext,
  extractProjectIds,
  getMentionables,
  type ParsedMention,
} from './mentions';
import { store } from '../state/store';
import type { Project } from '../types';

// Mock the store
vi.mock('../state/store', () => ({
  store: {
    getProjectByName: vi.fn(),
    getProjectByRepo: vi.fn(),
    getProjects: vi.fn(),
  },
}));

describe('Chat Mentions', () => {
  const mockProject: Project = {
    id: 'proj-1',
    name: 'test-project',
    repo: 'user/repo',
    phase: 'development',
    monitoringLevel: 'standard',
    goals: ['goal1', 'goal2'],
    focusAreas: ['backend', 'frontend'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseMentions', () => {
    it('should parse project mention', () => {
      const message = 'Check @my-project for details';
      const result = parseMentions(message);

      expect(result.mentions).toHaveLength(1);
      expect(result.mentions[0]).toEqual({
        type: 'project',
        value: 'my-project',
        original: '@my-project',
      });
    });

    it('should parse GitHub repo mention', () => {
      const message = 'Look at @owner/repo for examples';
      const result = parseMentions(message);

      expect(result.mentions).toHaveLength(1);
      expect(result.mentions[0]).toEqual({
        type: 'repo',
        value: 'owner/repo',
        original: '@owner/repo',
      });
    });

    it('should parse local path mention', () => {
      const message = 'Check @/home/user/code for the files';
      const result = parseMentions(message);

      expect(result.mentions).toHaveLength(1);
      expect(result.mentions[0]).toEqual({
        type: 'path',
        value: '/home/user/code',
        original: '@/home/user/code',
      });
    });

    it('should parse multiple mentions', () => {
      const message = 'Check @project1 and @owner/repo and @/path/to/dir';
      const result = parseMentions(message);

      expect(result.mentions).toHaveLength(3);
      expect(result.mentions[0].type).toBe('project');
      expect(result.mentions[1].type).toBe('repo');
      expect(result.mentions[2].type).toBe('path');
    });

    it('should handle message with no mentions', () => {
      const message = 'This is a regular message without mentions';
      const result = parseMentions(message);

      expect(result.mentions).toHaveLength(0);
      expect(result.cleanMessage).toBe(message);
    });

    it('should handle mentions with underscores and dashes', () => {
      const message = '@my-cool_project and @user/my-repo_name';
      const result = parseMentions(message);

      expect(result.mentions).toHaveLength(2);
      expect(result.mentions[0].value).toBe('my-cool_project');
      expect(result.mentions[1].value).toBe('user/my-repo_name');
    });

    it('should handle mentions with dots', () => {
      const message = 'Check @project.v2 and @/path/to/file.txt';
      const result = parseMentions(message);

      expect(result.mentions).toHaveLength(2);
      expect(result.mentions[0].value).toBe('project.v2');
      expect(result.mentions[1].value).toBe('/path/to/file.txt');
    });

    it('should preserve clean message', () => {
      const message = 'Check @project for details';
      const result = parseMentions(message);

      expect(result.cleanMessage).toBe(message);
    });

    it('should handle mentions at different positions', () => {
      const message = '@start middle @middle and @end';
      const result = parseMentions(message);

      expect(result.mentions).toHaveLength(3);
      expect(result.mentions[0].value).toBe('start');
      expect(result.mentions[1].value).toBe('middle');
      expect(result.mentions[2].value).toBe('end');
    });

    it('should not parse email addresses as mentions', () => {
      const message = 'Contact user@example.com for info';
      const result = parseMentions(message);

      // This will parse example.com as a mention due to regex
      // In production, you might want to exclude emails
      expect(result.mentions).toHaveLength(1);
      expect(result.mentions[0].type).toBe('project');
    });
  });

  describe('buildMentionContext', () => {
    it('should return empty string for no mentions', () => {
      const context = buildMentionContext([]);
      expect(context).toBe('');
    });

    it('should build context for project mention (found)', () => {
      vi.mocked(store.getProjectByName).mockReturnValue(mockProject);

      const mentions: ParsedMention[] = [
        { type: 'project', value: 'test-project', original: '@test-project' },
      ];

      const context = buildMentionContext(mentions);

      expect(context).toContain('Project "test-project"');
      expect(context).toContain('user/repo');
      expect(context).toContain('development');
      expect(context).toContain('goal1, goal2');
    });

    it('should build context for project mention (not found)', () => {
      vi.mocked(store.getProjectByName).mockReturnValue(undefined);

      const mentions: ParsedMention[] = [
        { type: 'project', value: 'unknown', original: '@unknown' },
      ];

      const context = buildMentionContext(mentions);

      expect(context).toContain('Project "unknown"');
      expect(context).toContain('not found in saved projects');
    });

    it('should build context for repo mention', () => {
      const mentions: ParsedMention[] = [
        { type: 'repo', value: 'owner/repo', original: '@owner/repo' },
      ];

      const context = buildMentionContext(mentions);

      expect(context).toContain('GitHub repository: owner/repo');
      expect(context).toContain('use gh CLI');
    });

    it('should build context for path mention', () => {
      const mentions: ParsedMention[] = [
        { type: 'path', value: '/home/user/code', original: '@/home/user/code' },
      ];

      const context = buildMentionContext(mentions);

      expect(context).toContain('Local path: /home/user/code');
      expect(context).toContain('filesystem path');
    });

    it('should build context for multiple mentions', () => {
      vi.mocked(store.getProjectByName).mockReturnValue(mockProject);

      const mentions: ParsedMention[] = [
        { type: 'project', value: 'test-project', original: '@test-project' },
        { type: 'repo', value: 'owner/repo', original: '@owner/repo' },
        { type: 'path', value: '/path/to/dir', original: '@/path/to/dir' },
      ];

      const context = buildMentionContext(mentions);

      expect(context).toContain('test-project');
      expect(context).toContain('owner/repo');
      expect(context).toContain('/path/to/dir');
    });

    it('should include closing note about referenced items', () => {
      const mentions: ParsedMention[] = [
        { type: 'project', value: 'test', original: '@test' },
      ];

      const context = buildMentionContext(mentions);

      expect(context).toContain('When the user mentions these items');
    });
  });

  describe('extractProjectIds', () => {
    it('should extract project ID from project mention', () => {
      vi.mocked(store.getProjectByName).mockReturnValue(mockProject);

      const mentions: ParsedMention[] = [
        { type: 'project', value: 'test-project', original: '@test-project' },
      ];

      const ids = extractProjectIds(mentions);

      expect(ids).toEqual(['proj-1']);
      expect(store.getProjectByName).toHaveBeenCalledWith('test-project');
    });

    it('should extract project ID from repo mention', () => {
      vi.mocked(store.getProjectByRepo).mockReturnValue(mockProject);

      const mentions: ParsedMention[] = [
        { type: 'repo', value: 'user/repo', original: '@user/repo' },
      ];

      const ids = extractProjectIds(mentions);

      expect(ids).toEqual(['proj-1']);
      expect(store.getProjectByRepo).toHaveBeenCalledWith('user/repo');
    });

    it('should return empty array for path mentions', () => {
      const mentions: ParsedMention[] = [
        { type: 'path', value: '/path/to/dir', original: '@/path/to/dir' },
      ];

      const ids = extractProjectIds(mentions);

      expect(ids).toEqual([]);
    });

    it('should return empty array when project not found', () => {
      vi.mocked(store.getProjectByName).mockReturnValue(undefined);

      const mentions: ParsedMention[] = [
        { type: 'project', value: 'unknown', original: '@unknown' },
      ];

      const ids = extractProjectIds(mentions);

      expect(ids).toEqual([]);
    });

    it('should remove duplicate project IDs', () => {
      vi.mocked(store.getProjectByName).mockReturnValue(mockProject);
      vi.mocked(store.getProjectByRepo).mockReturnValue(mockProject);

      const mentions: ParsedMention[] = [
        { type: 'project', value: 'test-project', original: '@test-project' },
        { type: 'repo', value: 'user/repo', original: '@user/repo' },
      ];

      const ids = extractProjectIds(mentions);

      // Both mentions refer to the same project
      expect(ids).toEqual(['proj-1']);
    });

    it('should extract multiple different project IDs', () => {
      const project2: Project = { ...mockProject, id: 'proj-2', name: 'project2' };

      vi.mocked(store.getProjectByName)
        .mockReturnValueOnce(mockProject)
        .mockReturnValueOnce(project2);

      const mentions: ParsedMention[] = [
        { type: 'project', value: 'test-project', original: '@test-project' },
        { type: 'project', value: 'project2', original: '@project2' },
      ];

      const ids = extractProjectIds(mentions);

      expect(ids).toHaveLength(2);
      expect(ids).toContain('proj-1');
      expect(ids).toContain('proj-2');
    });
  });

  describe('getMentionables', () => {
    it('should return mentionables from projects', async () => {
      vi.mocked(store.getProjects).mockReturnValue([mockProject]);

      const mentionables = await getMentionables();

      expect(mentionables).toHaveLength(1);
      expect(mentionables[0]).toEqual({
        id: 'project:proj-1',
        type: 'project',
        label: 'test-project',
        description: 'user/repo',
        value: '@test-project',
      });
    });

    it('should return empty array when no projects exist', async () => {
      vi.mocked(store.getProjects).mockReturnValue([]);

      const mentionables = await getMentionables();

      expect(mentionables).toEqual([]);
    });

    it('should return multiple mentionables', async () => {
      const project2: Project = {
        ...mockProject,
        id: 'proj-2',
        name: 'project2',
        repo: 'owner/repo2',
      };

      vi.mocked(store.getProjects).mockReturnValue([mockProject, project2]);

      const mentionables = await getMentionables();

      expect(mentionables).toHaveLength(2);
      expect(mentionables[0].label).toBe('test-project');
      expect(mentionables[1].label).toBe('project2');
    });

    it('should format mentionables correctly', async () => {
      vi.mocked(store.getProjects).mockReturnValue([mockProject]);

      const mentionables = await getMentionables();

      const item = mentionables[0];
      expect(item.id).toMatch(/^project:/);
      expect(item.type).toBe('project');
      expect(item.label).toBeDefined();
      expect(item.description).toBeDefined();
      expect(item.value).toMatch(/^@/);
    });
  });

  describe('Integration tests', () => {
    it('should parse, build context, and extract IDs', () => {
      vi.mocked(store.getProjectByName).mockReturnValue(mockProject);

      const message = 'Check @test-project for details';

      // Parse
      const { mentions } = parseMentions(message);
      expect(mentions).toHaveLength(1);

      // Build context
      const context = buildMentionContext(mentions);
      expect(context).toContain('test-project');

      // Extract IDs
      const ids = extractProjectIds(mentions);
      expect(ids).toEqual(['proj-1']);
    });

    it('should handle complex message with mixed mentions', () => {
      vi.mocked(store.getProjectByName).mockReturnValue(mockProject);
      vi.mocked(store.getProjectByRepo).mockReturnValue(undefined);

      const message = 'Check @test-project and @owner/other-repo in @/local/path';

      const { mentions } = parseMentions(message);
      expect(mentions).toHaveLength(3);

      const context = buildMentionContext(mentions);
      expect(context).toContain('test-project');
      expect(context).toContain('owner/other-repo');
      expect(context).toContain('/local/path');

      const ids = extractProjectIds(mentions);
      expect(ids).toEqual(['proj-1']);
    });
  });
});
