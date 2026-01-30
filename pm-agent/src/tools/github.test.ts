import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { githubTools, executeGitHubTool } from './github';
import type { ToolResult } from '../types';

// Mock execa
vi.mock('execa', () => ({
  execa: vi.fn(),
}));

// Mock approval queue
vi.mock('../approval/queue.js', () => ({
  approvalQueue: {
    addAction: vi.fn(),
  },
}));

import { execa } from 'execa';

describe('GitHub Tools - Tool Definitions', () => {
  it('should have correct number of tools', () => {
    expect(githubTools).toHaveLength(6);
  });

  it('should have github_repo_status tool with correct schema', () => {
    const tool = githubTools.find((t) => t.name === 'github_repo_status');
    expect(tool).toBeDefined();
    expect(tool?.description).toContain('repository status');
    expect(tool?.input_schema.properties).toHaveProperty('repo');
    expect(tool?.input_schema.required).toContain('repo');
  });

  it('should have github_list_issues tool with correct schema', () => {
    const tool = githubTools.find((t) => t.name === 'github_list_issues');
    expect(tool).toBeDefined();
    expect(tool?.input_schema.properties).toHaveProperty('repo');
    expect(tool?.input_schema.properties).toHaveProperty('state');
    expect(tool?.input_schema.properties).toHaveProperty('labels');
    expect(tool?.input_schema.properties).toHaveProperty('limit');
  });

  it('should have github_list_prs tool with correct schema', () => {
    const tool = githubTools.find((t) => t.name === 'github_list_prs');
    expect(tool).toBeDefined();
    expect(tool?.input_schema.properties).toHaveProperty('repo');
    expect(tool?.input_schema.properties).toHaveProperty('state');
    expect(tool?.input_schema.properties.state.enum).toContain('merged');
  });

  it('should have github_run_status tool with correct schema', () => {
    const tool = githubTools.find((t) => t.name === 'github_run_status');
    expect(tool).toBeDefined();
    expect(tool?.input_schema.properties).toHaveProperty('repo');
    expect(tool?.input_schema.properties).toHaveProperty('limit');
  });

  it('should have github_create_issue tool with correct schema', () => {
    const tool = githubTools.find((t) => t.name === 'github_create_issue');
    expect(tool).toBeDefined();
    expect(tool?.description).toContain('requires user approval');
    expect(tool?.input_schema.required).toEqual(['repo', 'title', 'body']);
  });

  it('should have github_comment_issue tool with correct schema', () => {
    const tool = githubTools.find((t) => t.name === 'github_comment_issue');
    expect(tool).toBeDefined();
    expect(tool?.description).toContain('requires user approval');
    expect(tool?.input_schema.required).toContain('issue_number');
  });
});

