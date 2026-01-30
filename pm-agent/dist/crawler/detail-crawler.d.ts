/**
 * Detail Crawler
 * Fetches detailed information from source pages
 */
import type { HypeNewsItem, NewsItem, NewsItemDetails } from "./types.js";
/**
 * Generate unique ID from URL
 */
export declare function generateId(url: string): string;
/**
 * Crawl details for a single news item
 */
export declare function crawlItemDetails(item: HypeNewsItem): Promise<NewsItemDetails>;
/**
 * Convert HypeNewsItem to full NewsItem with details
 */
export declare function convertToNewsItem(item: HypeNewsItem, fetchDetails?: boolean): Promise<NewsItem>;
/**
 * Batch convert items with optional details
 */
export declare function convertItemsBatch(items: HypeNewsItem[], fetchDetails?: boolean, onProgress?: (current: number, total: number) => void): Promise<NewsItem[]>;
//# sourceMappingURL=detail-crawler.d.ts.map