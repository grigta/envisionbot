/**
 * Idea Repository
 */

import type { Idea, IdeaPlan, IdeaStatus } from "../types.js";
import { BaseRepository, type RepositoryDeps } from "./base.repository.js";

interface IdeaRow {
  id: string;
  title: string;
  description: string;
  status: IdeaStatus;
  plan: string | null;
  project_id: string | null;
  repo_name: string | null;
  repo_url: string | null;
  error: string | null;
  created_at: number;
  updated_at: number;
}

interface IdeaFilter {
  status?: IdeaStatus;
}

export class IdeaRepository extends BaseRepository<Idea> {
  protected readonly tableName = "ideas";
  protected readonly cachePrefix = "pm:idea";
  protected readonly cacheTTL = 300; // 5 minutes
  protected readonly pubsubChannel = "pm:events:ideas" as const;

  private rowToIdea(row: IdeaRow): Idea {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      plan: row.plan ? (JSON.parse(row.plan) as IdeaPlan) : undefined,
      projectId: row.project_id ?? undefined,
      repoName: row.repo_name ?? undefined,
      repoUrl: row.repo_url ?? undefined,
      error: row.error ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getAll(filter?: IdeaFilter): Promise<Idea[]> {
    let sql = "SELECT * FROM ideas";
    const params: unknown[] = [];

    if (filter?.status) {
      sql += " WHERE status = ?";
      params.push(filter.status);
    }

    sql += " ORDER BY created_at DESC";

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as IdeaRow[];
    return rows.map((row) => this.rowToIdea(row));
  }

  async getActive(): Promise<Idea[]> {
    const cacheKey = "pm:ideas:active";
    const cached = await this.getFromCache<Idea[]>(cacheKey);
    if (cached) return cached;

    const stmt = this.db.prepare(`
      SELECT * FROM ideas
      WHERE status NOT IN ('completed', 'failed')
      ORDER BY created_at DESC
    `);
    const rows = stmt.all() as IdeaRow[];
    const ideas = rows.map((row) => this.rowToIdea(row));

    await this.setCache(cacheKey, ideas, 60);
    return ideas;
  }

  async getById(id: string): Promise<Idea | undefined> {
    const cacheKey = this.entityCacheKey(id);
    const cached = await this.getFromCache<Idea>(cacheKey);
    if (cached) return cached;

    const stmt = this.db.prepare("SELECT * FROM ideas WHERE id = ?");
    const row = stmt.get(id) as IdeaRow | undefined;

    if (row) {
      const idea = this.rowToIdea(row);
      await this.setCache(cacheKey, idea);
      return idea;
    }

    return undefined;
  }

  async create(idea: Idea): Promise<Idea> {
    const stmt = this.db.prepare(`
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

    await this.invalidateCache("pm:ideas:active", "pm:stats");
    await this.publishEvent("idea_created", idea);

    return idea;
  }

  async update(id: string, updates: Partial<Idea>): Promise<Idea | undefined> {
    const idea = await this.getById(id);
    if (!idea) return undefined;

    const updatedIdea: Idea = {
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

    stmt.run(
      updatedIdea.title,
      updatedIdea.description,
      updatedIdea.status,
      updatedIdea.plan ? JSON.stringify(updatedIdea.plan) : null,
      updatedIdea.projectId ?? null,
      updatedIdea.repoName ?? null,
      updatedIdea.repoUrl ?? null,
      updatedIdea.error ?? null,
      updatedIdea.updatedAt,
      id
    );

    await this.invalidateCache(
      this.entityCacheKey(id),
      "pm:ideas:active",
      "pm:stats"
    );

    // Publish appropriate event based on status
    if (updates.status === "plan_ready") {
      await this.publishEvent("idea_plan_ready", updatedIdea);
    } else if (updates.status === "completed") {
      await this.publishEvent("idea_launched", updatedIdea);
    } else {
      await this.publishEvent("idea_updated", updatedIdea);
    }

    return updatedIdea;
  }

  async delete(id: string): Promise<boolean> {
    const stmt = this.db.prepare("DELETE FROM ideas WHERE id = ?");
    const result = stmt.run(id);

    if (result.changes > 0) {
      await this.invalidateCache(
        this.entityCacheKey(id),
        "pm:ideas:active",
        "pm:stats"
      );
      return true;
    }

    return false;
  }
}
