/**
 * Tests for TaskRepository
 * Tests CRUD operations, filtering, specialized queries, and GitHub integration
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { TaskRepository } from "./task.repository.js";
import type { Task } from "../types.js";
import type { RepositoryDeps, DatabaseSync, CacheClient, PubSubClient } from "../db/index.js";

describe("TaskRepository", () => {
  let mockDb: DatabaseSync;
  let mockCache: CacheClient;
  let mockPubSub: PubSubClient;
  let repository: TaskRepository;

  const mockTask: Task = {
    id: "task-1",
    projectId: "project-1",
    type: "feature",
    priority: "high",
    title: "Implement feature X",
    description: "Detailed description",
    context: "Additional context",
    suggestedActions: [
      { action: "Create API endpoint", priority: "high", notes: "REST API" },
    ],
    relatedIssues: ["#1", "#2"],
    relatedPRs: ["#10"],
    status: "pending",
    kanbanStatus: "backlog",
    generatedAt: Date.now(),
    completedAt: undefined,
    approvedBy: undefined,
    generatedBy: "agent",
    githubIssueNumber: undefined,
    githubIssueUrl: undefined,
    githubIssueState: undefined,
    githubIssueCreatedAt: undefined,
    githubIssueSyncedAt: undefined,
  };

  const mockTaskRow = {
    id: mockTask.id,
    project_id: mockTask.projectId,
    type: mockTask.type,
    priority: mockTask.priority,
    title: mockTask.title,
    description: mockTask.description,
    context: mockTask.context,
    suggested_actions: JSON.stringify(mockTask.suggestedActions),
    related_issues: JSON.stringify(mockTask.relatedIssues),
    related_prs: JSON.stringify(mockTask.relatedPRs),
    status: mockTask.status,
    kanban_status: mockTask.kanbanStatus,
    generated_at: mockTask.generatedAt,
    completed_at: null,
    approved_by: null,
    generated_by: mockTask.generatedBy,
    github_issue_number: null,
    github_issue_url: null,
    github_issue_state: null,
    github_issue_created_at: null,
    github_issue_synced_at: null,
  };

  beforeEach(() => {
    const mockStmt = {
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn(),
    };

    mockDb = {
      prepare: vi.fn(() => mockStmt),
      exec: vi.fn(),
      close: vi.fn(),
    } as unknown as DatabaseSync;

    mockCache = {
      get: vi.fn(),
      set: vi.fn(),
      setex: vi.fn(),
      del: vi.fn(),
      keys: vi.fn(() => []),
    } as unknown as CacheClient;

    mockPubSub = {
      publish: vi.fn(),
      subscribe: vi.fn(),
      on: vi.fn(),
    } as unknown as PubSubClient;

    const deps: RepositoryDeps = {
      db: mockDb,
      cache: mockCache,
      pubsub: mockPubSub,
    };

    repository = new TaskRepository(deps);
  });

  describe("getAll", () => {
    it("should return all tasks without filter", async () => {
      const mockStmt = vi.mocked(mockDb.prepare("")).all;
      mockStmt.mockReturnValue([mockTaskRow]);

      const result = await repository.getAll();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("task-1");
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM tasks WHERE 1=1")
      );
    });

    it("should filter by projectId", async () => {
      const mockStmt = vi.mocked(mockDb.prepare("")).all;
      mockStmt.mockReturnValue([mockTaskRow]);

      await repository.getAll({ projectId: "project-1" });

      expect(mockStmt).toHaveBeenCalledWith("project-1");
    });

    it("should filter by status", async () => {
      const mockStmt = vi.mocked(mockDb.prepare("")).all;
      mockStmt.mockReturnValue([mockTaskRow]);

      await repository.getAll({ status: "pending" });

      expect(mockStmt).toHaveBeenCalledWith("pending");
    });

    it("should filter by kanbanStatus", async () => {
      const mockStmt = vi.mocked(mockDb.prepare("")).all;
      mockStmt.mockReturnValue([mockTaskRow]);

      await repository.getAll({ kanbanStatus: "backlog" });

      expect(mockStmt).toHaveBeenCalledWith("backlog");
    });

    it("should filter by multiple criteria", async () => {
      const mockStmt = vi.mocked(mockDb.prepare("")).all;
      mockStmt.mockReturnValue([mockTaskRow]);

      await repository.getAll({
        projectId: "project-1",
        status: "pending",
        kanbanStatus: "backlog",
      });

      expect(mockStmt).toHaveBeenCalledWith("project-1", "pending", "backlog");
    });

    it("should order by priority correctly", async () => {
      const mockStmt = vi.mocked(mockDb.prepare("")).all;
      mockStmt.mockReturnValue([]);

      await repository.getAll();

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("ORDER BY CASE priority")
      );
    });

    it("should return empty array when no tasks exist", async () => {
      const mockStmt = vi.mocked(mockDb.prepare("")).all;
      mockStmt.mockReturnValue([]);

      const result = await repository.getAll();

      expect(result).toEqual([]);
    });
  });

  describe("getPending", () => {
    it("should return cached pending tasks", async () => {
      const cachedTasks = [mockTask];
      vi.mocked(mockCache.get).mockResolvedValue(JSON.stringify(cachedTasks));

      const result = await repository.getPending();

      expect(result).toEqual(cachedTasks);
      expect(mockCache.get).toHaveBeenCalledWith("pm:tasks:pending");
    });

    it("should fetch pending tasks from database when cache is empty", async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null);
      const mockStmt = vi.mocked(mockDb.prepare("")).all;
      mockStmt.mockReturnValue([mockTaskRow]);

      const result = await repository.getPending();

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("pending");
      expect(mockCache.setex).toHaveBeenCalledWith(
        "pm:tasks:pending",
        30,
        expect.any(String)
      );
    });
  });

  describe("getByProjectId", () => {
    it("should return cached tasks for project", async () => {
      const cachedTasks = [mockTask];
      vi.mocked(mockCache.get).mockResolvedValue(JSON.stringify(cachedTasks));

      const result = await repository.getByProjectId("project-1");

      expect(result).toEqual(cachedTasks);
      expect(mockCache.get).toHaveBeenCalledWith("pm:tasks:project:project-1");
    });

    it("should fetch tasks from database when cache is empty", async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null);
      const mockStmt = vi.mocked(mockDb.prepare("")).all;
      mockStmt.mockReturnValue([mockTaskRow]);

      const result = await repository.getByProjectId("project-1");

      expect(result).toHaveLength(1);
      expect(result[0].projectId).toBe("project-1");
      expect(mockCache.setex).toHaveBeenCalledWith(
        "pm:tasks:project:project-1",
        60,
        expect.any(String)
      );
    });
  });

  describe("getById", () => {
    it("should return cached task when available", async () => {
      vi.mocked(mockCache.get).mockResolvedValue(JSON.stringify(mockTask));

      const result = await repository.getById("task-1");

      expect(result).toEqual(mockTask);
      expect(mockCache.get).toHaveBeenCalledWith("pm:task:task-1");
    });

    it("should fetch from database when cache is empty", async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null);
      const mockStmt = vi.mocked(mockDb.prepare("")).get;
      mockStmt.mockReturnValue(mockTaskRow);

      const result = await repository.getById("task-1");

      expect(result).toBeDefined();
      expect(result?.id).toBe("task-1");
      expect(mockDb.prepare).toHaveBeenCalledWith("SELECT * FROM tasks WHERE id = ?");
    });

    it("should return undefined when task not found", async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null);
      const mockStmt = vi.mocked(mockDb.prepare("")).get;
      mockStmt.mockReturnValue(undefined);

      const result = await repository.getById("nonexistent");

      expect(result).toBeUndefined();
    });
  });

  describe("findNextExecutableTask", () => {
    it("should find highest priority approved task in backlog", async () => {
      const approvedTask = {
        ...mockTaskRow,
        status: "approved",
        kanban_status: "backlog",
        priority: "critical",
      };
      const mockStmt = vi.mocked(mockDb.prepare("")).get;
      mockStmt.mockReturnValue(approvedTask);

      const result = await repository.findNextExecutableTask();

      expect(result).toBeDefined();
      expect(result?.status).toBe("approved");
      expect(result?.kanbanStatus).toBe("backlog");
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("WHERE status = 'approved'")
      );
    });

    it("should return null when no executable tasks exist", async () => {
      const mockStmt = vi.mocked(mockDb.prepare("")).get;
      mockStmt.mockReturnValue(undefined);

      const result = await repository.findNextExecutableTask();

      expect(result).toBeNull();
    });

    it("should order by priority correctly", async () => {
      const mockStmt = vi.mocked(mockDb.prepare("")).get;
      mockStmt.mockReturnValue(mockTaskRow);

      await repository.findNextExecutableTask();

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("ORDER BY")
      );
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("WHEN 'critical' THEN 1")
      );
    });
  });

  describe("getTasksWithGitHubIssues", () => {
    it("should return tasks with open GitHub issues", async () => {
      const taskWithIssue = {
        ...mockTaskRow,
        github_issue_number: 123,
        github_issue_state: "open" as const,
      };
      const mockStmt = vi.mocked(mockDb.prepare("")).all;
      mockStmt.mockReturnValue([taskWithIssue]);

      const result = await repository.getTasksWithGitHubIssues();

      expect(result).toHaveLength(1);
      expect(result[0].githubIssueNumber).toBe(123);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("WHERE github_issue_number IS NOT NULL")
      );
    });

    it("should order by sync time", async () => {
      const mockStmt = vi.mocked(mockDb.prepare("")).all;
      mockStmt.mockReturnValue([]);

      await repository.getTasksWithGitHubIssues();

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("ORDER BY github_issue_synced_at ASC")
      );
    });
  });

  describe("update", () => {
    it("should update existing task", async () => {
      vi.mocked(mockCache.get).mockResolvedValue(JSON.stringify(mockTask));
      const mockStmt = vi.mocked(mockDb.prepare("")).run;
      mockStmt.mockReturnValue({ changes: 1 });

      const updates = { title: "Updated title", priority: "critical" as const };
      const result = await repository.update("task-1", updates);

      expect(result).toBeDefined();
      expect(result?.title).toBe("Updated title");
      expect(result?.priority).toBe("critical");
    });

    it("should return undefined when task not found", async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null);
      const mockStmt = vi.mocked(mockDb.prepare("")).get;
      mockStmt.mockReturnValue(undefined);

      const result = await repository.update("nonexistent", { title: "New" });

      expect(result).toBeUndefined();
    });
  });

  describe("upsert", () => {
    it("should insert new task", async () => {
      const mockStmt = vi.mocked(mockDb.prepare("")).run;
      mockStmt.mockReturnValue({ changes: 1 });

      const result = await repository.upsert(mockTask);

      expect(result).toEqual(mockTask);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO tasks")
      );
    });

    it("should handle null values correctly", async () => {
      const mockStmt = vi.mocked(mockDb.prepare("")).run;
      mockStmt.mockReturnValue({ changes: 1 });

      await repository.upsert(mockTask);

      expect(mockStmt).toHaveBeenCalledWith(
        mockTask.id,
        mockTask.projectId,
        mockTask.type,
        mockTask.priority,
        mockTask.title,
        mockTask.description,
        mockTask.context,
        JSON.stringify(mockTask.suggestedActions),
        JSON.stringify(mockTask.relatedIssues),
        JSON.stringify(mockTask.relatedPRs),
        mockTask.status,
        mockTask.kanbanStatus,
        mockTask.generatedAt,
        null, // completedAt
        null, // approvedBy
        mockTask.generatedBy,
        null, // githubIssueNumber
        null, // githubIssueUrl
        null, // githubIssueState
        null, // githubIssueCreatedAt
        null  // githubIssueSyncedAt
      );
    });

    it("should invalidate relevant caches", async () => {
      const mockStmt = vi.mocked(mockDb.prepare("")).run;
      mockStmt.mockReturnValue({ changes: 1 });

      await repository.upsert(mockTask);

      expect(mockCache.del).toHaveBeenCalledWith(
        "pm:task:task-1",
        "pm:tasks:pending",
        "pm:tasks:project:project-1",
        "pm:stats"
      );
    });

    it("should publish upsert event", async () => {
      const mockStmt = vi.mocked(mockDb.prepare("")).run;
      mockStmt.mockReturnValue({ changes: 1 });

      await repository.upsert(mockTask);

      expect(mockPubSub.publish).toHaveBeenCalledWith(
        "pm:events:tasks",
        expect.stringContaining("task_upserted")
      );
    });
  });

  describe("updateStatus", () => {
    it("should update task status fields", async () => {
      vi.mocked(mockCache.get).mockResolvedValue(JSON.stringify(mockTask));
      const mockStmt = vi.mocked(mockDb.prepare("")).run;
      mockStmt.mockReturnValue({ changes: 1 });

      const updates = {
        status: "approved" as const,
        kanbanStatus: "in_progress" as const,
        approvedBy: "user-1",
      };
      const result = await repository.updateStatus("task-1", updates);

      expect(result).toBeDefined();
      expect(result?.status).toBe("approved");
      expect(result?.kanbanStatus).toBe("in_progress");
      expect(result?.approvedBy).toBe("user-1");
    });

    it("should handle completedAt timestamp", async () => {
      vi.mocked(mockCache.get).mockResolvedValue(JSON.stringify(mockTask));
      const mockStmt = vi.mocked(mockDb.prepare("")).run;
      mockStmt.mockReturnValue({ changes: 1 });

      const completedAt = Date.now();
      const result = await repository.updateStatus("task-1", {
        status: "completed",
        completedAt,
      });

      expect(result?.completedAt).toBe(completedAt);
    });

    it("should return undefined when task not found", async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null);
      const mockStmt = vi.mocked(mockDb.prepare("")).get;
      mockStmt.mockReturnValue(undefined);

      const result = await repository.updateStatus("nonexistent", { status: "approved" });

      expect(result).toBeUndefined();
    });
  });

  describe("delete", () => {
    it("should delete existing task", async () => {
      vi.mocked(mockCache.get).mockResolvedValue(JSON.stringify(mockTask));
      const mockStmt = vi.mocked(mockDb.prepare("")).run;
      mockStmt.mockReturnValue({ changes: 1 });

      const result = await repository.delete("task-1");

      expect(result).toBe(true);
      expect(mockDb.prepare).toHaveBeenCalledWith("DELETE FROM tasks WHERE id = ?");
      expect(mockStmt).toHaveBeenCalledWith("task-1");
    });

    it("should return false when task not found", async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null);
      const mockGetStmt = vi.mocked(mockDb.prepare("")).get;
      mockGetStmt.mockReturnValue(undefined);

      const result = await repository.delete("nonexistent");

      expect(result).toBe(false);
    });

    it("should invalidate relevant caches", async () => {
      vi.mocked(mockCache.get).mockResolvedValue(JSON.stringify(mockTask));
      const mockStmt = vi.mocked(mockDb.prepare("")).run;
      mockStmt.mockReturnValue({ changes: 1 });

      await repository.delete("task-1");

      expect(mockCache.del).toHaveBeenCalledWith(
        "pm:task:task-1",
        "pm:tasks:pending",
        "pm:tasks:project:project-1",
        "pm:stats"
      );
    });

    it("should publish delete event", async () => {
      vi.mocked(mockCache.get).mockResolvedValue(JSON.stringify(mockTask));
      const mockStmt = vi.mocked(mockDb.prepare("")).run;
      mockStmt.mockReturnValue({ changes: 1 });

      await repository.delete("task-1");

      expect(mockPubSub.publish).toHaveBeenCalledWith(
        "pm:events:tasks",
        expect.stringContaining("task_deleted")
      );
    });
  });

  describe("Data Transformation", () => {
    it("should correctly parse JSON fields", async () => {
      vi.mocked(mockCache.get).mockResolvedValue(null);
      const mockStmt = vi.mocked(mockDb.prepare("")).get;
      mockStmt.mockReturnValue(mockTaskRow);

      const result = await repository.getById("task-1");

      expect(result?.suggestedActions).toEqual(mockTask.suggestedActions);
      expect(result?.relatedIssues).toEqual(mockTask.relatedIssues);
      expect(result?.relatedPRs).toEqual(mockTask.relatedPRs);
    });

    it("should handle GitHub issue fields", async () => {
      const taskWithIssue = {
        ...mockTaskRow,
        github_issue_number: 123,
        github_issue_url: "https://github.com/owner/repo/issues/123",
        github_issue_state: "open" as const,
        github_issue_created_at: Date.now(),
        github_issue_synced_at: Date.now(),
      };
      vi.mocked(mockCache.get).mockResolvedValue(null);
      const mockStmt = vi.mocked(mockDb.prepare("")).get;
      mockStmt.mockReturnValue(taskWithIssue);

      const result = await repository.getById("task-1");

      expect(result?.githubIssueNumber).toBe(123);
      expect(result?.githubIssueUrl).toBe("https://github.com/owner/repo/issues/123");
      expect(result?.githubIssueState).toBe("open");
      expect(result?.githubIssueCreatedAt).toBeDefined();
      expect(result?.githubIssueSyncedAt).toBeDefined();
    });
  });
});
