/**
 * Browser Fetcher - Puppeteer-based HTML fetcher for JS-rendered pages
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import type { Fetcher, FetchResult, BrowserFetcherOptions } from '../types.js';

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const DEFAULT_OPTIONS: BrowserFetcherOptions = {
  timeout: 60000,
  waitForTimeout: 2000,
  scrollToBottom: true,
  viewport: {
    width: 1920,
    height: 1080,
  },
  userAgent: DEFAULT_USER_AGENT,
  headless: true,
};

export class BrowserFetcher implements Fetcher {
  private options: BrowserFetcherOptions;
  private browser: Browser | null = null;

  constructor(options: Partial<BrowserFetcherOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: this.options.headless,
        executablePath: this.options.executablePath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920,1080',
        ],
      });
    }
    return this.browser;
  }

  async fetch(url: string): Promise<FetchResult> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      // Set viewport
      if (this.options.viewport) {
        await page.setViewport(this.options.viewport);
      }

      // Set user agent
      if (this.options.userAgent) {
        await page.setUserAgent(this.options.userAgent);
      }

      // Block unnecessary resources for faster loading
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const resourceType = request.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          request.abort();
        } else {
          request.continue();
        }
      });

      // Navigate to page
      const response = await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.options.timeout,
      });

      if (!response) {
        throw new Error('No response received');
      }

      const statusCode = response.status();
      if (statusCode >= 400) {
        throw new Error(`HTTP ${statusCode}: ${response.statusText()}`);
      }

      // Wait for specific selector if provided
      if (this.options.waitForSelector) {
        await page.waitForSelector(this.options.waitForSelector, {
          timeout: this.options.timeout,
        });
      }

      // Additional wait time for JS rendering
      if (this.options.waitForTimeout) {
        await this.sleep(this.options.waitForTimeout);
      }

      // Scroll to bottom to trigger lazy loading
      if (this.options.scrollToBottom) {
        await this.autoScroll(page);
      }

      // Get the final HTML
      const html = await page.content();

      // Get response headers
      const headers: Record<string, string> = {};
      const responseHeaders = response.headers();
      for (const [key, value] of Object.entries(responseHeaders)) {
        headers[key] = value;
      }

      return {
        html,
        url: page.url(), // Final URL after redirects
        statusCode,
        headers,
        fetchedAt: Date.now(),
      };
    } finally {
      await page.close();
    }
  }

  private async autoScroll(page: Page): Promise<void> {
    // This code runs in browser context via Puppeteer
    await page.evaluate(`
      (async () => {
        await new Promise((resolve) => {
          let totalHeight = 0;
          const distance = 300;
          const maxScrolls = 20;
          let scrollCount = 0;

          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;
            scrollCount++;

            if (totalHeight >= scrollHeight || scrollCount >= maxScrolls) {
              clearInterval(timer);
              window.scrollTo(0, 0);
              resolve();
            }
          }, 100);
        });
      })()
    `);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

export function createBrowserFetcher(options?: Partial<BrowserFetcherOptions>): BrowserFetcher {
  return new BrowserFetcher(options);
}
