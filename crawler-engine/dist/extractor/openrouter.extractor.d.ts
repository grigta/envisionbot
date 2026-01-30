/**
 * OpenRouter Extractor - LLM-powered content extraction using OpenRouter API
 */
import type { Extractor, ExtractionConfig, ExtractionResult } from '../types.js';
export interface OpenRouterExtractorOptions {
    apiKey: string;
    defaultModel?: string;
    baseUrl?: string;
}
export declare class OpenRouterExtractor implements Extractor {
    private apiKey;
    private defaultModel;
    private baseUrl;
    constructor(options: OpenRouterExtractorOptions);
    /**
     * Extract structured data from content using OpenRouter
     */
    extract(content: string, config: ExtractionConfig): Promise<ExtractionResult>;
    /**
     * Create a chat completion via OpenRouter API
     */
    private createCompletion;
    /**
     * Build system prompt based on extraction config
     */
    private buildSystemPrompt;
    /**
     * Parse response and extract JSON
     */
    private parseResponse;
}
export declare function createOpenRouterExtractor(options: OpenRouterExtractorOptions): OpenRouterExtractor;
//# sourceMappingURL=openrouter.extractor.d.ts.map