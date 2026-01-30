/**
 * RSS Adapter - Simple adapter for RSS/Atom feeds
 */
import type { CrawlerAdapter, CrawledItem, ExtractionConfig } from '../types.js';
export declare class RSSAdapter implements CrawlerAdapter {
    private fetcher;
    private extractor;
    constructor();
    /**
     * Crawl RSS/Atom feed
     */
    crawl(url: string, _config?: ExtractionConfig): Promise<CrawledItem[]>;
    /**
     * Check if URL points to an RSS/Atom feed
     */
    private isRSSFeed;
    /**
     * Find RSS/Atom feed URL from HTML
     */
    private findFeedUrl;
}
export declare function createRSSAdapter(): RSSAdapter;
//# sourceMappingURL=rss.adapter.d.ts.map