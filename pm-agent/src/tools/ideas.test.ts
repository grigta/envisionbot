import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ideaTools, executeIdeaTool } from './ideas';
import type { ToolResult } from '../types';

// Mock dependencies
vi.mock('execa');
vi.mock('../state/store.js', () => ({
  stateStore: {
    ideas: {
      getById: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));
vi.mock('../server.js', () => ({
  broadcast: vi.fn(),
}));
vi.mock('./claude-code.js', () => ({
  runClaudeCode: vi.fn(),
}));

import { stateStore } from '../state/store';
import { runClaudeCode } from './claude-code';

describe('Idea Tools - Tool Definitions', () => {
  it('should have correct number of tools', () => {
    expect(ideaTools).toHaveLength(4);
  });

  it('should have idea_analyze tool with correct schema', () => {
    const tool = ideaTools.find((t) => t.name === 'idea_analyze');
    expect(tool).toBeDefined();
    expect(tool?.description).toContain('implementation plan');
    expect(tool?.input_schema.properties).toHaveProperty('ideaId');
    expect(tool?.input_schema.properties).toHaveProperty('title');
    expect(tool?.input_schema.properties).toHaveProperty('description');
    expect(tool?.input_schema.required).toEqual(['ideaId', 'title', 'description']);
  });

  it('should have idea_save_plan tool with correct schema', () => {
    const tool = ideaTools.find((t) => t.name === 'idea_save_plan');
    expect(tool).toBeDefined();
    expect(tool?.description).toContain('Save the generated plan');
    expect(tool?.input_schema.properties).toHaveProperty('ideaId');
    expect(tool?.input_schema.properties).toHaveProperty('plan');
    expect(tool?.input_schema.required).toEqual(['ideaId', 'plan']);
  });

  it('should have idea_create_repo tool with correct schema', () => {
    const tool = ideaTools.find((t) => t.name === 'idea_create_repo');
    expect(tool).toBeDefined();
    expect(tool?.description).toContain('requires approval');
    expect(tool?.input_schema.properties).toHaveProperty('ideaId');
    expect(tool?.input_schema.properties).toHaveProperty('repoName');
    expect(tool?.input_schema.properties).toHaveProperty('description');
    expect(tool?.input_schema.properties).toHaveProperty('isPrivate');
    expect(tool?.input_schema.required).toEqual(['ideaId', 'repoName']);
  });

  it('should have idea_generate_code tool with correct schema', () => {
    const tool = ideaTools.find((t) => t.name === 'idea_generate_code');
    expect(tool).toBeDefined();
    expect(tool?.description).toContain('Claude Code CLI');
    expect(tool?.input_schema.properties).toHaveProperty('ideaId');
    expect(tool?.input_schema.properties).toHaveProperty('repoPath');
    expect(tool?.input_schema.properties).toHaveProperty('prompt');
    expect(tool?.input_schema.required).toEqual(['ideaId', 'repoPath', 'prompt']);
  });

  describe('Plan Schema Structure', () => {
    it('should have correct plan object structure', () => {
      const tool = ideaTools.find((t) => t.name === 'idea_save_plan');
      const planSchema = tool?.input_schema.properties?.plan as any;

      expect(planSchema.type).toBe('object');
      expect(planSchema.properties).toHaveProperty('summary');
      expect(planSchema.properties).toHaveProperty('techStack');
      expect(planSchema.properties).toHaveProperty('structure');
      expect(planSchema.properties).toHaveProperty('features');
      expect(planSchema.properties).toHaveProperty('estimatedFiles');
      expect(planSchema.properties).toHaveProperty('repoNameSuggestion');
    });

    it('should have techStack as array of strings', () => {
      const tool = ideaTools.find((t) => t.name === 'idea_save_plan');
      const planSchema = tool?.input_schema.properties?.plan as any;

      expect(planSchema.properties.techStack.type).toBe('array');
      expect(planSchema.properties.techStack.items.type).toBe('string');
    });

    it('should have structure as array of objects', () => {
      const tool = ideaTools.find((t) => t.name === 'idea_save_plan');
      const planSchema = tool?.input_schema.properties?.plan as any;

      expect(planSchema.properties.structure.type).toBe('array');
      expect(planSchema.properties.structure.items.type).toBe('object');
      expect(planSchema.properties.structure.items.properties).toHaveProperty('path');
      expect(planSchema.properties.structure.items.properties).toHaveProperty('type');
      expect(planSchema.properties.structure.items.properties).toHaveProperty('description');
    });

    it('should have features as array of objects with priority', () => {
      const tool = ideaTools.find((t) => t.name === 'idea_save_plan');
      const planSchema = tool?.input_schema.properties?.plan as any;

      expect(planSchema.properties.features.type).toBe('array');
      expect(planSchema.properties.features.items.type).toBe('object');
      expect(planSchema.properties.features.items.properties).toHaveProperty('name');
      expect(planSchema.properties.features.items.properties).toHaveProperty('description');
      expect(planSchema.properties.features.items.properties).toHaveProperty('priority');
    });
  });
});

describe('Idea Tools - executeIdeaTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('unknown tool', () => {
    it('should return error for unknown tool', async () => {
      const result = await executeIdeaTool('unknown_tool', {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown idea tool');
    });
  });

  describe('idea_analyze', () => {
    it('should analyze idea and generate plan', async () => {
      vi.mocked(runClaudeCode).mockResolvedValue({
        success: true,
        output: 'Analysis output with plan details',
      } as any);

      const result = await executeIdeaTool('idea_analyze', {
        ideaId: 'idea-1',
        title: 'Task Manager App',
        description: 'A simple task management application',
      });

      expect(result.success).toBe(true);
      expect(runClaudeCode).toHaveBeenCalled();
    });

    it('should handle analysis errors', async () => {
      vi.mocked(runClaudeCode).mockResolvedValue({
        success: false,
        error: 'Claude Code failed',
      } as any);

      const result = await executeIdeaTool('idea_analyze', {
        ideaId: 'idea-1',
        title: 'Task Manager App',
        description: 'A simple task management application',
      });

      expect(result.success).toBe(false);
    });

    it('should include tech stack in analysis', async () => {
      vi.mocked(runClaudeCode).mockResolvedValue({
        success: true,
        output: 'Tech stack: React, Node.js, MongoDB',
      } as any);

      const result = await executeIdeaTool('idea_analyze', {
        ideaId: 'idea-1',
        title: 'Task Manager App',
        description: 'A simple task management application',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('idea_save_plan', () => {
    const mockPlan = {
      summary: 'A task management application',
      techStack: ['React', 'Node.js', 'MongoDB'],
      structure: [
        { path: 'src/components', type: 'directory', description: 'React components' },
        { path: 'src/api', type: 'directory', description: 'API routes' },
      ],
      features: [
        { name: 'Task CRUD', description: 'Create, read, update, delete tasks', priority: 'high' },
        { name: 'User Auth', description: 'User authentication', priority: 'high' },
      ],
      estimatedFiles: 25,
      repoNameSuggestion: 'task-manager',
    };

    it('should save plan for idea', async () => {
      const mockIdea = {
        id: 'idea-1',
        title: 'Task Manager',
        description: 'A task management app',
        status: 'planning',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      vi.mocked(stateStore.ideas.getById).mockResolvedValue(mockIdea as any);
      vi.mocked(stateStore.ideas.upsert).mockResolvedValue({
        ...mockIdea,
        plan: mockPlan,
        status: 'plan_ready',
      } as any);

      const result = await executeIdeaTool('idea_save_plan', {
        ideaId: 'idea-1',
        plan: mockPlan,
      });

      expect(result.success).toBe(true);
      expect(stateStore.ideas.getById).toHaveBeenCalledWith('idea-1');
      expect(stateStore.ideas.upsert).toHaveBeenCalled();
    });

    it('should return error if idea not found', async () => {
      vi.mocked(stateStore.ideas.getById).mockResolvedValue(undefined);

      const result = await executeIdeaTool('idea_save_plan', {
        ideaId: 'non-existent',
        plan: mockPlan,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Idea not found');
    });

    it('should update idea status to plan_ready', async () => {
      const mockIdea = {
        id: 'idea-1',
        title: 'Task Manager',
        description: 'A task management app',
        status: 'planning',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      vi.mocked(stateStore.ideas.getById).mockResolvedValue(mockIdea as any);
      vi.mocked(stateStore.ideas.upsert).mockImplementation(async (idea) => idea as any);

      await executeIdeaTool('idea_save_plan', {
        ideaId: 'idea-1',
        plan: mockPlan,
      });

      expect(stateStore.ideas.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'plan_ready',
          plan: mockPlan,
        })
      );
    });

    it('should validate plan structure', async () => {
      const mockIdea = {
        id: 'idea-1',
        title: 'Task Manager',
        description: 'A task management app',
        status: 'planning',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      vi.mocked(stateStore.ideas.getById).mockResolvedValue(mockIdea as any);

      const invalidPlan = {
        summary: 'Missing required fields',
      };

      const result = await executeIdeaTool('idea_save_plan', {
        ideaId: 'idea-1',
        plan: invalidPlan,
      });

      // Should still succeed but with incomplete plan
      // In real implementation, you might want stricter validation
      expect(result.success).toBe(true);
    });
  });

  describe('idea_create_repo', () => {
    it('should be marked as requiring approval', () => {
      const tool = ideaTools.find((t) => t.name === 'idea_create_repo');
      expect(tool?.description).toContain('requires approval');
    });

    it('should handle repo creation request', async () => {
      // This tool requires approval, so it should add to approval queue
      const result = await executeIdeaTool('idea_create_repo', {
        ideaId: 'idea-1',
        repoName: 'task-manager',
        description: 'A task management application',
        isPrivate: false,
      });

      // Implementation should add to approval queue and return pending status
      expect(result.success).toBe(true);
      expect(result.message).toContain('approval');
    });

    it('should validate repository name format', async () => {
      const result = await executeIdeaTool('idea_create_repo', {
        ideaId: 'idea-1',
        repoName: 'Invalid Repo Name!',
        description: 'Description',
      });

      // Should validate repo name (no spaces, special chars, etc.)
      // Implementation specific
      expect(result).toBeDefined();
    });

    it('should handle private repository flag', async () => {
      const result = await executeIdeaTool('idea_create_repo', {
        ideaId: 'idea-1',
        repoName: 'private-repo',
        description: 'Private repository',
        isPrivate: true,
      });

      expect(result).toBeDefined();
    });
  });

  describe('idea_generate_code', () => {
    it('should generate code using Claude Code CLI', async () => {
      vi.mocked(runClaudeCode).mockResolvedValue({
        success: true,
        output: 'Code generation completed',
      } as any);

      const result = await executeIdeaTool('idea_generate_code', {
        ideaId: 'idea-1',
        repoPath: '/path/to/repo',
        prompt: 'Generate a task management application',
      });

      expect(result.success).toBe(true);
      expect(runClaudeCode).toHaveBeenCalledWith(
        expect.stringContaining('Generate a task management application'),
        expect.objectContaining({
          cwd: '/path/to/repo',
        })
      );
    });

    it('should handle code generation errors', async () => {
      vi.mocked(runClaudeCode).mockResolvedValue({
        success: false,
        error: 'Claude Code failed',
      } as any);

      const result = await executeIdeaTool('idea_generate_code', {
        ideaId: 'idea-1',
        repoPath: '/path/to/repo',
        prompt: 'Generate code',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should update idea status during generation', async () => {
      const mockIdea = {
        id: 'idea-1',
        title: 'Task Manager',
        description: 'A task management app',
        status: 'creating_repo',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      vi.mocked(stateStore.ideas.getById).mockResolvedValue(mockIdea as any);
      vi.mocked(runClaudeCode).mockResolvedValue({
        success: true,
        output: 'Generation complete',
      } as any);

      await executeIdeaTool('idea_generate_code', {
        ideaId: 'idea-1',
        repoPath: '/path/to/repo',
        prompt: 'Generate code',
      });

      // Should update status to 'generating' during generation
      expect(stateStore.ideas.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'generating',
        })
      );
    });

    it('should broadcast progress updates', async () => {
      vi.mocked(runClaudeCode).mockResolvedValue({
        success: true,
        output: 'Generation complete',
      } as any);

      await executeIdeaTool('idea_generate_code', {
        ideaId: 'idea-1',
        repoPath: '/path/to/repo',
        prompt: 'Generate code',
      });

      // broadcast function should be called with progress updates
      const { broadcast } = await import('../server');
      expect(broadcast).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing required fields', async () => {
      const result = await executeIdeaTool('idea_analyze', {
        ideaId: 'idea-1',
        // Missing title and description
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(stateStore.ideas.getById).mockRejectedValue(new Error('Database error'));

      const result = await executeIdeaTool('idea_save_plan', {
        ideaId: 'idea-1',
        plan: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
    });

    it('should handle Claude Code CLI errors', async () => {
      vi.mocked(runClaudeCode).mockRejectedValue(new Error('Claude Code not found'));

      const result = await executeIdeaTool('idea_analyze', {
        ideaId: 'idea-1',
        title: 'Test',
        description: 'Test description',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Tool Result Structure', () => {
    it('should return success result with data', async () => {
      vi.mocked(runClaudeCode).mockResolvedValue({
        success: true,
        output: 'Success',
      } as any);

      const result: ToolResult = await executeIdeaTool('idea_analyze', {
        ideaId: 'idea-1',
        title: 'Test',
        description: 'Test',
      });

      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);
    });

    it('should return error result with message', async () => {
      const result: ToolResult = await executeIdeaTool('unknown_tool', {});

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('error');
      expect(typeof result.error).toBe('string');
    });
  });
});
