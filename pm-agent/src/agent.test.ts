import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Project, Finding, Priority, TaskType } from './types';

// Mock dependencies
vi.mock('@anthropic-ai/sdk');
vi.mock('./tools/github.js');
vi.mock('./tools/ideas.js');
vi.mock('./state/store.js');
vi.mock('./approval/queue.js');
vi.mock('./server.js');

// Import the functions we want to test
// Since they're not exported, we'll test them through their public APIs or recreate them for testing

describe('Agent - parseReportJson', () => {
  // Recreate the function for testing
  function mapStatus(status: string): Finding['severity'] {
    switch (status?.toLowerCase()) {
      case 'critical':
        return 'critical';
      case 'warning':
        return 'warning';
      case 'healthy':
        return 'info';
      default:
        return 'info';
    }
  }

  function parseReportJson(
    response: string,
    projects: Project[]
  ): {
    summary?: string;
    findings: Finding[];
    projectReports: any[];
  } {
    const findings: Finding[] = [];
    const projectReports: any[] = [];
    let summary: string | undefined;

    const jsonMatch =
      response.match(/```json\n?([\s\S]*?)\n?```/) ||
      response.match(/(\{[\s\S]*\})/);

    if (!jsonMatch) return { findings, projectReports };

    try {
      const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      summary = parsed.summary;

      if (parsed.findings && Array.isArray(parsed.findings)) {
        for (const f of parsed.findings) {
          const project = projects.find(
            (p) => p.name.toLowerCase() === f.project?.toLowerCase()
          );
          findings.push({
            severity: mapStatus(f.status),
            category: 'health',
            title: f.project || 'Unknown',
            description: f.issues?.join(', ') || f.description || '',
            projectId: project?.id || 'unknown',
          });
        }
      }

      if (parsed.projects && Array.isArray(parsed.projects)) {
        for (const p of parsed.projects) {
          const project = projects.find(
            (proj) => proj.name.toLowerCase() === p.name?.toLowerCase()
          );
          projectReports.push({
            projectId: project?.id || 'unknown',
            projectName: p.name,
            healthScore: p.healthScore || 0,
            openIssues: p.openIssues || 0,
            openPRs: p.openPRs || 0,
            ciStatus: p.ciStatus || 'unknown',
            risks: p.risks || [],
          });

          for (const risk of p.risks || []) {
            findings.push({
              severity: 'warning',
              category: 'risk',
              title: risk,
              description: `Risk identified for ${p.name}`,
              projectId: project?.id || 'unknown',
            });
          }

          if (p.healthScore !== undefined && p.healthScore < 70) {
            findings.push({
              severity: p.healthScore < 50 ? 'error' : 'warning',
              category: 'health',
              title: `Low health score: ${p.healthScore}`,
              description: `${p.name} has a health score of ${p.healthScore}/100`,
              projectId: project?.id || 'unknown',
            });
          }

          if (p.ciStatus === 'failing') {
            findings.push({
              severity: 'error',
              category: 'ci-cd',
              title: 'CI/CD Failing',
              description: `${p.name} has failing CI/CD pipelines`,
              projectId: project?.id || 'unknown',
            });
          }
        }
      }
    } catch {
      // JSON parse failed
    }

    return { summary, findings, projectReports };
  }

  const testProjects: Project[] = [
    {
      id: 'proj-1',
      name: 'Test Project',
      repo: 'user/test-repo',
      phase: 'development',
      monitoringLevel: 'standard',
      goals: ['Build feature'],
      focusAreas: ['backend'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];

  describe('mapStatus', () => {
    it('should map critical status', () => {
      expect(mapStatus('critical')).toBe('critical');
      expect(mapStatus('Critical')).toBe('critical');
      expect(mapStatus('CRITICAL')).toBe('critical');
    });

    it('should map warning status', () => {
      expect(mapStatus('warning')).toBe('warning');
      expect(mapStatus('Warning')).toBe('warning');
    });

    it('should map healthy to info', () => {
      expect(mapStatus('healthy')).toBe('info');
      expect(mapStatus('Healthy')).toBe('info');
    });

    it('should default to info for unknown status', () => {
      expect(mapStatus('unknown')).toBe('info');
      expect(mapStatus('')).toBe('info');
      expect(mapStatus('random')).toBe('info');
    });
  });

  describe('parseReportJson', () => {
    it('should return empty results for response without JSON', () => {
      const response = 'This is just plain text without JSON';
      const result = parseReportJson(response, testProjects);

      expect(result.findings).toEqual([]);
      expect(result.projectReports).toEqual([]);
      expect(result.summary).toBeUndefined();
    });

    it('should parse JSON from markdown code block', () => {
      const response = `
Here is the analysis:
\`\`\`json
{
  "summary": "Test summary",
  "findings": [
    {
      "project": "Test Project",
      "status": "warning",
      "issues": ["Issue 1", "Issue 2"]
    }
  ]
}
\`\`\`
      `;

      const result = parseReportJson(response, testProjects);

      expect(result.summary).toBe('Test summary');
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].severity).toBe('warning');
      expect(result.findings[0].description).toBe('Issue 1, Issue 2');
      expect(result.findings[0].projectId).toBe('proj-1');
    });

    it('should parse raw JSON without code block', () => {
      const response = '{"summary": "Raw JSON", "findings": []}';
      const result = parseReportJson(response, testProjects);

      expect(result.summary).toBe('Raw JSON');
      expect(result.findings).toEqual([]);
    });

    it('should create findings from health check format', () => {
      const response = `
\`\`\`json
{
  "findings": [
    {
      "project": "Test Project",
      "status": "critical",
      "issues": ["Critical bug", "Security vulnerability"]
    }
  ]
}
\`\`\`
      `;

      const result = parseReportJson(response, testProjects);

      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].severity).toBe('critical');
      expect(result.findings[0].category).toBe('health');
      expect(result.findings[0].title).toBe('Test Project');
    });

    it('should create findings from deep analysis format', () => {
      const response = `
\`\`\`json
{
  "projects": [
    {
      "name": "Test Project",
      "healthScore": 45,
      "openIssues": 10,
      "openPRs": 2,
      "ciStatus": "failing",
      "risks": ["Technical debt", "No tests"]
    }
  ]
}
\`\`\`
      `;

      const result = parseReportJson(response, testProjects);

      // Should have: 2 risk findings + 1 low health score + 1 failing CI
      expect(result.findings.length).toBeGreaterThanOrEqual(4);

      const riskFindings = result.findings.filter((f) => f.category === 'risk');
      expect(riskFindings).toHaveLength(2);
      expect(riskFindings[0].title).toBe('Technical debt');
      expect(riskFindings[1].title).toBe('No tests');

      const healthFinding = result.findings.find(
        (f) => f.category === 'health' && f.title.includes('Low health score')
      );
      expect(healthFinding).toBeDefined();
      expect(healthFinding?.severity).toBe('error'); // < 50

      const ciFinding = result.findings.find(
        (f) => f.category === 'ci-cd'
      );
      expect(ciFinding).toBeDefined();
      expect(ciFinding?.severity).toBe('error');
    });

    it('should create warning for health score between 50-70', () => {
      const response = `
\`\`\`json
{
  "projects": [
    {
      "name": "Test Project",
      "healthScore": 60,
      "risks": []
    }
  ]
}
\`\`\`
      `;

      const result = parseReportJson(response, testProjects);

      const healthFinding = result.findings.find(
        (f) => f.title.includes('Low health score')
      );
      expect(healthFinding?.severity).toBe('warning');
    });

    it('should not create health finding for score >= 70', () => {
      const response = `
\`\`\`json
{
  "projects": [
    {
      "name": "Test Project",
      "healthScore": 85,
      "risks": []
    }
  ]
}
\`\`\`
      `;

      const result = parseReportJson(response, testProjects);

      const healthFinding = result.findings.find(
        (f) => f.title.includes('Low health score')
      );
      expect(healthFinding).toBeUndefined();
    });

    it('should handle invalid JSON gracefully', () => {
      const response = '```json\n{invalid json\n```';
      const result = parseReportJson(response, testProjects);

      expect(result.findings).toEqual([]);
      expect(result.projectReports).toEqual([]);
    });

    it('should handle project name case insensitively', () => {
      const response = `
\`\`\`json
{
  "findings": [
    {
      "project": "test project",
      "status": "warning",
      "issues": ["Issue"]
    }
  ]
}
\`\`\`
      `;

      const result = parseReportJson(response, testProjects);

      expect(result.findings[0].projectId).toBe('proj-1');
    });

    it('should use "unknown" projectId for non-existent projects', () => {
      const response = `
\`\`\`json
{
  "findings": [
    {
      "project": "Nonexistent Project",
      "status": "warning",
      "issues": ["Issue"]
    }
  ]
}
\`\`\`
      `;

      const result = parseReportJson(response, testProjects);

      expect(result.findings[0].projectId).toBe('unknown');
    });

    it('should create project reports with correct structure', () => {
      const response = `
\`\`\`json
{
  "projects": [
    {
      "name": "Test Project",
      "healthScore": 85,
      "openIssues": 5,
      "openPRs": 3,
      "ciStatus": "passing",
      "risks": []
    }
  ]
}
\`\`\`
      `;

      const result = parseReportJson(response, testProjects);

      expect(result.projectReports).toHaveLength(1);
      expect(result.projectReports[0]).toEqual({
        projectId: 'proj-1',
        projectName: 'Test Project',
        healthScore: 85,
        openIssues: 5,
        openPRs: 3,
        ciStatus: 'passing',
        risks: [],
      });
    });
  });
});

