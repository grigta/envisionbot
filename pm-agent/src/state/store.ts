/**
 * Store - Database-backed state management
 * Migrated from file-based JSON storage to SQLite + Redis
 */

import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { initDatabase, type Database, type RepositoryDeps } from "../db/index.js";
import {
  ProjectRepository,
  TaskRepository,
  ActionRepository,
  MetricsRepository,
  ReportRepository,
  IdeaRepository,
  ChatRepository,
  StateRepository,
  TeamMemberRepository,
} from "../repositories/index.js";
import { MigrationService } from "../services/migration.service.js";
import type {
  Project,
  Task,
  PendingAction,
  ProjectMetrics,
  AnalysisReport,
  Idea,
  TeamMember,
} from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "../../data");

class Store {
  private db: Database | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  // Repositories
  private _projects: ProjectRepository | null = null;
  private _tasks: TaskRepository | null = null;
  private _actions: ActionRepository | null = null;
  private _metrics: MetricsRepository | null = null;
  private _reports: ReportRepository | null = null;
  private _ideas: IdeaRepository | null = null;
  private _chat: ChatRepository | null = null;
  private _state: StateRepository | null = null;
  private _team: TeamMemberRepository | null = null;

  constructor() {
    // Auto-initialize
    this.initPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize database
      this.db = await initDatabase({
        dataDir: DATA_DIR,
        redis: {
          host: process.env.REDIS_HOST || "localhost",
          port: parseInt(process.env.REDIS_PORT || "6379", 10),
        },
      });

      // Create repository dependencies
      const deps: RepositoryDeps = {
        db: this.db.sqlite,
        cache: this.db.cache,
        pubsub: this.db.pubsub,
      };

      // Initialize repositories
      this._projects = new ProjectRepository(deps);
      this._tasks = new TaskRepository(deps);
      this._actions = new ActionRepository(deps);
      this._metrics = new MetricsRepository(deps);
      this._reports = new ReportRepository(deps);
      this._ideas = new IdeaRepository(deps);
      this._chat = new ChatRepository(deps);
      this._state = new StateRepository(deps);
      this._team = new TeamMemberRepository(deps);

      // Run migration from JSON files if needed
      const migrationService = new MigrationService(this.db.sqlite, DATA_DIR);
      const migrationResult = await migrationService.migrate();

      if (!migrationResult.alreadyMigrated && migrationResult.success) {
        console.log("Data migration from JSON completed:", migrationResult.migratedCounts);
      }

      this.initialized = true;
      console.log(
        `Store initialized with SQLite${this.db.isRedisConnected ? " + Redis" : " (Redis unavailable, using memory cache)"}`
      );
    } catch (error) {
      console.error("Failed to initialize store:", error);
      throw error;
    }
  }

  // Getters for repositories (with initialization check)
  private get projects(): ProjectRepository {
    if (!this._projects) throw new Error("Store not initialized");
    return this._projects;
  }

  private get tasks(): TaskRepository {
    if (!this._tasks) throw new Error("Store not initialized");
    return this._tasks;
  }

  private get actions(): ActionRepository {
    if (!this._actions) throw new Error("Store not initialized");
    return this._actions;
  }

  private get metrics(): MetricsRepository {
    if (!this._metrics) throw new Error("Store not initialized");
    return this._metrics;
  }

  private get reports(): ReportRepository {
    if (!this._reports) throw new Error("Store not initialized");
    return this._reports;
  }

  private get ideas(): IdeaRepository {
    if (!this._ideas) throw new Error("Store not initialized");
    return this._ideas;
  }

  private get state(): StateRepository {
    if (!this._state) throw new Error("Store not initialized");
    return this._state;
  }

  private get team(): TeamMemberRepository {
    if (!this._team) throw new Error("Store not initialized");
    return this._team;
  }

  // ==========================================
  // Projects (sync-compatible API)
  // ==========================================

  getProjects(): Project[] {
    if (!this._projects || !this.db) return [];

    const stmt = this.db.sqlite.prepare(
      "SELECT * FROM projects ORDER BY updated_at DESC"
    );
    const rows = stmt.all() as Array<{
      id: string;
      name: string;
      repo: string;
      phase: Project["phase"];
      monitoring_level: Project["monitoringLevel"];
      goals: string;
      focus_areas: string;
      created_at: number;
      updated_at: number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      repo: row.repo,
      phase: row.phase,
      monitoringLevel: row.monitoring_level,
      goals: JSON.parse(row.goals),
      focusAreas: JSON.parse(row.focus_areas),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  getProject(id: string): Project | undefined {
    if (!this._projects || !this.db) return undefined;

    const stmt = this.db.sqlite.prepare("SELECT * FROM projects WHERE id = ?");
    const row = stmt.get(id) as
      | {
          id: string;
          name: string;
          repo: string;
          phase: Project["phase"];
          monitoring_level: Project["monitoringLevel"];
          goals: string;
          focus_areas: string;
          created_at: number;
          updated_at: number;
        }
      | undefined;

    if (!row) return undefined;

    return {
      id: row.id,
      name: row.name,
      repo: row.repo,
      phase: row.phase,
      monitoringLevel: row.monitoring_level,
      goals: JSON.parse(row.goals),
      focusAreas: JSON.parse(row.focus_areas),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  getProjectByName(name: string): Project | undefined {
    if (!this._projects || !this.db) return undefined;

    const stmt = this.db.sqlite.prepare(
      "SELECT * FROM projects WHERE LOWER(name) = LOWER(?)"
    );
    const row = stmt.get(name) as
      | {
          id: string;
          name: string;
          repo: string;
          phase: Project["phase"];
          monitoring_level: Project["monitoringLevel"];
          goals: string;
          focus_areas: string;
          created_at: number;
          updated_at: number;
        }
      | undefined;

    if (!row) return undefined;

    return {
      id: row.id,
      name: row.name,
      repo: row.repo,
      phase: row.phase,
      monitoringLevel: row.monitoring_level,
      goals: JSON.parse(row.goals),
      focusAreas: JSON.parse(row.focus_areas),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  getProjectByRepo(repo: string): Project | undefined {
    if (!this._projects || !this.db) return undefined;

    const stmt = this.db.sqlite.prepare(
      "SELECT * FROM projects WHERE LOWER(repo) = LOWER(?)"
    );
    const row = stmt.get(repo) as
      | {
          id: string;
          name: string;
          repo: string;
          phase: Project["phase"];
          monitoring_level: Project["monitoringLevel"];
          goals: string;
          focus_areas: string;
          created_at: number;
          updated_at: number;
        }
      | undefined;

    if (!row) return undefined;

    return {
      id: row.id,
      name: row.name,
      repo: row.repo,
      phase: row.phase,
      monitoringLevel: row.monitoring_level,
      goals: JSON.parse(row.goals),
      focusAreas: JSON.parse(row.focus_areas),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  addProject(project: Project): void {
    if (!this._projects || !this.db) return;

    const stmt = this.db.sqlite.prepare(`
      INSERT INTO projects (id, name, repo, phase, monitoring_level, goals, focus_areas, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        repo = excluded.repo,
        phase = excluded.phase,
        monitoring_level = excluded.monitoring_level,
        goals = excluded.goals,
        focus_areas = excluded.focus_areas,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      project.id,
      project.name,
      project.repo,
      project.phase,
      project.monitoringLevel,
      JSON.stringify(project.goals),
      JSON.stringify(project.focusAreas),
      project.createdAt,
      project.updatedAt
    );

    // Async cache invalidation (fire and forget)
    this.projects.upsert(project).catch(() => {});
  }

  removeProject(id: string): void {
    if (!this._projects || !this.db) return;

    const stmt = this.db.sqlite.prepare("DELETE FROM projects WHERE id = ?");
    stmt.run(id);

    // Async cache invalidation
    this.projects.delete(id).catch(() => {});
  }

  // ==========================================
  // Tasks
  // ==========================================

  getTasks(filter?: { projectId?: string; status?: Task["status"] }): Task[] {
    if (!this._tasks || !this.db) return [];

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

    sql += " ORDER BY CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END, generated_at DESC";

    const stmt = this.db.sqlite.prepare(sql);
    const rows = stmt.all(...params) as Array<{
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
      status: Task["status"];
      kanban_status: Task["kanbanStatus"];
      generated_at: number;
      completed_at: number | null;
      approved_by: Task["approvedBy"] | null;
      generated_by: Task["generatedBy"] | null;
      assigned_to: string | null;
      assigned_at: number | null;
    }>;

    return rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      type: row.type,
      priority: row.priority,
      title: row.title,
      description: row.description,
      context: row.context,
      suggestedActions: JSON.parse(row.suggested_actions),
      relatedIssues: JSON.parse(row.related_issues),
      relatedPRs: JSON.parse(row.related_prs),
      status: row.status,
      kanbanStatus: row.kanban_status,
      generatedAt: row.generated_at,
      completedAt: row.completed_at ?? undefined,
      approvedBy: row.approved_by ?? undefined,
      generatedBy: row.generated_by ?? undefined,
      assignedTo: row.assigned_to ?? undefined,
      assignedAt: row.assigned_at ?? undefined,
    }));
  }

  getTask(id: string): Task | undefined {
    if (!this._tasks || !this.db) return undefined;

    const stmt = this.db.sqlite.prepare("SELECT * FROM tasks WHERE id = ?");
    const row = stmt.get(id) as
      | {
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
          status: Task["status"];
          kanban_status: Task["kanbanStatus"];
          generated_at: number;
          completed_at: number | null;
          approved_by: Task["approvedBy"] | null;
          generated_by: Task["generatedBy"] | null;
          assigned_to: string | null;
          assigned_at: number | null;
        }
      | undefined;

    if (!row) return undefined;

    return {
      id: row.id,
      projectId: row.project_id,
      type: row.type,
      priority: row.priority,
      title: row.title,
      description: row.description,
      context: row.context,
      suggestedActions: JSON.parse(row.suggested_actions),
      relatedIssues: JSON.parse(row.related_issues),
      relatedPRs: JSON.parse(row.related_prs),
      status: row.status,
      kanbanStatus: row.kanban_status,
      generatedAt: row.generated_at,
      completedAt: row.completed_at ?? undefined,
      approvedBy: row.approved_by ?? undefined,
      generatedBy: row.generated_by ?? undefined,
      assignedTo: row.assigned_to ?? undefined,
      assignedAt: row.assigned_at ?? undefined,
    };
  }

  addTask(task: Task): void {
    if (!this._tasks || !this.db) return;

    const stmt = this.db.sqlite.prepare(`
      INSERT INTO tasks (
        id, project_id, type, priority, title, description, context,
        suggested_actions, related_issues, related_prs, status, kanban_status,
        generated_at, completed_at, approved_by, generated_by,
        assigned_to, assigned_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        assigned_to = excluded.assigned_to,
        assigned_at = excluded.assigned_at
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
      task.assignedTo ?? null,
      task.assignedAt ?? null
    );

    // Async cache invalidation
    this.tasks.upsert(task).catch(() => {});
  }

  updateTask(id: string, updates: Partial<Task>): Task | undefined {
    const task = this.getTask(id);
    if (!task) return undefined;

    const updatedTask = { ...task, ...updates };
    this.addTask(updatedTask);
    return updatedTask;
  }

  // ==========================================
  // Pending Actions
  // ==========================================

  getPendingActions(): PendingAction[] {
    if (!this._actions || !this.db) return [];

    const stmt = this.db.sqlite.prepare(
      "SELECT * FROM pending_actions WHERE status = 'pending' ORDER BY created_at DESC"
    );
    const rows = stmt.all() as Array<{
      id: string;
      task_id: string;
      action_type: string;
      action_description: string;
      action_payload: string;
      created_at: number;
      expires_at: number;
      status: PendingAction["status"];
      telegram_message_id: number | null;
    }>;

    return rows.map((row) => ({
      id: row.id,
      taskId: row.task_id,
      action: {
        type: row.action_type as PendingAction["action"]["type"],
        description: row.action_description,
        payload: JSON.parse(row.action_payload),
      },
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      status: row.status,
      telegramMessageId: row.telegram_message_id ?? undefined,
    }));
  }

  getPendingAction(id: string): PendingAction | undefined {
    if (!this._actions || !this.db) return undefined;

    const stmt = this.db.sqlite.prepare(
      "SELECT * FROM pending_actions WHERE id = ?"
    );
    const row = stmt.get(id) as
      | {
          id: string;
          task_id: string;
          action_type: string;
          action_description: string;
          action_payload: string;
          created_at: number;
          expires_at: number;
          status: PendingAction["status"];
          telegram_message_id: number | null;
        }
      | undefined;

    if (!row) return undefined;

    return {
      id: row.id,
      taskId: row.task_id,
      action: {
        type: row.action_type as PendingAction["action"]["type"],
        description: row.action_description,
        payload: JSON.parse(row.action_payload),
      },
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      status: row.status,
      telegramMessageId: row.telegram_message_id ?? undefined,
    };
  }

  addPendingAction(action: PendingAction): void {
    if (!this._actions || !this.db) return;

    const stmt = this.db.sqlite.prepare(`
      INSERT INTO pending_actions (
        id, task_id, action_type, action_description, action_payload,
        created_at, expires_at, status, telegram_message_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      action.id,
      action.taskId,
      action.action.type,
      action.action.description,
      JSON.stringify(action.action.payload),
      action.createdAt,
      action.expiresAt,
      action.status,
      action.telegramMessageId ?? null
    );

    // Async cache invalidation
    this.actions.create(action).catch(() => {});
  }

  updatePendingAction(
    id: string,
    updates: Partial<PendingAction>
  ): PendingAction | undefined {
    const action = this.getPendingAction(id);
    if (!action || !this.db) return undefined;

    const stmt = this.db.sqlite.prepare(`
      UPDATE pending_actions
      SET status = ?, telegram_message_id = COALESCE(?, telegram_message_id)
      WHERE id = ?
    `);

    stmt.run(updates.status ?? action.status, updates.telegramMessageId ?? null, id);

    const updatedAction = { ...action, ...updates };

    // Async cache invalidation
    if (updates.status) {
      this.actions.updateStatus(id, updates.status, updates.telegramMessageId).catch(() => {});
    }

    return updatedAction;
  }

  // ==========================================
  // Metrics
  // ==========================================

  addMetrics(metrics: ProjectMetrics): void {
    if (!this._metrics || !this.db) return;

    const stmt = this.db.sqlite.prepare(`
      INSERT INTO project_metrics (
        project_id, timestamp, open_issues, open_prs, last_commit_at,
        ci_status, velocity, health_score, security_alerts
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      metrics.projectId,
      metrics.timestamp,
      metrics.openIssues,
      metrics.openPRs,
      metrics.lastCommitAt ?? null,
      metrics.ciStatus,
      metrics.velocity,
      metrics.healthScore,
      metrics.securityAlerts
    );

    // Async: cleanup old metrics and invalidate cache
    this.metrics.create(metrics).catch(() => {});
  }

  getMetrics(projectId: string, limit = 10): ProjectMetrics[] {
    if (!this._metrics || !this.db) return [];

    const stmt = this.db.sqlite.prepare(`
      SELECT * FROM project_metrics
      WHERE project_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    const rows = stmt.all(projectId, limit) as Array<{
      id: number;
      project_id: string;
      timestamp: number;
      open_issues: number;
      open_prs: number;
      last_commit_at: number | null;
      ci_status: ProjectMetrics["ciStatus"];
      velocity: number;
      health_score: number;
      security_alerts: number;
    }>;

    return rows.map((row) => ({
      projectId: row.project_id,
      timestamp: row.timestamp,
      openIssues: row.open_issues,
      openPRs: row.open_prs,
      lastCommitAt: row.last_commit_at ?? undefined,
      ciStatus: row.ci_status,
      velocity: row.velocity,
      healthScore: row.health_score,
      securityAlerts: row.security_alerts,
    }));
  }

  // ==========================================
  // Reports
  // ==========================================

  getReports(limit = 20): AnalysisReport[] {
    if (!this._reports || !this.db) return [];

    const stmt = this.db.sqlite.prepare(`
      SELECT * FROM analysis_reports
      ORDER BY started_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(limit) as Array<{
      id: string;
      type: AnalysisReport["type"];
      project_ids: string;
      started_at: number;
      completed_at: number | null;
      summary: string;
      generated_tasks: string;
    }>;

    return rows.map((row) => {
      // Get findings
      const findingsStmt = this.db!.sqlite.prepare(
        "SELECT * FROM report_findings WHERE report_id = ?"
      );
      const findingRows = findingsStmt.all(row.id) as Array<{
        severity: string;
        category: string;
        title: string;
        description: string;
        project_id: string | null;
      }>;

      // Get project reports
      const prStmt = this.db!.sqlite.prepare(
        "SELECT * FROM project_reports WHERE report_id = ?"
      );
      const prRows = prStmt.all(row.id) as Array<{
        project_id: string;
        project_name: string;
        health_score: number;
        open_issues: number;
        open_prs: number;
        ci_status: string;
        risks: string;
      }>;

      return {
        id: row.id,
        type: row.type,
        projectIds: JSON.parse(row.project_ids),
        startedAt: row.started_at,
        completedAt: row.completed_at ?? undefined,
        summary: row.summary,
        findings: findingRows.map((f) => ({
          severity: f.severity as AnalysisReport["findings"][0]["severity"],
          category: f.category,
          title: f.title,
          description: f.description,
          projectId: f.project_id ?? "unknown",
        })),
        generatedTasks: JSON.parse(row.generated_tasks),
        projectReports:
          prRows.length > 0
            ? prRows.map((pr) => ({
                projectId: pr.project_id,
                projectName: pr.project_name,
                healthScore: pr.health_score,
                openIssues: pr.open_issues,
                openPRs: pr.open_prs,
                ciStatus: pr.ci_status as "passing" | "failing" | "unknown",
                risks: JSON.parse(pr.risks),
              }))
            : undefined,
      };
    });
  }

  getReport(id: string): AnalysisReport | undefined {
    const reports = this.getReports(100);
    return reports.find((r) => r.id === id);
  }

  addReport(report: AnalysisReport): void {
    if (!this._reports) return;

    // Async: use repository for full create with cache
    this.reports.create(report).catch(() => {});
  }

  deleteReport(id: string): boolean {
    if (!this._reports || !this.db) return false;

    const stmt = this.db.sqlite.prepare("DELETE FROM analysis_reports WHERE id = ?");
    const result = stmt.run(id);

    // Async cache invalidation
    this.reports.delete(id).catch(() => {});

    return result.changes > 0;
  }

  // ==========================================
  // Ideas
  // ==========================================

  getIdeas(filter?: { status?: Idea["status"] }): Idea[] {
    if (!this._ideas || !this.db) return [];

    let sql = "SELECT * FROM ideas";
    const params: unknown[] = [];

    if (filter?.status) {
      sql += " WHERE status = ?";
      params.push(filter.status);
    }

    sql += " ORDER BY created_at DESC";

    const stmt = this.db.sqlite.prepare(sql);
    const rows = stmt.all(...params) as Array<{
      id: string;
      title: string;
      description: string;
      status: Idea["status"];
      plan: string | null;
      project_id: string | null;
      repo_name: string | null;
      repo_url: string | null;
      error: string | null;
      created_at: number;
      updated_at: number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      plan: row.plan ? JSON.parse(row.plan) : undefined,
      projectId: row.project_id ?? undefined,
      repoName: row.repo_name ?? undefined,
      repoUrl: row.repo_url ?? undefined,
      error: row.error ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  getIdea(id: string): Idea | undefined {
    if (!this._ideas || !this.db) return undefined;

    const stmt = this.db.sqlite.prepare("SELECT * FROM ideas WHERE id = ?");
    const row = stmt.get(id) as
      | {
          id: string;
          title: string;
          description: string;
          status: Idea["status"];
          plan: string | null;
          project_id: string | null;
          repo_name: string | null;
          repo_url: string | null;
          error: string | null;
          created_at: number;
          updated_at: number;
        }
      | undefined;

    if (!row) return undefined;

    return {
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      plan: row.plan ? JSON.parse(row.plan) : undefined,
      projectId: row.project_id ?? undefined,
      repoName: row.repo_name ?? undefined,
      repoUrl: row.repo_url ?? undefined,
      error: row.error ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  addIdea(idea: Idea): void {
    if (!this._ideas || !this.db) return;

    const existing = this.getIdea(idea.id);

    if (existing) {
      // Update
      const stmt = this.db.sqlite.prepare(`
        UPDATE ideas
        SET title = ?, description = ?, status = ?, plan = ?,
            project_id = ?, repo_name = ?, repo_url = ?, error = ?, updated_at = ?
        WHERE id = ?
      `);

      stmt.run(
        idea.title,
        idea.description,
        idea.status,
        idea.plan ? JSON.stringify(idea.plan) : null,
        idea.projectId ?? null,
        idea.repoName ?? null,
        idea.repoUrl ?? null,
        idea.error ?? null,
        idea.updatedAt,
        idea.id
      );
    } else {
      // Insert
      const stmt = this.db.sqlite.prepare(`
        INSERT INTO ideas (
          id, title, description, status, plan, project_id,
          repo_name, repo_url, error, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        idea.id,
        idea.title,
        idea.description,
        idea.status,
        idea.plan ? JSON.stringify(idea.plan) : null,
        idea.projectId ?? null,
        idea.repoName ?? null,
        idea.repoUrl ?? null,
        idea.error ?? null,
        idea.createdAt,
        idea.updatedAt
      );
    }

    // Async cache invalidation
    (existing ? this.ideas.update(idea.id, idea) : this.ideas.create(idea)).catch(() => {});
  }

  updateIdea(id: string, updates: Partial<Idea>): Idea | undefined {
    const idea = this.getIdea(id);
    if (!idea) return undefined;

    const updatedIdea = { ...idea, ...updates, updatedAt: Date.now() };
    this.addIdea(updatedIdea);
    return updatedIdea;
  }

  removeIdea(id: string): void {
    if (!this._ideas || !this.db) return;

    const stmt = this.db.sqlite.prepare("DELETE FROM ideas WHERE id = ?");
    stmt.run(id);

    // Async cache invalidation
    this.ideas.delete(id).catch(() => {});
  }

  // ==========================================
  // Timestamps
  // ==========================================

  getLastHealthCheck(): number | undefined {
    if (!this._state || !this.db) return undefined;

    const stmt = this.db.sqlite.prepare(
      "SELECT value FROM agent_state WHERE key = 'lastHealthCheck'"
    );
    const row = stmt.get() as { value: string } | undefined;
    return row ? JSON.parse(row.value) : undefined;
  }

  setLastHealthCheck(timestamp: number): void {
    if (!this._state || !this.db) return;

    const stmt = this.db.sqlite.prepare(`
      INSERT OR REPLACE INTO agent_state (key, value, updated_at)
      VALUES ('lastHealthCheck', ?, ?)
    `);
    stmt.run(JSON.stringify(timestamp), Date.now());

    // Async cache invalidation
    this.state.setLastHealthCheck(timestamp).catch(() => {});
  }

  getLastDeepAnalysis(): number | undefined {
    if (!this._state || !this.db) return undefined;

    const stmt = this.db.sqlite.prepare(
      "SELECT value FROM agent_state WHERE key = 'lastDeepAnalysis'"
    );
    const row = stmt.get() as { value: string } | undefined;
    return row ? JSON.parse(row.value) : undefined;
  }

  setLastDeepAnalysis(timestamp: number): void {
    if (!this._state || !this.db) return;

    const stmt = this.db.sqlite.prepare(`
      INSERT OR REPLACE INTO agent_state (key, value, updated_at)
      VALUES ('lastDeepAnalysis', ?, ?)
    `);
    stmt.run(JSON.stringify(timestamp), Date.now());

    // Async cache invalidation
    this.state.setLastDeepAnalysis(timestamp).catch(() => {});
  }

  // ==========================================
  // Stats
  // ==========================================

  getStats(): {
    projectCount: number;
    taskCount: number;
    pendingActionsCount: number;
    ideaCount: number;
    activeIdeasCount: number;
    lastHealthCheck?: number;
    lastDeepAnalysis?: number;
  } {
    if (!this._state || !this.db) {
      return {
        projectCount: 0,
        taskCount: 0,
        pendingActionsCount: 0,
        ideaCount: 0,
        activeIdeasCount: 0,
      };
    }

    const projectCount =
      (
        this.db.sqlite.prepare("SELECT COUNT(*) as count FROM projects").get() as {
          count: number;
        }
      )?.count ?? 0;

    const taskCount =
      (
        this.db.sqlite.prepare("SELECT COUNT(*) as count FROM tasks").get() as {
          count: number;
        }
      )?.count ?? 0;

    const pendingActionsCount =
      (
        this.db.sqlite
          .prepare(
            "SELECT COUNT(*) as count FROM pending_actions WHERE status = 'pending'"
          )
          .get() as { count: number }
      )?.count ?? 0;

    const ideaCount =
      (
        this.db.sqlite.prepare("SELECT COUNT(*) as count FROM ideas").get() as {
          count: number;
        }
      )?.count ?? 0;

    const activeIdeasCount =
      (
        this.db.sqlite
          .prepare(
            "SELECT COUNT(*) as count FROM ideas WHERE status NOT IN ('completed', 'failed')"
          )
          .get() as { count: number }
      )?.count ?? 0;

    return {
      projectCount,
      taskCount,
      pendingActionsCount,
      ideaCount,
      activeIdeasCount,
      lastHealthCheck: this.getLastHealthCheck(),
      lastDeepAnalysis: this.getLastDeepAnalysis(),
    };
  }

  // ==========================================
  // Repository Dependencies (for external services)
  // ==========================================

  async waitForInit(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  getRepositoryDeps(): RepositoryDeps | null {
    if (!this.db) return null;
    return {
      db: this.db.sqlite,
      cache: this.db.cache,
      pubsub: this.db.pubsub,
    };
  }

  // ==========================================
  // Team Members
  // ==========================================

  getTeamMembers(): TeamMember[] {
    if (!this._team || !this.db) return [];

    const stmt = this.db.sqlite.prepare("SELECT * FROM team_members ORDER BY name ASC");
    const rows = stmt.all() as Array<{
      id: string;
      name: string;
      email: string | null;
      github_username: string | null;
      telegram_username: string | null;
      role: TeamMember["role"];
      avatar_url: string | null;
      is_active: number;
      created_at: number;
      updated_at: number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email ?? undefined,
      githubUsername: row.github_username ?? undefined,
      telegramUsername: row.telegram_username ?? undefined,
      role: row.role,
      avatarUrl: row.avatar_url ?? undefined,
      isActive: row.is_active === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  getTeamMember(id: string): TeamMember | undefined {
    if (!this._team || !this.db) return undefined;

    const stmt = this.db.sqlite.prepare("SELECT * FROM team_members WHERE id = ?");
    const row = stmt.get(id) as
      | {
          id: string;
          name: string;
          email: string | null;
          github_username: string | null;
          telegram_username: string | null;
          role: TeamMember["role"];
          avatar_url: string | null;
          is_active: number;
          created_at: number;
          updated_at: number;
        }
      | undefined;

    if (!row) return undefined;

    return {
      id: row.id,
      name: row.name,
      email: row.email ?? undefined,
      githubUsername: row.github_username ?? undefined,
      telegramUsername: row.telegram_username ?? undefined,
      role: row.role,
      avatarUrl: row.avatar_url ?? undefined,
      isActive: row.is_active === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  addTeamMember(member: TeamMember): void {
    if (!this._team || !this.db) return;

    const stmt = this.db.sqlite.prepare(`
      INSERT INTO team_members (
        id, name, email, github_username, telegram_username, role,
        avatar_url, is_active, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        email = excluded.email,
        github_username = excluded.github_username,
        telegram_username = excluded.telegram_username,
        role = excluded.role,
        avatar_url = excluded.avatar_url,
        is_active = excluded.is_active,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      member.id,
      member.name,
      member.email ?? null,
      member.githubUsername ?? null,
      member.telegramUsername ?? null,
      member.role,
      member.avatarUrl ?? null,
      member.isActive ? 1 : 0,
      member.createdAt,
      member.updatedAt
    );

    // Async cache invalidation
    this.team.upsert(member).catch(() => {});
  }

  removeTeamMember(id: string): void {
    if (!this._team || !this.db) return;

    const stmt = this.db.sqlite.prepare("DELETE FROM team_members WHERE id = ?");
    stmt.run(id);

    // Async cache invalidation
    this.team.delete(id).catch(() => {});
  }

  assignTaskToMember(taskId: string, memberId: string | null): Task | undefined {
    const task = this.getTask(taskId);
    if (!task) return undefined;

    const updatedTask = {
      ...task,
      assignedTo: memberId ?? undefined,
      assignedAt: memberId ? Date.now() : undefined,
    };
    this.addTask(updatedTask);
    return updatedTask;
  }

  // ==========================================
  // Lifecycle
  // ==========================================

  save(): void {
    // No-op: SQLite auto-saves
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
    }
  }
}

export const stateStore = new Store();
export const store = stateStore;
