/**
 * Scraper Engine - AI-powered web scraper for competitive analysis
 *
 * @packageDocumentation
 */
export * from './types.js';
export * from './crawler/index.js';
export * from './analyzer/index.js';
export * from './ai/index.js';
import type { CrawlConfig, FullAnalysis, ProgressCallback } from './types.js';
export interface FullAnalysisOptions {
    crawlConfig?: Partial<CrawlConfig>;
    openrouterApiKey?: string;
    model?: string;
    ownProductDescription?: string;
    onCrawlProgress?: ProgressCallback;
}
/**
 * Run complete competitor analysis: crawl + analyze + AI insights
 */
export declare function analyzeCompetitor(competitorId: string, domain: string, options?: FullAnalysisOptions): Promise<FullAnalysis>;
/**
 * Get package version
 */
export declare function getVersion(): string;
//# sourceMappingURL=index.d.ts.map