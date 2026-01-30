/**
 * CrawlerEngine - Main engine for managing crawler sources and executing crawls
 * Provides a high-level API for adding sources, testing, and crawling
 */

import { EventEmitter } from 'eventemitter3';
import type {
  EngineConfig,
  EngineEvents,
  SourceConfig,
  CrawlerSource,
  CrawledItem,
  CrawlResult,
  TestResult,
  ExtractionConfig,
  CrawlStats,
} from './types.js';
import { UniversalAIAdapter } from './adapters/universal.adapter.js';
import { RSSAdapter } from './adapters/rss.adapter.js';

export class CrawlerEngine extends EventEmitter<EngineEvents> {
  private config: EngineConfig;
  private sources: Map<string, CrawlerSource> = new Map();
  private adapters: Map<string, UniversalAIAdapter> = new Map();

  constructor(config: EngineConfig) {
    super();
    this.config = {
      ...config,
      defaultModel: config.defaultModel || 'claude-sonnet-4-20250514',
      maxConcurrent: config.maxConcurrent || 3,
    };
  }

  /**
   * Add a new crawler source
   */
  async addSource(sourceConfig: SourceConfig): Promise<CrawlerSource> {
    const id = this.generateId();

    const source: CrawlerSource = {
      id,
      name: sourceConfig.name,
      url: sourceConfig.url,
      prompt: sourceConfig.prompt,
      schema: sourceConfig.schema,
      requiresBrowser: sourceConfig.requiresBrowser || false,
      crawlIntervalHours: sourceConfig.crawlIntervalHours || 24,
      isEnabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Create adapter for this source
    const adapter = new UniversalAIAdapter({
      useBrowser: source.requiresBrowser,
      extractorMode: this.config.extractorMode,
      claudePath: this.config.claudePath,
      anthropicApiKey: this.config.anthropicApiKey,
      anthropicAuthToken: this.config.anthropicAuthToken,
      openrouterApiKey: this.config.openrouterApiKey,
      openrouterModel: this.config.openrouterModel,
      browserOptions: this.config.browserOptions,
      ...sourceConfig.adapterConfig,
    });

    this.sources.set(id, source);
    this.adapters.set(id, adapter);

    this.emit('source:added', { source });

    return source;
  }

  /**
   * Update an existing source
   */
  updateSource(sourceId: string, updates: Partial<SourceConfig>): CrawlerSource {
    const source = this.sources.get(sourceId);
    if (!source) {
      throw new Error(`Source not found: ${sourceId}`);
    }

    const updatedSource: CrawlerSource = {
      ...source,
      ...updates,
      updatedAt: Date.now(),
    };

    // If browser requirement changed, recreate adapter
    if (updates.requiresBrowser !== undefined && updates.requiresBrowser !== source.requiresBrowser) {
      const oldAdapter = this.adapters.get(sourceId);
      oldAdapter?.close();

      const newAdapter = new UniversalAIAdapter({
        useBrowser: updates.requiresBrowser,
        extractorMode: this.config.extractorMode,
        claudePath: this.config.claudePath,
        anthropicApiKey: this.config.anthropicApiKey,
        anthropicAuthToken: this.config.anthropicAuthToken,
        openrouterApiKey: this.config.openrouterApiKey,
        openrouterModel: this.config.openrouterModel,
        browserOptions: this.config.browserOptions,
        ...updates.adapterConfig,
      });

      this.adapters.set(sourceId, newAdapter);
    }

    this.sources.set(sourceId, updatedSource);
    this.emit('source:updated', { source: updatedSource });

    return updatedSource;
  }

  /**
   * Remove a source
   */
  async removeSource(sourceId: string): Promise<void> {
    const adapter = this.adapters.get(sourceId);
    if (adapter) {
      await adapter.close();
    }

    this.sources.delete(sourceId);
    this.adapters.delete(sourceId);

    this.emit('source:removed', { sourceId });
  }

  /**
   * Get all sources
   */
  getSources(): CrawlerSource[] {
    return Array.from(this.sources.values());
  }

  /**
   * Get a specific source
   */
  getSource(sourceId: string): CrawlerSource | undefined {
    return this.sources.get(sourceId);
  }

  /**
   * Test a URL before adding as a source
   */
  async testSource(
    url: string,
    prompt?: string,
    options?: { requiresBrowser?: boolean; schema?: object }
  ): Promise<TestResult> {
    const startTime = Date.now();

    // Create temporary adapter
    const adapter = new UniversalAIAdapter({
      useBrowser: options?.requiresBrowser ?? true,
      extractorMode: this.config.extractorMode,
      claudePath: this.config.claudePath,
      anthropicApiKey: this.config.anthropicApiKey,
      anthropicAuthToken: this.config.anthropicAuthToken,
      openrouterApiKey: this.config.openrouterApiKey,
      openrouterModel: this.config.openrouterModel,
      browserOptions: this.config.browserOptions,
    });

    try {
      const extractionConfig: ExtractionConfig = {
        prompt: prompt || 'Извлеки все основные элементы контента страницы',
        extractionType: options?.schema ? 'schema' : 'block',
        schema: options?.schema,
        outputLanguage: 'ru',
      };

      const items = await adapter.crawl(url, extractionConfig);

      return {
        success: true,
        items,
        itemCount: items.length,
        stats: items[0]?.metadata?.crawlStats as CrawlStats | undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      await adapter.close();
    }
  }

  /**
   * Crawl a specific source
   */
  async crawl(sourceId: string): Promise<CrawlResult> {
    const source = this.sources.get(sourceId);
    const adapter = this.adapters.get(sourceId);

    if (!source || !adapter) {
      throw new Error(`Source not found: ${sourceId}`);
    }

    const startTime = Date.now();

    this.emit('crawl:start', { sourceId, url: source.url });
    this.emit('crawl:progress', { sourceId, stage: 'fetching', progress: 0 });

    try {
      const extractionConfig: ExtractionConfig = {
        prompt: source.prompt,
        extractionType: source.schema ? 'schema' : 'block',
        schema: source.schema,
        outputLanguage: 'ru',
      };

      this.emit('crawl:progress', { sourceId, stage: 'processing', progress: 25 });

      const items = await adapter.crawl(source.url, extractionConfig);

      this.emit('crawl:progress', { sourceId, stage: 'extracting', progress: 75 });

      const result: CrawlResult = {
        sourceId,
        url: source.url,
        items,
        success: true,
        startedAt: startTime,
        completedAt: Date.now(),
        stats: (items[0]?.metadata?.crawlStats as CrawlStats) || {
          fetchTimeMs: 0,
          processTimeMs: 0,
          extractTimeMs: 0,
          totalTimeMs: Date.now() - startTime,
          htmlSize: 0,
          markdownSize: 0,
          chunksCount: 1,
        },
      };

      // Update source with crawl info
      const updatedSource: CrawlerSource = {
        ...source,
        lastCrawlAt: Date.now(),
        lastCrawlStatus: 'success',
        lastCrawlItemCount: items.length,
        lastCrawlError: undefined,
        updatedAt: Date.now(),
      };
      this.sources.set(sourceId, updatedSource);

      this.emit('crawl:progress', { sourceId, stage: 'complete', progress: 100 });
      this.emit('crawl:complete', { sourceId, result });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Update source with error
      const updatedSource: CrawlerSource = {
        ...source,
        lastCrawlAt: Date.now(),
        lastCrawlStatus: 'error',
        lastCrawlError: errorMessage,
        updatedAt: Date.now(),
      };
      this.sources.set(sourceId, updatedSource);

      this.emit('crawl:error', { sourceId, error: error as Error });

      return {
        sourceId,
        url: source.url,
        items: [],
        success: false,
        error: errorMessage,
        startedAt: startTime,
        completedAt: Date.now(),
        stats: {
          fetchTimeMs: 0,
          processTimeMs: 0,
          extractTimeMs: 0,
          totalTimeMs: Date.now() - startTime,
          htmlSize: 0,
          markdownSize: 0,
          chunksCount: 0,
        },
      };
    }
  }

  /**
   * Crawl all enabled sources
   */
  async crawlAll(): Promise<CrawlResult[]> {
    const enabledSources = Array.from(this.sources.values()).filter((s) => s.isEnabled);
    const results: CrawlResult[] = [];

    // Crawl in batches based on maxConcurrent
    for (let i = 0; i < enabledSources.length; i += this.config.maxConcurrent!) {
      const batch = enabledSources.slice(i, i + this.config.maxConcurrent!);
      const batchResults = await Promise.all(batch.map((source) => this.crawl(source.id)));
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Crawl a URL directly without creating a source
   */
  async crawlUrl(
    url: string,
    options?: {
      prompt?: string;
      schema?: object;
      requiresBrowser?: boolean;
    }
  ): Promise<CrawledItem[]> {
    const adapter = new UniversalAIAdapter({
      useBrowser: options?.requiresBrowser ?? true,
      extractorMode: this.config.extractorMode,
      claudePath: this.config.claudePath,
      anthropicApiKey: this.config.anthropicApiKey,
      anthropicAuthToken: this.config.anthropicAuthToken,
      openrouterApiKey: this.config.openrouterApiKey,
      openrouterModel: this.config.openrouterModel,
      browserOptions: this.config.browserOptions,
    });

    try {
      const extractionConfig: ExtractionConfig = {
        prompt: options?.prompt || 'Извлеки основные элементы контента',
        extractionType: options?.schema ? 'schema' : 'block',
        schema: options?.schema,
        outputLanguage: 'ru',
      };

      return await adapter.crawl(url, extractionConfig);
    } finally {
      await adapter.close();
    }
  }

  /**
   * Crawl an RSS feed
   */
  async crawlRSS(url: string): Promise<CrawledItem[]> {
    const rssAdapter = new RSSAdapter();
    return rssAdapter.crawl(url);
  }

  /**
   * Close all adapters and cleanup
   */
  async close(): Promise<void> {
    for (const adapter of this.adapters.values()) {
      await adapter.close();
    }
    this.adapters.clear();
  }

  /**
   * Generate unique source ID
   */
  private generateId(): string {
    return `src_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
  }
}

export function createCrawlerEngine(config: EngineConfig): CrawlerEngine {
  return new CrawlerEngine(config);
}
