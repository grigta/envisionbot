/**
 * Team Member Repository
 */

import type { TeamMember, ProjectTeamMember } from "../types.js";
import { BaseRepository, type RepositoryDeps } from "./base.repository.js";

interface TeamMemberRow {
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

interface ProjectTeamMemberRow {
  id: number;
  project_id: string;
  member_id: string;
  role: string | null;
  joined_at: number;
}

export class TeamMemberRepository extends BaseRepository<TeamMember> {
  protected readonly tableName = "team_members";
  protected readonly cachePrefix = "pm:team_member";
  protected readonly cacheTTL = 300; // 5 minutes
  protected readonly pubsubChannel = "pm:events:team" as const;

  private rowToTeamMember(row: TeamMemberRow): TeamMember {
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

  async getAll(): Promise<TeamMember[]> {
    const cacheKey = this.listCacheKey();
    const cached = await this.getFromCache<TeamMember[]>(cacheKey);
    if (cached) return cached;

    const stmt = this.db.prepare("SELECT * FROM team_members ORDER BY name ASC");
    const rows = stmt.all() as TeamMemberRow[];
    const members = rows.map((row) => this.rowToTeamMember(row));

    await this.setCache(cacheKey, members, 60);
    return members;
  }

  async getById(id: string): Promise<TeamMember | undefined> {
    const cacheKey = this.entityCacheKey(id);
    const cached = await this.getFromCache<TeamMember>(cacheKey);
    if (cached) return cached;

    const stmt = this.db.prepare("SELECT * FROM team_members WHERE id = ?");
    const row = stmt.get(id) as TeamMemberRow | undefined;

    if (row) {
      const member = this.rowToTeamMember(row);
      await this.setCache(cacheKey, member);
      return member;
    }

    return undefined;
  }

  async getByEmail(email: string): Promise<TeamMember | undefined> {
    const stmt = this.db.prepare(
      "SELECT * FROM team_members WHERE LOWER(email) = LOWER(?)"
    );
    const row = stmt.get(email) as TeamMemberRow | undefined;
    return row ? this.rowToTeamMember(row) : undefined;
  }

  async getByGithubUsername(username: string): Promise<TeamMember | undefined> {
    const stmt = this.db.prepare(
      "SELECT * FROM team_members WHERE LOWER(github_username) = LOWER(?)"
    );
    const row = stmt.get(username) as TeamMemberRow | undefined;
    return row ? this.rowToTeamMember(row) : undefined;
  }

  async getActive(): Promise<TeamMember[]> {
    const stmt = this.db.prepare(
      "SELECT * FROM team_members WHERE is_active = 1 ORDER BY name ASC"
    );
    const rows = stmt.all() as TeamMemberRow[];
    return rows.map((row) => this.rowToTeamMember(row));
  }

  async upsert(member: TeamMember): Promise<TeamMember> {
    const stmt = this.db.prepare(`
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

    await this.invalidateCache(
      this.entityCacheKey(member.id),
      this.listCacheKey()
    );

    await this.publishEvent("team_member_upserted", member);

    return member;
  }

  async delete(id: string): Promise<boolean> {
    const stmt = this.db.prepare("DELETE FROM team_members WHERE id = ?");
    const result = stmt.run(id);

    if (result.changes > 0) {
      await this.invalidateCache(this.entityCacheKey(id), this.listCacheKey());
      await this.publishEvent("team_member_deleted", { id });
      return true;
    }

    return false;
  }

  // Project Team Members

  async getProjectMembers(projectId: string): Promise<TeamMember[]> {
    const stmt = this.db.prepare(`
      SELECT tm.* FROM team_members tm
      INNER JOIN project_team_members ptm ON tm.id = ptm.member_id
      WHERE ptm.project_id = ?
      ORDER BY tm.name ASC
    `);
    const rows = stmt.all(projectId) as TeamMemberRow[];
    return rows.map((row) => this.rowToTeamMember(row));
  }

  async getMemberProjects(memberId: string): Promise<string[]> {
    const stmt = this.db.prepare(`
      SELECT project_id FROM project_team_members
      WHERE member_id = ?
    `);
    const rows = stmt.all(memberId) as Array<{ project_id: string }>;
    return rows.map((row) => row.project_id);
  }

  async addMemberToProject(
    projectId: string,
    memberId: string,
    role?: string
  ): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO project_team_members (project_id, member_id, role, joined_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(project_id, member_id) DO UPDATE SET
        role = excluded.role
    `);

    stmt.run(projectId, memberId, role ?? null, Date.now());

    await this.invalidateCache(`pm:project:${projectId}:members`);
    await this.publishEvent("member_added_to_project", { projectId, memberId, role });
  }

  async removeMemberFromProject(projectId: string, memberId: string): Promise<boolean> {
    const stmt = this.db.prepare(`
      DELETE FROM project_team_members
      WHERE project_id = ? AND member_id = ?
    `);
    const result = stmt.run(projectId, memberId);

    if (result.changes > 0) {
      await this.invalidateCache(`pm:project:${projectId}:members`);
      await this.publishEvent("member_removed_from_project", { projectId, memberId });
      return true;
    }

    return false;
  }
}
