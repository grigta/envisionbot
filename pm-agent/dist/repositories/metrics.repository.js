/**
 * Project Metrics Repository
 */
import { BaseRepository } from "./base.repository.js";
export class MetricsRepository extends BaseRepository {
    tableName = "project_metrics";
    cachePrefix = "pm:metrics";
    cacheTTL = 120; // 2 minutes
    pubsubChannel = "pm:events:analysis";
    rowToMetrics(row) {
        return {
            projectId: row.project_id,
            timestamp: row.timestamp,
            openIssues: row.open_issues,
            openPRs: row.open_prs,
            lastCommitAt: row.last_commit_at ?? undefined,
            ciStatus: row.ci_status,
            velocity: row.velocity,
            healthScore: row.health_score,
            securityAlerts: row.security_alerts,
        };
    }
    async getByProjectId(projectId, limit = 10) {
        const cacheKey = `${this.cachePrefix}:project:${projectId}:${limit}`;
        const cached = await this.getFromCache(cacheKey);
        if (cached)
            return cached;
        const stmt = this.db.prepare(`
      SELECT * FROM project_metrics
      WHERE project_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
        const rows = stmt.all(projectId, limit);
        const metrics = rows.map((row) => this.rowToMetrics(row));
        await this.setCache(cacheKey, metrics);
        return metrics;
    }
    async getLatest(projectId) {
        const stmt = this.db.prepare(`
      SELECT * FROM project_metrics
      WHERE project_id = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `);
        const row = stmt.get(projectId);
        return row ? this.rowToMetrics(row) : undefined;
    }
    async create(metrics) {
        const stmt = this.db.prepare(`
      INSERT INTO project_metrics (
        project_id, timestamp, open_issues, open_prs, last_commit_at,
        ci_status, velocity, health_score, security_alerts
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(metrics.projectId, metrics.timestamp, metrics.openIssues, metrics.openPRs, metrics.lastCommitAt ?? null, metrics.ciStatus, metrics.velocity, metrics.healthScore, metrics.securityAlerts);
        // Clean up old metrics (keep last 100 per project)
        await this.cleanupOldMetrics(metrics.projectId, 100);
        await this.invalidateCachePattern(`${this.cachePrefix}:project:${metrics.projectId}:*`);
        return metrics;
    }
    async cleanupOldMetrics(projectId, keep) {
        const stmt = this.db.prepare(`
      DELETE FROM project_metrics
      WHERE project_id = ? AND id NOT IN (
        SELECT id FROM project_metrics
        WHERE project_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
      )
    `);
        stmt.run(projectId, projectId, keep);
    }
}
//# sourceMappingURL=metrics.repository.js.map