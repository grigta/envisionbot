/**
 * GitHub Issue Service
 * Handles creation and synchronization of GitHub Issues for tasks
 */

import type { Task, Project, GitHubSyncResult } from "../types.js";
import type { TaskRepository } from "../repositories/task.repository.js";
import type { ProjectRepository } from "../repositories/project.repository.js";
import { createIssueDirect, getIssue } from "../tools/github.js";

export class GitHubIssueService {
  constructor(
    private taskRepo: TaskRepository,
    private projectRepo: ProjectRepository
  ) {}

  /**
   * Create GitHub Issue for approved task
   * @returns {GitHubSyncResult} Result with issue number and URL
   */
  async createIssueForTask(taskId: string): Promise<GitHubSyncResult> {
    // 1. Fetch task and project
    const task = await this.taskRepo.getById(taskId);
    if (!task) {
      return { success: false, error: "Task not found" };
    }

    const project = await this.projectRepo.getById(task.projectId);
    if (!project) {
      return { success: false, error: "Project not found" };
    }

    if (!project.repo) {
      return { success: false, error: "Project does not have GitHub repo configured" };
    }

    // 2. Check if issue already exists
    if (task.githubIssueNumber) {
      return {
        success: false,
        error: `Issue already exists: #${task.githubIssueNumber}`,
      };
    }

    // 3. Build issue content (with @Claude Code at beginning)
    const { title, body, labels } = this.buildIssueContent(task, project);

    // 4. Create GitHub Issue
    try {
      const result = await createIssueDirect(project.repo, title, body, labels);

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Failed to create issue",
        };
      }

      // 5. Update task with GitHub issue info
      await this.taskRepo.update(taskId, {
        githubIssueNumber: result.issueNumber,
        githubIssueUrl: result.issueUrl,
        githubIssueState: "open",
        githubIssueCreatedAt: Date.now(),
        githubIssueSyncedAt: Date.now(),
      });

      // 6. Add issue URL to relatedIssues array
      if (result.issueUrl) {
        const updatedRelatedIssues = [...task.relatedIssues, result.issueUrl];
        await this.taskRepo.update(taskId, {
          relatedIssues: updatedRelatedIssues,
        });
      }

      return {
        success: true,
        issueNumber: result.issueNumber,
        issueUrl: result.issueUrl,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Build GitHub Issue content with Claude Code mention at beginning
   */
  private buildIssueContent(
    task: Task,
    project: Project
  ): {
    title: string;
    body: string;
    labels: string[];
  } {
    // Title: [Task Type] Task Title
    const title = `[${task.type}] ${task.title}`;

    // Body: Start with @Claude Code mention, then task details
    const body = `@Claude Code

## Description
${task.description}

## Context
${task.context}

## Priority
${task.priority}

## Suggested Actions
${task.suggestedActions.map((action, i) => `${i + 1}. ${action.description}`).join("\n")}

${task.relatedPRs.length > 0 ? `## Related PRs\n${task.relatedPRs.map((pr) => `- ${pr}`).join("\n")}` : ""}

---
**Task ID**: \`${task.id}\`
**Project**: ${project.name}
**Generated**: ${new Date(task.generatedAt).toISOString()}
`;

    // Labels: task type, priority
    const labels = [`type:${task.type}`, `priority:${task.priority}`, "claude-task"];

    return { title, body, labels };
  }

  /**
   * Sync GitHub Issue state back to Task
   * Checks if issue is closed → mark task as completed
   */
  async syncIssueState(taskId: string): Promise<GitHubSyncResult> {
    const task = await this.taskRepo.getById(taskId);
    if (!task) {
      return { success: false, error: "Task not found" };
    }

    if (!task.githubIssueNumber) {
      return { success: false, error: "Task does not have GitHub issue" };
    }

    const project = await this.projectRepo.getById(task.projectId);
    if (!project || !project.repo) {
      return { success: false, error: "Project repo not configured" };
    }

    try {
      // Fetch issue info from GitHub
      const issueInfo = await this.fetchIssueInfo(project.repo, task.githubIssueNumber);

      // Update task with latest state
      const updates: Partial<Task> = {
        githubIssueState: issueInfo.state as "open" | "closed",
        githubIssueSyncedAt: Date.now(),
      };

      // If issue closed → mark task as completed
      if (issueInfo.state === "closed" && task.status !== "completed") {
        updates.status = "completed";
        updates.completedAt = Date.now();
      }

      await this.taskRepo.update(taskId, updates);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Fetch issue info from GitHub via gh CLI
   */
  private async fetchIssueInfo(
    repo: string,
    issueNumber: number
  ): Promise<{
    state: "open" | "closed";
    title: string;
    url: string;
  }> {
    const result = await getIssue(repo, issueNumber);
    return {
      state: result.state as "open" | "closed",
      title: result.title,
      url: result.url,
    };
  }

  /**
   * Sync all tasks with GitHub issues
   * Run periodically by scheduler
   */
  async syncAllTasks(): Promise<{ synced: number; errors: number }> {
    const tasks = await this.taskRepo.getTasksWithGitHubIssues();

    let synced = 0;
    let errors = 0;

    for (const task of tasks) {
      try {
        await this.syncIssueState(task.id);
        synced++;
      } catch (error) {
        console.error(`Failed to sync task ${task.id}:`, error);
        errors++;
      }
    }

    return { synced, errors };
  }
}
