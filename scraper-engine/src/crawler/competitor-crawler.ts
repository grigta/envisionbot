import { PlaywrightCrawler, Configuration } from 'crawlee';
import { randomUUID } from 'crypto';
import type {
  CrawlConfig,
  CrawlJob,
  CrawlResult,
  CrawledPage,
  CrawlError,
  CrawlProgress,
  ProgressCallback,
  CrawlSummary,
} from '../types.js';
import { DEFAULT_CRAWL_CONFIG } from '../types.js';
import {
  createProxyConfiguration,
  getRandomUserAgent,
  getStealthLaunchArgs,
  FINGERPRINT_EVASION_SCRIPT,
  getCommonHeaders,
  parseRobotsTxt,
  isUrlAllowed,
  RateLimiter,
  type RobotsTxtRules,
} from './anti-detection.js';
import {
  extractFromPage,
  createCrawledPage,
  normalizeUrl,
  shouldCrawlUrl,
  extractDomain,
} from './page-extractor.js';
import { fetchSitemap, sortByPriority } from './sitemap-parser.js';
import { detectTechStack, type TechDetectionContext } from '../analyzer/tech-detector.js';

// ============================================
// COMPETITOR CRAWLER
// ============================================

export class CompetitorCrawler {
  private config: CrawlConfig;
  private competitorId: string;
  private job: CrawlJob;
  private pages: CrawledPage[] = [];
  private errors: CrawlError[] = [];
  private visitedUrls: Set<string> = new Set();
  private rateLimiter: RateLimiter;
  private robotsRules?: RobotsTxtRules;
  private techContext: TechDetectionContext = {
    headers: {},
    cookies: [],
    scripts: [],
    html: '',
    meta: {},
  };
  private onProgress?: ProgressCallback;
  private aborted = false;

  constructor(
    competitorId: string,
    config: Partial<CrawlConfig> = {}
  ) {
    this.competitorId = competitorId;
    this.config = { ...DEFAULT_CRAWL_CONFIG, ...config };
    this.job = this.createJob();
    this.rateLimiter = new RateLimiter(
      this.config.minDelay,
      this.config.maxDelay,
      this.config.maxRequestsPerMinute || 20
    );
  }

  private createJob(): CrawlJob {
    return {
      id: randomUUID(),
      competitorId: this.competitorId,
      status: 'pending',
      config: this.config,
      pagesFound: 0,
      pagesCrawled: 0,
      errors: [],
    };
  }

  /**
   * Start crawling a domain
   */
  async crawl(
    domain: string,
    onProgress?: ProgressCallback
  ): Promise<CrawlResult> {
    this.onProgress = onProgress;
    this.job.status = 'running';
    this.job.startedAt = Date.now();

    const baseUrl = domain.startsWith('http://') || domain.startsWith('https://') ? domain : `https://${domain}`;
    const normalizedDomain = extractDomain(baseUrl);

    this.emitProgress();

    try {
      // 1. Fetch robots.txt if respecting it
      if (this.config.respectRobotsTxt) {
        await this.fetchRobotsTxt(baseUrl);
      }

      // 2. Collect URLs to crawl
      const urlsToCrawl: { url: string; depth: number }[] = [];

      // Add homepage
      urlsToCrawl.push({ url: baseUrl, depth: 0 });

      // 3. Parse sitemap if enabled
      if (this.config.useSitemap) {
        const sitemapResult = await fetchSitemap(baseUrl, this.config.maxPages);
        const sitemapUrls = sortByPriority(sitemapResult.urls);

        for (const sitemapUrl of sitemapUrls) {
          if (urlsToCrawl.length >= this.config.maxPages) break;
          if (!this.visitedUrls.has(normalizeUrl(sitemapUrl.loc))) {
            urlsToCrawl.push({ url: sitemapUrl.loc, depth: 1 });
            this.visitedUrls.add(normalizeUrl(sitemapUrl.loc));
          }
        }

        if (sitemapResult.errors.length > 0) {
          for (const error of sitemapResult.errors) {
            this.errors.push({
              url: baseUrl,
              message: error,
              timestamp: Date.now(),
            });
          }
        }
      }

      this.job.pagesFound = urlsToCrawl.length;
      this.emitProgress();

      // 4. Create and run crawler
      await this.runCrawler(baseUrl, normalizedDomain, urlsToCrawl);

      // 5. Finalize
      this.job.status = 'completed';
      this.job.completedAt = Date.now();
      this.job.durationMs = this.job.completedAt - (this.job.startedAt || this.job.completedAt);
      this.job.pagesCrawled = this.pages.length;
      this.job.errors = this.errors;

    } catch (error) {
      this.job.status = 'failed';
      this.job.completedAt = Date.now();
      this.job.durationMs = this.job.completedAt - (this.job.startedAt || this.job.completedAt);
      this.errors.push({
        url: baseUrl,
        message: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      });
      this.job.errors = this.errors;
    }

    this.emitProgress();

    // Detect tech stack from collected context
    const techStack = detectTechStack(this.techContext);

    // Build structure analysis
    const structure = this.analyzeStructure();

    return {
      success: this.job.status === 'completed',
      job: this.job,
      pages: this.pages,
      techStack,
      structure,
      errors: this.errors,
      summary: this.buildSummary(),
    };
  }

