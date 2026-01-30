/**
 * Crawler Service
 * Integrates @envisionbot/crawler-engine with pm-agent
 */

import {
  CrawlerEngine,
  type CrawlerSource as EngineCrawlerSource,
  type CrawledItem as EngineCrawledItem,
  type CrawlResult,
  type TestResult,
} from "@envisionbot/crawler-engine";
import type { CrawlerRepository } from "../repositories/crawler.repository.js";
import type { CrawlerSource, CrawledItem } from "../types.js";
import { broadcast } from "../server.js";

export interface CrawlerServiceAuthConfig {
  apiKey?: string;
  authToken?: string;
  /** Use CLI mode for extraction (supports Max subscription via Claude Code) */
  useCLI?: boolean;
}

export class CrawlerService {
  private engine: CrawlerEngine;
  private repository: CrawlerRepository;
  private isRunning: Map<string, boolean> = new Map();

  constructor(repository: CrawlerRepository, authConfig: CrawlerServiceAuthConfig) {
    this.repository = repository;

    // ВСЕГДА используем OpenRouter для crawler
    this.engine = new CrawlerEngine({
      extractorMode: 'openrouter',
      openrouterApiKey: process.env.OPENROUTER_API_KEY!,
      openrouterModel: process.env.OPENROUTER_MODEL || 'google/gemini-3-flash-preview',
      maxConcurrent: 2,
    });

    console.log('🤖 Crawler using OpenRouter with', process.env.OPENROUTER_MODEL || 'gemini-3-flash-preview');
  }

  /**
   * Get all crawler sources
   */
  async getSources(filter?: { isEnabled?: boolean }): Promise<CrawlerSource[]> {
    return this.repository.getAllSources(filter);
  }

  /**
   * Get source by ID
   */
  async getSource(id: string): Promise<CrawlerSource | undefined> {
    return this.repository.getSourceById(id);
  }

  /**
   * Create a new crawler source
   */
  async createSource(data: {
    name: string;
    url: string;
    prompt?: string;
    schema?: object;
    requiresBrowser?: boolean;
    crawlIntervalHours?: number;
  }): Promise<CrawlerSource> {
    const id = `src_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;

    const source = await this.repository.createSource({
      id,
      name: data.name,
      url: data.url,
      prompt: data.prompt,
      schema: data.schema,
      requiresBrowser: data.requiresBrowser ?? false,
      crawlIntervalHours: data.crawlIntervalHours ?? 24,
      isEnabled: true,
    });

    broadcast({
      type: "news_updated",
      timestamp: Date.now(),
      data: { action: "source_created", sourceId: id },
    });

    return source;
  }

  /**
   * Update a crawler source
   */
  async updateSource(
    id: string,
    updates: Partial<Omit<CrawlerSource, "id" | "createdAt">>
  ): Promise<CrawlerSource | undefined> {
    const updated = await this.repository.updateSource(id, updates);

    if (updated) {
      broadcast({
        type: "news_updated",
        timestamp: Date.now(),
        data: { action: "source_updated", sourceId: id },
      });
    }

    return updated;
  }

  /**
   * Delete a crawler source
   */
  async deleteSource(id: string): Promise<boolean> {
    const deleted = await this.repository.deleteSource(id);

    if (deleted) {
      broadcast({
        type: "news_updated",
        timestamp: Date.now(),
        data: { action: "source_deleted", sourceId: id },
      });
    }

    return deleted;
  }

  /**
   * Test a URL before adding as source
   */
  async testSource(
    url: string,
    prompt?: string,
    options?: { requiresBrowser?: boolean; schema?: object }
  ): Promise<TestResult> {
    return this.engine.testSource(url, prompt, options);
  }

  /**
   * Run crawl for a specific source
   */
  async crawlSource(sourceId: string): Promise<CrawlResult> {
    const source = await this.repository.getSourceById(sourceId);
    if (!source) {
      throw new Error(`Source not found: ${sourceId}`);
    }

    if (this.isRunning.get(sourceId)) {
      throw new Error(`Crawl already running for source: ${sourceId}`);
    }

    this.isRunning.set(sourceId, true);

    broadcast({
      type: "news_crawl_started",
      timestamp: Date.now(),
      data: { sourceId, sourceName: source.name },
    });

    try {
      // Crawl using engine
      const items = await this.engine.crawlUrl(source.url, {
        prompt: source.prompt,
        schema: source.schema,
        requiresBrowser: source.requiresBrowser,
      });

      // Convert to our item format and save
      const crawledItems: CrawledItem[] = items.map((item) => ({
        id: item.id,
        sourceId,
        title: item.title,
        url: item.url,
        description: item.description,
        content: item.content,
        metadata: item.metadata,
        extractedAt: item.extractedAt,
        isProcessed: false,
      }));

      // Save items to database
      const { inserted, updated } = await this.repository.bulkUpsertItems(crawledItems);

      // Update source crawl status
      await this.repository.updateCrawlResult(sourceId, {
        status: "success",
        itemCount: items.length,
      });

      const result: CrawlResult = {
        sourceId,
        url: source.url,
        items: items,
        success: true,
        startedAt: Date.now(),
        completedAt: Date.now(),
        stats: {
          fetchTimeMs: 0,
          processTimeMs: 0,
          extractTimeMs: 0,
          totalTimeMs: 0,
          htmlSize: 0,
          markdownSize: 0,
          chunksCount: 1,
        },
      };

      broadcast({
        type: "news_updated",
        timestamp: Date.now(),
        data: {
          action: "crawl_complete",
          sourceId,
          itemCount: items.length,
          inserted,
          updated,
        },
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Update source with error
      await this.repository.updateCrawlResult(sourceId, {
        status: "error",
        error: errorMessage,
      });

      broadcast({
        type: "news_updated",
        timestamp: Date.now(),
        data: {
          action: "crawl_error",
          sourceId,
          error: errorMessage,
        },
      });

      throw error;
    } finally {
      this.isRunning.set(sourceId, false);
    }
  }

  /**
   * Run crawl for all enabled sources that are due
   */
  async crawlAllDue(): Promise<Array<{ sourceId: string; success: boolean; error?: string }>> {
    const sources = await this.repository.getSourcesDueForCrawl();
    const results: Array<{ sourceId: string; success: boolean; error?: string }> = [];

    for (const source of sources) {
      try {
        await this.crawlSource(source.id);
        results.push({ sourceId: source.id, success: true });
      } catch (error) {
        results.push({
          sourceId: source.id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  /**
   * Get crawled items
   */
  async getItems(filter?: {
    sourceId?: string;
    projectId?: string;
    isProcessed?: boolean;
    limit?: number;
  }): Promise<CrawledItem[]> {
    return this.repository.getItems(filter);
  }

  /**
   * Get item by ID
   */
  async getItem(id: string): Promise<CrawledItem | undefined> {
    return this.repository.getItemById(id);
  }

  /**
   * Mark item as processed (linked to a project)
   */
  async markItemProcessed(
    itemId: string,
    projectId?: string,
    relevanceScore?: number
  ): Promise<void> {
    await this.repository.markItemProcessed(itemId, projectId, relevanceScore);
  }

  /**
   * Get crawler statistics
   */
  async getStats() {
    return this.repository.getStats();
  }

  /**
   * Cleanup old items
   */
  async cleanup(olderThanDays: number = 30): Promise<number> {
    return this.repository.deleteOldItems(olderThanDays);
  }

  /**
   * Close the engine
   */
  async close(): Promise<void> {
    await this.engine.close();
  }
}
