/**
 * @envisionbot/crawler-engine
 * AI-powered universal web crawler engine
 *
 * Pipeline: Fetch → Clean → Markdown → Prune → Chunk → LLM Extract
 */

// Main engine
export { CrawlerEngine, createCrawlerEngine } from './engine.js';

// Types
export type {
  // Core types
  CrawledItem,
  CrawlResult,
  CrawlStats,
  // Fetcher types
  Fetcher,
  FetchResult,
  HTTPFetcherOptions,
  BrowserFetcherOptions,
  // Processor types
  CleanerOptions,
  MarkdownOptions,
  MarkdownRule,
  PruningOptions,
  ChunkOptions,
  ContentChunk,
  // Extractor types
  Extractor,
  ExtractionConfig,
  ExtractionResult,
  ExtractionType,
  // Adapter types
  AdapterConfig,
  CrawlerAdapter,
  // Source & Engine types
  SourceConfig,
  CrawlerSource,
  TestResult,
  EngineConfig,
  EngineEvents,
  // RSS types
  RSSItem,
  RSSFeed,
} from './types.js';

// Default options
export {
  DEFAULT_CLEANER_OPTIONS,
  DEFAULT_MARKDOWN_OPTIONS,
  DEFAULT_PRUNING_OPTIONS,
  DEFAULT_CHUNK_OPTIONS,
} from './types.js';

// Fetchers
export { HTTPFetcher, createHTTPFetcher } from './fetcher/http.fetcher.js';
export { BrowserFetcher, createBrowserFetcher } from './fetcher/browser.fetcher.js';

// Processors
export { HTMLCleaner, createHTMLCleaner } from './processor/html-cleaner.js';
export { MarkdownConverter, createMarkdownConverter } from './processor/markdown.js';
export { PruningFilter, createPruningFilter } from './processor/pruning-filter.js';
export { Chunker, createChunker } from './processor/chunker.js';

// Extractors
export { ClaudeExtractor, createClaudeExtractor } from './extractor/claude.extractor.js';
export { RSSExtractor, createRSSExtractor } from './extractor/rss.extractor.js';

// Adapters
export { UniversalAIAdapter, createUniversalAdapter } from './adapters/universal.adapter.js';
export { RSSAdapter, createRSSAdapter } from './adapters/rss.adapter.js';