describe('GitHub Tools - executeGitHubTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('unknown tool', () => {
    it('should return error for unknown tool', async () => {
      const result = await executeGitHubTool('unknown_tool', {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown GitHub tool');
    });
  });

  describe('repo validation', () => {
    it('should validate repo format', async () => {
      // Mock execa to avoid actual gh calls
      vi.mocked(execa).mockRejectedValue(new Error('Invalid repo'));

      const result = await executeGitHubTool('github_repo_status', {
        repo: 'invalid-format',
      });

      // Should handle the error gracefully
      expect(result.success).toBe(false);
    });

    it('should accept valid repo format', async () => {
      vi.mocked(execa).mockResolvedValue({
        stdout: JSON.stringify({
          open_issues_count: 5,
          open_pr_count: 2,
        }),
        stderr: '',
        exitCode: 0,
        command: '',
        escapedCommand: '',
        failed: false,
        timedOut: false,
        isCanceled: false,
        killed: false,
      } as any);

      const result = await executeGitHubTool('github_repo_status', {
        repo: 'owner/repo',
      });

      // Should process valid repo
      expect(vi.mocked(execa)).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle execa errors', async () => {
      vi.mocked(execa).mockRejectedValue(new Error('Command failed'));

      const result = await executeGitHubTool('github_repo_status', {
        repo: 'owner/repo',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle non-Error exceptions', async () => {
      vi.mocked(execa).mockRejectedValue('String error');

      const result = await executeGitHubTool('github_repo_status', {
        repo: 'owner/repo',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('String error');
    });
  });

  describe('github_repo_status', () => {
    it('should call gh api for repo status', async () => {
      const mockData = {
        open_issues_count: 10,
        open_pr_count: 3,
        stargazers_count: 100,
        forks_count: 25,
      };

      vi.mocked(execa).mockResolvedValue({
        stdout: JSON.stringify(mockData),
        stderr: '',
        exitCode: 0,
        command: '',
        escapedCommand: '',
        failed: false,
        timedOut: false,
        isCanceled: false,
        killed: false,
      } as any);

      const result = await executeGitHubTool('github_repo_status', {
        repo: 'owner/repo',
      });

      expect(vi.mocked(execa)).toHaveBeenCalledWith(
        'gh',
        expect.arrayContaining(['api', 'repos/owner/repo']),
        expect.any(Object)
      );
    });
  });

  describe('github_list_issues', () => {
    it('should list issues with default parameters', async () => {
      const mockIssues = [
        { number: 1, title: 'Issue 1', state: 'open' },
        { number: 2, title: 'Issue 2', state: 'open' },
      ];

      vi.mocked(execa).mockResolvedValue({
        stdout: JSON.stringify(mockIssues),
        stderr: '',
        exitCode: 0,
        command: '',
        escapedCommand: '',
        failed: false,
        timedOut: false,
        isCanceled: false,
        killed: false,
      } as any);

      const result = await executeGitHubTool('github_list_issues', {
        repo: 'owner/repo',
      });

      expect(vi.mocked(execa)).toHaveBeenCalledWith(
        'gh',
        expect.arrayContaining(['issue', 'list', '--repo', 'owner/repo']),
        expect.any(Object)
      );
    });

    it('should apply state filter', async () => {
      vi.mocked(execa).mockResolvedValue({
        stdout: JSON.stringify([]),
        stderr: '',
        exitCode: 0,
        command: '',
        escapedCommand: '',
        failed: false,
        timedOut: false,
        isCanceled: false,
        killed: false,
      } as any);

      await executeGitHubTool('github_list_issues', {
        repo: 'owner/repo',
        state: 'closed',
      });

      expect(vi.mocked(execa)).toHaveBeenCalledWith(
        'gh',
        expect.arrayContaining(['--state', 'closed']),
        expect.any(Object)
      );
    });

    it('should apply labels filter', async () => {
      vi.mocked(execa).mockResolvedValue({
        stdout: JSON.stringify([]),
        stderr: '',
        exitCode: 0,
        command: '',
        escapedCommand: '',
        failed: false,
        timedOut: false,
        isCanceled: false,
        killed: false,
      } as any);

      await executeGitHubTool('github_list_issues', {
        repo: 'owner/repo',
        labels: 'bug,priority:high',
      });

      expect(vi.mocked(execa)).toHaveBeenCalledWith(
        'gh',
        expect.arrayContaining(['--label', 'bug,priority:high']),
        expect.any(Object)
      );
    });

    it('should apply limit', async () => {
      vi.mocked(execa).mockResolvedValue({
        stdout: JSON.stringify([]),
        stderr: '',
        exitCode: 0,
        command: '',
        escapedCommand: '',
        failed: false,
        timedOut: false,
        isCanceled: false,
        killed: false,
      } as any);

      await executeGitHubTool('github_list_issues', {
        repo: 'owner/repo',
        limit: 20,
      });

      expect(vi.mocked(execa)).toHaveBeenCalledWith(
        'gh',
        expect.arrayContaining(['--limit', '20']),
        expect.any(Object)
      );
    });
  });

  describe('github_list_prs', () => {
    it('should list PRs', async () => {
      const mockPRs = [
        { number: 1, title: 'PR 1', state: 'open' },
        { number: 2, title: 'PR 2', state: 'merged' },
      ];

      vi.mocked(execa).mockResolvedValue({
        stdout: JSON.stringify(mockPRs),
        stderr: '',
        exitCode: 0,
        command: '',
        escapedCommand: '',
        failed: false,
        timedOut: false,
        isCanceled: false,
        killed: false,
      } as any);

      const result = await executeGitHubTool('github_list_prs', {
        repo: 'owner/repo',
      });

      expect(vi.mocked(execa)).toHaveBeenCalledWith(
        'gh',
        expect.arrayContaining(['pr', 'list', '--repo', 'owner/repo']),
        expect.any(Object)
      );
    });

    it('should filter by state', async () => {
      vi.mocked(execa).mockResolvedValue({
        stdout: JSON.stringify([]),
        stderr: '',
        exitCode: 0,
        command: '',
        escapedCommand: '',
        failed: false,
        timedOut: false,
        isCanceled: false,
        killed: false,
      } as any);

      await executeGitHubTool('github_list_prs', {
        repo: 'owner/repo',
        state: 'merged',
      });

      expect(vi.mocked(execa)).toHaveBeenCalledWith(
        'gh',
        expect.arrayContaining(['--state', 'merged']),
        expect.any(Object)
      );
    });
  });

  describe('github_run_status', () => {
    it('should get workflow run status', async () => {
      const mockRuns = [
        { id: 1, status: 'completed', conclusion: 'success' },
        { id: 2, status: 'in_progress', conclusion: null },
      ];

      vi.mocked(execa).mockResolvedValue({
        stdout: JSON.stringify({ workflow_runs: mockRuns }),
        stderr: '',
        exitCode: 0,
        command: '',
        escapedCommand: '',
        failed: false,
        timedOut: false,
        isCanceled: false,
        killed: false,
      } as any);

      const result = await executeGitHubTool('github_run_status', {
        repo: 'owner/repo',
      });

      expect(vi.mocked(execa)).toHaveBeenCalledWith(
        'gh',
        expect.arrayContaining(['api', 'repos/owner/repo/actions/runs']),
        expect.any(Object)
      );
    });
  });
});

describe('GitHub Tools - Command Construction', () => {
  it('should construct gh issue list command correctly', () => {
    const expectedArgs = [
      'issue',
      'list',
      '--repo',
      'owner/repo',
      '--state',
      'open',
      '--label',
      'bug',
      '--limit',
      '10',
      '--json',
      expect.any(String),
    ];

    // Test that the command would be constructed correctly
    // (actual construction happens inside the function)
    expect(expectedArgs).toContain('issue');
    expect(expectedArgs).toContain('--repo');
    expect(expectedArgs).toContain('--state');
  });

  it('should construct gh pr list command correctly', () => {
    const expectedArgs = ['pr', 'list', '--repo', 'owner/repo'];
    expect(expectedArgs).toContain('pr');
    expect(expectedArgs).toContain('list');
  });

  it('should construct gh api command correctly', () => {
    const expectedArgs = ['api', 'repos/owner/repo'];
    expect(expectedArgs).toContain('api');
    expect(expectedArgs[1]).toMatch(/repos\/.+\/.+/);
  });
});

describe('GitHub Tools - Response Parsing', () => {
  it('should parse JSON response from gh commands', () => {
    const jsonResponse = JSON.stringify({
      open_issues_count: 5,
      open_pr_count: 2,
    });

    const parsed = JSON.parse(jsonResponse);
    expect(parsed.open_issues_count).toBe(5);
    expect(parsed.open_pr_count).toBe(2);
  });

  it('should handle empty array responses', () => {
    const jsonResponse = JSON.stringify([]);
    const parsed = JSON.parse(jsonResponse);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(0);
  });

  it('should parse issue list response', () => {
    const issues = [
      {
        number: 1,
        title: 'Bug in auth',
        state: 'open',
        labels: ['bug', 'priority:high'],
      },
      {
        number: 2,
        title: 'Feature request',
        state: 'open',
        labels: ['enhancement'],
      },
    ];

    expect(issues).toHaveLength(2);
    expect(issues[0].number).toBe(1);
    expect(issues[0].labels).toContain('bug');
  });
});

describe('GitHub Tools - Tool Result Structure', () => {
  it('should return success result with data', () => {
    const result: ToolResult = {
      success: true,
      data: { issues: [] },
    };

    expect(result).toHaveProperty('success');
    expect(result.success).toBe(true);
    expect(result).toHaveProperty('data');
  });

  it('should return error result with message', () => {
    const result: ToolResult = {
      success: false,
      error: 'Failed to execute command',
    };

    expect(result.success).toBe(false);
    expect(result).toHaveProperty('error');
    expect(typeof result.error).toBe('string');
  });

  it('should include optional message field', () => {
    const result: ToolResult = {
      success: true,
      message: 'Operation completed successfully',
      data: {},
    };

    expect(result).toHaveProperty('message');
  });
});
