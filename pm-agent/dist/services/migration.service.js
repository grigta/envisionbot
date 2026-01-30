/**
 * Migration Service
 * Migrates data from JSON files to SQLite database
 */
import { readFileSync, existsSync, renameSync } from "node:fs";
import { join } from "node:path";
export class MigrationService {
    db;
    dataDir;
    constructor(db, dataDir) {
        this.db = db;
        this.dataDir = dataDir;
    }
    async migrate() {
        const result = {
            success: true,
            alreadyMigrated: false,
            migratedCounts: {
                projects: 0,
                tasks: 0,
                pendingActions: 0,
                metrics: 0,
                reports: 0,
                ideas: 0,
                chatSessions: 0,
                chatMessages: 0,
            },
            errors: [],
        };
        try {
            // Check if migration already done
            const migrationCheck = this.db
                .prepare("SELECT value FROM agent_state WHERE key = 'migration_completed'")
                .get();
            if (migrationCheck?.value === '"true"' || migrationCheck?.value === "true") {
                console.log("Migration already completed, skipping...");
                result.alreadyMigrated = true;
                return result;
            }
            // Migrate state.json
            this.migrateStateFile(result);
            // Migrate chat-history.json
            this.migrateChatHistory(result);
            // Mark migration as complete
            this.db
                .prepare(`INSERT OR REPLACE INTO agent_state (key, value, updated_at)
           VALUES ('migration_completed', '"true"', ?)`)
                .run(Date.now());
            // Backup original files
            this.backupOriginalFiles();
            console.log("Migration completed successfully:", result.migratedCounts);
        }
        catch (error) {
            result.success = false;
            result.errors.push(error instanceof Error ? error.message : String(error));
            console.error("Migration failed:", error);
        }
        return result;
    }
    migrateStateFile(result) {
        const stateFile = join(this.dataDir, "state.json");
        if (!existsSync(stateFile)) {
            console.log("No state.json found, checking projects.json...");
            this.migrateProjectsFile(result);
            return;
        }
        const data = readFileSync(stateFile, "utf-8");
        const state = JSON.parse(data);
        // Begin transaction
        this.db.exec("BEGIN TRANSACTION");
        try {
            // Migrate projects
            for (const project of state.projects) {
                this.insertProject(project);
                result.migratedCounts.projects++;
            }
            // Migrate tasks
            for (const task of state.tasks) {
                this.insertTask(task);
                result.migratedCounts.tasks++;
            }
            // Migrate pending actions
            for (const action of state.pendingActions) {
                this.insertPendingAction(action);
                result.migratedCounts.pendingActions++;
            }
            // Migrate metrics
            for (const metric of state.metrics) {
                this.insertMetric(metric);
                result.migratedCounts.metrics++;
            }
            // Migrate reports
            for (const report of state.reports) {
                this.insertReport(report);
                result.migratedCounts.reports++;
            }
            // Migrate ideas
            for (const idea of state.ideas || []) {
                this.insertIdea(idea);
                result.migratedCounts.ideas++;
            }
            // Migrate agent state values
            if (state.lastHealthCheck) {
                this.db
                    .prepare(`INSERT OR REPLACE INTO agent_state (key, value, updated_at)
             VALUES ('lastHealthCheck', ?, ?)`)
                    .run(JSON.stringify(state.lastHealthCheck), Date.now());
            }
            if (state.lastDeepAnalysis) {
                this.db
                    .prepare(`INSERT OR REPLACE INTO agent_state (key, value, updated_at)
             VALUES ('lastDeepAnalysis', ?, ?)`)
                    .run(JSON.stringify(state.lastDeepAnalysis), Date.now());
            }
            this.db.exec("COMMIT");
        }
        catch (error) {
            this.db.exec("ROLLBACK");
            throw error;
        }
    }
    migrateProjectsFile(result) {
        const projectsFile = join(this.dataDir, "projects.json");
        if (!existsSync(projectsFile)) {
            console.log("No projects.json found, skipping project migration");
            return;
        }
        const data = readFileSync(projectsFile, "utf-8");
        const projectsConfig = JSON.parse(data);
        if (!projectsConfig.projects) {
            return;
        }
        this.db.exec("BEGIN TRANSACTION");
        try {
            for (const project of projectsConfig.projects) {
                this.insertProject(project);
                result.migratedCounts.projects++;
            }
            this.db.exec("COMMIT");
        }
        catch (error) {
            this.db.exec("ROLLBACK");
            throw error;
        }
    }
    migrateChatHistory(result) {
        const chatFile = join(this.dataDir, "chat-history.json");
        if (!existsSync(chatFile)) {
            console.log("No chat-history.json found, skipping chat migration");
            return;
        }
        const data = readFileSync(chatFile, "utf-8");
        const chatStore = JSON.parse(data);
        this.db.exec("BEGIN TRANSACTION");
        try {
            // Migrate sessions
            for (const session of chatStore.sessions) {
                this.db
                    .prepare(`INSERT INTO chat_sessions (id, title, created_at, updated_at)
             VALUES (?, ?, ?, ?)`)
                    .run(session.id, session.title ?? null, session.createdAt, session.updatedAt);
                result.migratedCounts.chatSessions++;
                // Migrate messages
                for (const message of session.messages) {
                    this.db
                        .prepare(`INSERT INTO chat_messages (
                id, session_id, role, content, timestamp,
                project_ids, mentions, steps, success, error
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                        .run(message.id, session.id, message.role, message.content, message.timestamp, message.projectIds ? JSON.stringify(message.projectIds) : null, message.mentions ? JSON.stringify(message.mentions) : null, message.steps ? JSON.stringify(message.steps) : null, message.success !== undefined ? (message.success ? 1 : 0) : null, message.error ?? null);
                    result.migratedCounts.chatMessages++;
                }
            }
            // Store current session ID
            if (chatStore.currentSessionId) {
                this.db
                    .prepare(`INSERT OR REPLACE INTO agent_state (key, value, updated_at)
             VALUES ('currentChatSessionId', ?, ?)`)
                    .run(JSON.stringify(chatStore.currentSessionId), Date.now());
            }
            this.db.exec("COMMIT");
        }
        catch (error) {
            this.db.exec("ROLLBACK");
            throw error;
        }
    }
    insertProject(project) {
        this.db
            .prepare(`INSERT INTO projects (
          id, name, repo, phase, monitoring_level, goals, focus_areas, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(project.id, project.name, project.repo, project.phase, project.monitoringLevel, JSON.stringify(project.goals), JSON.stringify(project.focusAreas), project.createdAt, project.updatedAt);
    }
    insertTask(task) {
        this.db
            .prepare(`INSERT INTO tasks (
          id, project_id, type, priority, title, description, context,
          suggested_actions, related_issues, related_prs, status, kanban_status,
          generated_at, completed_at, approved_by, generated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(task.id, task.projectId, task.type, task.priority, task.title, task.description, task.context, JSON.stringify(task.suggestedActions), JSON.stringify(task.relatedIssues), JSON.stringify(task.relatedPRs), task.status, task.kanbanStatus || "not_started", task.generatedAt, task.completedAt ?? null, task.approvedBy ?? null, task.generatedBy ?? null);
    }
    insertPendingAction(action) {
        this.db
            .prepare(`INSERT INTO pending_actions (
          id, task_id, action_type, action_description, action_payload,
          created_at, expires_at, status, telegram_message_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(action.id, action.taskId, action.action.type, action.action.description, JSON.stringify(action.action.payload), action.createdAt, action.expiresAt, action.status, action.telegramMessageId ?? null);
    }
    insertMetric(metric) {
        this.db
            .prepare(`INSERT INTO project_metrics (
          project_id, timestamp, open_issues, open_prs, last_commit_at,
          ci_status, velocity, health_score, security_alerts
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(metric.projectId, metric.timestamp, metric.openIssues, metric.openPRs, metric.lastCommitAt ?? null, metric.ciStatus, metric.velocity, metric.healthScore, metric.securityAlerts);
    }
    insertReport(report) {
        this.db
            .prepare(`INSERT INTO analysis_reports (
          id, type, project_ids, started_at, completed_at, summary, generated_tasks
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`)
            .run(report.id, report.type, JSON.stringify(report.projectIds), report.startedAt, report.completedAt ?? null, report.summary, JSON.stringify(report.generatedTasks));
        // Insert findings
        for (const finding of report.findings) {
            this.db
                .prepare(`INSERT INTO report_findings (
            report_id, severity, category, title, description, project_id
          ) VALUES (?, ?, ?, ?, ?, ?)`)
                .run(report.id, finding.severity, finding.category, finding.title, finding.description, finding.projectId !== "unknown" ? finding.projectId : null);
        }
        // Insert project reports
        for (const pr of report.projectReports || []) {
            this.db
                .prepare(`INSERT INTO project_reports (
            report_id, project_id, project_name, health_score,
            open_issues, open_prs, ci_status, risks
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
                .run(report.id, pr.projectId, pr.projectName, pr.healthScore, pr.openIssues, pr.openPRs, pr.ciStatus, JSON.stringify(pr.risks));
        }
    }
    insertIdea(idea) {
        this.db
            .prepare(`INSERT INTO ideas (
          id, title, description, status, plan, project_id,
          repo_name, repo_url, error, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(idea.id, idea.title, idea.description, idea.status, idea.plan ? JSON.stringify(idea.plan) : null, idea.projectId ?? null, idea.repoName ?? null, idea.repoUrl ?? null, idea.error ?? null, idea.createdAt, idea.updatedAt);
    }
    backupOriginalFiles() {
        const timestamp = Date.now();
        const stateFile = join(this.dataDir, "state.json");
        const chatFile = join(this.dataDir, "chat-history.json");
        const projectsFile = join(this.dataDir, "projects.json");
        if (existsSync(stateFile)) {
            renameSync(stateFile, join(this.dataDir, `state.json.backup.${timestamp}`));
            console.log(`Backed up state.json to state.json.backup.${timestamp}`);
        }
        if (existsSync(chatFile)) {
            renameSync(chatFile, join(this.dataDir, `chat-history.json.backup.${timestamp}`));
            console.log(`Backed up chat-history.json to chat-history.json.backup.${timestamp}`);
        }
        if (existsSync(projectsFile)) {
            renameSync(projectsFile, join(this.dataDir, `projects.json.backup.${timestamp}`));
            console.log(`Backed up projects.json to projects.json.backup.${timestamp}`);
        }
    }
}
//# sourceMappingURL=migration.service.js.map