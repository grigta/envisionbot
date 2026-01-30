/**
 * Browser Fetcher - Puppeteer-based HTML fetcher for JS-rendered pages
 */
import type { Fetcher, FetchResult, BrowserFetcherOptions } from '../types.js';
export declare class BrowserFetcher implements Fetcher {
    private options;
    private browser;
    constructor(options?: Partial<BrowserFetcherOptions>);
    private getBrowser;
    fetch(url: string): Promise<FetchResult>;
    private autoScroll;
    private sleep;
    close(): Promise<void>;
}
export declare function createBrowserFetcher(options?: Partial<BrowserFetcherOptions>): BrowserFetcher;
//# sourceMappingURL=browser.fetcher.d.ts.map