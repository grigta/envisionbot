/**
 * News Analyzer Service
 * Uses Claude AI to analyze news items and generate application recommendations
 */
import type { RepositoryDeps } from "../db/index.js";
import type { NewsItem, AIApplicationAnalysis } from "../crawler/types.js";
export declare class NewsAnalyzerService {
    private deps;
    private client;
    private model;
    private newsRepository;
    constructor(deps: RepositoryDeps);
    /**
     * Analyze a single news item
     */
    analyzeItem(item: NewsItem): Promise<AIApplicationAnalysis>;
    /**
     * Analyze a news item by ID and save results
     */
    analyzeAndSave(id: string): Promise<AIApplicationAnalysis | undefined>;
    /**
     * Analyze all items without analysis
     */
    analyzeUnanalyzed(onProgress?: (current: number, total: number, item: NewsItem) => void): Promise<number>;
    /**
     * Re-analyze a specific item (even if already analyzed)
     */
    reanalyze(id: string): Promise<AIApplicationAnalysis | undefined>;
}
//# sourceMappingURL=news-analyzer.service.d.ts.map