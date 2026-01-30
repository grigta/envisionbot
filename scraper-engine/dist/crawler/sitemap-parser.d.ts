export interface SitemapUrl {
    loc: string;
    lastmod?: string;
    changefreq?: string;
    priority?: number;
}
export interface SitemapIndex {
    sitemaps: string[];
}
export interface SitemapParseResult {
    urls: SitemapUrl[];
    sitemapIndexes: string[];
    errors: string[];
}
/**
 * Parse sitemap XML content
 */
export declare function parseSitemap(content: string): SitemapParseResult;
/**
 * Fetch and parse sitemap from URL
 */
export declare function fetchSitemap(baseUrl: string, maxUrls?: number, timeout?: number): Promise<SitemapParseResult>;
/**
 * Filter sitemap URLs by patterns
 */
export declare function filterSitemapUrls(urls: SitemapUrl[], options?: {
    includePaths?: RegExp[];
    excludePaths?: RegExp[];
    maxAge?: number;
}): SitemapUrl[];
/**
 * Sort sitemap URLs by priority
 */
export declare function sortByPriority(urls: SitemapUrl[]): SitemapUrl[];
//# sourceMappingURL=sitemap-parser.d.ts.map