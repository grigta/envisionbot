/**
 * Store - Database-backed state management
 * Migrated from file-based JSON storage to SQLite + Redis
 */
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { initDatabase } from "../db/index.js";
import { ProjectRepository, TaskRepository, ActionRepository, MetricsRepository, ReportRepository, IdeaRepository, ChatRepository, StateRepository, } from "../repositories/index.js";
import { MigrationService } from "../services/migration.service.js";
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "../../data");
class Store {
    db = null;
    initialized = false;
    initPromise = null;
    // Repositories
    _projects = null;
    _tasks = null;
    _actions = null;
    _metrics = null;
    _reports = null;
    _ideas = null;
    _chat = null;
    _state = null;
    constructor() {
        // Auto-initialize
        this.initPromise = this.initialize();
    }
    async initialize() {
        if (this.initialized)
            return;
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
            const deps = {
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
            // Run migration from JSON files if needed
            const migrationService = new MigrationService(this.db.sqlite, DATA_DIR);
            const migrationResult = await migrationService.migrate();
            if (!migrationResult.alreadyMigrated && migrationResult.success) {
                console.log("Data migration from JSON completed:", migrationResult.migratedCounts);
            }
            this.initialized = true;
            console.log(`Store initialized with SQLite${this.db.isRedisConnected ? " + Redis" : " (Redis unavailable, using memory cache)"}`);
        }
        catch (error) {
            console.error("Failed to initialize store:", error);
            throw error;
        }
    }
    // Getters for repositories (with initialization check)
    get projects() {
        if (!this._projects)
            throw new Error("Store not initialized");
        return this._projects;
    }
    get tasks() {
        if (!this._tasks)
            throw new Error("Store not initialized");
        return this._tasks;
    }
    get actions() {
        if (!this._actions)
            throw new Error("Store not initialized");
        return this._actions;
    }
    get metrics() {
        if (!this._metrics)
            throw new Error("Store not initialized");
        return this._metrics;
    }
    get reports() {
        if (!this._reports)
            throw new Error("Store not initialized");
        return this._reports;
    }
    get ideas() {
        if (!this._ideas)
            throw new Error("Store not initialized");
        return this._ideas;
    }
    get state() {
        if (!this._state)
            throw new Error("Store not initialized");
        return this._state;
    }
    // ==========================================
    // Projects (sync-compatible API)
    // ==========================================
    getProjects() {
        if (!this._projects || !this.db)
            return [];
        const stmt = this.db.sqlite.prepare("SELECT * FROM projects ORDER BY updated_at DESC");
        const rows = stmt.all();
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
    getProject(id) {
        if (!this._projects || !this.db)
            return undefined;
        const stmt = this.db.sqlite.prepare("SELECT * FROM projects WHERE id = ?");
        const row = stmt.get(id);
        if (!row)
            return undefined;
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
    getProjectByName(name) {
        if (!this._projects || !this.db)
            return undefined;
        const stmt = this.db.sqlite.prepare("SELECT * FROM projects WHERE LOWER(name) = LOWER(?)");
        const row = stmt.get(name);
        if (!row)
            return undefined;
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
    getProjectByRepo(repo) {
        if (!this._projects || !this.db)
            return undefined;
        const stmt = this.db.sqlite.prepare("SELECT * FROM projects WHERE LOWER(repo) = LOWER(?)");
        const row = stmt.get(repo);
        if (!row)
            return undefined;
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
    addProject(project) {
        if (!this._projects || !this.db)
            return;
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
        stmt.run(project.id, project.name, project.repo, project.phase, project.monitoringLevel, JSON.stringify(project.goals), JSON.stringify(project.focusAreas), project.createdAt, project.updatedAt);
        // Async cache invalidation (fire and forget)
        this.projects.upsert(project).catch(() => { });
    }
    removeProject(id) {
        if (!this._projects || !this.db)
            return;
        const stmt = this.db.sqlite.prepare("DELETE FROM projects WHERE id = ?");
        stmt.run(id);
        // Async cache invalidation
        this.projects.delete(id).catch(() => { });
    }
    // ==========================================
    // Tasks
    // ==========================================
    getTasks(filter) {
        if (!this._tasks || !this.db)
            return [];
        let sql = "SELECT * FROM tasks WHERE 1=1";
        const params = [];
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
        const rows = stmt.all(...params);
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
        }));
    }
    getTask(id) {
        if (!this._tasks || !this.db)
            return undefined;
        const stmt = this.db.sqlite.prepare("SELECT * FROM tasks WHERE id = ?");
        const row = stmt.get(id);
        if (!row)
            return undefined;
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
        };
    }
    addTask(task) {
        if (!this._tasks || !this.db)
            return;
        const stmt = this.db.sqlite.prepare(`
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
        stmt.run(task.id, task.projectId, task.type, task.priority, task.title, task.description, task.context, JSON.stringify(task.suggestedActions), JSON.stringify(task.relatedIssues), JSON.stringify(task.relatedPRs), task.status, task.kanbanStatus, task.generatedAt, task.completedAt ?? null, task.approvedBy ?? null, task.generatedBy ?? null);
        // Async cache invalidation
        this.tasks.upsert(task).catch(() => { });
    }
    updateTask(id, updates) {
        const task = this.getTask(id);
        if (!task)
            return undefined;
        const updatedTask = { ...task, ...updates };
        this.addTask(updatedTask);
        return updatedTask;
    }
    // ==========================================
    // Pending Actions
    // ==========================================
    getPendingActions() {
        if (!this._actions || !this.db)
            return [];
        const stmt = this.db.sqlite.prepare("SELECT * FROM pending_actions WHERE status = 'pending' ORDER BY created_at DESC");
        const rows = stmt.all();
        return rows.map((row) => ({
            id: row.id,
            taskId: row.task_id,
            action: {
                type: row.action_type,
                description: row.action_description,
                payload: JSON.parse(row.action_payload),
            },
            createdAt: row.created_at,
            expiresAt: row.expires_at,
            status: row.status,
            telegramMessageId: row.telegram_message_id ?? undefined,
        }));
    }
    getPendingAction(id) {
        if (!this._actions || !this.db)
            return undefined;
        const stmt = this.db.sqlite.prepare("SELECT * FROM pending_actions WHERE id = ?");
        const row = stmt.get(id);
        if (!row)
            return undefined;
        return {
            id: row.id,
            taskId: row.task_id,
            action: {
                type: row.action_type,
                description: row.action_description,
                payload: JSON.parse(row.action_payload),
            },
            createdAt: row.created_at,
            expiresAt: row.expires_at,
            status: row.status,
            telegramMessageId: row.telegram_message_id ?? undefined,
        };
    }
    addPendingAction(action) {
        if (!this._actions || !this.db)
            return;
        const stmt = this.db.sqlite.prepare(`
      INSERT INTO pending_actions (
        id, task_id, action_type, action_description, action_payload,
        created_at, expires_at, status, telegram_message_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(action.id, action.taskId, action.action.type, action.action.description, JSON.stringify(action.action.payload), action.createdAt, action.expiresAt, action.status, action.telegramMessageId ?? null);
        // Async cache invalidation
        this.actions.create(action).catch(() => { });
    }
    updatePendingAction(id, updates) {
        const action = this.getPendingAction(id);
        if (!action || !this.db)
            return undefined;
        const stmt = this.db.sqlite.prepare(`
      UPDATE pending_actions
      SET status = ?, telegram_message_id = COALESCE(?, telegram_message_id)
      WHERE id = ?
    `);
        stmt.run(updates.status ?? action.status, updates.telegramMessageId ?? null, id);
        const updatedAction = { ...action, ...updates };
        // Async cache invalidation
        if (updates.status) {
            this.actions.updateStatus(id, updates.status, updates.telegramMessageId).catch(() => { });
        }
        return updatedAction;
    }
    // ==========================================
    // Metrics
    // ==========================================
    addMetrics(metrics) {
        if (!this._metrics || !this.db)
            return;
        const stmt = this.db.sqlite.prepare(`
      INSERT INTO project_metrics (
        project_id, timestamp, open_issues, open_prs, last_commit_at,
        ci_status, velocity, health_score, security_alerts
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(metrics.projectId, metrics.timestamp, metrics.openIssues, metrics.openPRs, metrics.lastCommitAt ?? null, metrics.ciStatus, metrics.velocity, metrics.healthScore, metrics.securityAlerts);
        // Async: cleanup old metrics and invalidate cache
        this.metrics.create(metrics).catch(() => { });
    }
    getMetrics(projectId, limit = 10) {
        if (!this._metrics || !this.db)
            return [];
        const stmt = this.db.sqlite.prepare(`
      SELECT * FROM project_metrics
      WHERE project_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
        const rows = stmt.all(projectId, limit);
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
    getReports(limit = 20) {
        if (!this._reports || !this.db)
            return [];
        const stmt = this.db.sqlite.prepare(`
      SELECT * FROM analysis_reports
      ORDER BY started_at DESC
      LIMIT ?
    `);
        const rows = stmt.all(limit);
        return rows.map((row) => {
            // Get findings
            const findingsStmt = this.db.sqlite.prepare("SELECT * FROM report_findings WHERE report_id = ?");
            const findingRows = findingsStmt.all(row.id);
            // Get project reports
            const prStmt = this.db.sqlite.prepare("SELECT * FROM project_reports WHERE report_id = ?");
            const prRows = prStmt.all(row.id);
            return {
                id: row.id,
                type: row.type,
                projectIds: JSON.parse(row.project_ids),
                startedAt: row.started_at,
                completedAt: row.completed_at ?? undefined,
                summary: row.summary,
                findings: findingRows.map((f) => ({
                    severity: f.severity,
                    category: f.category,
                    title: f.title,
                    description: f.description,
                    projectId: f.project_id ?? "unknown",
                })),
                generatedTasks: JSON.parse(row.generated_tasks),
                projectReports: prRows.length > 0
                    ? prRows.map((pr) => ({
                        projectId: pr.project_id,
                        projectName: pr.project_name,
                        healthScore: pr.health_score,
                        openIssues: pr.open_issues,
                        openPRs: pr.open_prs,
                        ciStatus: pr.ci_status,
                        risks: JSON.parse(pr.risks),
                    }))
                    : undefined,
            };
        });
    }
    getReport(id) {
        const reports = this.getReports(100);
        return reports.find((r) => r.id === id);
    }
    addReport(report) {
        if (!this._reports)
            return;
        // Async: use repository for full create with cache
        this.reports.create(report).catch(() => { });
    }
    deleteReport(id) {
        if (!this._reports || !this.db)
            return false;
        const stmt = this.db.sqlite.prepare("DELETE FROM analysis_reports WHERE id = ?");
        const result = stmt.run(id);
        // Async cache invalidation
        this.reports.delete(id).catch(() => { });
        return result.changes > 0;
    }
    // ==========================================
    // Ideas
    // ==========================================
    getIdeas(filter) {
        if (!this._ideas || !this.db)
            return [];
        let sql = "SELECT * FROM ideas";
        const params = [];
        if (filter?.status) {
            sql += " WHERE status = ?";
            params.push(filter.status);
        }
        sql += " ORDER BY created_at DESC";
        const stmt = this.db.sqlite.prepare(sql);
        const rows = stmt.all(...params);
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
    getIdea(id) {
        if (!this._ideas || !this.db)
            return undefined;
        const stmt = this.db.sqlite.prepare("SELECT * FROM ideas WHERE id = ?");
        const row = stmt.get(id);
        if (!row)
            return undefined;
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
    addIdea(idea) {
        if (!this._ideas || !this.db)
            return;
        const existing = this.getIdea(idea.id);
        if (existing) {
            // Update
            const stmt = this.db.sqlite.prepare(`
        UPDATE ideas
        SET title = ?, description = ?, status = ?, plan = ?,
            project_id = ?, repo_name = ?, repo_url = ?, error = ?, updated_at = ?
        WHERE id = ?
      `);
            stmt.run(idea.title, idea.description, idea.status, idea.plan ? JSON.stringify(idea.plan) : null, idea.projectId ?? null, idea.repoName ?? null, idea.repoUrl ?? null, idea.error ?? null, idea.updatedAt, idea.id);
        }
        else {
            // Insert
            const stmt = this.db.sqlite.prepare(`
        INSERT INTO ideas (
          id, title, description, status, plan, project_id,
          repo_name, repo_url, error, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
            stmt.run(idea.id, idea.title, idea.description, idea.status, idea.plan ? JSON.stringify(idea.plan) : null, idea.projectId ?? null, idea.repoName ?? null, idea.repoUrl ?? null, idea.error ?? null, idea.createdAt, idea.updatedAt);
        }
        // Async cache invalidation
        (existing ? this.ideas.update(idea.id, idea) : this.ideas.create(idea)).catch(() => { });
    }
    updateIdea(id, updates) {
        const idea = this.getIdea(id);
        if (!idea)
            return undefined;
        const updatedIdea = { ...idea, ...updates, updatedAt: Date.now() };
        this.addIdea(updatedIdea);
        return updatedIdea;
    }
    removeIdea(id) {
        if (!this._ideas || !this.db)
            return;
        const stmt = this.db.sqlite.prepare("DELETE FROM ideas WHERE id = ?");
        stmt.run(id);
        // Async cache invalidation
        this.ideas.delete(id).catch(() => { });
    }
    // ==========================================
    // Timestamps
    // ==========================================
    getLastHealthCheck() {
        if (!this._state || !this.db)
            return undefined;
        const stmt = this.db.sqlite.prepare("SELECT value FROM agent_state WHERE key = 'lastHealthCheck'");
        const row = stmt.get();
        return row ? JSON.parse(row.value) : undefined;
    }
    setLastHealthCheck(timestamp) {
        if (!this._state || !this.db)
            return;
        const stmt = this.db.sqlite.prepare(`
      INSERT OR REPLACE INTO agent_state (key, value, updated_at)
      VALUES ('lastHealthCheck', ?, ?)
    `);
        stmt.run(JSON.stringify(timestamp), Date.now());
        // Async cache invalidation
        this.state.setLastHealthCheck(timestamp).catch(() => { });
    }
    getLastDeepAnalysis() {
        if (!this._state || !this.db)
            return undefined;
        const stmt = this.db.sqlite.prepare("SELECT value FROM agent_state WHERE key = 'lastDeepAnalysis'");
        const row = stmt.get();
        return row ? JSON.parse(row.value) : undefined;
    }
    setLastDeepAnalysis(timestamp) {
        if (!this._state || !this.db)
            return;
        const stmt = this.db.sqlite.prepare(`
      INSERT OR REPLACE INTO agent_state (key, value, updated_at)
      VALUES ('lastDeepAnalysis', ?, ?)
    `);
        stmt.run(JSON.stringify(timestamp), Date.now());
        // Async cache invalidation
        this.state.setLastDeepAnalysis(timestamp).catch(() => { });
    }
    // ==========================================
    // Stats
    // ==========================================
    getStats() {
        if (!this._state || !this.db) {
            return {
                projectCount: 0,
                taskCount: 0,
                pendingActionsCount: 0,
                ideaCount: 0,
                activeIdeasCount: 0,
            };
        }
        const projectCount = this.db.sqlite.prepare("SELECT COUNT(*) as count FROM projects").get()?.count ?? 0;
        const taskCount = this.db.sqlite.prepare("SELECT COUNT(*) as count FROM tasks").get()?.count ?? 0;
        const pendingActionsCount = this.db.sqlite
            .prepare("SELECT COUNT(*) as count FROM pending_actions WHERE status = 'pending'")
            .get()?.count ?? 0;
        const ideaCount = this.db.sqlite.prepare("SELECT COUNT(*) as count FROM ideas").get()?.count ?? 0;
        const activeIdeasCount = this.db.sqlite
            .prepare("SELECT COUNT(*) as count FROM ideas WHERE status NOT IN ('completed', 'failed')")
            .get()?.count ?? 0;
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
    getRepositoryDeps() {
        if (!this.db)
            return null;
        return {
            db: this.db.sqlite,
            cache: this.db.cache,
            pubsub: this.db.pubsub,
        };
    }
    // ==========================================
    // Lifecycle
    // ==========================================
    save() {
        // No-op: SQLite auto-saves
    }
    async close() {
        if (this.db) {
            await this.db.close();
        }
    }
}
export const stateStore = new Store();
export const store = stateStore;
//# sourceMappingURL=store.js.map