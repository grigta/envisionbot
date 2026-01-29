import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "../../data");
const CHAT_HISTORY_FILE = join(DATA_DIR, "chat-history.json");
const MAX_SESSIONS = 50;
const MAX_MESSAGES_PER_SESSION = 100;
class ChatHistory {
    store;
    constructor() {
        this.store = this.load();
    }
    load() {
        if (!existsSync(DATA_DIR)) {
            mkdirSync(DATA_DIR, { recursive: true });
        }
        if (existsSync(CHAT_HISTORY_FILE)) {
            try {
                const data = readFileSync(CHAT_HISTORY_FILE, "utf-8");
                return JSON.parse(data);
            }
            catch (error) {
                console.error("Failed to load chat history:", error);
            }
        }
        return { sessions: [] };
    }
    save() {
        try {
            writeFileSync(CHAT_HISTORY_FILE, JSON.stringify(this.store, null, 2));
        }
        catch (error) {
            console.error("Failed to save chat history:", error);
        }
    }
    /**
     * Get or create current session
     */
    getCurrentSession() {
        if (this.store.currentSessionId) {
            const session = this.store.sessions.find((s) => s.id === this.store.currentSessionId);
            if (session)
                return session;
        }
        // Create new session
        return this.createSession();
    }
    /**
     * Create a new chat session
     */
    createSession(title) {
        const session = {
            id: `session-${Date.now()}`,
            title,
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        this.store.sessions.unshift(session);
        this.store.currentSessionId = session.id;
        // Limit number of sessions
        if (this.store.sessions.length > MAX_SESSIONS) {
            this.store.sessions = this.store.sessions.slice(0, MAX_SESSIONS);
        }
        this.save();
        return session;
    }
    /**
     * Add a user message to the current session
     */
    addUserMessage(content, options) {
        const session = options?.sessionId
            ? this.store.sessions.find((s) => s.id === options.sessionId) || this.getCurrentSession()
            : this.getCurrentSession();
        const message = {
            id: `msg-${Date.now()}-user`,
            role: "user",
            content,
            timestamp: Date.now(),
            projectIds: options?.projectIds,
            mentions: options?.mentions,
        };
        session.messages.push(message);
        session.updatedAt = Date.now();
        // Auto-set title from first message
        if (!session.title && session.messages.length === 1) {
            session.title = content.slice(0, 50) + (content.length > 50 ? "..." : "");
        }
        // Limit messages per session
        if (session.messages.length > MAX_MESSAGES_PER_SESSION) {
            session.messages = session.messages.slice(-MAX_MESSAGES_PER_SESSION);
        }
        this.save();
        return message;
    }
    /**
     * Add an assistant message to the current session
     */
    addAssistantMessage(content, options) {
        const session = options?.sessionId
            ? this.store.sessions.find((s) => s.id === options.sessionId) || this.getCurrentSession()
            : this.getCurrentSession();
        const message = {
            id: `msg-${Date.now()}-assistant`,
            role: "assistant",
            content,
            timestamp: Date.now(),
            steps: options?.steps,
            success: options?.success,
            error: options?.error,
        };
        session.messages.push(message);
        session.updatedAt = Date.now();
        // Limit messages per session
        if (session.messages.length > MAX_MESSAGES_PER_SESSION) {
            session.messages = session.messages.slice(-MAX_MESSAGES_PER_SESSION);
        }
        this.save();
        return message;
    }
    /**
     * Get all sessions (for history display)
     */
    getSessions(limit = 20) {
        return this.store.sessions.slice(0, limit);
    }
    /**
     * Get a specific session
     */
    getSession(id) {
        return this.store.sessions.find((s) => s.id === id);
    }
    /**
     * Switch to a different session
     */
    switchSession(id) {
        const session = this.store.sessions.find((s) => s.id === id);
        if (session) {
            this.store.currentSessionId = id;
            this.save();
        }
        return session;
    }
    /**
     * Delete a session
     */
    deleteSession(id) {
        this.store.sessions = this.store.sessions.filter((s) => s.id !== id);
        if (this.store.currentSessionId === id) {
            this.store.currentSessionId = this.store.sessions[0]?.id;
        }
        this.save();
    }
    /**
     * Clear all history
     */
    clearAll() {
        this.store = { sessions: [] };
        this.save();
    }
    /**
     * Get recent messages across all sessions (for context)
     */
    getRecentMessages(limit = 10) {
        const allMessages = [];
        for (const session of this.store.sessions) {
            allMessages.push(...session.messages);
        }
        return allMessages
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }
}
export const chatHistory = new ChatHistory();
//# sourceMappingURL=history.js.map