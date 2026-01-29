import { parseMentions } from "./mentions.js";
export interface ChatContext {
    prompt: string;
    projectIds: string[];
    mentions: ReturnType<typeof parseMentions>["mentions"];
}
/**
 * Build a complete prompt for the chat agent
 * Includes system context, project info, and the user's message
 */
export declare function buildChatContext(message: string, projectId?: string): ChatContext;
/**
 * Build a simpler prompt for quick queries
 */
export declare function buildQuickQueryContext(query: string): string;
//# sourceMappingURL=context.d.ts.map