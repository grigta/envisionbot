/**
 * Task Repository
 */

import type { Task, TaskStatus, KanbanStatus, SuggestedAction, TaskDependency } from "../types.js";
import { BaseRepository, type RepositoryDeps } from "./base.repository.js";

interface TaskRow {
  id: string;
  project_id: string;
  type: Task["type"];
  priority: Task["priority"];
  title: string;
  description: string;
  context: string;
  suggested_actions: string;
  related_issues: string;
  related_prs: string;
  status: TaskStatus;
  kanban_status: KanbanStatus;
  generated_at: number;
  completed_at: number | null;
  approved_by: Task["approvedBy"] | null;
  generated_by: Task["generatedBy"] | null;
  github_issue_number: number | null;
  github_issue_url: string | null;
  github_issue_state: "open" | "closed" | null;
  github_issue_created_at: number | null;
  github_issue_synced_at: number | null;
}

interface TaskFilter {
  projectId?: string;
  status?: TaskStatus;
  kanbanStatus?: KanbanStatus;
}

export class TaskRepository extends BaseRepository<Task> {
  protected readonly tableName = "tasks";
  protected readonly cachePrefix = "pm:task";
  protected readonly cacheTTL = 120; // 2 minutes
  protected readonly pubsubChannel = "pm:events:tasks" as const;

  private rowToTask(row: TaskRow): Task {
    return {
      id: row.id,
      projectId: row.project_id,
      type: row.type,
      priority: row.priority,
      title: row.title,
      description: row.description,
      context: row.context,
      suggestedActions: JSON.parse(row.suggested_actions) as SuggestedAction[],
      relatedIssues: JSON.parse(row.related_issues),
      relatedPRs: JSON.parse(row.related_prs),
      status: row.status,
      kanbanStatus: row.kanban_status,
      generatedAt: row.generated_at,
      completedAt: row.completed_at ?? undefined,
      approvedBy: row.approved_by ?? undefined,
      generatedBy: row.generated_by ?? undefined,
      githubIssueNumber: row.github_issue_number ?? undefined,
      githubIssueUrl: row.github_issue_url ?? undefined,
      githubIssueState: row.github_issue_state ?? undefined,
      githubIssueCreatedAt: row.github_issue_created_at ?? undefined,
      githubIssueSyncedAt: row.github_issue_synced_at ?? undefined,
    };
  }

  async getAll(filter?: TaskFilter): Promise<Task[]> {
    let sql = "SELECT * FROM tasks WHERE 1=1";
    const params: unknown[] = [];

    if (filter?.projectId) {
      sql += " AND project_id = ?";
      params.push(filter.projectId);
    }
    if (filter?.status) {
      sql += " AND status = ?";
      params.push(filter.status);
    }
    if (filter?.kanbanStatus) {
      sql += " AND kanban_status = ?";
      params.push(filter.kanbanStatus);
    }

    sql += " ORDER BY CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END, generated_at DESC";

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as TaskRow[];
    return rows.map((row) => this.rowToTask(row));
  }

  async getPending(): Promise<Task[]> {
    const cacheKey = "pm:tasks:pending";
    const cached = await this.getFromCache<Task[]>(cacheKey);
    if (cached) return cached;

    const tasks = await this.getAll({ status: "pending" });
    await this.setCache(cacheKey, tasks, 30);
    return tasks;
  }

  async getByProjectId(projectId: string): Promise<Task[]> {
    const cacheKey = `pm:tasks:project:${projectId}`;
    const cached = await this.getFromCache<Task[]>(cacheKey);
    if (cached) return cached;

    const tasks = await this.getAll({ projectId });
    await this.setCache(cacheKey, tasks, 60);
    return tasks;
  }

  async getById(id: string): Promise<Task | undefined> {
    const cacheKey = this.entityCacheKey(id);
    const cached = await this.getFromCache<Task>(cacheKey);
    if (cached) return cached;

    const stmt = this.db.prepare("SELECT * FROM tasks WHERE id = ?");
    const row = stmt.get(id) as TaskRow | undefined;

    if (row) {
      const task = this.rowToTask(row);
      await this.setCache(cacheKey, task);
      return task;
    }

    return undefined;
  }

