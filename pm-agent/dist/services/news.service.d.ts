/**
 * News Service
 * Orchestrates news crawling, detail fetching, and AI analysis
 */
import type { RepositoryDeps } from "../db/index.js";
import { NewsRepository } from "../repositories/news.repository.js";
import type { NewsItem, HypeNewsItem, CrawlResult, CrawlProgress, CrawlHistory, NewsStats } from "../crawler/types.js";
export interface NewsServiceOptions {
    onProgress?: (progress: CrawlProgress) => void;
    fetchDetails?: boolean;
    limit?: number;
}
export declare class NewsService {
    private deps;
    private newsRepository;
    constructor(deps: RepositoryDeps);
    /**
     * Run full crawl cycle
     */
    runCrawl(options?: NewsServiceOptions): Promise<CrawlResult>;
    /**
     * Crawl only the list (no details)
     */
    crawlHypeListOnly(limit?: number): Promise<HypeNewsItem[]>;
    /**
     * Update details for a specific item
     */
    updateItemDetails(id: string): Promise<NewsItem | undefined>;
    /**
     * Update details for all active items
     */
    updateAllDetails(onProgress?: (current: number, total: number) => void): Promise<void>;
    /**
     * Get all news items
     */
    getAll(filter?: {
        source?: string;
        isActive?: boolean;
        limit?: number;
    }): Promise<NewsItem[]>;
    /**
     * Get news item by ID
     */
    getById(id: string): Promise<NewsItem | undefined>;
    /**
     * Get top N items
     */
    getTop(limit?: number): Promise<NewsItem[]>;
    /**
     * Get statistics
     */
    getStats(): Promise<NewsStats>;
    /**
     * Get crawl history
     */
    getCrawlHistory(limit?: number): Promise<CrawlHistory[]>;
    /**
     * Get repository for direct access (e.g., for AI analysis updates)
     */
    getRepository(): NewsRepository;
}
//# sourceMappingURL=news.service.d.ts.map