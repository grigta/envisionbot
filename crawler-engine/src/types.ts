/**
 * @envisionbot/crawler-engine
 * Type definitions for AI-powered universal web crawler
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Extracted item from a crawled page
 */
export interface CrawledItem {
  id: string;
  title: string;
  url: string;
  description?: string;
  content?: string;
  metadata: Record<string, unknown>;
  extractedAt: number;
}

/**
 * Result of a crawl operation
 */
export interface CrawlResult {
  sourceId: string;
  url: string;
  items: CrawledItem[];
  success: boolean;
  error?: string;
  startedAt: number;
  completedAt: number;
  stats: CrawlStats;
}

/**
 * Statistics from crawl operation
 */
export interface CrawlStats {
  fetchTimeMs: number;
  processTimeMs: number;
  extractTimeMs: number;
  totalTimeMs: number;
  htmlSize: number;
  markdownSize: number;
  chunksCount: number;
}

// ============================================================================
// Fetcher Types
// ============================================================================

/**
 * Options for HTTP fetcher
 */
export interface HTTPFetcherOptions {
  timeout?: number;
  headers?: Record<string, string>;
  userAgent?: string;
  followRedirects?: boolean;
  maxRedirects?: number;
}

/**
 * Options for browser fetcher (Puppeteer)
 */
export interface BrowserFetcherOptions {
  timeout?: number;
  waitForSelector?: string;
  waitForTimeout?: number;
  scrollToBottom?: boolean;
  viewport?: {
    width: number;
    height: number;
  };
  userAgent?: string;
  headless?: boolean;
  executablePath?: string;
}

/**
 * Result from fetcher
 */
export interface FetchResult {
  html: string;
  url: string;
  statusCode: number;
  headers: Record<string, string>;
  fetchedAt: number;
}

/**
 * Fetcher interface
 */
export interface Fetcher {
  fetch(url: string): Promise<FetchResult>;
  close?(): Promise<void>;
}

// ============================================================================
// Processor Types
// ============================================================================

/**
 * Options for HTML cleaner
 */
export interface CleanerOptions {
  /** Tags to remove entirely (e.g., ['nav', 'footer', 'aside']) */
  excludedTags: string[];
  /** CSS class patterns to remove (e.g., ['advertisement', 'sidebar']) */
  excludedClasses: string[];
  /** ID patterns to remove (e.g., ['ad-container', 'popup']) */
  excludedIds: string[];
  /** Remove script tags */
  removeScripts: boolean;
  /** Remove style tags */
  removeStyles: boolean;
  /** Remove HTML comments */
  removeComments: boolean;
  /** Remove empty elements */
  removeEmpty: boolean;
  /** Keep only main content area (article, main, etc.) */
  keepMainContentOnly: boolean;
}

/**
 * Options for Markdown converter
 */
export interface MarkdownOptions {
  /** Heading style: 'atx' (#) or 'setext' (underline) */
  headingStyle: 'atx' | 'setext';
  /** Code block style: 'fenced' (```) or 'indented' */
  codeBlockStyle: 'fenced' | 'indented';
  /** Bullet list marker */
  bulletListMarker: '-' | '*' | '+';
  /** Keep images */
  keepImages: boolean;
  /** Keep links */
  keepLinks: boolean;
  /** Custom rules */
  customRules?: MarkdownRule[];
}

/**
 * Custom Markdown conversion rule
 */
export interface MarkdownRule {
  name: string;
  filter: string | string[];
  replacement: (content: string, node: unknown) => string;
}

/**
 * Options for pruning filter
 */
export interface PruningOptions {
  /** Enable/disable pruning filter (default: true) */
  enabled: boolean;
  /** Minimum text density ratio (0-1) to keep a block */
  minTextDensity: number;
  /** Minimum word count to keep a block */
  minWordCount: number;
  /** Maximum link density ratio (0-1) - blocks with more links are removed */
  maxLinkDensity: number;
  /** Patterns to always remove */
  removePatterns: RegExp[];
  /** Keep blocks containing these keywords */
  keepKeywords: string[];
}

/**
 * Options for content chunker
 */
