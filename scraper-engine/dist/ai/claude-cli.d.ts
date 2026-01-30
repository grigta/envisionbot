/**
 * Claude CLI Integration
 * Uses Claude Code CLI with --print for AI analysis via Max subscription
 *
 * Key trick: Remove ANTHROPIC_API_KEY from env to force CLI to use OAuth token
 */
export interface ClaudeCliOptions {
    model?: string;
    maxTokens?: number;
    timeout?: number;
}
export interface ClaudeCliResult {
    content: string;
    tokensUsed: number;
}
/**
 * Check if Claude CLI is available
 */
export declare function isClaudeCliAvailable(): boolean;
/**
 * Run Claude CLI with --print flag using Max subscription
 */
export declare function runClaudeCli(prompt: string, options?: ClaudeCliOptions): Promise<ClaudeCliResult>;
/**
 * Parse JSON from Claude CLI output
 * Handles various formats: raw JSON, markdown code blocks, or JSON embedded in text
 */
export declare function parseJsonFromCli<T>(output: string): T;
//# sourceMappingURL=claude-cli.d.ts.map