/**
 * Universal AI Adapter - Main crawling pipeline
 * Combines fetcher, processors, and extractor into a single pipeline
 */
import type { AdapterConfig, CrawlerAdapter, CrawledItem, ExtractionConfig } from '../types.js';
export declare class UniversalAIAdapter implements CrawlerAdapter {
    private fetcher;
    private cleaner;
    private converter;
    private filter;
    private chunker;
    private extractor;
    private useBrowser;
    private workerPool;
    private config;
    constructor(config: AdapterConfig);
    /**
     * Initialize worker pool for parallel processing
     */
    private initWorkerPool;
    /**
     * Full crawl pipeline: Fetch → Clean → Markdown → Prune → Chunk → Extract (Parallel)
     */
    crawl(url: string, config: ExtractionConfig): Promise<CrawledItem[]>;
    /**
     * Extract data from chunks using worker pool (parallel processing)
     */
    private extractInParallel;
    /**
     * Crawl and return raw processed content (without LLM extraction)
     * Useful for debugging or when extraction is not needed
     */
    crawlRaw(url: string): Promise<{
        html: string;
        cleanedHtml: string;
        markdown: string;
        filteredContent: string;
        chunks: string[];
    }>;
    /**
     * Merge extraction results from multiple chunks
     */
    private mergeResults;
    /**
     * Normalize extracted data to CrawledItem format
     */
    private normalizeToCrawledItem;
    /**
     * Generate stable ID from URL or title
     */
    private generateId;
    /**
     * Close resources (browser and worker pool)
     */
    close(): Promise<void>;
}
export declare function createUniversalAdapter(config: AdapterConfig): UniversalAIAdapter;
//# sourceMappingURL=universal.adapter.d.ts.map