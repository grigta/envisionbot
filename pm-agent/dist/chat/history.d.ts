import type { AgentStep } from "../tools/claude-code.js";
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
    steps?: AgentStep[];
    success?: boolean;
    error?: string;
}
export interface ChatSession {
    id: string;
    title?: string;
    messages: ChatMessage[];
    createdAt: number;
    updatedAt: number;
}
declare class ChatHistory {
    private store;
    constructor();
    private load;
    private save;
    /**
     * Get or create current session
     */
    getCurrentSession(): ChatSession;
    /**
     * Create a new chat session
     */
    createSession(title?: string): ChatSession;
    /**
     * Add a user message to the current session
     */
    addUserMessage(content: string, options?: {
        sessionId?: string;
        projectIds?: string[];
        mentions?: Array<{
            type: string;
            value: string;
        }>;
    }): ChatMessage;
    /**
     * Add an assistant message to the current session
     */
    addAssistantMessage(content: string, options?: {
        sessionId?: string;
        steps?: AgentStep[];
        success?: boolean;
        error?: string;
    }): ChatMessage;
    /**
     * Get all sessions (for history display)
     */
    getSessions(limit?: number): ChatSession[];
    /**
     * Get a specific session
     */
    getSession(id: string): ChatSession | undefined;
    /**
     * Switch to a different session
     */
    switchSession(id: string): ChatSession | undefined;
    /**
     * Delete a session
     */
    deleteSession(id: string): void;
    /**
     * Clear all history
     */
    clearAll(): void;
    /**
     * Get recent messages across all sessions (for context)
     */
    getRecentMessages(limit?: number): ChatMessage[];
}
export declare const chatHistory: ChatHistory;
export {};
//# sourceMappingURL=history.d.ts.map