import type { CrawlConfig, CrawlJob, CrawlResult, ProgressCallback } from '../types.js';
export declare class CompetitorCrawler {
    private config;
    private competitorId;
    private job;
    private pages;
    private errors;
    private visitedUrls;
    private rateLimiter;
    private robotsRules?;
    private techContext;
    private onProgress?;
    private aborted;
    constructor(competitorId: string, config?: Partial<CrawlConfig>);
    private createJob;
    /**
     * Start crawling a domain
     */
    crawl(domain: string, onProgress?: ProgressCallback): Promise<CrawlResult>;
    /**
     * Abort crawling
     */
    abort(): void;
    /**
     * Get current job status
     */
    getJob(): CrawlJob;
    private fetchRobotsTxt;
    private runCrawler;
    private emitProgress;
    private analyzeStructure;
    private buildSummary;
}
/**
 * Create and run a competitor crawl
 */
export declare function crawlCompetitor(competitorId: string, domain: string, config?: Partial<CrawlConfig>, onProgress?: ProgressCallback): Promise<CrawlResult>;
export { DEFAULT_CRAWL_CONFIG } from '../types.js';
//# sourceMappingURL=competitor-crawler.d.ts.map