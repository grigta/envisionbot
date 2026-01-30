/**
 * Claude Extractor - LLM-powered content extraction using Claude API
 */
import type { Extractor, ExtractionConfig, ExtractionResult } from '../types.js';
export interface ClaudeExtractorOptions {
    apiKey?: string;
    authToken?: string;
    defaultModel?: string;
}
export declare class ClaudeExtractor implements Extractor {
    private client;
    private defaultModel;
    constructor(options: ClaudeExtractorOptions);
    /**
     * Extract structured data from content using Claude
     */
    extract(content: string, config: ExtractionConfig): Promise<ExtractionResult>;
    /**
     * Build system prompt based on extraction config
     */
    private buildSystemPrompt;
    /**
     * Parse Claude's response and extract JSON
     */
    private parseResponse;
}
export declare function createClaudeExtractor(options: ClaudeExtractorOptions): ClaudeExtractor;
//# sourceMappingURL=claude.extractor.d.ts.map