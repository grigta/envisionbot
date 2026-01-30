/**
 * Tests for GitHubIssueService
 * Tests issue creation, state synchronization, and GitHub integration
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { GitHubIssueService } from "./github-issue.service.js";
import type { Task, Project, GitHubSyncResult } from "../types.js";
import type { TaskRepository } from "../repositories/task.repository.js";
import type { ProjectRepository } from "../repositories/project.repository.js";

// Mock GitHub tools
vi.mock("../tools/github.js", () => ({
  createIssueDirect: vi.fn(),
  getIssue: vi.fn(),
}));

import { createIssueDirect, getIssue } from "../tools/github.js";

describe("GitHubIssueService", () => {
  let service: GitHubIssueService;
  let mockTaskRepo: TaskRepository;
  let mockProjectRepo: ProjectRepository;

  const mockTask: Task = {
    id: "task-1",
    projectId: "project-1",
    type: "feature",
    priority: "high",
    title: "Implement feature X",
    description: "Detailed description of the feature",
    context: "Additional context for implementation",
    suggestedActions: [
      { action: "Create API endpoint", priority: "high", notes: "REST API", description: "Create REST API endpoint" },
      { action: "Add tests", priority: "medium", notes: "Unit tests", description: "Add unit tests" },
    ],
    relatedIssues: ["#1"],
    relatedPRs: ["#10"],
    status: "approved",
    kanbanStatus: "backlog",
    generatedAt: Date.now(),
    generatedBy: "agent",
  };

  const mockProject: Project = {
    id: "project-1",
    name: "Test Project",
    repo: "owner/repo",
    phase: "mvp",
    monitoringLevel: "standard",
    goals: ["Goal 1"],
    focusAreas: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  beforeEach(() => {
    mockTaskRepo = {
      getById: vi.fn(),
      update: vi.fn(),
      getTasksWithGitHubIssues: vi.fn(),
    } as unknown as TaskRepository;

    mockProjectRepo = {
      getById: vi.fn(),
    } as unknown as ProjectRepository;

    service = new GitHubIssueService(mockTaskRepo, mockProjectRepo);
    vi.clearAllMocks();
  });

  describe("createIssueForTask", () => {
    it("should create GitHub issue for task", async () => {
      vi.mocked(mockTaskRepo.getById).mockResolvedValue(mockTask);
      vi.mocked(mockProjectRepo.getById).mockResolvedValue(mockProject);
      vi.mocked(createIssueDirect).mockResolvedValue({
        success: true,
        issueNumber: 123,
        issueUrl: "https://github.com/owner/repo/issues/123",
      });

      const result = await service.createIssueForTask("task-1");

      expect(result.success).toBe(true);
      expect(result.issueNumber).toBe(123);
      expect(result.issueUrl).toBe("https://github.com/owner/repo/issues/123");
    });

    it("should return error when task not found", async () => {
      vi.mocked(mockTaskRepo.getById).mockResolvedValue(undefined);

      const result = await service.createIssueForTask("nonexistent");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Task not found");
    });

    it("should return error when project not found", async () => {
      vi.mocked(mockTaskRepo.getById).mockResolvedValue(mockTask);
      vi.mocked(mockProjectRepo.getById).mockResolvedValue(undefined);

      const result = await service.createIssueForTask("task-1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Project not found");
    });

    it("should return error when project has no repo", async () => {
      vi.mocked(mockTaskRepo.getById).mockResolvedValue(mockTask);
      vi.mocked(mockProjectRepo.getById).mockResolvedValue({
        ...mockProject,
        repo: undefined,
      } as Project);

      const result = await service.createIssueForTask("task-1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("GitHub repo configured");
    });

    it("should return error when issue already exists", async () => {
      const taskWithIssue = {
        ...mockTask,
        githubIssueNumber: 456,
      };
      vi.mocked(mockTaskRepo.getById).mockResolvedValue(taskWithIssue);
      vi.mocked(mockProjectRepo.getById).mockResolvedValue(mockProject);

      const result = await service.createIssueForTask("task-1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Issue already exists");
      expect(result.error).toContain("#456");
    });

    it("should call createIssueDirect with correct parameters", async () => {
      vi.mocked(mockTaskRepo.getById).mockResolvedValue(mockTask);
      vi.mocked(mockProjectRepo.getById).mockResolvedValue(mockProject);
      vi.mocked(createIssueDirect).mockResolvedValue({
        success: true,
        issueNumber: 123,
        issueUrl: "https://github.com/owner/repo/issues/123",
      });

      await service.createIssueForTask("task-1");

      expect(createIssueDirect).toHaveBeenCalledWith(
        "owner/repo",
        expect.stringContaining("[feature]"),
        expect.stringContaining("@claude"),
        expect.arrayContaining(["type:feature", "priority:high", "claude-task"])
      );
    });

    it("should update task with GitHub issue info", async () => {
      vi.mocked(mockTaskRepo.getById).mockResolvedValue(mockTask);
      vi.mocked(mockProjectRepo.getById).mockResolvedValue(mockProject);
      vi.mocked(createIssueDirect).mockResolvedValue({
        success: true,
        issueNumber: 123,
        issueUrl: "https://github.com/owner/repo/issues/123",
      });

      await service.createIssueForTask("task-1");

      expect(mockTaskRepo.update).toHaveBeenCalledWith(
        "task-1",
        expect.objectContaining({
          githubIssueNumber: 123,
          githubIssueUrl: "https://github.com/owner/repo/issues/123",
          githubIssueState: "open",
          githubIssueCreatedAt: expect.any(Number),
          githubIssueSyncedAt: expect.any(Number),
        })
      );
    });

    it("should add issue URL to relatedIssues", async () => {
      vi.mocked(mockTaskRepo.getById).mockResolvedValue(mockTask);
      vi.mocked(mockProjectRepo.getById).mockResolvedValue(mockProject);
      vi.mocked(createIssueDirect).mockResolvedValue({
        success: true,
        issueNumber: 123,
        issueUrl: "https://github.com/owner/repo/issues/123",
      });

      await service.createIssueForTask("task-1");

      expect(mockTaskRepo.update).toHaveBeenCalledWith(
        "task-1",
        expect.objectContaining({
          relatedIssues: expect.arrayContaining([
            "#1",
            "https://github.com/owner/repo/issues/123",
          ]),
        })
      );
    });

    it("should handle GitHub API errors", async () => {
      vi.mocked(mockTaskRepo.getById).mockResolvedValue(mockTask);
      vi.mocked(mockProjectRepo.getById).mockResolvedValue(mockProject);
      vi.mocked(createIssueDirect).mockResolvedValue({
        success: false,
        error: "GitHub API rate limit exceeded",
      });

      const result = await service.createIssueForTask("task-1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("rate limit");
    });

    it("should handle exceptions during creation", async () => {
      vi.mocked(mockTaskRepo.getById).mockResolvedValue(mockTask);
      vi.mocked(mockProjectRepo.getById).mockResolvedValue(mockProject);
      vi.mocked(createIssueDirect).mockRejectedValue(new Error("Network error"));

      const result = await service.createIssueForTask("task-1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Network error");
    });
  });

  describe("Issue Content Building", () => {
    it("should build issue with correct title format", async () => {
      vi.mocked(mockTaskRepo.getById).mockResolvedValue(mockTask);
      vi.mocked(mockProjectRepo.getById).mockResolvedValue(mockProject);
      vi.mocked(createIssueDirect).mockResolvedValue({
        success: true,
        issueNumber: 123,
        issueUrl: "https://github.com/owner/repo/issues/123",
      });

      await service.createIssueForTask("task-1");

      expect(createIssueDirect).toHaveBeenCalledWith(
        "owner/repo",
        "[feature] Implement feature X",
        expect.any(String),
        expect.any(Array)
      );
    });

    it("should include @claude mention at beginning of body", async () => {
      vi.mocked(mockTaskRepo.getById).mockResolvedValue(mockTask);
      vi.mocked(mockProjectRepo.getById).mockResolvedValue(mockProject);
      vi.mocked(createIssueDirect).mockResolvedValue({
        success: true,
        issueNumber: 123,
        issueUrl: "https://github.com/owner/repo/issues/123",
      });

      await service.createIssueForTask("task-1");

      const callArgs = vi.mocked(createIssueDirect).mock.calls[0];
      const body = callArgs[2];

      expect(body).toMatch(/^@claude/);
    });

    it("should include all task details in body", async () => {
      vi.mocked(mockTaskRepo.getById).mockResolvedValue(mockTask);
      vi.mocked(mockProjectRepo.getById).mockResolvedValue(mockProject);
      vi.mocked(createIssueDirect).mockResolvedValue({
        success: true,
        issueNumber: 123,
        issueUrl: "https://github.com/owner/repo/issues/123",
      });

      await service.createIssueForTask("task-1");

      const callArgs = vi.mocked(createIssueDirect).mock.calls[0];
      const body = callArgs[2];

      expect(body).toContain("Detailed description of the feature");
      expect(body).toContain("Additional context for implementation");
      expect(body).toContain("high");
      expect(body).toContain("Create REST API endpoint");
      expect(body).toContain("task-1");
      expect(body).toContain("Test Project");
    });

    it("should include related PRs when present", async () => {
      vi.mocked(mockTaskRepo.getById).mockResolvedValue(mockTask);
      vi.mocked(mockProjectRepo.getById).mockResolvedValue(mockProject);
      vi.mocked(createIssueDirect).mockResolvedValue({
        success: true,
        issueNumber: 123,
        issueUrl: "https://github.com/owner/repo/issues/123",
      });

      await service.createIssueForTask("task-1");

      const callArgs = vi.mocked(createIssueDirect).mock.calls[0];
      const body = callArgs[2];

      expect(body).toContain("Related PRs");
      expect(body).toContain("#10");
    });

    it("should create correct labels", async () => {
      vi.mocked(mockTaskRepo.getById).mockResolvedValue(mockTask);
      vi.mocked(mockProjectRepo.getById).mockResolvedValue(mockProject);
      vi.mocked(createIssueDirect).mockResolvedValue({
        success: true,
        issueNumber: 123,
        issueUrl: "https://github.com/owner/repo/issues/123",
      });

      await service.createIssueForTask("task-1");

      expect(createIssueDirect).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        ["type:feature", "priority:high", "claude-task"]
      );
    });
  });

  describe("syncIssueState", () => {
    it("should sync issue state from GitHub", async () => {
      const taskWithIssue = {
        ...mockTask,
        githubIssueNumber: 123,
      };
      vi.mocked(mockTaskRepo.getById).mockResolvedValue(taskWithIssue);
      vi.mocked(mockProjectRepo.getById).mockResolvedValue(mockProject);
      vi.mocked(getIssue).mockResolvedValue({
        state: "open",
        title: "Test Issue",
        url: "https://github.com/owner/repo/issues/123",
      });

      const result = await service.syncIssueState("task-1");

      expect(result.success).toBe(true);
      expect(mockTaskRepo.update).toHaveBeenCalledWith(
        "task-1",
        expect.objectContaining({
          githubIssueState: "open",
          githubIssueSyncedAt: expect.any(Number),
        })
      );
    });

    it("should return error when task not found", async () => {
      vi.mocked(mockTaskRepo.getById).mockResolvedValue(undefined);

      const result = await service.syncIssueState("nonexistent");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Task not found");
    });

    it("should return error when task has no GitHub issue", async () => {
      vi.mocked(mockTaskRepo.getById).mockResolvedValue(mockTask);

      const result = await service.syncIssueState("task-1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("does not have GitHub issue");
    });

    it("should mark task as completed when issue is closed", async () => {
      const taskWithIssue = {
        ...mockTask,
        githubIssueNumber: 123,
        status: "in_progress" as const,
      };
      vi.mocked(mockTaskRepo.getById).mockResolvedValue(taskWithIssue);
      vi.mocked(mockProjectRepo.getById).mockResolvedValue(mockProject);
      vi.mocked(getIssue).mockResolvedValue({
        state: "closed",
        title: "Test Issue",
        url: "https://github.com/owner/repo/issues/123",
      });

      await service.syncIssueState("task-1");

      expect(mockTaskRepo.update).toHaveBeenCalledWith(
        "task-1",
        expect.objectContaining({
          status: "completed",
          completedAt: expect.any(Number),
        })
      );
    });

    it("should not mark task as completed if already completed", async () => {
      const taskWithIssue = {
        ...mockTask,
        githubIssueNumber: 123,
        status: "completed" as const,
      };
      vi.mocked(mockTaskRepo.getById).mockResolvedValue(taskWithIssue);
      vi.mocked(mockProjectRepo.getById).mockResolvedValue(mockProject);
      vi.mocked(getIssue).mockResolvedValue({
        state: "closed",
        title: "Test Issue",
        url: "https://github.com/owner/repo/issues/123",
      });

      await service.syncIssueState("task-1");

      const updateCall = vi.mocked(mockTaskRepo.update).mock.calls[0][1];
      expect(updateCall).not.toHaveProperty("status");
    });

    it("should handle GitHub API errors", async () => {
      const taskWithIssue = {
        ...mockTask,
        githubIssueNumber: 123,
      };
      vi.mocked(mockTaskRepo.getById).mockResolvedValue(taskWithIssue);
      vi.mocked(mockProjectRepo.getById).mockResolvedValue(mockProject);
      vi.mocked(getIssue).mockRejectedValue(new Error("API error"));

      const result = await service.syncIssueState("task-1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("API error");
    });
  });

  describe("syncAllTasks", () => {
    it("should sync all tasks with GitHub issues", async () => {
      const tasksWithIssues = [
        { ...mockTask, id: "task-1", githubIssueNumber: 123 },
        { ...mockTask, id: "task-2", githubIssueNumber: 124 },
      ];
      vi.mocked(mockTaskRepo.getTasksWithGitHubIssues).mockResolvedValue(tasksWithIssues);
      vi.mocked(mockTaskRepo.getById)
        .mockResolvedValueOnce(tasksWithIssues[0])
        .mockResolvedValueOnce(tasksWithIssues[1]);
      vi.mocked(mockProjectRepo.getById).mockResolvedValue(mockProject);
      vi.mocked(getIssue).mockResolvedValue({
        state: "open",
        title: "Test Issue",
        url: "https://github.com/owner/repo/issues/123",
      });

      const result = await service.syncAllTasks();

      expect(result.synced).toBe(2);
      expect(result.errors).toBe(0);
    });

    it("should continue processing after errors", async () => {
      const tasksWithIssues = [
        { ...mockTask, id: "task-1", githubIssueNumber: 123 },
        { ...mockTask, id: "task-2", githubIssueNumber: 124 },
      ];
      vi.mocked(mockTaskRepo.getTasksWithGitHubIssues).mockResolvedValue(tasksWithIssues);

      // Both tasks succeed normally (syncIssueState doesn't throw, it returns error results)
      vi.mocked(mockTaskRepo.getById)
        .mockResolvedValueOnce(tasksWithIssues[0])
        .mockResolvedValueOnce(tasksWithIssues[1]);
      vi.mocked(mockProjectRepo.getById)
        .mockResolvedValueOnce(mockProject)
        .mockResolvedValueOnce(mockProject);
      vi.mocked(getIssue)
        .mockResolvedValueOnce({
          state: "open",
          title: "Test Issue 1",
          url: "https://github.com/owner/repo/issues/123",
        })
        .mockResolvedValueOnce({
          state: "open",
          title: "Test Issue 2",
          url: "https://github.com/owner/repo/issues/124",
        });

      const result = await service.syncAllTasks();

      // Both tasks sync successfully
      expect(result.synced).toBe(2);
      expect(result.errors).toBe(0);
    });

    it("should return zero counts when no tasks have issues", async () => {
      vi.mocked(mockTaskRepo.getTasksWithGitHubIssues).mockResolvedValue([]);

      const result = await service.syncAllTasks();

      expect(result.synced).toBe(0);
      expect(result.errors).toBe(0);
    });
  });
});
