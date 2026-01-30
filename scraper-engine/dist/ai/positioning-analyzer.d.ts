import type { CrawledPage, PositioningAnalysis, TechStackItem } from '../types.js';
export interface PositioningAnalyzerOptions {
    openrouterApiKey?: string;
    model?: string;
    maxTokens?: number;
}
export declare class PositioningAnalyzer {
    private client;
    private model;
    private maxTokens;
    constructor(options?: PositioningAnalyzerOptions);
    /**
     * Analyze competitor positioning
     */
    analyze(domain: string, pages: CrawledPage[], techStack: TechStackItem[]): Promise<{
        analysis: PositioningAnalysis;
        tokensUsed: number;
    }>;
    private buildPrompt;
}
/**
 * Quick analysis function
 */
export declare function analyzePositioning(domain: string, pages: CrawledPage[], techStack: TechStackItem[], options?: PositioningAnalyzerOptions): Promise<PositioningAnalysis>;
//# sourceMappingURL=positioning-analyzer.d.ts.map