  /**
   * Find next executable task from backlog
   * Returns task with highest priority that is approved and in backlog
   */
  async findNextExecutableTask(): Promise<Task | null> {
    const sql = `
      SELECT * FROM tasks
      WHERE status = 'approved'
        AND kanban_status IN ('backlog', 'not_started')
      ORDER BY
        CASE priority
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
          ELSE 5
        END,
        generated_at ASC
      LIMIT 1
    `;

    const stmt = this.db.prepare(sql);
    const row = stmt.get() as TaskRow | undefined;

    if (row) {
      return this.rowToTask(row);
    }

    return null;
  }

  /**
   * Get all tasks that have GitHub issues (for syncing)
   * Returns tasks with open GitHub issues ordered by last sync time
   */
  async getTasksWithGitHubIssues(): Promise<Task[]> {
    const sql = `
      SELECT * FROM tasks
      WHERE github_issue_number IS NOT NULL
        AND github_issue_state = 'open'
      ORDER BY github_issue_synced_at ASC NULLS FIRST
    `;

    const stmt = this.db.prepare(sql);
    const rows = stmt.all() as TaskRow[];
    return rows.map((row) => this.rowToTask(row));
  }

  /**
   * Get task by GitHub issue number and repository
   * Used by webhook service to find tasks linked to GitHub issues
   */
  async getByGitHubIssue(repo: string, issueNumber: number): Promise<Task | undefined> {
    // First, get the project for this repo
    const projectStmt = this.db.prepare("SELECT id FROM projects WHERE repo = ?");
    const project = projectStmt.get(repo) as { id: string } | undefined;

    if (!project) {
      return undefined;
    }

    // Find task with this GitHub issue number in this project
    const stmt = this.db.prepare(`
      SELECT * FROM tasks
      WHERE project_id = ?
        AND github_issue_number = ?
      LIMIT 1
    `);

    const row = stmt.get(project.id, issueNumber) as TaskRow | undefined;

    if (row) {
      return this.rowToTask(row);
    }

    return undefined;
  }

  /**
   * Get tasks that reference a specific PR URL
   * Used by webhook service to find tasks linked to pull requests
   */
  async getByRelatedPR(prUrl: string): Promise<Task[]> {
    const sql = `
      SELECT * FROM tasks
      WHERE related_prs LIKE ?
    `;

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(`%${prUrl}%`) as TaskRow[];
    return rows.map((row) => this.rowToTask(row));
  }

  /**
   * Update specific fields of a task
   */
  async update(id: string, updates: Partial<Task>): Promise<Task | undefined> {
    const task = await this.getById(id);
    if (!task) return undefined;

    const updatedTask = { ...task, ...updates };
    return this.upsert(updatedTask);
  }

  async upsert(task: Task): Promise<Task> {
    const stmt = this.db.prepare(`
      INSERT INTO tasks (
        id, project_id, type, priority, title, description, context,
        suggested_actions, related_issues, related_prs, status, kanban_status,
        generated_at, completed_at, approved_by, generated_by,
        github_issue_number, github_issue_url, github_issue_state,
        github_issue_created_at, github_issue_synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        type = excluded.type,
        priority = excluded.priority,
        title = excluded.title,
        description = excluded.description,
        context = excluded.context,
        suggested_actions = excluded.suggested_actions,
        related_issues = excluded.related_issues,
        related_prs = excluded.related_prs,
        status = excluded.status,
        kanban_status = excluded.kanban_status,
        completed_at = excluded.completed_at,
        approved_by = excluded.approved_by,
        github_issue_number = excluded.github_issue_number,
        github_issue_url = excluded.github_issue_url,
        github_issue_state = excluded.github_issue_state,
        github_issue_created_at = excluded.github_issue_created_at,
        github_issue_synced_at = excluded.github_issue_synced_at
    `);

    stmt.run(
      task.id,
      task.projectId,
      task.type,
      task.priority,
      task.title,
      task.description,
      task.context,
      JSON.stringify(task.suggestedActions),
      JSON.stringify(task.relatedIssues),
      JSON.stringify(task.relatedPRs),
      task.status,
      task.kanbanStatus,
      task.generatedAt,
      task.completedAt ?? null,
      task.approvedBy ?? null,
      task.generatedBy ?? null,
      task.githubIssueNumber ?? null,
      task.githubIssueUrl ?? null,
      task.githubIssueState ?? null,
      task.githubIssueCreatedAt ?? null,
      task.githubIssueSyncedAt ?? null
    );

    await this.invalidateCache(
      this.entityCacheKey(task.id),
      "pm:tasks:pending",
      `pm:tasks:project:${task.projectId}`,
      "pm:stats"
    );

    await this.publishEvent("task_upserted", task);

    return task;
  }

