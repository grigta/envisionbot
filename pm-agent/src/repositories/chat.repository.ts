/**
 * Chat Repository
 */

import { BaseRepository, type RepositoryDeps } from "./base.repository.js";

export interface ChatSession {
  id: string;
  title?: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  projectIds?: string[];
  mentions?: Array<{ type: string; value: string }>;
  steps?: unknown[];
  success?: boolean;
  error?: string;
}

interface SessionRow {
  id: string;
  title: string | null;
  created_at: number;
  updated_at: number;
}

interface MessageRow {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  project_ids: string | null;
  mentions: string | null;
  steps: string | null;
  success: number | null;
  error: string | null;
}

export class ChatRepository extends BaseRepository<ChatSession> {
  protected readonly tableName = "chat_sessions";
  protected readonly cachePrefix = "pm:chat";
  protected readonly cacheTTL = 300; // 5 minutes
  protected readonly pubsubChannel = "pm:events:chat" as const;

  private rowToSession(row: SessionRow, messages: ChatMessage[]): ChatSession {
    return {
      id: row.id,
      title: row.title ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      messages,
    };
  }

  private rowToMessage(row: MessageRow): ChatMessage {
    return {
      id: row.id,
      role: row.role,
      content: row.content,
      timestamp: row.timestamp,
      projectIds: row.project_ids ? JSON.parse(row.project_ids) : undefined,
      mentions: row.mentions ? JSON.parse(row.mentions) : undefined,
      steps: row.steps ? JSON.parse(row.steps) : undefined,
      success: row.success !== null ? row.success === 1 : undefined,
      error: row.error ?? undefined,
    };
  }

  async getAllSessions(limit = 20): Promise<ChatSession[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM chat_sessions
      ORDER BY updated_at DESC
      LIMIT ?
    `);
    const rows = stmt.all(limit) as SessionRow[];

    return Promise.all(
      rows.map(async (row) => {
        const messages = await this.getSessionMessages(row.id);
        return this.rowToSession(row, messages);
      })
    );
  }

  async getSessionById(id: string): Promise<ChatSession | undefined> {
    const cacheKey = `${this.cachePrefix}:session:${id}`;
    const cached = await this.getFromCache<ChatSession>(cacheKey);
    if (cached) return cached;

    const stmt = this.db.prepare("SELECT * FROM chat_sessions WHERE id = ?");
    const row = stmt.get(id) as SessionRow | undefined;

    if (row) {
      const messages = await this.getSessionMessages(id);
      const session = this.rowToSession(row, messages);
      await this.setCache(cacheKey, session);
      return session;
    }

    return undefined;
  }

  async getSessionMessages(
    sessionId: string,
    limit?: number
  ): Promise<ChatMessage[]> {
    let sql = `
      SELECT * FROM chat_messages
      WHERE session_id = ?
      ORDER BY timestamp ASC
    `;
    const params: unknown[] = [sessionId];

    if (limit) {
      sql += " LIMIT ?";
      params.push(limit);
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as MessageRow[];
    return rows.map((row) => this.rowToMessage(row));
  }

  async createSession(session: Omit<ChatSession, "messages">): Promise<ChatSession> {
    const stmt = this.db.prepare(`
      INSERT INTO chat_sessions (id, title, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(session.id, session.title ?? null, session.createdAt, session.updatedAt);

    const fullSession: ChatSession = { ...session, messages: [] };
    await this.invalidateCache("pm:chat:sessions");

    return fullSession;
  }

  async updateSession(
    id: string,
    updates: Partial<Pick<ChatSession, "title" | "updatedAt">>
  ): Promise<ChatSession | undefined> {
    const session = await this.getSessionById(id);
    if (!session) return undefined;

    const stmt = this.db.prepare(`
      UPDATE chat_sessions
      SET title = COALESCE(?, title), updated_at = ?
      WHERE id = ?
    `);

    const updatedAt = updates.updatedAt ?? Date.now();
    stmt.run(updates.title ?? null, updatedAt, id);

    const updatedSession = {
      ...session,
      title: updates.title ?? session.title,
      updatedAt,
    };

    await this.invalidateCache(
      `${this.cachePrefix}:session:${id}`,
      "pm:chat:sessions"
    );

    return updatedSession;
  }

  async deleteSession(id: string): Promise<boolean> {
    const stmt = this.db.prepare("DELETE FROM chat_sessions WHERE id = ?");
    const result = stmt.run(id);

    if (result.changes > 0) {
      await this.invalidateCache(
        `${this.cachePrefix}:session:${id}`,
        "pm:chat:sessions"
      );
      return true;
    }

    return false;
  }

  async addMessage(sessionId: string, message: ChatMessage): Promise<ChatMessage> {
    const stmt = this.db.prepare(`
      INSERT INTO chat_messages (
        id, session_id, role, content, timestamp,
        project_ids, mentions, steps, success, error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      message.id,
      sessionId,
      message.role,
      message.content,
      message.timestamp,
      message.projectIds ? JSON.stringify(message.projectIds) : null,
      message.mentions ? JSON.stringify(message.mentions) : null,
      message.steps ? JSON.stringify(message.steps) : null,
      message.success !== undefined ? (message.success ? 1 : 0) : null,
      message.error ?? null
    );

    // Update session's updated_at
    const updateStmt = this.db.prepare(`
      UPDATE chat_sessions SET updated_at = ? WHERE id = ?
    `);
    updateStmt.run(message.timestamp, sessionId);

    await this.invalidateCache(`${this.cachePrefix}:session:${sessionId}`);

    // Publish chat event
    await this.publishEvent("chat_message", { sessionId, message });

    return message;
  }

  async getCurrentSessionId(): Promise<string | null> {
    return this.cache.get("pm:chat:current");
  }

  async setCurrentSessionId(sessionId: string): Promise<void> {
    await this.cache.set("pm:chat:current", sessionId);
  }
}
