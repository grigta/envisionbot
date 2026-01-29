/**
 * Project Repository
 */

import type { Project, FocusArea } from "../types.js";
import { BaseRepository, type RepositoryDeps } from "./base.repository.js";

interface ProjectRow {
  id: string;
  name: string;
  repo: string;
  phase: Project["phase"];
  monitoring_level: Project["monitoringLevel"];
  goals: string;
  focus_areas: string;
  created_at: number;
  updated_at: number;
  health_check_interval_hours: number | null;
  alert_threshold_health_score: number | null;
  alert_threshold_open_issues: number | null;
  alert_on_ci_failure: number;
}

export class ProjectRepository extends BaseRepository<Project> {
  protected readonly tableName = "projects";
  protected readonly cachePrefix = "pm:project";
  protected readonly cacheTTL = 300; // 5 minutes
  protected readonly pubsubChannel = "pm:events:projects" as const;

  private rowToProject(row: ProjectRow): Project {
    return {
      id: row.id,
      name: row.name,
      repo: row.repo,
      phase: row.phase,
      monitoringLevel: row.monitoring_level,
      goals: JSON.parse(row.goals),
      focusAreas: JSON.parse(row.focus_areas) as FocusArea[],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      healthCheckIntervalHours: row.health_check_interval_hours ?? undefined,
      alertThresholdHealthScore: row.alert_threshold_health_score ?? undefined,
      alertThresholdOpenIssues: row.alert_threshold_open_issues ?? undefined,
      alertOnCiFailure: row.alert_on_ci_failure === 1,
    };
  }

  async getAll(): Promise<Project[]> {
    const cacheKey = this.listCacheKey();
    const cached = await this.getFromCache<Project[]>(cacheKey);
    if (cached) return cached;

    const stmt = this.db.prepare("SELECT * FROM projects ORDER BY updated_at DESC");
    const rows = stmt.all() as ProjectRow[];
    const projects = rows.map((row) => this.rowToProject(row));

    await this.setCache(cacheKey, projects, 60);
    return projects;
  }

  async getById(id: string): Promise<Project | undefined> {
    const cacheKey = this.entityCacheKey(id);
    const cached = await this.getFromCache<Project>(cacheKey);
    if (cached) return cached;

    const stmt = this.db.prepare("SELECT * FROM projects WHERE id = ?");
    const row = stmt.get(id) as ProjectRow | undefined;

    if (row) {
      const project = this.rowToProject(row);
      await this.setCache(cacheKey, project);
      return project;
    }

    return undefined;
  }

  async getByName(name: string): Promise<Project | undefined> {
    const stmt = this.db.prepare(
      "SELECT * FROM projects WHERE LOWER(name) = LOWER(?)"
    );
    const row = stmt.get(name) as ProjectRow | undefined;
    return row ? this.rowToProject(row) : undefined;
  }

  async getByRepo(repo: string): Promise<Project | undefined> {
    const stmt = this.db.prepare(
      "SELECT * FROM projects WHERE LOWER(repo) = LOWER(?)"
    );
    const row = stmt.get(repo) as ProjectRow | undefined;
    return row ? this.rowToProject(row) : undefined;
  }

  async upsert(project: Project): Promise<Project> {
    const stmt = this.db.prepare(`
      INSERT INTO projects (
        id, name, repo, phase, monitoring_level, goals, focus_areas, created_at, updated_at,
        health_check_interval_hours, alert_threshold_health_score, alert_threshold_open_issues, alert_on_ci_failure
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        repo = excluded.repo,
        phase = excluded.phase,
        monitoring_level = excluded.monitoring_level,
        goals = excluded.goals,
        focus_areas = excluded.focus_areas,
        updated_at = excluded.updated_at,
        health_check_interval_hours = excluded.health_check_interval_hours,
        alert_threshold_health_score = excluded.alert_threshold_health_score,
        alert_threshold_open_issues = excluded.alert_threshold_open_issues,
        alert_on_ci_failure = excluded.alert_on_ci_failure
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
      project.updatedAt,
      project.healthCheckIntervalHours ?? null,
      project.alertThresholdHealthScore ?? null,
      project.alertThresholdOpenIssues ?? null,
      project.alertOnCiFailure === false ? 0 : 1
    );

    await this.invalidateCache(
      this.entityCacheKey(project.id),
      this.listCacheKey(),
      "pm:stats"
    );

    await this.publishEvent("project_upserted", project);

    return project;
  }

  async delete(id: string): Promise<boolean> {
    const stmt = this.db.prepare("DELETE FROM projects WHERE id = ?");
    const result = stmt.run(id);

    if (result.changes > 0) {
      await this.invalidateCache(
        this.entityCacheKey(id),
        this.listCacheKey(),
        "pm:stats"
      );

      await this.publishEvent("project_deleted", { id });
      return true;
    }

    return false;
  }
}