  /**
   * Abort crawling
   */
  abort(): void {
    this.aborted = true;
    this.job.status = 'cancelled';
  }

  /**
   * Get current job status
   */
  getJob(): CrawlJob {
    return this.job;
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private async fetchRobotsTxt(baseUrl: string): Promise<void> {
    try {
      const response = await fetch(`${baseUrl}/robots.txt`, {
        headers: getCommonHeaders(),
      });
      if (response.ok) {
        const content = await response.text();
        this.robotsRules = parseRobotsTxt(content);
      }
    } catch {
      // Robots.txt not available, allow all
    }
  }

  private async runCrawler(
    _baseUrl: string,
    _domain: string,
    initialUrls: { url: string; depth: number }[]
  ): Promise<void> {
    // Configure Crawlee to use custom storage
    Configuration.getGlobalConfig().set('persistStorage', false);
    Configuration.getGlobalConfig().set('purgeOnStart', true);

    const proxyConfiguration = createProxyConfiguration(this.config);

    const crawler = new PlaywrightCrawler({
      proxyConfiguration,
      maxConcurrency: this.config.maxConcurrency || 3,
      maxRequestsPerCrawl: this.config.maxPages,
      requestHandlerTimeoutSecs: 60,
      navigationTimeoutSecs: 30,

      useSessionPool: true,
      persistCookiesPerSession: true,
      sessionPoolOptions: { maxPoolSize: 50 },

      launchContext: {
        launchOptions: {
          headless: this.config.useHeadless,
          args: getStealthLaunchArgs(),
        },
      },

      preNavigationHooks: [
        async ({ page, request }) => {
          if (this.aborted) {
            throw new Error('Crawl aborted');
          }

          // Apply rate limiting
          await this.rateLimiter.waitForSlot();

          // Set random user agent
          if (this.config.userAgentRotation) {
            const userAgent = getRandomUserAgent();
            await page.setExtraHTTPHeaders({
              ...getCommonHeaders(userAgent),
            });
          }

          // Inject fingerprint evasion
          await page.addInitScript(FINGERPRINT_EVASION_SCRIPT);

          // Capture response headers for tech detection
          page.on('response', async (response) => {
            if (response.url() === request.url) {
              const headers = response.headers();
              Object.assign(this.techContext.headers, headers);
            }
          });
        },
      ],

      requestHandler: async ({ page, request, enqueueLinks, log }) => {
        const url = request.url;
        const depth = request.userData?.depth ?? 0;
        const startTime = Date.now();

        try {
          // Check robots.txt
          if (this.robotsRules && !isUrlAllowed(url, this.robotsRules)) {
            log.info(`Skipping ${url} (blocked by robots.txt)`);
            return;
          }

          // Wait for page to be fully loaded
          await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});

          // Collect tech detection context
          const cookies = await page.context().cookies();
          this.techContext.cookies.push(...cookies.map(c => c.name));

          const scripts = await page.$$eval('script[src]', (els) =>
            els.map((el) => el.getAttribute('src') || '')
          );
          this.techContext.scripts.push(...scripts);

          const html = await page.content();
          this.techContext.html = html; // Last page HTML

          // Extract page data
          const extraction = await extractFromPage(page, url);
          const responseTime = Date.now() - startTime;

          const crawledPage = createCrawledPage(
            randomUUID(),
            this.competitorId,
            url,
            depth,
            extraction,
            this.job.id,
            200,
            responseTime
          );

          this.pages.push(crawledPage);
          this.job.pagesCrawled = this.pages.length;
          this.emitProgress(url);

          // Enqueue links for deeper crawling
          if (depth < this.config.depth && this.pages.length < this.config.maxPages) {
            await enqueueLinks({
              strategy: 'same-domain',
              transformRequestFunction: (req) => {
                const normalized = normalizeUrl(req.url);
                if (
                  this.visitedUrls.has(normalized) ||
                  !shouldCrawlUrl(req.url) ||
                  this.pages.length >= this.config.maxPages
                ) {
                  return false;
                }
                this.visitedUrls.add(normalized);
                this.job.pagesFound = this.visitedUrls.size;
                req.userData = { depth: depth + 1 };
                return req;
              },
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          log.error(`Error crawling ${url}: ${errorMessage}`);
          this.errors.push({
            url,
            message: errorMessage,
            timestamp: Date.now(),
          });
        }
      },

      failedRequestHandler: async ({ request, log }) => {
        log.error(`Request failed: ${request.url}`);
        this.errors.push({
          url: request.url,
          message: `Request failed after retries`,
          timestamp: Date.now(),
        });
      },
    });

    // Add initial URLs to the crawler
    const requests = initialUrls.map(({ url, depth }) => {
      this.visitedUrls.add(normalizeUrl(url));
      return {
        url,
        userData: { depth },
      };
    });

    await crawler.run(requests);
  }

  private emitProgress(currentUrl?: string): void {
    if (this.onProgress) {
      const progress: CrawlProgress = {
        competitorId: this.competitorId,
        jobId: this.job.id,
        status: this.job.status,
        pagesFound: this.job.pagesFound,
        pagesCrawled: this.job.pagesCrawled,
        currentUrl,
        progress: this.job.pagesFound > 0
          ? Math.round((this.job.pagesCrawled / this.job.pagesFound) * 100)
          : 0,
      };
      this.onProgress(progress);
    }
  }

  private analyzeStructure(): import('../types.js').SiteStructureAnalysis {
    const paths = this.pages.map(p => p.path);
    const uniquePaths = [...new Set(paths)];

    // Build folder tree
    const folders = new Map<string, number>();
    let maxDepth = 0;

    for (const path of uniquePaths) {
      const parts = path.split('/').filter(p => p.length > 0);
      maxDepth = Math.max(maxDepth, parts.length);

      for (let i = 0; i < parts.length; i++) {
        const folderPath = '/' + parts.slice(0, i + 1).join('/');
        folders.set(folderPath, (folders.get(folderPath) || 0) + 1);
      }
    }

    // Detect top-level folders
    const topLevelFolders = [...folders.keys()]
      .filter(f => f.split('/').filter(p => p).length === 1)
      .sort((a, b) => (folders.get(b) || 0) - (folders.get(a) || 0));

    // Detect common patterns
    const hasBlog = topLevelFolders.some(f =>
      /^\/(blog|news|articles|posts)/i.test(f)
    );
    const hasProductCatalog = topLevelFolders.some(f =>
      /^\/(products?|catalog|shop|store)/i.test(f)
    );
    const hasDocumentation = topLevelFolders.some(f =>
      /^\/(docs?|documentation|help|guide)/i.test(f)
    );

    // Build root node
    const rootNode: import('../types.js').SiteStructureNode = {
      path: '/',
      depth: 0,
      pageCount: uniquePaths.filter(p => p === '/').length || 1,
      childCount: topLevelFolders.length,
      nodeType: 'root',
    };

    return {
      totalPages: this.pages.length,
      maxDepth,
      rootNode,
      topLevelFolders,
      flatStructure: maxDepth <= 2,
      hasProductCatalog,
      hasBlog,
      hasDocumentation,
    };
  }

  private buildSummary(): CrawlSummary {
    const totalImages = this.pages.reduce((sum, p) => sum + p.images.length, 0);
    const totalLinks = this.pages.reduce((sum, p) => sum + p.links.length, 0);
    const responseTimes = this.pages
      .filter(p => p.responseTimeMs)
      .map(p => p.responseTimeMs!);
    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    return {
      totalPages: this.job.pagesFound,
      successfulPages: this.pages.length,
      failedPages: this.errors.length,
      totalLinks,
      totalImages,
      averageResponseTime: Math.round(averageResponseTime),
      crawlDuration: this.job.durationMs || 0,
    };
  }
}

// ============================================
// FACTORY FUNCTION
// ============================================

/**
 * Create and run a competitor crawl
 */
export async function crawlCompetitor(
  competitorId: string,
  domain: string,
  config?: Partial<CrawlConfig>,
  onProgress?: ProgressCallback
): Promise<CrawlResult> {
  const crawler = new CompetitorCrawler(competitorId, config);
  return crawler.crawl(domain, onProgress);
}

// Re-export DEFAULT_CRAWL_CONFIG
export { DEFAULT_CRAWL_CONFIG } from '../types.js';
