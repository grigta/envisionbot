/**
 * Hype.replicate.dev Crawler
 * Crawls top-25 AI/ML news items using Puppeteer
 */
import type { HypeNewsItem } from "./types.js";
/**
 * Crawl hype.replicate.dev and return top-25 items
 */
export declare function crawlHypeList(limit?: number): Promise<HypeNewsItem[]>;
/**
 * Test the crawler
 */
export declare function testHypeCrawler(): Promise<void>;
//# sourceMappingURL=hype-crawler.d.ts.map