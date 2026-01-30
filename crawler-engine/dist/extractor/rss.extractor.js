/**
 * RSS Extractor - Simple RSS/Atom feed parser
 */
import Parser from 'rss-parser';
export class RSSExtractor {
    parser;
    constructor() {
        this.parser = new Parser({
            customFields: {
                item: [
                    ['content:encoded', 'content'],
                    ['dc:creator', 'creator'],
                ],
            },
        });
    }
    /**
     * Parse RSS/Atom feed from URL
     */
    async parseUrl(url) {
        const feed = await this.parser.parseURL(url);
        return {
            title: feed.title || '',
            description: feed.description,
            link: feed.link || url,
            feedUrl: url,
            lastBuildDate: feed.lastBuildDate,
            items: feed.items.map((item) => this.mapItem(item)),
        };
    }
    /**
     * Parse RSS/Atom feed from XML string
     */
    async parseString(xml, feedUrl) {
        const feed = await this.parser.parseString(xml);
        return {
            title: feed.title || '',
            description: feed.description,
            link: feed.link || feedUrl,
            feedUrl,
            lastBuildDate: feed.lastBuildDate,
            items: feed.items.map((item) => this.mapItem(item)),
        };
    }
    /**
     * Convert RSS feed to CrawledItems
     */
    feedToCrawledItems(feed) {
        return feed.items.map((item, index) => ({
            id: this.generateId(item.link || item.guid || `${feed.feedUrl}-${index}`),
            title: item.title || 'Untitled',
            url: item.link || '',
            description: item.contentSnippet || item.content,
            content: item.content,
            metadata: {
                pubDate: item.pubDate,
                creator: item.creator,
                categories: item.categories,
                guid: item.guid,
                feedTitle: feed.title,
                feedUrl: feed.feedUrl,
            },
            extractedAt: Date.now(),
        }));
    }
    mapItem(item) {
        return {
            title: item.title || '',
            link: item.link,
            pubDate: item.pubDate,
            creator: item.creator,
            content: item.content,
            contentSnippet: item.contentSnippet,
            guid: item.guid,
            categories: item.categories,
        };
    }
    generateId(input) {
        // Simple hash-like ID generation
        return input
            .toLowerCase()
            .replace(/https?:\/\//g, '')
            .replace(/[^a-z0-9]/g, '_')
            .substring(0, 100);
    }
}
export function createRSSExtractor() {
    return new RSSExtractor();
}
//# sourceMappingURL=rss.extractor.js.map