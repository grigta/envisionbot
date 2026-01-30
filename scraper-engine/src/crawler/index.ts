// Crawler module exports
export {
  CompetitorCrawler,
  crawlCompetitor,
  DEFAULT_CRAWL_CONFIG,
} from './competitor-crawler.js';

export {
  // Anti-detection utilities
  getRandomUserAgent,
  getAllUserAgents,
  parseProxyList,
  createProxyConfiguration,
  calculateDelay,
  delay,
  withDelay,
  FINGERPRINT_EVASION_SCRIPT,
  getStealthLaunchArgs,
  getCommonHeaders,
  getRefererForDomain,
  parseRobotsTxt,
  isUrlAllowed,
  RateLimiter,
  type RobotsTxtRules,
} from './anti-detection.js';

export {
  // Page extraction
  extractSEOData,
  extractHeadings,
  extractImages,
  extractLinks,
  extractTextContent,
  countWords,
  extractFromHtml,
  extractFromPage,
  createCrawledPage,
  resolveUrl,
  normalizeUrl,
  shouldCrawlUrl,
  extractDomain,
  getPathDepth,
  type PageExtractionResult,
} from './page-extractor.js';

export {
  // Sitemap parsing
  parseSitemap,
  fetchSitemap,
  filterSitemapUrls,
  sortByPriority,
  type SitemapUrl,
  type SitemapIndex,
  type SitemapParseResult,
} from './sitemap-parser.js';