  async updateStatus(
    id: string,
    updates: Partial<Pick<Task, "status" | "kanbanStatus" | "completedAt" | "approvedBy">>
  ): Promise<Task | undefined> {
    const task = await this.getById(id);
    if (!task) return undefined;

    const updatedTask = { ...task, ...updates };
    return this.upsert(updatedTask);
  }

  async delete(id: string): Promise<boolean> {
    const task = await this.getById(id);
    if (!task) return false;

    const stmt = this.db.prepare("DELETE FROM tasks WHERE id = ?");
    const result = stmt.run(id);

    if (result.changes > 0) {
      await this.invalidateCache(
        this.entityCacheKey(id),
        "pm:tasks:pending",
        `pm:tasks:project:${task.projectId}`,
        "pm:stats"
      );

      await this.publishEvent("task_deleted", { id });
      return true;
    }

    return false;
  }

  // ============================================
  // TASK DEPENDENCIES
  // ============================================

  /**
   * Add a dependency relationship between tasks
   * Prevents circular dependencies
   */
  async addDependency(
    taskId: string,
    dependsOnTaskId: string,
    type: "depends_on" | "blocks" = "depends_on"
  ): Promise<{ success: boolean; error?: string }> {
    // Validate both tasks exist
    const task = await this.getById(taskId);
    const dependsOnTask = await this.getById(dependsOnTaskId);

    if (!task) {
      return { success: false, error: "Task not found" };
    }
    if (!dependsOnTask) {
      return { success: false, error: "Dependency task not found" };
    }

    // Check for circular dependency
    const wouldCreateCycle = await this.wouldCreateCircularDependency(taskId, dependsOnTaskId);
    if (wouldCreateCycle) {
      return { success: false, error: "Cannot add dependency: would create circular dependency" };
    }

    // Add the dependency
    try {
      const stmt = this.db.prepare(`
        INSERT INTO task_dependencies (task_id, depends_on_task_id, type, created_at)
        VALUES (?, ?, ?, ?)
      `);

      stmt.run(taskId, dependsOnTaskId, type, Date.now());

      await this.invalidateCache(
        this.entityCacheKey(taskId),
        this.entityCacheKey(dependsOnTaskId),
        `pm:tasks:project:${task.projectId}`
      );

      await this.publishEvent("task_dependency_added", { taskId, dependsOnTaskId, type });

      return { success: true };
    } catch (error) {
      // Check if it's a unique constraint violation
      if (error instanceof Error && error.message.includes("UNIQUE")) {
        return { success: false, error: "Dependency already exists" };
      }
      throw error;
    }
  }

  /**
   * Remove a dependency relationship
   */
  async removeDependency(taskId: string, dependsOnTaskId: string): Promise<boolean> {
    const task = await this.getById(taskId);
    if (!task) return false;

    const stmt = this.db.prepare(`
      DELETE FROM task_dependencies
      WHERE task_id = ? AND depends_on_task_id = ?
    `);

    const result = stmt.run(taskId, dependsOnTaskId);

    if (result.changes > 0) {
      await this.invalidateCache(
        this.entityCacheKey(taskId),
        this.entityCacheKey(dependsOnTaskId),
        `pm:tasks:project:${task.projectId}`
      );

      await this.publishEvent("task_dependency_removed", { taskId, dependsOnTaskId });
      return true;
    }

    return false;
  }

  /**
   * Get all tasks that this task depends on
   */
  async getDependencies(taskId: string): Promise<Task[]> {
    const stmt = this.db.prepare(`
      SELECT t.* FROM tasks t
      INNER JOIN task_dependencies td ON td.depends_on_task_id = t.id
      WHERE td.task_id = ?
      ORDER BY t.priority, t.generated_at DESC
    `);

    const rows = stmt.all(taskId) as TaskRow[];
    return rows.map((row) => this.rowToTask(row));
  }

