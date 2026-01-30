/**
 * Task Repository
 */

import type { Task, TaskStatus, KanbanStatus, SuggestedAction } from "../types.js";
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
        generated_at, completed_at, approved_by, generated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        approved_by = excluded.approved_by
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
      task.generatedBy ?? null
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
}
