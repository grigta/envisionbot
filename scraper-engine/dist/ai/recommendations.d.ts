import type { SWOTAnalysis, PositioningAnalysis, SEOAnalysisResult, TechStackItem } from '../types.js';
export interface RecommendationsReport {
    strategicRecommendations: Array<{
        title: string;
        description: string;
        rationale: string;
        priority: 'high' | 'medium' | 'low';
        effort: 'high' | 'medium' | 'low';
        impact: 'high' | 'medium' | 'low';
        category: 'positioning' | 'product' | 'marketing' | 'technology' | 'operations';
    }>;
    quickWins: Array<{
        title: string;
        description: string;
        expectedImpact: string;
        timeframe: string;
    }>;
    longTermInitiatives: Array<{
        title: string;
        description: string;
        expectedImpact: string;
        timeframe: string;
    }>;
}
export interface RecommendationsGeneratorOptions {
    openrouterApiKey?: string;
    model?: string;
    maxTokens?: number;
}
export declare class RecommendationsGenerator {
    private client;
    private model;
    private maxTokens;
    constructor(options?: RecommendationsGeneratorOptions);
    generate(positioning: PositioningAnalysis, swot: SWOTAnalysis, seo: SEOAnalysisResult, techStack: TechStackItem[]): Promise<{
        report: RecommendationsReport;
        tokensUsed: number;
    }>;
    private buildPrompt;
}
export declare function generateRecommendations(positioning: PositioningAnalysis, swot: SWOTAnalysis, seo: SEOAnalysisResult, techStack: TechStackItem[], options?: RecommendationsGeneratorOptions): Promise<RecommendationsReport>;
export declare function filterByPriority(recommendations: any[], priority: string): any[];
export declare function filterByCategory(recommendations: any[], category: string): any[];
export declare function sortByImpactEffort(recommendations: any[]): any[];
export declare function getEffortImpactMatrix(recommendations: any[]): any;
//# sourceMappingURL=recommendations.d.ts.map