/**
 * Claude CLI Extractor
 * Uses Claude Code CLI with Max subscription instead of direct API
 * This bypasses the OAuth limitation by using `claude --print` mode
 */
import type { Extractor, ExtractionConfig, ExtractionResult } from '../types.js';
export interface ClaudeCLIExtractorOptions {
    /** Path to claude CLI binary (optional, defaults to 'claude') */
    claudePath?: string;
    /** Timeout in milliseconds */
    timeout?: number;
}
export declare class ClaudeCLIExtractor implements Extractor {
    private claudePath;
    private timeout;
    constructor(options?: ClaudeCLIExtractorOptions);
    /**
     * Extract structured data from content using Claude Code CLI
     */
    extract(content: string, config: ExtractionConfig): Promise<ExtractionResult>;
    /**
     * Run claude CLI with --print flag using subscription auth
     */
    private runClaudeCLI;
    /**
     * Build extraction prompt
     */
    private buildPrompt;
    /**
     * Parse Claude's response
     */
    private parseResponse;
}
export declare function createClaudeCLIExtractor(options?: ClaudeCLIExtractorOptions): ClaudeCLIExtractor;
//# sourceMappingURL=claude-cli.extractor.d.ts.map