export interface ChunkOptions {
  /** Maximum tokens per chunk */
  maxTokens: number;
  /** Overlap tokens between chunks */
  overlapTokens: number;
  /** Chunk by: 'tokens', 'paragraphs', 'sentences' */
  chunkBy: 'tokens' | 'paragraphs' | 'sentences';
  /** Preserve section headers in each chunk */
  preserveHeaders: boolean;
}

/**
 * A content chunk
 */
export interface ContentChunk {
  index: number;
  content: string;
  tokenCount: number;
  startOffset: number;
  endOffset: number;
}

// ============================================================================
// Extractor Types
// ============================================================================

/**
 * Extraction type
 */
export type ExtractionType = 'schema' | 'block' | 'auto';

/**
 * Configuration for LLM extraction
 */
export interface ExtractionConfig {
  /** Type of extraction */
  extractionType: ExtractionType;
  /** Custom prompt for extraction */
  prompt?: string;
  /** JSON schema for structured extraction */
  schema?: object;
  /** Model to use */
  model?: string;
  /** Maximum tokens for response */
  maxTokens?: number;
  /** Temperature for generation */
  temperature?: number;
  /** Language for output (e.g., 'ru', 'en') */
  outputLanguage?: string;
}

/**
 * Result from LLM extraction
 */
export interface ExtractionResult {
  data: unknown;
  raw: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  extractedAt: number;
}

/**
 * Extractor interface
 */
export interface Extractor {
  extract(content: string, config: ExtractionConfig): Promise<ExtractionResult>;
}

// ============================================================================
// Adapter Types
// ============================================================================

/**
 * Extractor mode - how to call Claude for extraction
 */
export type ExtractorMode = 'api' | 'cli' | 'openrouter';

/**
 * Configuration for creating an adapter
 */
export interface AdapterConfig {
  /** Use browser (Puppeteer) instead of HTTP fetch */
  useBrowser: boolean;
  /** Extractor mode: 'api' for direct SDK, 'cli' for Claude Code CLI, 'openrouter' for OpenRouter API */
  extractorMode?: ExtractorMode;
  /** Anthropic API key for Claude (for sk-ant-api keys) */
  anthropicApiKey?: string;
  /** Anthropic auth token for Claude (for OAuth tokens like sk-ant-oat) */
  anthropicAuthToken?: string;
  /** Path to claude CLI binary (for cli mode) */
  claudePath?: string;
  /** OpenRouter API key (for openrouter mode) */
  openrouterApiKey?: string;
  /** OpenRouter model (for openrouter mode) */
  openrouterModel?: string;
  /** Custom cleaner options */
  cleanerOptions?: Partial<CleanerOptions>;
  /** Custom markdown options */
  markdownOptions?: Partial<MarkdownOptions>;
  /** Custom pruning options */
  pruningOptions?: Partial<PruningOptions>;
  /** Custom chunk options */
  chunkOptions?: Partial<ChunkOptions>;
  /** Browser fetcher options */
  browserOptions?: Partial<BrowserFetcherOptions>;
  /** HTTP fetcher options */
  httpOptions?: Partial<HTTPFetcherOptions>;
}

/**
 * Adapter interface for crawling
 */
export interface CrawlerAdapter {
  crawl(url: string, config: ExtractionConfig): Promise<CrawledItem[]>;
  close?(): Promise<void>;
}

// ============================================================================
// Source & Engine Types
// ============================================================================

/**
 * Configuration for adding a new source
 */
export interface SourceConfig {
  /** Display name */
  name: string;
  /** URL to crawl */
  url: string;
  /** Extraction prompt */
  prompt?: string;
  /** JSON schema for extraction */
  schema?: object;
  /** Requires browser (JS rendering) */
  requiresBrowser?: boolean;
  /** Crawl interval in hours */
  crawlIntervalHours?: number;
  /** Custom adapter config */
  adapterConfig?: Partial<AdapterConfig>;
}

/**
 * A configured crawler source
 */
