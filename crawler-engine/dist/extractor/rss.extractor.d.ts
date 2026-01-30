/**
 * RSS Extractor - Simple RSS/Atom feed parser
 */
import type { RSSFeed, CrawledItem } from '../types.js';
export declare class RSSExtractor {
    private parser;
    constructor();
    /**
     * Parse RSS/Atom feed from URL
     */
    parseUrl(url: string): Promise<RSSFeed>;
    /**
     * Parse RSS/Atom feed from XML string
     */
    parseString(xml: string, feedUrl: string): Promise<RSSFeed>;
    /**
     * Convert RSS feed to CrawledItems
     */
    feedToCrawledItems(feed: RSSFeed): CrawledItem[];
    private mapItem;
    private generateId;
}
export declare function createRSSExtractor(): RSSExtractor;
//# sourceMappingURL=rss.extractor.d.ts.map