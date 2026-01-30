import type { CrawledPage, SWOTAnalysis, TechStackItem, SEOAnalysisResult, SiteStructureAnalysis } from '../types.js';
export interface SWOTGeneratorOptions {
    openrouterApiKey?: string;
    model?: string;
    maxTokens?: number;
}
export declare class SWOTGenerator {
    private client;
    private model;
    private maxTokens;
    constructor(options?: SWOTGeneratorOptions);
    generate(domain: string, pages: CrawledPage[], techStack: TechStackItem[], seoAnalysis: SEOAnalysisResult, structureAnalysis: SiteStructureAnalysis): Promise<{
        analysis: SWOTAnalysis;
        tokensUsed: number;
    }>;
    private buildPrompt;
}
export declare function generateSWOT(domain: string, pages: CrawledPage[], techStack: TechStackItem[], seoAnalysis: SEOAnalysisResult, structureAnalysis: SiteStructureAnalysis, options?: SWOTGeneratorOptions): Promise<SWOTAnalysis>;
//# sourceMappingURL=swot-generator.d.ts.map