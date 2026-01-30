/**
 * Chat Repository
 */
import { BaseRepository } from "./base.repository.js";
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
    mentions?: Array<{
        type: string;
        value: string;
    }>;
    steps?: unknown[];
    success?: boolean;
    error?: string;
}
export declare class ChatRepository extends BaseRepository<ChatSession> {
    protected readonly tableName = "chat_sessions";
    protected readonly cachePrefix = "pm:chat";
    protected readonly cacheTTL = 300;
    protected readonly pubsubChannel: "pm:events:chat";
    private rowToSession;
    private rowToMessage;
    getAllSessions(limit?: number): Promise<ChatSession[]>;
    getSessionById(id: string): Promise<ChatSession | undefined>;
    getSessionMessages(sessionId: string, limit?: number): Promise<ChatMessage[]>;
    createSession(session: Omit<ChatSession, "messages">): Promise<ChatSession>;
    updateSession(id: string, updates: Partial<Pick<ChatSession, "title" | "updatedAt">>): Promise<ChatSession | undefined>;
    deleteSession(id: string): Promise<boolean>;
    addMessage(sessionId: string, message: ChatMessage): Promise<ChatMessage>;
    getCurrentSessionId(): Promise<string | null>;
    setCurrentSessionId(sessionId: string): Promise<void>;
}
//# sourceMappingURL=chat.repository.d.ts.map