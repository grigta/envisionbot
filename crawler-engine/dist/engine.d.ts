/**
 * CrawlerEngine - Main engine for managing crawler sources and executing crawls
 * Provides a high-level API for adding sources, testing, and crawling
 */
import { EventEmitter } from 'eventemitter3';
import type { EngineConfig, EngineEvents, SourceConfig, CrawlerSource, CrawledItem, CrawlResult, TestResult } from './types.js';
export declare class CrawlerEngine extends EventEmitter<EngineEvents> {
    private config;
    private sources;
    private adapters;
    constructor(config: EngineConfig);
    /**
     * Add a new crawler source
     */
    addSource(sourceConfig: SourceConfig): Promise<CrawlerSource>;
    /**
     * Update an existing source
     */
    updateSource(sourceId: string, updates: Partial<SourceConfig>): CrawlerSource;
    /**
     * Remove a source
     */
    removeSource(sourceId: string): Promise<void>;
    /**
     * Get all sources
     */
    getSources(): CrawlerSource[];
    /**
     * Get a specific source
     */
    getSource(sourceId: string): CrawlerSource | undefined;
    /**
     * Test a URL before adding as a source
     */
    testSource(url: string, prompt?: string, options?: {
        requiresBrowser?: boolean;
        schema?: object;
    }): Promise<TestResult>;
    /**
     * Crawl a specific source
     */
    crawl(sourceId: string): Promise<CrawlResult>;
    /**
     * Crawl all enabled sources
     */
    crawlAll(): Promise<CrawlResult[]>;
    /**
     * Crawl a URL directly without creating a source
     */
    crawlUrl(url: string, options?: {
        prompt?: string;
        schema?: object;
        requiresBrowser?: boolean;
    }): Promise<CrawledItem[]>;
    /**
     * Crawl an RSS feed
     */
    crawlRSS(url: string): Promise<CrawledItem[]>;
    /**
     * Close all adapters and cleanup
     */
    close(): Promise<void>;
    /**
     * Generate unique source ID
     */
    private generateId;
}
export declare function createCrawlerEngine(config: EngineConfig): CrawlerEngine;
//# sourceMappingURL=engine.d.ts.map