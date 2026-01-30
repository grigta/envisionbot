/**
 * HTTP Fetcher - Simple fetch-based HTML fetcher
 */
import type { Fetcher, FetchResult, HTTPFetcherOptions } from '../types.js';
export declare class HTTPFetcher implements Fetcher {
    private options;
    constructor(options?: Partial<HTTPFetcherOptions>);
    fetch(url: string): Promise<FetchResult>;
}
export declare function createHTTPFetcher(options?: Partial<HTTPFetcherOptions>): HTTPFetcher;
//# sourceMappingURL=http.fetcher.d.ts.map