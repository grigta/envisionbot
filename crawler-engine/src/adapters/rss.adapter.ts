/**
 * RSS Adapter - Simple adapter for RSS/Atom feeds
 */

import type { CrawlerAdapter, CrawledItem, ExtractionConfig } from '../types.js';
import { RSSExtractor } from '../extractor/rss.extractor.js';
import { HTTPFetcher } from '../fetcher/http.fetcher.js';

export class RSSAdapter implements CrawlerAdapter {
  private fetcher: HTTPFetcher;
  private extractor: RSSExtractor;

  constructor() {
    this.fetcher = new HTTPFetcher();
    this.extractor = new RSSExtractor();
  }

  /**
   * Crawl RSS/Atom feed
   */
  async crawl(url: string, _config?: ExtractionConfig): Promise<CrawledItem[]> {
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
  private async isRSSFeed(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      const contentType = response.headers.get('content-type') || '';
      return (
        contentType.includes('xml') ||
        contentType.includes('rss') ||
        contentType.includes('atom') ||
        url.endsWith('.rss') ||
        url.endsWith('.xml') ||
        url.endsWith('/feed') ||
        url.includes('/feed/')
      );
    } catch {
      return false;
    }
  }

  /**
   * Find RSS/Atom feed URL from HTML
   */
  private findFeedUrl(html: string, baseUrl: string): string | null {
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

export function createRSSAdapter(): RSSAdapter {
  return new RSSAdapter();
}
