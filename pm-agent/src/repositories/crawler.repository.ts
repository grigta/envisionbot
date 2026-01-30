/**
 * Crawler Repository
 * Handles CRUD operations for crawler sources and crawled items
 */

import { BaseRepository, type RepositoryDeps, type PubSubChannel } from "./base.repository.js";
import type {
  CrawlerSource,
  CrawledItem,
  CrawlerSourceRow,
  CrawledItemRow,
} from "../types.js";

/**
 * Convert database row to CrawlerSource
 */
function rowToSource(row: CrawlerSourceRow): CrawlerSource {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    prompt: row.prompt || undefined,
    schema: row.schema ? JSON.parse(row.schema) : undefined,
    requiresBrowser: row.requires_browser === 1,
    crawlIntervalHours: row.crawl_interval_hours,
    isEnabled: row.is_enabled === 1,
    lastCrawlAt: row.last_crawl_at || undefined,
    lastCrawlStatus: row.last_crawl_status as CrawlerSource["lastCrawlStatus"],
    lastCrawlItemCount: row.last_crawl_item_count || undefined,
    lastCrawlError: row.last_crawl_error || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Convert database row to CrawledItem
 */
function rowToItem(row: CrawledItemRow): CrawledItem {
  return {
    id: row.id,
    sourceId: row.source_id,
    title: row.title,
    url: row.url,
    description: row.description || undefined,
    content: row.content || undefined,
    metadata: JSON.parse(row.metadata),
    extractedAt: row.extracted_at,
    projectId: row.project_id || undefined,
    relevanceScore: row.relevance_score || undefined,
    isProcessed: row.is_processed === 1,
  };
}

export class CrawlerRepository extends BaseRepository<CrawlerSource> {
  protected readonly tableName = "crawler_sources";
  protected readonly cachePrefix = "pm:crawler";
  protected readonly cacheTTL = 300; // 5 minutes
  protected readonly pubsubChannel = "pm:events:news" as PubSubChannel; // Reuse news channel

  constructor(deps: RepositoryDeps) {
    super(deps);
  }

  // ==========================================
  // Sources CRUD
  // ==========================================

  /**
   * Get all crawler sources
   */
  async getAllSources(filter?: { isEnabled?: boolean }): Promise<CrawlerSource[]> {
    const cacheKey = this.listCacheKey(filter?.isEnabled !== undefined ? `enabled_${filter.isEnabled}` : "all");

    const cached = await this.getFromCache<CrawlerSource[]>(cacheKey);
    if (cached) return cached;

    let sql = `SELECT * FROM ${this.tableName}`;
    const params: unknown[] = [];

    if (filter?.isEnabled !== undefined) {
      sql += " WHERE is_enabled = ?";
      params.push(filter.isEnabled ? 1 : 0);
    }

    sql += " ORDER BY created_at DESC";

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as CrawlerSourceRow[];
    const sources = rows.map(rowToSource);

    await this.setCache(cacheKey, sources);
    return sources;
  }

  /**
   * Get source by ID
   */
  async getSourceById(id: string): Promise<CrawlerSource | undefined> {
    const cacheKey = this.entityCacheKey(id);

    const cached = await this.getFromCache<CrawlerSource>(cacheKey);
    if (cached) return cached;

    const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`);
    const row = stmt.get(id) as CrawlerSourceRow | undefined;

    if (!row) return undefined;

    const source = rowToSource(row);
    await this.setCache(cacheKey, source);
    return source;
  }

  /**
   * Create a new crawler source
   */
  async createSource(source: Omit<CrawlerSource, "createdAt" | "updatedAt">): Promise<CrawlerSource> {
    const now = Date.now();
    const fullSource: CrawlerSource = {
      ...source,
      createdAt: now,
      updatedAt: now,
    };

    const sql = `
      INSERT INTO ${this.tableName} (
        id, name, url, prompt, schema, requires_browser,
        crawl_interval_hours, is_enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    this.db.prepare(sql).run(
      fullSource.id,
      fullSource.name,
      fullSource.url,
      fullSource.prompt || null,
      fullSource.schema ? JSON.stringify(fullSource.schema) : null,
      fullSource.requiresBrowser ? 1 : 0,
      fullSource.crawlIntervalHours,
      fullSource.isEnabled ? 1 : 0,
      fullSource.createdAt,
      fullSource.updatedAt
    );

    await this.invalidateCachePattern(`${this.cachePrefix}:*`);
    await this.publishEvent("crawler_source_created", { id: fullSource.id });

    return fullSource;
  }

  /**
   * Update a crawler source
   */
  async updateSource(id: string, updates: Partial<CrawlerSource>): Promise<CrawlerSource | undefined> {
    const existing = await this.getSourceById(id);
    if (!existing) return undefined;

    const updated: CrawlerSource = {
      ...existing,
      ...updates,
      id, // Ensure ID doesn't change
      updatedAt: Date.now(),
    };

    const sql = `
      UPDATE ${this.tableName}
      SET name = ?, url = ?, prompt = ?, schema = ?, requires_browser = ?,
          crawl_interval_hours = ?, is_enabled = ?, updated_at = ?
      WHERE id = ?
    `;

    this.db.prepare(sql).run(
      updated.name,
      updated.url,
      updated.prompt || null,
      updated.schema ? JSON.stringify(updated.schema) : null,
      updated.requiresBrowser ? 1 : 0,
      updated.crawlIntervalHours,
      updated.isEnabled ? 1 : 0,
      updated.updatedAt,
      id
    );

    await this.invalidateCachePattern(`${this.cachePrefix}:*`);
    await this.publishEvent("crawler_source_updated", { id });

    return updated;
  }

  /**
   * Delete a crawler source
   */
  async deleteSource(id: string): Promise<boolean> {
    const stmt = this.db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`);
    const result = stmt.run(id);

    if (result.changes > 0) {
      await this.invalidateCachePattern(`${this.cachePrefix}:*`);
      await this.publishEvent("crawler_source_deleted", { id });
      return true;
    }

    return false;
  }

  /**
   * Update crawl result for a source
   */
  async updateCrawlResult(
    id: string,
    result: {
      status: "success" | "error";
      itemCount?: number;
      error?: string;
    }
  ): Promise<void> {
    const sql = `
      UPDATE ${this.tableName}
      SET last_crawl_at = ?, last_crawl_status = ?, last_crawl_item_count = ?,
          last_crawl_error = ?, updated_at = ?
      WHERE id = ?
    `;

    this.db.prepare(sql).run(
      Date.now(),
      result.status,
      result.itemCount || null,
      result.error || null,
      Date.now(),
      id
    );

    await this.invalidateCache(this.entityCacheKey(id));
    await this.invalidateCachePattern(`${this.cachePrefix}:list:*`);
  }

  /**
   * Get sources due for crawling
   */
  async getSourcesDueForCrawl(): Promise<CrawlerSource[]> {
    const now = Date.now();

    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE is_enabled = 1
        AND (last_crawl_at IS NULL OR last_crawl_at < ? - (crawl_interval_hours * 3600000))
      ORDER BY last_crawl_at ASC NULLS FIRST
    `;

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(now) as CrawlerSourceRow[];

    return rows.map(rowToSource);
  }

  // ==========================================
  // Items CRUD
  // ==========================================

  /**
   * Get items for a source
   */
  async getItems(filter?: {
    sourceId?: string;
    projectId?: string;
    isProcessed?: boolean;
    limit?: number;
  }): Promise<CrawledItem[]> {
    let sql = "SELECT * FROM crawled_items WHERE 1=1";
    const params: unknown[] = [];

    if (filter?.sourceId) {
      sql += " AND source_id = ?";
      params.push(filter.sourceId);
    }

    if (filter?.projectId) {
      sql += " AND project_id = ?";
      params.push(filter.projectId);
    }

    if (filter?.isProcessed !== undefined) {
      sql += " AND is_processed = ?";
      params.push(filter.isProcessed ? 1 : 0);
    }

    sql += " ORDER BY extracted_at DESC";

    if (filter?.limit) {
      sql += " LIMIT ?";
      params.push(filter.limit);
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as CrawledItemRow[];

    return rows.map(rowToItem);
  }

  /**
   * Get item by ID
   */
  async getItemById(id: string): Promise<CrawledItem | undefined> {
    const stmt = this.db.prepare("SELECT * FROM crawled_items WHERE id = ?");
    const row = stmt.get(id) as CrawledItemRow | undefined;

    return row ? rowToItem(row) : undefined;
  }

  /**
   * Upsert crawled item
   */
  async upsertItem(item: CrawledItem): Promise<CrawledItem> {
    const sql = `
      INSERT INTO crawled_items (
        id, source_id, title, url, description, content,
        metadata, extracted_at, project_id, relevance_score, is_processed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source_id, url) DO UPDATE SET
        title = excluded.title,
        description = COALESCE(excluded.description, description),
        content = COALESCE(excluded.content, content),
        metadata = excluded.metadata,
        extracted_at = excluded.extracted_at
    `;

    this.db.prepare(sql).run(
      item.id,
      item.sourceId,
      item.title,
      item.url,
      item.description || null,
      item.content || null,
      JSON.stringify(item.metadata),
      item.extractedAt,
      item.projectId || null,
      item.relevanceScore || null,
      item.isProcessed ? 1 : 0
    );

    return item;
  }

  /**
   * Bulk upsert items
   */
  async bulkUpsertItems(items: CrawledItem[]): Promise<{ inserted: number; updated: number }> {
    let inserted = 0;
    let updated = 0;

    this.transaction(() => {
      for (const item of items) {
        // Check if exists
        const existing = this.db
          .prepare("SELECT id FROM crawled_items WHERE source_id = ? AND url = ?")
          .get(item.sourceId, item.url);

        if (existing) {
          updated++;
        } else {
          inserted++;
        }

        // Upsert
        const sql = `
          INSERT INTO crawled_items (
            id, source_id, title, url, description, content,
            metadata, extracted_at, project_id, relevance_score, is_processed
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(source_id, url) DO UPDATE SET
            title = excluded.title,
            description = COALESCE(excluded.description, description),
            content = COALESCE(excluded.content, content),
            metadata = excluded.metadata,
            extracted_at = excluded.extracted_at
        `;

        this.db.prepare(sql).run(
          item.id,
          item.sourceId,
          item.title,
          item.url,
          item.description || null,
          item.content || null,
          JSON.stringify(item.metadata),
          item.extractedAt,
          item.projectId || null,
          item.relevanceScore || null,
          item.isProcessed ? 1 : 0
        );
      }
    });

    await this.publishEvent("crawler_items_updated", { inserted, updated });

    return { inserted, updated };
  }

  /**
   * Mark item as processed
   */
  async markItemProcessed(id: string, projectId?: string, relevanceScore?: number): Promise<void> {
    const sql = `
      UPDATE crawled_items
      SET is_processed = 1, project_id = ?, relevance_score = ?
      WHERE id = ?
    `;

    this.db.prepare(sql).run(projectId || null, relevanceScore || null, id);
  }

  /**
   * Delete old items (older than X days)
   */
  async deleteOldItems(olderThanDays: number): Promise<number> {
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

    const stmt = this.db.prepare(
      "DELETE FROM crawled_items WHERE extracted_at < ? AND is_processed = 0"
    );
    const result = stmt.run(cutoff);

    return result.changes;
  }

  /**
   * Get crawler statistics
   */
  async getStats(): Promise<{
    totalSources: number;
    enabledSources: number;
    totalItems: number;
    processedItems: number;
    lastCrawlAt?: number;
  }> {
    const sourcesStmt = this.db.prepare(
      `SELECT COUNT(*) as total, SUM(CASE WHEN is_enabled = 1 THEN 1 ELSE 0 END) as enabled
       FROM ${this.tableName}`
    );
    const sourcesRow = sourcesStmt.get() as { total: number; enabled: number };

    const itemsStmt = this.db.prepare(
      `SELECT COUNT(*) as total, SUM(CASE WHEN is_processed = 1 THEN 1 ELSE 0 END) as processed
       FROM crawled_items`
    );
    const itemsRow = itemsStmt.get() as { total: number; processed: number };

    const lastCrawlStmt = this.db.prepare(
      `SELECT MAX(last_crawl_at) as last_crawl FROM ${this.tableName} WHERE last_crawl_at IS NOT NULL`
    );
    const lastCrawlRow = lastCrawlStmt.get() as { last_crawl: number | null };

    return {
      totalSources: sourcesRow.total,
      enabledSources: sourcesRow.enabled,
      totalItems: itemsRow.total,
      processedItems: itemsRow.processed,
      lastCrawlAt: lastCrawlRow.last_crawl || undefined,
    };
  }
}
