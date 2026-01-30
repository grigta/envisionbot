/**
 * Chat Repository
 */
import { BaseRepository } from "./base.repository.js";
export class ChatRepository extends BaseRepository {
    tableName = "chat_sessions";
    cachePrefix = "pm:chat";
    cacheTTL = 300; // 5 minutes
    pubsubChannel = "pm:events:chat";
    rowToSession(row, messages) {
        return {
            id: row.id,
            title: row.title ?? undefined,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            messages,
        };
    }
    rowToMessage(row) {
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
    async getAllSessions(limit = 20) {
        const stmt = this.db.prepare(`
      SELECT * FROM chat_sessions
      ORDER BY updated_at DESC
      LIMIT ?
    `);
        const rows = stmt.all(limit);
        return Promise.all(rows.map(async (row) => {
            const messages = await this.getSessionMessages(row.id);
            return this.rowToSession(row, messages);
        }));
    }
    async getSessionById(id) {
        const cacheKey = `${this.cachePrefix}:session:${id}`;
        const cached = await this.getFromCache(cacheKey);
        if (cached)
            return cached;
        const stmt = this.db.prepare("SELECT * FROM chat_sessions WHERE id = ?");
        const row = stmt.get(id);
        if (row) {
            const messages = await this.getSessionMessages(id);
            const session = this.rowToSession(row, messages);
            await this.setCache(cacheKey, session);
            return session;
        }
        return undefined;
    }
    async getSessionMessages(sessionId, limit) {
        let sql = `
      SELECT * FROM chat_messages
      WHERE session_id = ?
      ORDER BY timestamp ASC
    `;
        const params = [sessionId];
        if (limit) {
            sql += " LIMIT ?";
            params.push(limit);
        }
        const stmt = this.db.prepare(sql);
        const rows = stmt.all(...params);
        return rows.map((row) => this.rowToMessage(row));
    }
    async createSession(session) {
        const stmt = this.db.prepare(`
      INSERT INTO chat_sessions (id, title, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `);
        stmt.run(session.id, session.title ?? null, session.createdAt, session.updatedAt);
        const fullSession = { ...session, messages: [] };
        await this.invalidateCache("pm:chat:sessions");
        return fullSession;
    }
    async updateSession(id, updates) {
        const session = await this.getSessionById(id);
        if (!session)
            return undefined;
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
        await this.invalidateCache(`${this.cachePrefix}:session:${id}`, "pm:chat:sessions");
        return updatedSession;
    }
    async deleteSession(id) {
        const stmt = this.db.prepare("DELETE FROM chat_sessions WHERE id = ?");
        const result = stmt.run(id);
        if (result.changes > 0) {
            await this.invalidateCache(`${this.cachePrefix}:session:${id}`, "pm:chat:sessions");
            return true;
        }
        return false;
    }
    async addMessage(sessionId, message) {
        const stmt = this.db.prepare(`
      INSERT INTO chat_messages (
        id, session_id, role, content, timestamp,
        project_ids, mentions, steps, success, error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(message.id, sessionId, message.role, message.content, message.timestamp, message.projectIds ? JSON.stringify(message.projectIds) : null, message.mentions ? JSON.stringify(message.mentions) : null, message.steps ? JSON.stringify(message.steps) : null, message.success !== undefined ? (message.success ? 1 : 0) : null, message.error ?? null);
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
    async getCurrentSessionId() {
        return this.cache.get("pm:chat:current");
    }
    async setCurrentSessionId(sessionId) {
        await this.cache.set("pm:chat:current", sessionId);
    }
}
//# sourceMappingURL=chat.repository.js.map