export interface CrawlerSource {
  id: string;
  name: string;
  url: string;
  prompt?: string;
  schema?: object;
  requiresBrowser: boolean;
  crawlIntervalHours: number;
  isEnabled: boolean;
  lastCrawlAt?: number;
  lastCrawlStatus?: 'success' | 'error';
  lastCrawlItemCount?: number;
  lastCrawlError?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Result of testing a source
 */
export interface TestResult {
  success: boolean;
  items?: CrawledItem[];
  itemCount?: number;
  error?: string;
  stats?: CrawlStats;
}

/**
 * Engine configuration
 */
export interface EngineConfig {
  /** Anthropic API key (for sk-ant-api keys) */
  anthropicApiKey?: string;
  /** Anthropic auth token (for OAuth tokens like sk-ant-oat) */
  anthropicAuthToken?: string;
  /** OpenRouter API key (for openrouter mode) */
  openrouterApiKey?: string;
  /** OpenRouter model (for openrouter mode) */
  openrouterModel?: string;
  /** Extractor mode: 'api' for direct SDK, 'cli' for Claude Code CLI, 'openrouter' for OpenRouter API */
  extractorMode?: ExtractorMode;
  /** Path to claude CLI binary (for cli mode) */
  claudePath?: string;
  /** Default extraction model */
  defaultModel?: string;
  /** Max concurrent crawls */
  maxConcurrent?: number;
  /** Default browser options */
  browserOptions?: Partial<BrowserFetcherOptions>;
}

/**
 * Engine events
 */
export interface EngineEvents {
  'crawl:start': { sourceId: string; url: string };
  'crawl:progress': { sourceId: string; stage: string; progress: number };
  'crawl:complete': { sourceId: string; result: CrawlResult };
  'crawl:error': { sourceId: string; error: Error };
  'source:added': { source: CrawlerSource };
  'source:updated': { source: CrawlerSource };
  'source:removed': { sourceId: string };
}

// ============================================================================
// RSS Types
// ============================================================================

/**
 * RSS feed item
 */
export interface RSSItem {
  title: string;
  link?: string;
  pubDate?: string;
  creator?: string;
  content?: string;
  contentSnippet?: string;
  guid?: string;
  categories?: string[];
}

/**
 * RSS feed
 */
export interface RSSFeed {
  title: string;
  description?: string;
  link: string;
  items: RSSItem[];
  feedUrl: string;
  lastBuildDate?: string;
}

// ============================================================================
// Default Options
// ============================================================================

export const DEFAULT_CLEANER_OPTIONS: CleanerOptions = {
  excludedTags: [
    'nav', 'footer', 'aside', 'header', 'script', 'style', 'noscript',
    'iframe', 'form', 'button', 'input', 'select', 'textarea',
  ],
  excludedClasses: [
    'nav', 'navigation', 'menu', 'sidebar', 'footer', 'header',
    'advertisement', 'ad', 'ads', 'banner', 'cookie', 'popup',
    'modal', 'overlay', 'social', 'share', 'comment', 'comments',
  ],
  excludedIds: [
    'nav', 'navigation', 'menu', 'sidebar', 'footer', 'header',
    'ad', 'ads', 'advertisement', 'banner', 'cookie', 'popup',
  ],
  removeScripts: true,
  removeStyles: true,
  removeComments: true,
  removeEmpty: true,
  keepMainContentOnly: false,
};

export const DEFAULT_MARKDOWN_OPTIONS: MarkdownOptions = {
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  keepImages: true,
  keepLinks: true,
};

export const DEFAULT_PRUNING_OPTIONS: PruningOptions = {
  enabled: false, // Disabled by default - LLM handles content filtering better
  minTextDensity: 0.1, // More permissive for link-heavy sites
  minWordCount: 3, // Allow short titles/links
  maxLinkDensity: 1.0, // Allow 100% links - important for list pages
  removePatterns: [
    /^(copyright|©|\(c\))/i,
    /^all rights reserved/i,
    /^privacy policy/i,
    /^terms (of|and) (service|use)/i,
    /^cookie policy/i,
  ],
  keepKeywords: [],
};

export const DEFAULT_CHUNK_OPTIONS: ChunkOptions = {
  maxTokens: 4000,
  overlapTokens: 200,
  chunkBy: 'tokens',
  preserveHeaders: true,
};
