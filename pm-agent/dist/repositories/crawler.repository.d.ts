/**
 * Crawler Repository
 * Handles CRUD operations for crawler sources and crawled items
 */
import { BaseRepository, type RepositoryDeps, type PubSubChannel } from "./base.repository.js";
import type { CrawlerSource, CrawledItem } from "../types.js";
export declare class CrawlerRepository extends BaseRepository<CrawlerSource> {
    protected readonly tableName = "crawler_sources";
    protected readonly cachePrefix = "pm:crawler";
    protected readonly cacheTTL = 300;
    protected readonly pubsubChannel: PubSubChannel;
    constructor(deps: RepositoryDeps);
    /**
     * Get all crawler sources
     */
    getAllSources(filter?: {
        isEnabled?: boolean;
    }): Promise<CrawlerSource[]>;
    /**
     * Get source by ID
     */
    getSourceById(id: string): Promise<CrawlerSource | undefined>;
    /**
     * Create a new crawler source
     */
    createSource(source: Omit<CrawlerSource, "createdAt" | "updatedAt">): Promise<CrawlerSource>;
    /**
     * Update a crawler source
     */
    updateSource(id: string, updates: Partial<CrawlerSource>): Promise<CrawlerSource | undefined>;
    /**
     * Delete a crawler source
     */
    deleteSource(id: string): Promise<boolean>;
    /**
     * Update crawl result for a source
     */
    updateCrawlResult(id: string, result: {
        status: "success" | "error";
        itemCount?: number;
        error?: string;
    }): Promise<void>;
    /**
     * Get sources due for crawling
     */
    getSourcesDueForCrawl(): Promise<CrawlerSource[]>;
    /**
     * Get items for a source
     */
    getItems(filter?: {
        sourceId?: string;
        projectId?: string;
        isProcessed?: boolean;
        limit?: number;
    }): Promise<CrawledItem[]>;
    /**
     * Get item by ID
     */
    getItemById(id: string): Promise<CrawledItem | undefined>;
    /**
     * Upsert crawled item
     */
    upsertItem(item: CrawledItem): Promise<CrawledItem>;
    /**
     * Bulk upsert items
     */
    bulkUpsertItems(items: CrawledItem[]): Promise<{
        inserted: number;
        updated: number;
    }>;
    /**
     * Mark item as processed
     */
    markItemProcessed(id: string, projectId?: string, relevanceScore?: number): Promise<void>;
    /**
     * Delete old items (older than X days)
     */
    deleteOldItems(olderThanDays: number): Promise<number>;
    /**
     * Get crawler statistics
     */
    getStats(): Promise<{
        totalSources: number;
        enabledSources: number;
        totalItems: number;
        processedItems: number;
        lastCrawlAt?: number;
    }>;
}
//# sourceMappingURL=crawler.repository.d.ts.map