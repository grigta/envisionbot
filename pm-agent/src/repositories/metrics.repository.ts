/**
 * Project Metrics Repository
 */

import type { ProjectMetrics } from "../types.js";
import { BaseRepository, type RepositoryDeps } from "./base.repository.js";

interface MetricsRow {
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
}

export class MetricsRepository extends BaseRepository<ProjectMetrics> {
  protected readonly tableName = "project_metrics";
  protected readonly cachePrefix = "pm:metrics";
  protected readonly cacheTTL = 120; // 2 minutes
  protected readonly pubsubChannel = "pm:events:analysis" as const;

  private rowToMetrics(row: MetricsRow): ProjectMetrics {
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

  async getByProjectId(projectId: string, limit = 10): Promise<ProjectMetrics[]> {
    const cacheKey = `${this.cachePrefix}:project:${projectId}:${limit}`;
    const cached = await this.getFromCache<ProjectMetrics[]>(cacheKey);
    if (cached) return cached;

    const stmt = this.db.prepare(`
      SELECT * FROM project_metrics
      WHERE project_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    const rows = stmt.all(projectId, limit) as MetricsRow[];
    const metrics = rows.map((row) => this.rowToMetrics(row));

    await this.setCache(cacheKey, metrics);
    return metrics;
  }

  async getLatest(projectId: string): Promise<ProjectMetrics | undefined> {
    const stmt = this.db.prepare(`
      SELECT * FROM project_metrics
      WHERE project_id = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `);
    const row = stmt.get(projectId) as MetricsRow | undefined;
    return row ? this.rowToMetrics(row) : undefined;
  }

  async create(metrics: ProjectMetrics): Promise<ProjectMetrics> {
    const stmt = this.db.prepare(`
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

    // Clean up old metrics (keep last 100 per project)
    await this.cleanupOldMetrics(metrics.projectId, 100);

    await this.invalidateCachePattern(`${this.cachePrefix}:project:${metrics.projectId}:*`);

    return metrics;
  }

  private async cleanupOldMetrics(projectId: string, keep: number): Promise<void> {
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
