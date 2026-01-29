export interface ParsedMention {
    type: "project" | "repo" | "path";
    value: string;
    original: string;
}
export interface ParseMentionsResult {
    mentions: ParsedMention[];
    cleanMessage: string;
}
/**
 * Parse @-mentions from a message
 * Supports:
 * - @project-name - reference to a saved project
 * - @owner/repo - reference to a GitHub repository
 * - @/path/to/dir - reference to a local path
 */
export declare function parseMentions(message: string): ParseMentionsResult;
/**
 * Build context string from parsed mentions
 * This is appended to the agent prompt to provide context about referenced items
 */
export declare function buildMentionContext(mentions: ParsedMention[]): string;
/**
 * Extract project IDs from mentions
 * Useful for associating chat messages with projects
 */
export declare function extractProjectIds(mentions: ParsedMention[]): string[];
/**
 * Get all mentionable items for autocomplete
 */
export declare function getMentionables(): Promise<Array<{
    id: string;
    type: "project" | "repo";
    label: string;
    description: string;
    value: string;
}>>;
//# sourceMappingURL=mentions.d.ts.map