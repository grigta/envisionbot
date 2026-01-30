/**
 * Crawler Service
 * Integrates @envisionbot/crawler-engine with pm-agent
 */
import { type CrawlResult, type TestResult } from "@envisionbot/crawler-engine";
import type { CrawlerRepository } from "../repositories/crawler.repository.js";
import type { CrawlerSource, CrawledItem } from "../types.js";
export interface CrawlerServiceAuthConfig {
    apiKey?: string;
    authToken?: string;
    /** Use CLI mode for extraction (supports Max subscription via Claude Code) */
    useCLI?: boolean;
}
export declare class CrawlerService {
    private engine;
    private repository;
    private isRunning;
    constructor(repository: CrawlerRepository, authConfig: CrawlerServiceAuthConfig);
    /**
     * Get all crawler sources
     */
    getSources(filter?: {
        isEnabled?: boolean;
    }): Promise<CrawlerSource[]>;
    /**
     * Get source by ID
     */
    getSource(id: string): Promise<CrawlerSource | undefined>;
    /**
     * Create a new crawler source
     */
    createSource(data: {
        name: string;
        url: string;
        prompt?: string;
        schema?: object;
        requiresBrowser?: boolean;
        crawlIntervalHours?: number;
    }): Promise<CrawlerSource>;
    /**
     * Update a crawler source
     */
    updateSource(id: string, updates: Partial<Omit<CrawlerSource, "id" | "createdAt">>): Promise<CrawlerSource | undefined>;
    /**
     * Delete a crawler source
     */
    deleteSource(id: string): Promise<boolean>;
    /**
     * Test a URL before adding as source
     */
    testSource(url: string, prompt?: string, options?: {
        requiresBrowser?: boolean;
        schema?: object;
    }): Promise<TestResult>;
    /**
     * Run crawl for a specific source
     */
    crawlSource(sourceId: string): Promise<CrawlResult>;
    /**
     * Run crawl for all enabled sources that are due
     */
    crawlAllDue(): Promise<Array<{
        sourceId: string;
        success: boolean;
        error?: string;
    }>>;
    /**
     * Get crawled items
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
    getItem(id: string): Promise<CrawledItem | undefined>;
    /**
     * Mark item as processed (linked to a project)
     */
    markItemProcessed(itemId: string, projectId?: string, relevanceScore?: number): Promise<void>;
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
    /**
     * Cleanup old items
     */
    cleanup(olderThanDays?: number): Promise<number>;
    /**
     * Close the engine
     */
    close(): Promise<void>;
}
//# sourceMappingURL=crawler.service.d.ts.map