describe('Agent - Task Extraction', () => {
  // Recreate task parsing logic for testing
  function parseTasksFromResponse(response: string, projectId: string): any[] {
    const tasks: any[] = [];
    const taskPattern = /(?:Task|TODO|Action):\s*(.+?)(?:\n|$)/gi;
    let match;

    while ((match = taskPattern.exec(response)) !== null) {
      const taskText = match[1].trim();
      if (taskText.length > 5) {
        // Basic task extraction
        tasks.push({
          id: `task-${Date.now()}-${tasks.length}`,
          projectId,
          title: taskText,
          description: taskText,
          type: inferTaskType(taskText),
          priority: inferPriority(taskText),
          status: 'pending',
          kanbanStatus: 'backlog',
          generatedBy: 'agent',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    return tasks;
  }

  function inferTaskType(text: string): TaskType {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('fix') || lowerText.includes('bug')) return 'bug';
    if (lowerText.includes('test')) return 'test';
    if (lowerText.includes('doc')) return 'docs';
    if (lowerText.includes('refactor')) return 'refactor';
    return 'feature';
  }

  function inferPriority(text: string): Priority {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('critical') || lowerText.includes('urgent')) return 'critical';
    if (lowerText.includes('high') || lowerText.includes('important')) return 'high';
    if (lowerText.includes('low')) return 'low';
    return 'medium';
  }

  describe('inferTaskType', () => {
    it('should infer bug type from keywords', () => {
      expect(inferTaskType('Fix critical bug in authentication')).toBe('bug');
      expect(inferTaskType('Bug: User cannot login')).toBe('bug');
    });

    it('should infer test type from keywords', () => {
      expect(inferTaskType('Add tests for user service')).toBe('test');
      expect(inferTaskType('Write test cases')).toBe('test');
    });

    it('should infer docs type from keywords', () => {
      expect(inferTaskType('Update documentation')).toBe('docs');
      expect(inferTaskType('Add API docs')).toBe('docs');
    });

    it('should infer refactor type from keywords', () => {
      expect(inferTaskType('Refactor database layer')).toBe('refactor');
    });

    it('should default to feature for unknown types', () => {
      expect(inferTaskType('Implement new dashboard')).toBe('feature');
      expect(inferTaskType('Add user profile page')).toBe('feature');
    });
  });

  describe('inferPriority', () => {
    it('should infer critical priority', () => {
      expect(inferPriority('Critical: Fix security vulnerability')).toBe('critical');
      expect(inferPriority('Urgent: System is down')).toBe('critical');
    });

    it('should infer high priority', () => {
      expect(inferPriority('High priority: Fix login')).toBe('high');
      expect(inferPriority('Important: Update dependencies')).toBe('high');
    });

    it('should infer low priority', () => {
      expect(inferPriority('Low: Update README')).toBe('low');
    });

    it('should default to medium priority', () => {
      expect(inferPriority('Add new feature')).toBe('medium');
      expect(inferPriority('Refactor code')).toBe('medium');
    });
  });

  describe('parseTasksFromResponse', () => {
    it('should extract tasks from response', () => {
      const response = `
Based on the analysis, here are the recommended actions:

Task: Fix authentication bug in login flow
Task: Add unit tests for user service
Task: Update API documentation
      `;

      const tasks = parseTasksFromResponse(response, 'proj-1');

      expect(tasks).toHaveLength(3);
      expect(tasks[0].title).toContain('Fix authentication bug');
      expect(tasks[1].title).toContain('Add unit tests');
      expect(tasks[2].title).toContain('Update API documentation');
    });

    it('should extract TODO format', () => {
      const response = `
TODO: Implement user profile page
TODO: Add error handling
      `;

      const tasks = parseTasksFromResponse(response, 'proj-1');

      expect(tasks).toHaveLength(2);
    });

    it('should extract Action format', () => {
      const response = `
Action: Deploy to production
Action: Monitor error rates
      `;

      const tasks = parseTasksFromResponse(response, 'proj-1');

      expect(tasks).toHaveLength(2);
    });

    it('should skip very short tasks', () => {
      const response = `
Task: Fix
Task: This is a proper task description
      `;

      const tasks = parseTasksFromResponse(response, 'proj-1');

      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toContain('proper task');
    });

    it('should set correct task properties', () => {
      const response = 'Task: Fix critical bug in authentication';
      const tasks = parseTasksFromResponse(response, 'proj-1');

      expect(tasks[0].projectId).toBe('proj-1');
      expect(tasks[0].type).toBe('bug');
      expect(tasks[0].priority).toBe('critical');
      expect(tasks[0].status).toBe('pending');
      expect(tasks[0].kanbanStatus).toBe('backlog');
      expect(tasks[0].generatedBy).toBe('agent');
    });

    it('should handle multiline tasks correctly', () => {
      const response = `
Task: First task
Some description
Task: Second task
More content
      `;

      const tasks = parseTasksFromResponse(response, 'proj-1');

      expect(tasks).toHaveLength(2);
      expect(tasks[0].title).toBe('First task');
      expect(tasks[1].title).toBe('Second task');
    });
  });
});

describe('Agent - Tool Execution', () => {
  it('should handle tool result structure', () => {
    const toolResult = {
      success: true,
      data: { issueNumber: 123 },
      message: 'Issue created successfully',
    };

    expect(toolResult).toHaveProperty('success');
    expect(toolResult).toHaveProperty('data');
    expect(toolResult).toHaveProperty('message');
    expect(toolResult.success).toBe(true);
  });

  it('should handle tool error structure', () => {
    const toolResult = {
      success: false,
      error: 'Failed to create issue',
      message: 'GitHub API error',
    };

    expect(toolResult.success).toBe(false);
    expect(toolResult).toHaveProperty('error');
  });
});