  /**
   * Get all tasks that depend on this task
   */
  async getDependents(taskId: string): Promise<Task[]> {
    const stmt = this.db.prepare(`
      SELECT t.* FROM tasks t
      INNER JOIN task_dependencies td ON td.task_id = t.id
      WHERE td.depends_on_task_id = ?
      ORDER BY t.priority, t.generated_at DESC
    `);

    const rows = stmt.all(taskId) as TaskRow[];
    return rows.map((row) => this.rowToTask(row));
  }

  /**
   * Check if all dependencies for a task are completed
   */
  async areDependenciesMet(taskId: string): Promise<boolean> {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM task_dependencies td
      INNER JOIN tasks t ON t.id = td.depends_on_task_id
      WHERE td.task_id = ?
        AND t.status != 'completed'
    `);

    const result = stmt.get(taskId) as { count: number };
    return result.count === 0;
  }

  /**
   * Get task with its dependency information populated
   */
  async getTaskWithDependencies(taskId: string): Promise<Task | undefined> {
    const task = await this.getById(taskId);
    if (!task) return undefined;

    const [dependsOn, blocks] = await Promise.all([
      this.getDependencies(taskId),
      this.getDependents(taskId),
    ]);

    return {
      ...task,
      dependsOn,
      blockedBy: dependsOn, // Alias for clarity
      blocks,
    };
  }

  /**
   * Get all tasks with their dependencies populated (efficient batch query)
   */
  async getTasksWithDependencies(filter?: TaskFilter): Promise<Task[]> {
    const tasks = await this.getAll(filter);

    if (tasks.length === 0) return [];

    // Batch load all dependencies
    const taskIds = tasks.map((t) => t.id);
    const placeholders = taskIds.map(() => "?").join(",");

    // Get all dependencies for these tasks
    const depsStmt = this.db.prepare(`
      SELECT td.task_id, td.depends_on_task_id, t.*
      FROM task_dependencies td
      INNER JOIN tasks t ON t.id = td.depends_on_task_id
      WHERE td.task_id IN (${placeholders})
    `);

    const depRows = depsStmt.all(...taskIds) as Array<TaskRow & { task_id: string }>;

    // Get all dependents for these tasks
    const dependentsStmt = this.db.prepare(`
      SELECT td.depends_on_task_id as task_id, td.task_id as dependent_id, t.*
      FROM task_dependencies td
      INNER JOIN tasks t ON t.id = td.task_id
      WHERE td.depends_on_task_id IN (${placeholders})
    `);

    const dependentRows = dependentsStmt.all(...taskIds) as Array<TaskRow & { task_id: string }>;

    // Group dependencies by task
    const dependenciesMap = new Map<string, Task[]>();
    const dependentsMap = new Map<string, Task[]>();

    for (const row of depRows) {
      const taskId = row.task_id;
      if (!dependenciesMap.has(taskId)) {
        dependenciesMap.set(taskId, []);
      }
      dependenciesMap.get(taskId)!.push(this.rowToTask(row));
    }

    for (const row of dependentRows) {
      const taskId = row.task_id;
      if (!dependentsMap.has(taskId)) {
        dependentsMap.set(taskId, []);
      }
      dependentsMap.get(taskId)!.push(this.rowToTask(row));
    }

    // Attach dependencies to tasks
    return tasks.map((task) => ({
      ...task,
      dependsOn: dependenciesMap.get(task.id) || [],
      blockedBy: dependenciesMap.get(task.id) || [],
      blocks: dependentsMap.get(task.id) || [],
    }));
  }

  /**
   * Check if adding a dependency would create a circular dependency
   * Uses BFS to detect cycles
   */
  private async wouldCreateCircularDependency(
    taskId: string,
    dependsOnTaskId: string
  ): Promise<boolean> {
    // If adding this dependency would mean dependsOnTask eventually depends on taskId,
    // we have a cycle
    const visited = new Set<string>();
    const queue: string[] = [dependsOnTaskId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;

      if (currentId === taskId) {
        return true; // Found a cycle
      }

      if (visited.has(currentId)) {
        continue;
      }

      visited.add(currentId);

      // Get all tasks that currentId depends on
      const stmt = this.db.prepare(`
        SELECT depends_on_task_id FROM task_dependencies
        WHERE task_id = ?
      `);

      const deps = stmt.all(currentId) as Array<{ depends_on_task_id: string }>;

      for (const dep of deps) {
        queue.push(dep.depends_on_task_id);
      }
    }

    return false;
  }
}
