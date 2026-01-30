/**
 * Plan Repository
 * Handles storage and retrieval of project plans
 */
import { randomUUID } from "node:crypto";
import { BaseRepository } from "./base.repository.js";
export class PlanRepository extends BaseRepository {
    tableName = "project_plans";
    cachePrefix = "pm:plan";
    cacheTTL = 300; // 5 minutes
    pubsubChannel = "pm:events:analysis";
    rowToPlan(row) {
        return {
            id: row.id,
            projectId: row.project_id,
            markdown: row.markdown,
            version: row.version,
            generatedAt: row.generated_at,
            updatedAt: row.updated_at,
            analysisSummary: row.analysis_summary || undefined,
        };
    }
    statusRowToStatus(row) {
        return {
            projectId: row.project_id,
            status: row.status,
            progress: row.progress,
            currentStep: row.current_step || undefined,
            error: row.error || undefined,
            startedAt: row.started_at || undefined,
            completedAt: row.completed_at || undefined,
        };
    }
    /**
     * Get plan by project ID
     */
    async getByProjectId(projectId) {
        const cacheKey = this.entityCacheKey(projectId);
        const cached = await this.getFromCache(cacheKey);
        if (cached)
            return cached;
        const stmt = this.db.prepare("SELECT * FROM project_plans WHERE project_id = ?");
        const row = stmt.get(projectId);
        if (row) {
            const plan = this.rowToPlan(row);
            await this.setCache(cacheKey, plan);
            return plan;
        }
        return undefined;
    }
    /**
     * Get plan by ID
     */
    async getById(id) {
        const stmt = this.db.prepare("SELECT * FROM project_plans WHERE id = ?");
        const row = stmt.get(id);
        return row ? this.rowToPlan(row) : undefined;
    }
    /**
     * Save or update a plan
     */
    async upsert(plan) {
        const stmt = this.db.prepare(`
      INSERT INTO project_plans (id, project_id, markdown, version, generated_at, updated_at, analysis_summary)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET
        markdown = excluded.markdown,
        version = version + 1,
        updated_at = excluded.updated_at,
        analysis_summary = excluded.analysis_summary
    `);
        stmt.run(plan.id, plan.projectId, plan.markdown, plan.version, plan.generatedAt, plan.updatedAt, plan.analysisSummary || null);
        // Get the updated plan (version might have changed)
        const updated = await this.getByProjectId(plan.projectId);
        await this.invalidateCache(this.entityCacheKey(plan.projectId), this.listCacheKey());
        await this.publishEvent("plan_updated", updated || plan);
        return updated || plan;
    }
    /**
     * Update plan markdown only
     */
    async updateMarkdown(projectId, markdown) {
        const stmt = this.db.prepare(`
      UPDATE project_plans
      SET markdown = ?, updated_at = ?, version = version + 1
      WHERE project_id = ?
    `);
        const now = Date.now();
        const result = stmt.run(markdown, now, projectId);
        if (result.changes === 0) {
            return undefined;
        }
        await this.invalidateCache(this.entityCacheKey(projectId));
        const updated = await this.getByProjectId(projectId);
        if (updated) {
            await this.publishEvent("plan_updated", updated);
        }
        return updated;
    }
    /**
     * Delete a plan
     */
    async delete(projectId) {
        const stmt = this.db.prepare("DELETE FROM project_plans WHERE project_id = ?");
        const result = stmt.run(projectId);
        if (result.changes > 0) {
            await this.invalidateCache(this.entityCacheKey(projectId), this.listCacheKey());
            await this.publishEvent("plan_deleted", { projectId });
            return true;
        }
        return false;
    }
    /**
     * Get all plans
     */
    async getAll() {
        const cacheKey = this.listCacheKey();
        const cached = await this.getFromCache(cacheKey);
        if (cached)
            return cached;
        const stmt = this.db.prepare("SELECT * FROM project_plans ORDER BY updated_at DESC");
        const rows = stmt.all();
        const plans = rows.map((row) => this.rowToPlan(row));
        await this.setCache(cacheKey, plans, 60);
        return plans;
    }
    // ==========================================
    // Analysis Status Methods
    // ==========================================
    /**
     * Get analysis status for a project
     */
    async getAnalysisStatus(projectId) {
        const stmt = this.db.prepare("SELECT * FROM analysis_status WHERE project_id = ?");
        const row = stmt.get(projectId);
        return row ? this.statusRowToStatus(row) : undefined;
    }
    /**
     * Update analysis status
     */
    async updateAnalysisStatus(status) {
        const stmt = this.db.prepare(`
      INSERT INTO analysis_status (project_id, status, progress, current_step, error, started_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET
        status = excluded.status,
        progress = excluded.progress,
        current_step = excluded.current_step,
        error = excluded.error,
        started_at = COALESCE(excluded.started_at, started_at),
        completed_at = excluded.completed_at
    `);
        stmt.run(status.projectId, status.status, status.progress, status.currentStep || null, status.error || null, status.startedAt || null, status.completedAt || null);
        await this.publishEvent("analysis_progress", status);
    }
    /**
     * Reset analysis status to idle
     */
    async resetAnalysisStatus(projectId) {
        const stmt = this.db.prepare(`
      UPDATE analysis_status
      SET status = 'idle', progress = 0, current_step = NULL, error = NULL, completed_at = NULL
      WHERE project_id = ?
    `);
        stmt.run(projectId);
    }
    /**
     * Get all running analyses
     */
    async getRunningAnalyses() {
        const stmt = this.db.prepare(`
      SELECT * FROM analysis_status
      WHERE status NOT IN ('idle', 'completed', 'failed')
    `);
        const rows = stmt.all();
        return rows.map((row) => this.statusRowToStatus(row));
    }
    // ==========================================
    // Plan Version Methods
    // ==========================================
    versionRowToVersion(row) {
        return {
            id: row.id,
            planId: row.plan_id,
            version: row.version,
            markdown: row.markdown,
            analysisSummary: row.analysis_summary || undefined,
            changeSummary: row.change_summary || undefined,
            createdAt: row.created_at,
        };
    }
    /**
     * Archive the current plan version before updating
     */
    async archiveCurrentVersion(planId, changeSummary) {
        const current = await this.getById(planId);
        if (!current)
            return;
        const stmt = this.db.prepare(`
      INSERT INTO plan_versions (id, plan_id, version, markdown, analysis_summary, change_summary, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(randomUUID(), planId, current.version, current.markdown, current.analysisSummary || null, changeSummary || null, Date.now());
    }
    /**
     * Get all versions for a project
     */
    async getVersions(projectId) {
        // First get the plan ID for this project
        const plan = await this.getByProjectId(projectId);
        if (!plan)
            return [];
        const stmt = this.db.prepare(`
      SELECT * FROM plan_versions
      WHERE plan_id = ?
      ORDER BY version DESC
    `);
        const rows = stmt.all(plan.id);
        return rows.map((row) => this.versionRowToVersion(row));
    }
    /**
     * Get a specific version
     */
    async getVersion(projectId, version) {
        const plan = await this.getByProjectId(projectId);
        if (!plan)
            return undefined;
        // If requesting current version, return from project_plans
        if (version === plan.version) {
            return {
                id: plan.id,
                planId: plan.id,
                version: plan.version,
                markdown: plan.markdown,
                analysisSummary: plan.analysisSummary,
                createdAt: plan.updatedAt,
            };
        }
        // Otherwise look in history
        const stmt = this.db.prepare(`
      SELECT * FROM plan_versions
      WHERE plan_id = ? AND version = ?
    `);
        const row = stmt.get(plan.id, version);
        return row ? this.versionRowToVersion(row) : undefined;
    }
    /**
     * Get all versions including current (for dropdown)
     */
    async getAllVersionsWithCurrent(projectId) {
        const plan = await this.getByProjectId(projectId);
        if (!plan)
            return [];
        // Get historical versions
        const historicalVersions = await this.getVersions(projectId);
        // Add current version at the beginning
        const currentVersion = {
            id: plan.id,
            planId: plan.id,
            version: plan.version,
            markdown: plan.markdown,
            analysisSummary: plan.analysisSummary,
            createdAt: plan.updatedAt,
        };
        return [currentVersion, ...historicalVersions];
    }
}
//# sourceMappingURL=plan.repository.js.map