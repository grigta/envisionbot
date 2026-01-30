/**
 * RSS Adapter - Simple adapter for RSS/Atom feeds
 */
import { RSSExtractor } from '../extractor/rss.extractor.js';
import { HTTPFetcher } from '../fetcher/http.fetcher.js';
export class RSSAdapter {
    fetcher;
    extractor;
    constructor() {
        this.fetcher = new HTTPFetcher();
        this.extractor = new RSSExtractor();
    }
    /**
     * Crawl RSS/Atom feed
     */
    async crawl(url, _config) {
        // Check if URL is RSS feed
        if (await this.isRSSFeed(url)) {
            const feed = await this.extractor.parseUrl(url);
            return this.extractor.feedToCrawledItems(feed);
        }
        // Try to find RSS feed link in HTML
        const fetchResult = await this.fetcher.fetch(url);
        const feedUrl = this.findFeedUrl(fetchResult.html, url);
        if (feedUrl) {
            const feed = await this.extractor.parseUrl(feedUrl);
            return this.extractor.feedToCrawledItems(feed);
        }
        throw new Error('No RSS/Atom feed found at this URL');
    }
    /**
     * Check if URL points to an RSS/Atom feed
     */
    async isRSSFeed(url) {
        try {
            const response = await fetch(url, { method: 'HEAD' });
            const contentType = response.headers.get('content-type') || '';
            return (contentType.includes('xml') ||
                contentType.includes('rss') ||
                contentType.includes('atom') ||
                url.endsWith('.rss') ||
                url.endsWith('.xml') ||
                url.endsWith('/feed') ||
                url.includes('/feed/'));
        }
        catch {
            return false;
        }
    }
    /**
     * Find RSS/Atom feed URL from HTML
     */
    findFeedUrl(html, baseUrl) {
        // Look for feed links in HTML
        const feedPatterns = [
            /<link[^>]+type=["']application\/rss\+xml["'][^>]+href=["']([^"']+)["']/i,
            /<link[^>]+href=["']([^"']+)["'][^>]+type=["']application\/rss\+xml["']/i,
            /<link[^>]+type=["']application\/atom\+xml["'][^>]+href=["']([^"']+)["']/i,
            /<link[^>]+href=["']([^"']+)["'][^>]+type=["']application\/atom\+xml["']/i,
            /<a[^>]+href=["']([^"']*(?:rss|feed|atom)[^"']*)["']/i,
        ];
        for (const pattern of feedPatterns) {
            const match = html.match(pattern);
            if (match) {
                const feedUrl = match[1];
                // Resolve relative URLs
                if (feedUrl.startsWith('/')) {
                    const base = new URL(baseUrl);
                    return `${base.origin}${feedUrl}`;
                }
                if (!feedUrl.startsWith('http')) {
                    return new URL(feedUrl, baseUrl).href;
                }
                return feedUrl;
            }
        }
        // Try common feed paths
        const base = new URL(baseUrl);
        const commonPaths = ['/feed', '/rss', '/feed.xml', '/rss.xml', '/atom.xml', '/index.xml'];
        // Return the most common one to try
        return `${base.origin}/feed`;
    }
}
export function createRSSAdapter() {
    return new RSSAdapter();
}
//# sourceMappingURL=rss.adapter.js.map