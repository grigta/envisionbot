import * as cheerio from 'cheerio';
import type { Page } from 'playwright';
import type { SEOData, HeadingsData, ImageData, LinkData, CrawledPage } from '../types.js';
/**
 * Extract SEO data from HTML using Cheerio
 */
export declare function extractSEOData($: cheerio.CheerioAPI): SEOData;
/**
 * Extract all headings from HTML
 */
export declare function extractHeadings($: cheerio.CheerioAPI): HeadingsData;
/**
 * Extract images from HTML
 */
export declare function extractImages($: cheerio.CheerioAPI, baseUrl: string): ImageData[];
/**
 * Extract links from HTML
 */
export declare function extractLinks($: cheerio.CheerioAPI, baseUrl: string): LinkData[];
/**
 * Extract text content from HTML (cleaned)
 */
export declare function extractTextContent($: cheerio.CheerioAPI): string;
/**
 * Count words in text
 */
export declare function countWords(text: string): number;
export interface PageExtractionResult {
    seo: SEOData;
    headings: HeadingsData;
    images: ImageData[];
    links: LinkData[];
    textContent: string;
    wordCount: number;
}
/**
 * Extract all data from HTML string
 */
export declare function extractFromHtml(html: string, url: string): PageExtractionResult;
/**
 * Extract data from Playwright page
 */
export declare function extractFromPage(page: Page, url: string): Promise<PageExtractionResult>;
/**
 * Create CrawledPage from extraction result
 */
export declare function createCrawledPage(id: string, competitorId: string, url: string, depth: number, extraction: PageExtractionResult, crawlJobId?: string, statusCode?: number, responseTimeMs?: number): CrawledPage;
/**
 * Resolve relative URL to absolute
 */
export declare function resolveUrl(href: string, baseUrl: string): string;
/**
 * Normalize URL for deduplication
 */
export declare function normalizeUrl(url: string): string;
/**
 * Check if URL should be crawled (filter out non-HTML resources)
 */
export declare function shouldCrawlUrl(url: string): boolean;
/**
 * Extract domain from URL
 */
export declare function extractDomain(url: string): string;
/**
 * Get path depth
 */
export declare function getPathDepth(path: string): number;
//# sourceMappingURL=page-extractor.d.ts.map