/**
 * Idea Repository
 */
import { BaseRepository } from "./base.repository.js";
export class IdeaRepository extends BaseRepository {
    tableName = "ideas";
    cachePrefix = "pm:idea";
    cacheTTL = 300; // 5 minutes
    pubsubChannel = "pm:events:ideas";
    rowToIdea(row) {
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
    async getAll(filter) {
        let sql = "SELECT * FROM ideas";
        const params = [];
        if (filter?.status) {
            sql += " WHERE status = ?";
            params.push(filter.status);
        }
        sql += " ORDER BY created_at DESC";
        const stmt = this.db.prepare(sql);
        const rows = stmt.all(...params);
        return rows.map((row) => this.rowToIdea(row));
    }
    async getActive() {
        const cacheKey = "pm:ideas:active";
        const cached = await this.getFromCache(cacheKey);
        if (cached)
            return cached;
        const stmt = this.db.prepare(`
      SELECT * FROM ideas
      WHERE status NOT IN ('completed', 'failed')
      ORDER BY created_at DESC
    `);
        const rows = stmt.all();
        const ideas = rows.map((row) => this.rowToIdea(row));
        await this.setCache(cacheKey, ideas, 60);
        return ideas;
    }
    async getById(id) {
        const cacheKey = this.entityCacheKey(id);
        const cached = await this.getFromCache(cacheKey);
        if (cached)
            return cached;
        const stmt = this.db.prepare("SELECT * FROM ideas WHERE id = ?");
        const row = stmt.get(id);
        if (row) {
            const idea = this.rowToIdea(row);
            await this.setCache(cacheKey, idea);
            return idea;
        }
        return undefined;
    }
    async create(idea) {
        const stmt = this.db.prepare(`
      INSERT INTO ideas (
        id, title, description, status, plan, project_id,
        repo_name, repo_url, error, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(idea.id, idea.title, idea.description, idea.status, idea.plan ? JSON.stringify(idea.plan) : null, idea.projectId ?? null, idea.repoName ?? null, idea.repoUrl ?? null, idea.error ?? null, idea.createdAt, idea.updatedAt);
        await this.invalidateCache("pm:ideas:active", "pm:stats");
        await this.publishEvent("idea_created", idea);
        return idea;
    }
    async update(id, updates) {
        const idea = await this.getById(id);
        if (!idea)
            return undefined;
        const updatedIdea = {
            ...idea,
            ...updates,
            updatedAt: Date.now(),
        };
        const stmt = this.db.prepare(`
      UPDATE ideas
      SET title = ?, description = ?, status = ?, plan = ?,
          project_id = ?, repo_name = ?, repo_url = ?, error = ?, updated_at = ?
      WHERE id = ?
    `);
        stmt.run(updatedIdea.title, updatedIdea.description, updatedIdea.status, updatedIdea.plan ? JSON.stringify(updatedIdea.plan) : null, updatedIdea.projectId ?? null, updatedIdea.repoName ?? null, updatedIdea.repoUrl ?? null, updatedIdea.error ?? null, updatedIdea.updatedAt, id);
        await this.invalidateCache(this.entityCacheKey(id), "pm:ideas:active", "pm:stats");
        // Publish appropriate event based on status
        if (updates.status === "plan_ready") {
            await this.publishEvent("idea_plan_ready", updatedIdea);
        }
        else if (updates.status === "completed") {
            await this.publishEvent("idea_launched", updatedIdea);
        }
        else {
            await this.publishEvent("idea_updated", updatedIdea);
        }
        return updatedIdea;
    }
    async delete(id) {
        const stmt = this.db.prepare("DELETE FROM ideas WHERE id = ?");
        const result = stmt.run(id);
        if (result.changes > 0) {
            await this.invalidateCache(this.entityCacheKey(id), "pm:ideas:active", "pm:stats");
            return true;
        }
        return false;
    }
}
//# sourceMappingURL=idea.repository.js.map