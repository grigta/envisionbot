/**
 * HTTP Fetcher - Simple fetch-based HTML fetcher
 */

import type { Fetcher, FetchResult, HTTPFetcherOptions } from '../types.js';

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const DEFAULT_OPTIONS: HTTPFetcherOptions = {
  timeout: 30000,
  userAgent: DEFAULT_USER_AGENT,
  followRedirects: true,
  maxRedirects: 5,
  headers: {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate',
    Connection: 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
  },
};

export class HTTPFetcher implements Fetcher {
  private options: HTTPFetcherOptions;

  constructor(options: Partial<HTTPFetcherOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  async fetch(url: string): Promise<FetchResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

    try {
      const headers: Record<string, string> = {
        ...this.options.headers,
        'User-Agent': this.options.userAgent || DEFAULT_USER_AGENT,
      };

      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
        redirect: this.options.followRedirects ? 'follow' : 'manual',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      return {
        html,
        url: response.url, // Final URL after redirects
        statusCode: response.status,
        headers: responseHeaders,
        fetchedAt: Date.now(),
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export function createHTTPFetcher(options?: Partial<HTTPFetcherOptions>): HTTPFetcher {
  return new HTTPFetcher(options);
}
