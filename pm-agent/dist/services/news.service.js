/**
 * News Service
 * Orchestrates news crawling, detail fetching, and AI analysis
 */
import { NewsRepository } from "../repositories/news.repository.js";
import { crawlHypeList, convertItemsBatch, } from "../crawler/index.js";
export class NewsService {
    deps;
    newsRepository;
    constructor(deps) {
        this.deps = deps;
        this.newsRepository = new NewsRepository(deps);
    }
    /**
     * Run full crawl cycle
     */
    async runCrawl(options = {}) {
        const { onProgress, fetchDetails = false, limit = 25, } = options;
        const startTime = Date.now();
        const errors = [];
        // Create history entry
        const historyId = await this.newsRepository.saveCrawlHistory({
            startedAt: startTime,
            status: "running",
            itemsFound: 0,
        });
        try {
            // Stage 1: Fetch list from hype.replicate.dev
            onProgress?.({
                stage: "fetching_list",
                message: "Fetching news list from hype.replicate.dev...",
            });
            const hypeItems = await crawlHypeList(limit);
            console.log(`Fetched ${hypeItems.length} items from hype.replicate.dev`);
            if (hypeItems.length === 0) {
                throw new Error("No items found from hype.replicate.dev");
            }
            // Stage 2: Convert to NewsItems (optionally fetch details)
            onProgress?.({
                stage: fetchDetails ? "fetching_details" : "saving",
                current: 0,
                total: hypeItems.length,
                message: fetchDetails
                    ? "Fetching details from source pages..."
                    : "Processing items...",
            });
            const newsItems = await convertItemsBatch(hypeItems, fetchDetails, (current, total) => {
                onProgress?.({
                    stage: "fetching_details",
                    current,
                    total,
                    message: `Processing ${current}/${total}...`,
                });
            });
            // Stage 3: Save to database
            onProgress?.({
                stage: "saving",
                message: "Saving to database...",
            });
            const { inserted, updated } = await this.newsRepository.bulkUpsert(newsItems);
            // Mark items that fell out of top as inactive
            const activeIds = newsItems.map((item) => item.id);
            const deactivated = await this.newsRepository.markInactive(activeIds);
            if (deactivated > 0) {
                console.log(`Deactivated ${deactivated} items that fell out of top`);
            }
            // Complete
            const durationMs = Date.now() - startTime;
            onProgress?.({
                stage: "completed",
                message: `Completed! Found ${newsItems.length} items, ${inserted} new, ${updated} updated`,
            });
            // Update history
            await this.newsRepository.saveCrawlHistory({
                id: historyId,
                startedAt: startTime,
                completedAt: Date.now(),
                status: "completed",
                itemsFound: newsItems.length,
                itemsNew: inserted,
                itemsUpdated: updated,
                errors: errors.length > 0 ? errors : undefined,
                durationMs,
            });
            return {
                success: true,
                items: newsItems,
                newCount: inserted,
                updatedCount: updated,
                errors,
                crawledAt: startTime,
                durationMs,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            errors.push(errorMessage);
            console.error("Crawl failed:", errorMessage);
            onProgress?.({
                stage: "failed",
                message: `Failed: ${errorMessage}`,
            });
            // Update history with failure
            await this.newsRepository.saveCrawlHistory({
                id: historyId,
                startedAt: startTime,
                completedAt: Date.now(),
                status: "failed",
                itemsFound: 0,
                errors,
                durationMs: Date.now() - startTime,
            });
            return {
                success: false,
                items: [],
                newCount: 0,
                updatedCount: 0,
                errors,
                crawledAt: startTime,
                durationMs: Date.now() - startTime,
            };
        }
    }
    /**
     * Crawl only the list (no details)
     */
    async crawlHypeListOnly(limit = 25) {
        return crawlHypeList(limit);
    }
    /**
     * Update details for a specific item
     */
    async updateItemDetails(id) {
        const item = await this.newsRepository.getById(id);
        if (!item)
            return undefined;
        // Re-crawl details
        const { crawlItemDetails } = await import("../crawler/detail-crawler.js");
        const details = await crawlItemDetails({
            rank: item.rank,
            title: item.title,
            url: item.url,
            source: item.source,
            metric: item.metric,
            metricValue: item.metricValue,
            description: item.description,
        });
        // Update item with new details
        const updatedItem = {
            ...item,
            details,
            updatedAt: Date.now(),
        };
        await this.newsRepository.upsert(updatedItem);
        return updatedItem;
    }
    /**
     * Update details for all active items
     */
    async updateAllDetails(onProgress) {
        const items = await this.newsRepository.getTop(25);
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            onProgress?.(i + 1, items.length);
            try {
                await this.updateItemDetails(item.id);
            }
            catch (error) {
                console.error(`Failed to update details for ${item.id}:`, error);
            }
            // Be polite between requests
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }
    /**
     * Get all news items
     */
    async getAll(filter) {
        return this.newsRepository.getAll(filter);
    }
    /**
     * Get news item by ID
     */
    async getById(id) {
        return this.newsRepository.getById(id);
    }
    /**
     * Get top N items
     */
    async getTop(limit) {
        return this.newsRepository.getTop(limit);
    }
    /**
     * Get statistics
     */
    async getStats() {
        return this.newsRepository.getStats();
    }
    /**
     * Get crawl history
     */
    async getCrawlHistory(limit) {
        return this.newsRepository.getCrawlHistory(limit);
    }
    /**
     * Get repository for direct access (e.g., for AI analysis updates)
     */
    getRepository() {
        return this.newsRepository;
    }
}
//# sourceMappingURL=news.service.js.map