/**
 * News Repository
 * Handles CRUD operations for news items from hype.replicate.dev
 */
import { BaseRepository, type RepositoryDeps, type PubSubChannel } from "./base.repository.js";
import type { NewsItem, NewsSource, CrawlHistory, NewsStats, AIApplicationAnalysis } from "../crawler/types.js";
export declare class NewsRepository extends BaseRepository<NewsItem> {
    protected readonly tableName = "news_items";
    protected readonly cachePrefix = "pm:news";
    protected readonly cacheTTL = 300;
    protected readonly pubsubChannel: PubSubChannel;
    constructor(deps: RepositoryDeps);
    /**
     * Get all news items with optional filter
     */
    getAll(filter?: {
        source?: NewsSource;
        isActive?: boolean;
        limit?: number;
    }): Promise<NewsItem[]>;
    /**
     * Get news item by ID
     */
    getById(id: string): Promise<NewsItem | undefined>;
    /**
     * Get top N active news items
     */
    getTop(limit?: number): Promise<NewsItem[]>;
    /**
     * Get news item by rank
     */
    getByRank(rank: number): Promise<NewsItem | undefined>;
    /**
     * Upsert a news item (insert or update)
     */
    upsert(item: NewsItem): Promise<NewsItem>;
    /**
     * Bulk upsert items
     */
    bulkUpsert(items: NewsItem[]): Promise<{
        inserted: number;
        updated: number;
    }>;
    /**
     * Mark items as inactive (fell out of top)
     */
    markInactive(excludeIds: string[]): Promise<number>;
    /**
     * Update AI analysis for a news item
     */
    updateAIAnalysis(id: string, analysis: AIApplicationAnalysis): Promise<void>;
    /**
     * Get crawl history
     */
    getCrawlHistory(limit?: number): Promise<CrawlHistory[]>;
    /**
     * Get last crawl
     */
    getLastCrawl(): Promise<CrawlHistory | undefined>;
    /**
     * Save crawl history entry
     */
    saveCrawlHistory(history: CrawlHistory): Promise<number>;
    /**
     * Get statistics
     */
    getStats(): Promise<NewsStats>;
}
//# sourceMappingURL=news.repository.d.ts.map