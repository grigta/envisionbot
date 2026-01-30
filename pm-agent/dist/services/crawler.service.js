/**
 * Crawler Service
 * Integrates @envisionbot/crawler-engine with pm-agent
 */
import { CrawlerEngine, } from "@envisionbot/crawler-engine";
import { broadcast } from "../server.js";
export class CrawlerService {
    engine;
    repository;
    isRunning = new Map();
    constructor(repository, authConfig) {
        this.repository = repository;
        // ВСЕГДА используем OpenRouter для crawler
        this.engine = new CrawlerEngine({
            extractorMode: 'openrouter',
            openrouterApiKey: process.env.OPENROUTER_API_KEY,
            openrouterModel: process.env.OPENROUTER_MODEL || 'google/gemini-3-flash-preview',
            maxConcurrent: 2,
        });
        console.log('🤖 Crawler using OpenRouter with', process.env.OPENROUTER_MODEL || 'gemini-3-flash-preview');
    }
    /**
     * Get all crawler sources
     */
    async getSources(filter) {
        return this.repository.getAllSources(filter);
    }
    /**
     * Get source by ID
     */
    async getSource(id) {
        return this.repository.getSourceById(id);
    }
    /**
     * Create a new crawler source
     */
    async createSource(data) {
        const id = `src_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
        const source = await this.repository.createSource({
            id,
            name: data.name,
            url: data.url,
            prompt: data.prompt,
            schema: data.schema,
            requiresBrowser: data.requiresBrowser ?? false,
            crawlIntervalHours: data.crawlIntervalHours ?? 24,
            isEnabled: true,
        });
        broadcast({
            type: "news_updated",
            timestamp: Date.now(),
            data: { action: "source_created", sourceId: id },
        });
        return source;
    }
    /**
     * Update a crawler source
     */
    async updateSource(id, updates) {
        const updated = await this.repository.updateSource(id, updates);
        if (updated) {
            broadcast({
                type: "news_updated",
                timestamp: Date.now(),
                data: { action: "source_updated", sourceId: id },
            });
        }
        return updated;
    }
    /**
     * Delete a crawler source
     */
    async deleteSource(id) {
        const deleted = await this.repository.deleteSource(id);
        if (deleted) {
            broadcast({
                type: "news_updated",
                timestamp: Date.now(),
                data: { action: "source_deleted", sourceId: id },
            });
        }
        return deleted;
    }
    /**
     * Test a URL before adding as source
     */
    async testSource(url, prompt, options) {
        return this.engine.testSource(url, prompt, options);
    }
    /**
     * Run crawl for a specific source
     */
    async crawlSource(sourceId) {
        const source = await this.repository.getSourceById(sourceId);
        if (!source) {
            throw new Error(`Source not found: ${sourceId}`);
        }
        if (this.isRunning.get(sourceId)) {
            throw new Error(`Crawl already running for source: ${sourceId}`);
        }
        this.isRunning.set(sourceId, true);
        broadcast({
            type: "news_crawl_started",
            timestamp: Date.now(),
            data: { sourceId, sourceName: source.name },
        });
        try {
            // Crawl using engine
            const items = await this.engine.crawlUrl(source.url, {
                prompt: source.prompt,
                schema: source.schema,
                requiresBrowser: source.requiresBrowser,
            });
            // Convert to our item format and save
            const crawledItems = items.map((item) => ({
                id: item.id,
                sourceId,
                title: item.title,
                url: item.url,
                description: item.description,
                content: item.content,
                metadata: item.metadata,
                extractedAt: item.extractedAt,
                isProcessed: false,
            }));
            // Save items to database
            const { inserted, updated } = await this.repository.bulkUpsertItems(crawledItems);
            // Update source crawl status
            await this.repository.updateCrawlResult(sourceId, {
                status: "success",
                itemCount: items.length,
            });
            const result = {
                sourceId,
                url: source.url,
                items: items,
                success: true,
                startedAt: Date.now(),
                completedAt: Date.now(),
                stats: {
                    fetchTimeMs: 0,
                    processTimeMs: 0,
                    extractTimeMs: 0,
                    totalTimeMs: 0,
                    htmlSize: 0,
                    markdownSize: 0,
                    chunksCount: 1,
                },
            };
            broadcast({
                type: "news_updated",
                timestamp: Date.now(),
                data: {
                    action: "crawl_complete",
                    sourceId,
                    itemCount: items.length,
                    inserted,
                    updated,
                },
            });
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            // Update source with error
            await this.repository.updateCrawlResult(sourceId, {
                status: "error",
                error: errorMessage,
            });
            broadcast({
                type: "news_updated",
                timestamp: Date.now(),
                data: {
                    action: "crawl_error",
                    sourceId,
                    error: errorMessage,
                },
            });
            throw error;
        }
        finally {
            this.isRunning.set(sourceId, false);
        }
    }
    /**
     * Run crawl for all enabled sources that are due
     */
    async crawlAllDue() {
        const sources = await this.repository.getSourcesDueForCrawl();
        const results = [];
        for (const source of sources) {
            try {
                await this.crawlSource(source.id);
                results.push({ sourceId: source.id, success: true });
            }
            catch (error) {
                results.push({
                    sourceId: source.id,
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
        return results;
    }
    /**
     * Get crawled items
     */
    async getItems(filter) {
        return this.repository.getItems(filter);
    }
    /**
     * Get item by ID
     */
    async getItem(id) {
        return this.repository.getItemById(id);
    }
    /**
     * Mark item as processed (linked to a project)
     */
    async markItemProcessed(itemId, projectId, relevanceScore) {
        await this.repository.markItemProcessed(itemId, projectId, relevanceScore);
    }
    /**
     * Get crawler statistics
     */
    async getStats() {
        return this.repository.getStats();
    }
    /**
     * Cleanup old items
     */
    async cleanup(olderThanDays = 30) {
        return this.repository.deleteOldItems(olderThanDays);
    }
    /**
     * Close the engine
     */
    async close() {
        await this.engine.close();
    }
}
//# sourceMappingURL=crawler.service.js.map