/**
 * Project Repository
 */
import { BaseRepository } from "./base.repository.js";
export class ProjectRepository extends BaseRepository {
    tableName = "projects";
    cachePrefix = "pm:project";
    cacheTTL = 300; // 5 minutes
    pubsubChannel = "pm:events:projects";
    rowToProject(row) {
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
    async getAll() {
        const cacheKey = this.listCacheKey();
        const cached = await this.getFromCache(cacheKey);
        if (cached)
            return cached;
        const stmt = this.db.prepare("SELECT * FROM projects ORDER BY updated_at DESC");
        const rows = stmt.all();
        const projects = rows.map((row) => this.rowToProject(row));
        await this.setCache(cacheKey, projects, 60);
        return projects;
    }
    async getById(id) {
        const cacheKey = this.entityCacheKey(id);
        const cached = await this.getFromCache(cacheKey);
        if (cached)
            return cached;
        const stmt = this.db.prepare("SELECT * FROM projects WHERE id = ?");
        const row = stmt.get(id);
        if (row) {
            const project = this.rowToProject(row);
            await this.setCache(cacheKey, project);
            return project;
        }
        return undefined;
    }
    async getByName(name) {
        const stmt = this.db.prepare("SELECT * FROM projects WHERE LOWER(name) = LOWER(?)");
        const row = stmt.get(name);
        return row ? this.rowToProject(row) : undefined;
    }
    async getByRepo(repo) {
        const stmt = this.db.prepare("SELECT * FROM projects WHERE LOWER(repo) = LOWER(?)");
        const row = stmt.get(repo);
        return row ? this.rowToProject(row) : undefined;
    }
    async upsert(project) {
        const stmt = this.db.prepare(`
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
        await this.invalidateCache(this.entityCacheKey(project.id), this.listCacheKey(), "pm:stats");
        await this.publishEvent("project_upserted", project);
        return project;
    }
    async delete(id) {
        const stmt = this.db.prepare("DELETE FROM projects WHERE id = ?");
        const result = stmt.run(id);
        if (result.changes > 0) {
            await this.invalidateCache(this.entityCacheKey(id), this.listCacheKey(), "pm:stats");
            await this.publishEvent("project_deleted", { id });
            return true;
        }
        return false;
    }
}
//# sourceMappingURL=project.repository.js.map