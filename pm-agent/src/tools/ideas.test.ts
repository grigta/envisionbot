import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ideaTools, executeIdeaTool } from './ideas';

// Mock dependencies
vi.mock('execa', () => ({
  execa: vi.fn(),
}));

vi.mock('../state/store.js', () => ({
  stateStore: {
    getIdea: vi.fn(),
    updateIdea: vi.fn(),
    addProject: vi.fn(),
  },
}));

vi.mock('../server.js', () => ({
  broadcast: vi.fn(),
}));

vi.mock('./claude-code.js', () => ({
  runClaudeCode: vi.fn(),
}));

import { execa } from 'execa';
import { stateStore } from '../state/store.js';
import { broadcast } from '../server.js';
import { runClaudeCode } from './claude-code.js';

describe('Idea Tools', () => {
  describe('Tool Definitions', () => {
    it('should have correct number of tools', () => {
      expect(ideaTools).toHaveLength(4);
    });

    it('should have idea_analyze tool with correct schema', () => {
      const tool = ideaTools.find((t) => t.name === 'idea_analyze');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('Analyze an idea');
      expect(tool?.input_schema.properties).toHaveProperty('ideaId');
      expect(tool?.input_schema.properties).toHaveProperty('title');
      expect(tool?.input_schema.properties).toHaveProperty('description');
      expect(tool?.input_schema.required).toEqual(['ideaId', 'title', 'description']);
    });

    it('should have idea_save_plan tool with correct schema', () => {
      const tool = ideaTools.find((t) => t.name === 'idea_save_plan');
      expect(tool).toBeDefined();
      expect(tool?.input_schema.properties).toHaveProperty('ideaId');
      expect(tool?.input_schema.properties).toHaveProperty('plan');
      expect(tool?.input_schema.required).toEqual(['ideaId', 'plan']);
    });

    it('should have idea_create_repo tool with correct schema', () => {
      const tool = ideaTools.find((t) => t.name === 'idea_create_repo');
      expect(tool).toBeDefined();
      expect(tool?.input_schema.properties).toHaveProperty('repoName');
      expect(tool?.input_schema.properties).toHaveProperty('isPrivate');
      expect(tool?.input_schema.required).toEqual(['ideaId', 'repoName']);
    });

    it('should have idea_generate_code tool with correct schema', () => {
      const tool = ideaTools.find((t) => t.name === 'idea_generate_code');
      expect(tool).toBeDefined();
      expect(tool?.input_schema.properties).toHaveProperty('repoPath');
      expect(tool?.input_schema.properties).toHaveProperty('prompt');
      expect(tool?.input_schema.required).toEqual(['ideaId', 'repoPath', 'prompt']);
    });
  });

  describe('executeIdeaTool', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    describe('idea_analyze', () => {
      it('should mark idea as planning', async () => {
        const mockIdea = {
          id: 'idea-1',
          title: 'Test Idea',
          description: 'Test description',
          status: 'pending',
        };

        vi.mocked(stateStore.getIdea).mockReturnValue(mockIdea);

        const result = await executeIdeaTool('idea_analyze', {
          ideaId: 'idea-1',
          title: 'Test Idea',
          description: 'Test description',
        });

        expect(result.success).toBe(true);
        expect(stateStore.updateIdea).toHaveBeenCalledWith('idea-1', {
          status: 'planning',
        });
        expect(broadcast).toHaveBeenCalledWith({
          type: 'idea_updated',
          timestamp: expect.any(Number),
          data: { ideaId: 'idea-1', status: 'planning' },
        });
      });

      it('should return error when idea not found', async () => {
        vi.mocked(stateStore.getIdea).mockReturnValue(null);

        const result = await executeIdeaTool('idea_analyze', {
          ideaId: 'nonexistent',
          title: 'Test',
          description: 'Test',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Idea not found');
      });
    });

    describe('idea_save_plan', () => {
      it('should save plan and mark as plan_ready', async () => {
        const mockIdea = {
          id: 'idea-1',
          title: 'Test Idea',
          status: 'planning',
        };

        const mockPlan = {
          summary: 'Test plan',
          techStack: ['React', 'Node.js'],
          structure: [],
          features: [],
          estimatedFiles: 10,
          repoNameSuggestion: 'test-repo',
        };

        vi.mocked(stateStore.getIdea).mockReturnValue(mockIdea);

        const result = await executeIdeaTool('idea_save_plan', {
          ideaId: 'idea-1',
          plan: mockPlan,
        });

        expect(result.success).toBe(true);
        expect(stateStore.updateIdea).toHaveBeenCalledWith('idea-1', {
          status: 'plan_ready',
          plan: mockPlan,
        });
        expect(broadcast).toHaveBeenCalledWith({
          type: 'idea_plan_ready',
          timestamp: expect.any(Number),
          data: { ideaId: 'idea-1', plan: mockPlan },
        });
      });

      it('should return error when idea not found', async () => {
        vi.mocked(stateStore.getIdea).mockReturnValue(null);

        const result = await executeIdeaTool('idea_save_plan', {
          ideaId: 'nonexistent',
          plan: {},
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Idea not found');
      });
    });

    describe('idea_create_repo', () => {
      it('should require approved status before creating repo', async () => {
        const mockIdea = {
          id: 'idea-1',
          title: 'Test Idea',
          status: 'plan_ready',
        };

        vi.mocked(stateStore.getIdea).mockReturnValue(mockIdea);

        const result = await executeIdeaTool('idea_create_repo', {
          ideaId: 'idea-1',
          repoName: 'test-repo',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('must be approved');
      });

      it('should create repo when idea is approved', async () => {
        const mockIdea = {
          id: 'idea-1',
          title: 'Test Idea',
          status: 'approved',
        };

        vi.mocked(stateStore.getIdea).mockReturnValue(mockIdea);
        vi.mocked(execa).mockResolvedValue({
          stdout: 'Repository created',
          stderr: '',
          exitCode: 0,
        } as any);

        const result = await executeIdeaTool('idea_create_repo', {
          ideaId: 'idea-1',
          repoName: 'test-repo',
          description: 'Test repository',
          isPrivate: false,
        });

        expect(result.success).toBe(true);
        expect(execa).toHaveBeenCalledWith(
          'gh',
          expect.arrayContaining(['repo', 'create', 'test-repo', '--public', '--clone']),
          expect.any(Object)
        );
      });

      it('should handle private repository creation', async () => {
        const mockIdea = {
          id: 'idea-1',
          title: 'Test Idea',
          status: 'approved',
        };

        vi.mocked(stateStore.getIdea).mockReturnValue(mockIdea);
        vi.mocked(execa).mockResolvedValue({
          stdout: 'https://github.com/owner/test-repo',
          stderr: '',
          exitCode: 0,
        } as any);

        await executeIdeaTool('idea_create_repo', {
          ideaId: 'idea-1',
          repoName: 'test-repo',
          isPrivate: true,
        });

        expect(execa).toHaveBeenCalledWith(
          'gh',
          expect.arrayContaining(['--private']),
          expect.any(Object)
        );
      });

      it('should handle repo creation errors', async () => {
        const mockIdea = {
          id: 'idea-1',
          title: 'Test Idea',
          status: 'approved',
        };

        vi.mocked(stateStore.getIdea).mockReturnValue(mockIdea);
        vi.mocked(execa).mockRejectedValue(new Error('Repository already exists'));

        const result = await executeIdeaTool('idea_create_repo', {
          ideaId: 'idea-1',
          repoName: 'test-repo',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Repository already exists');
        expect(stateStore.updateIdea).toHaveBeenCalledWith('idea-1', {
          status: 'failed',
          error: 'Repository already exists',
        });
      });
    });

    describe('idea_generate_code', () => {
      it('should generate code and create project', async () => {
        const mockIdea = {
          id: 'idea-1',
          title: 'Test Idea',
          status: 'creating_repo',
          repoName: 'test-repo',
          plan: {
            features: [
              { name: 'Feature 1', priority: 'core', description: 'Test' },
            ],
          },
        };

        vi.mocked(stateStore.getIdea).mockReturnValue(mockIdea);
        vi.mocked(runClaudeCode).mockResolvedValue({
          success: true,
          output: 'Code generated successfully',
        });
        vi.mocked(execa)
          .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 } as any) // git add
          .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 } as any) // git commit
          .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 } as any) // git push
          .mockResolvedValueOnce({ stdout: 'testuser', stderr: '', exitCode: 0 } as any); // gh api user

        const result = await executeIdeaTool('idea_generate_code', {
          ideaId: 'idea-1',
          repoPath: './test-repo',
          prompt: 'Generate a test project',
        });

        expect(result.success).toBe(true);
        expect(runClaudeCode).toHaveBeenCalledWith('./test-repo', 'Generate a test project');
        expect(stateStore.updateIdea).toHaveBeenCalledWith('idea-1', {
          status: 'generating',
        });
        expect(stateStore.addProject).toHaveBeenCalled();
        expect(broadcast).toHaveBeenCalledWith({
          type: 'idea_launched',
          timestamp: expect.any(Number),
          data: { ideaId: 'idea-1', projectId: expect.any(String) },
        });
      });

      it('should return error when idea not found', async () => {
        vi.mocked(stateStore.getIdea).mockReturnValue(null);

        const result = await executeIdeaTool('idea_generate_code', {
          ideaId: 'nonexistent',
          repoPath: './test-repo',
          prompt: 'Test',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Idea not found');
      });

      it('should handle code generation errors', async () => {
        const mockIdea = {
          id: 'idea-1',
          title: 'Test Idea',
          status: 'creating_repo',
        };

        vi.mocked(stateStore.getIdea).mockReturnValue(mockIdea);
        vi.mocked(runClaudeCode).mockResolvedValue({
          success: false,
          output: 'Code generation failed',
        });

        const result = await executeIdeaTool('idea_generate_code', {
          ideaId: 'idea-1',
          repoPath: './test-repo',
          prompt: 'Test',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Code generation failed');
        expect(stateStore.updateIdea).toHaveBeenCalledWith('idea-1', {
          status: 'failed',
          error: 'Code generation failed',
        });
      });
    });

    describe('Unknown tool', () => {
      it('should return error for unknown tool', async () => {
        const result = await executeIdeaTool('unknown_tool', {});

        expect(result.success).toBe(false);
        expect(result.error).toContain('Unknown idea tool');
      });
    });
  });
});
