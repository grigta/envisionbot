/**
 * Universal AI Adapter - Main crawling pipeline
 * Combines fetcher, processors, and extractor into a single pipeline
 */
import { HTTPFetcher } from '../fetcher/http.fetcher.js';
import { BrowserFetcher } from '../fetcher/browser.fetcher.js';
import { HTMLCleaner } from '../processor/html-cleaner.js';
import { MarkdownConverter } from '../processor/markdown.js';
import { PruningFilter } from '../processor/pruning-filter.js';
import { SmartChunker } from '../processor/smart-chunker.js';
import { ClaudeExtractor } from '../extractor/claude.extractor.js';
import { ClaudeCLIExtractor } from '../extractor/claude-cli.extractor.js';
import { OpenRouterExtractor } from '../extractor/openrouter.extractor.js';
import { Piscina } from 'piscina';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import os from 'os';
export class UniversalAIAdapter {
    fetcher;
    cleaner;
    converter;
    filter;
    chunker;
    extractor;
    useBrowser;
    workerPool = null;
    config;
    constructor(config) {
        this.config = config;
        this.useBrowser = config.useBrowser;
        // Initialize fetcher
        this.fetcher = config.useBrowser
            ? new BrowserFetcher(config.browserOptions)
            : new HTTPFetcher(config.httpOptions);
        // Initialize processors
        this.cleaner = new HTMLCleaner(config.cleanerOptions);
        this.converter = new MarkdownConverter(config.markdownOptions);
        this.filter = new PruningFilter(config.pruningOptions);
        // Use SmartChunker with overlap for better context preservation
        this.chunker = new SmartChunker({
            chunkSize: 2000,
            chunkOverlap: 400,
        });
        // Initialize extractor based on mode
        // openrouter mode uses OpenRouter API with Gemini
        // CLI mode uses Claude Code CLI with Max subscription support
        // API mode uses direct Anthropic SDK (requires API key)
        if (config.extractorMode === 'openrouter') {
            this.extractor = new OpenRouterExtractor({
                apiKey: config.openrouterApiKey,
                defaultModel: config.openrouterModel,
            });
        }
        else if (config.extractorMode === 'cli') {
            this.extractor = new ClaudeCLIExtractor({
                claudePath: config.claudePath,
            });
        }
        else {
            // Default to API mode
            this.extractor = new ClaudeExtractor({
                apiKey: config.anthropicApiKey,
                authToken: config.anthropicAuthToken,
            });
        }
    }
    /**
     * Initialize worker pool for parallel processing
     */
    initWorkerPool() {
        if (this.workerPool) {
            return this.workerPool;
        }
        // Get worker file path
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);
        const workerPath = resolve(__dirname, '../workers/extraction-worker.js');
        // Create worker pool with optimal configuration
        const cpuCount = os.availableParallelism();
        this.workerPool = new Piscina({
            filename: workerPath,
            minThreads: Math.max(2, Math.floor(cpuCount / 2)),
            maxThreads: Math.max(4, cpuCount),
            idleTimeout: 60000, // 1 minute
            maxQueue: 'auto',
            resourceLimits: {
                maxOldGenerationSizeMb: 512, // 512MB per worker
                maxYoungGenerationSizeMb: 128,
            },
        });
        console.log(`[Adapter] Worker pool initialized: ${this.workerPool.options.minThreads}-${this.workerPool.options.maxThreads} threads`);
        return this.workerPool;
    }
    /**
     * Full crawl pipeline: Fetch → Clean → Markdown → Prune → Chunk → Extract (Parallel)
     */
    async crawl(url, config) {
        const stats = {};
        const startTime = Date.now();
        console.log(`[Adapter] Starting crawl pipeline for: ${url}`);
        // 1. Fetch HTML
        const fetchStart = Date.now();
        const fetchResult = await this.fetcher.fetch(url);
        stats.fetchTimeMs = Date.now() - fetchStart;
        stats.htmlSize = fetchResult.html.length;
        console.log(`[Adapter] 1. Fetch: ${fetchResult.html.length} chars`);
        // 2. Clean HTML
        const processStart = Date.now();
        const cleanedHtml = this.cleaner.cleanBody(fetchResult.html);
        console.log(`[Adapter] 2. Clean: ${cleanedHtml.length} chars`);
        // 3. Convert to Markdown
        const markdown = this.converter.convert(cleanedHtml);
        stats.markdownSize = markdown.length;
        console.log(`[Adapter] 3. Markdown: ${markdown.length} chars`);
        // 4. Filter/Prune content
        const filteredContent = this.filter.filter(markdown);
        console.log(`[Adapter] 4. Filtered: ${filteredContent.length} chars`);
        // 5. Smart Chunk with overlap (no size limit!)
        const chunks = this.chunker.chunk(filteredContent);
        stats.chunksCount = chunks.length;
        stats.processTimeMs = Date.now() - processStart;
        console.log(`[Adapter] 5. Smart Chunks: ${chunks.length} chunks, avg size: ${Math.round(chunks.reduce((sum, c) => sum + c.content.length, 0) / chunks.length)} chars`);
        // 6. Extract using Worker Pool (parallel processing)
        const extractStart = Date.now();
        const results = await this.extractInParallel(chunks.map(c => c.content), config);
        stats.extractTimeMs = Date.now() - extractStart;
        stats.totalTimeMs = Date.now() - startTime;
        console.log(`[Adapter] 6. Parallel extraction completed in ${stats.extractTimeMs}ms`);
        // 7. Merge and normalize results
        return this.mergeResults(results, url, stats);
    }
    /**
     * Extract data from chunks using worker pool (parallel processing)
     */
    async extractInParallel(contents, config) {
        const pool = this.initWorkerPool();
        // Prepare worker payloads
        const payloads = contents.map(content => ({
            content,
            config,
            extractorMode: this.config.extractorMode || 'openrouter',
            apiKey: this.config.openrouterApiKey || this.config.anthropicApiKey,
            model: this.config.openrouterModel,
        }));
        // Process all chunks in parallel using worker pool
        const results = await Promise.all(payloads.map(payload => pool.run(payload)));
        return results;
    }
    /**
     * Crawl and return raw processed content (without LLM extraction)
     * Useful for debugging or when extraction is not needed
     */
    async crawlRaw(url) {
        const fetchResult = await this.fetcher.fetch(url);
        const cleanedHtml = this.cleaner.cleanBody(fetchResult.html);
        const markdown = this.converter.convert(cleanedHtml);
        const filteredContent = this.filter.filter(markdown);
        const chunks = this.chunker.chunk(filteredContent);
        return {
            html: fetchResult.html,
            cleanedHtml,
            markdown,
            filteredContent,
            chunks: chunks.map((c) => c.content),
        };
    }
    /**
     * Merge extraction results from multiple chunks
     */
    mergeResults(results, url, stats) {
        const items = [];
        const seen = new Set();
        for (const result of results) {
            const data = result.data;
            // Handle array results
            if (Array.isArray(data)) {
                for (const item of data) {
                    const crawledItem = this.normalizeToCrawledItem(item, url);
                    if (crawledItem && !seen.has(crawledItem.id)) {
                        seen.add(crawledItem.id);
                        crawledItem.metadata.crawlStats = stats;
                        items.push(crawledItem);
                    }
                }
            }
            // Handle object with items array
            else if (data && typeof data === 'object' && 'items' in data) {
                const itemsData = data.items;
                if (Array.isArray(itemsData)) {
                    for (const item of itemsData) {
                        const crawledItem = this.normalizeToCrawledItem(item, url);
                        if (crawledItem && !seen.has(crawledItem.id)) {
                            seen.add(crawledItem.id);
                            crawledItem.metadata.crawlStats = stats;
                            items.push(crawledItem);
                        }
                    }
                }
            }
            // Handle single object result
            else if (data && typeof data === 'object') {
                const crawledItem = this.normalizeToCrawledItem(data, url);
                if (crawledItem && !seen.has(crawledItem.id)) {
                    seen.add(crawledItem.id);
                    crawledItem.metadata.crawlStats = stats;
                    items.push(crawledItem);
                }
            }
        }
        return items;
    }
    /**
     * Normalize extracted data to CrawledItem format
     */
    normalizeToCrawledItem(data, sourceUrl) {
        if (!data || typeof data !== 'object')
            return null;
        const obj = data;
        // Extract title (try common field names)
        const title = obj.title ||
            obj.name ||
            obj.headline ||
            obj.header ||
            (typeof obj.text === 'string' ? obj.text.substring(0, 100) : null);
        if (!title || typeof title !== 'string')
            return null;
        // Extract URL
        const url = typeof obj.url === 'string'
            ? obj.url
            : typeof obj.link === 'string'
                ? obj.link
                : typeof obj.href === 'string'
                    ? obj.href
                    : sourceUrl;
        // Extract description
        const description = typeof obj.description === 'string'
            ? obj.description
            : typeof obj.summary === 'string'
                ? obj.summary
                : typeof obj.content === 'string'
                    ? obj.content.substring(0, 500)
                    : undefined;
        // Generate ID - use title if URL is same as source (avoids duplicate IDs)
        const id = this.generateId(url === sourceUrl ? title : url || title);
        // Collect remaining fields as metadata
        const metadata = {};
        const standardFields = ['title', 'name', 'headline', 'url', 'link', 'href', 'description', 'summary', 'content'];
        for (const [key, value] of Object.entries(obj)) {
            if (!standardFields.includes(key) && value !== undefined) {
                metadata[key] = value;
            }
        }
        return {
            id,
            title: title,
            url: url,
            description,
            metadata,
            extractedAt: Date.now(),
        };
    }
    /**
     * Generate stable ID from URL or title
     */
    generateId(input) {
        return input
            .toLowerCase()
            .replace(/https?:\/\//g, '')
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_+/g, '_')
            .substring(0, 100);
    }
    /**
     * Close resources (browser and worker pool)
     */
    async close() {
        // Close browser if using browser fetcher
        if (this.useBrowser && 'close' in this.fetcher) {
            await this.fetcher.close();
        }
        // Close worker pool
        if (this.workerPool) {
            await this.workerPool.destroy();
            this.workerPool = null;
            console.log('[Adapter] Worker pool closed');
        }
    }
}
export function createUniversalAdapter(config) {
    return new UniversalAIAdapter(config);
}
//# sourceMappingURL=universal.adapter.js.map