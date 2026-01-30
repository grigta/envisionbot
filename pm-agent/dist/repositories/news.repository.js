/**
 * News Repository
 * Handles CRUD operations for news items from hype.replicate.dev
 */
import { BaseRepository } from "./base.repository.js";
/**
 * Convert database row to NewsItem
 */
function rowToNewsItem(row) {
    return {
        id: row.id,
        rank: row.rank,
        title: row.title,
        url: row.url,
        source: row.source,
        metric: row.metric,
        metricValue: row.metric_value,
        description: row.description || undefined,
        details: {
            fullDescription: row.full_description || undefined,
            technologies: row.technologies ? JSON.parse(row.technologies) : undefined,
            useCases: row.use_cases ? JSON.parse(row.use_cases) : undefined,
            author: row.author || undefined,
            createdAt: row.source_created_at || undefined,
            lastUpdated: row.source_updated_at || undefined,
            license: row.license || undefined,
            topics: row.topics ? JSON.parse(row.topics) : undefined,
            readmePreview: row.readme_preview || undefined,
        },
        aiAnalysis: row.ai_analyzed_at
            ? {
                summary: row.ai_summary || undefined,
                applications: row.ai_applications ? JSON.parse(row.ai_applications) : [],
                projectIdeas: row.ai_project_ideas ? JSON.parse(row.ai_project_ideas) : [],
                targetAudience: row.ai_target_audience ? JSON.parse(row.ai_target_audience) : [],
                integrations: row.ai_integrations ? JSON.parse(row.ai_integrations) : [],
                analyzedAt: row.ai_analyzed_at,
            }
            : undefined,
        crawledAt: row.crawled_at,
        updatedAt: row.updated_at,
        isActive: row.is_active === 1,
    };
}
/**
 * Convert NewsItem to database row params
 */
function newsItemToParams(item) {
    return {
        id: item.id,
        rank: item.rank,
        title: item.title,
        url: item.url,
        source: item.source,
        metric: item.metric,
        metric_value: item.metricValue,
        description: item.description || null,
        full_description: item.details?.fullDescription || null,
        technologies: item.details?.technologies ? JSON.stringify(item.details.technologies) : null,
        use_cases: item.details?.useCases ? JSON.stringify(item.details.useCases) : null,
        author: item.details?.author || null,
        source_created_at: item.details?.createdAt || null,
        source_updated_at: item.details?.lastUpdated || null,
        license: item.details?.license || null,
        topics: item.details?.topics ? JSON.stringify(item.details.topics) : null,
        readme_preview: item.details?.readmePreview || null,
        ai_summary: item.aiAnalysis?.summary || null,
        ai_applications: item.aiAnalysis?.applications ? JSON.stringify(item.aiAnalysis.applications) : null,
        ai_project_ideas: item.aiAnalysis?.projectIdeas ? JSON.stringify(item.aiAnalysis.projectIdeas) : null,
        ai_target_audience: item.aiAnalysis?.targetAudience ? JSON.stringify(item.aiAnalysis.targetAudience) : null,
        ai_integrations: item.aiAnalysis?.integrations ? JSON.stringify(item.aiAnalysis.integrations) : null,
        ai_analyzed_at: item.aiAnalysis?.analyzedAt || null,
        crawled_at: item.crawledAt,
        updated_at: item.updatedAt,
        is_active: item.isActive ? 1 : 0,
    };
}
export class NewsRepository extends BaseRepository {
    tableName = "news_items";
    cachePrefix = "pm:news";
    cacheTTL = 300; // 5 minutes
    pubsubChannel = "pm:events:news";
    constructor(deps) {
        super(deps);
    }
    /**
     * Get all news items with optional filter
     */
    async getAll(filter) {
        const cacheKey = this.listCacheKey(filter ? `${filter.source || "all"}_${filter.isActive ?? "all"}_${filter.limit || "all"}` : "all");
        const cached = await this.getFromCache(cacheKey);
        if (cached)
            return cached;
        let sql = `SELECT * FROM ${this.tableName} WHERE 1=1`;
        const params = [];
        if (filter?.source) {
            sql += " AND source = ?";
            params.push(filter.source);
        }
        if (filter?.isActive !== undefined) {
            sql += " AND is_active = ?";
            params.push(filter.isActive ? 1 : 0);
        }
        sql += " ORDER BY rank ASC";
        if (filter?.limit) {
            sql += " LIMIT ?";
            params.push(filter.limit);
        }
        const stmt = this.db.prepare(sql);
        const rows = stmt.all(...params);
        const items = rows.map(rowToNewsItem);
        await this.setCache(cacheKey, items);
        return items;
    }
    /**
     * Get news item by ID
     */
    async getById(id) {
        const cacheKey = this.entityCacheKey(id);
        const cached = await this.getFromCache(cacheKey);
        if (cached)
            return cached;
        const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`);
        const row = stmt.get(id);
        if (!row)
            return undefined;
        const item = rowToNewsItem(row);
        await this.setCache(cacheKey, item);
        return item;
    }
    /**
     * Get top N active news items
     */
    async getTop(limit = 25) {
        return this.getAll({ isActive: true, limit });
    }
    /**
     * Get news item by rank
     */
    async getByRank(rank) {
        const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE rank = ? AND is_active = 1`);
        const row = stmt.get(rank);
        return row ? rowToNewsItem(row) : undefined;
    }
    /**
     * Upsert a news item (insert or update)
     */
    async upsert(item) {
        const params = newsItemToParams(item);
        const sql = `
      INSERT INTO ${this.tableName} (
        id, rank, title, url, source, metric, metric_value, description,
        full_description, technologies, use_cases, author, source_created_at,
        source_updated_at, license, topics, readme_preview,
        ai_summary, ai_applications, ai_project_ideas, ai_target_audience, ai_integrations, ai_analyzed_at,
        crawled_at, updated_at, is_active
      ) VALUES (
        $id, $rank, $title, $url, $source, $metric, $metric_value, $description,
        $full_description, $technologies, $use_cases, $author, $source_created_at,
        $source_updated_at, $license, $topics, $readme_preview,
        $ai_summary, $ai_applications, $ai_project_ideas, $ai_target_audience, $ai_integrations, $ai_analyzed_at,
        $crawled_at, $updated_at, $is_active
      )
      ON CONFLICT(id) DO UPDATE SET
        rank = excluded.rank,
        title = excluded.title,
        source = excluded.source,
        metric = excluded.metric,
        metric_value = excluded.metric_value,
        description = COALESCE(excluded.description, description),
        full_description = COALESCE(excluded.full_description, full_description),
        technologies = COALESCE(excluded.technologies, technologies),
        use_cases = COALESCE(excluded.use_cases, use_cases),
        author = COALESCE(excluded.author, author),
        source_created_at = COALESCE(excluded.source_created_at, source_created_at),
        source_updated_at = COALESCE(excluded.source_updated_at, source_updated_at),
        license = COALESCE(excluded.license, license),
        topics = COALESCE(excluded.topics, topics),
        readme_preview = COALESCE(excluded.readme_preview, readme_preview),
        ai_summary = COALESCE(excluded.ai_summary, ai_summary),
        ai_applications = COALESCE(excluded.ai_applications, ai_applications),
        ai_project_ideas = COALESCE(excluded.ai_project_ideas, ai_project_ideas),
        ai_target_audience = COALESCE(excluded.ai_target_audience, ai_target_audience),
        ai_integrations = COALESCE(excluded.ai_integrations, ai_integrations),
        ai_analyzed_at = COALESCE(excluded.ai_analyzed_at, ai_analyzed_at),
        updated_at = excluded.updated_at,
        is_active = excluded.is_active
    `;
        const stmt = this.db.prepare(sql);
        stmt.run(params);
        await this.invalidateCachePattern(`${this.cachePrefix}:*`);
        await this.publishEvent("news_updated", { id: item.id });
        return item;
    }
    /**
     * Bulk upsert items
     */
    async bulkUpsert(items) {
        let inserted = 0;
        let updated = 0;
        this.transaction(() => {
            for (const item of items) {
                // Check if exists
                const existing = this.db
                    .prepare(`SELECT id FROM ${this.tableName} WHERE id = ?`)
                    .get(item.id);
                if (existing) {
                    updated++;
                }
                else {
                    inserted++;
                }
                // Use upsert logic inline (without cache operations for bulk)
                const params = newsItemToParams(item);
                const sql = `
          INSERT INTO ${this.tableName} (
            id, rank, title, url, source, metric, metric_value, description,
            full_description, technologies, use_cases, author, source_created_at,
            source_updated_at, license, topics, readme_preview,
            ai_summary, ai_applications, ai_project_ideas, ai_target_audience, ai_integrations, ai_analyzed_at,
            crawled_at, updated_at, is_active
          ) VALUES (
            $id, $rank, $title, $url, $source, $metric, $metric_value, $description,
            $full_description, $technologies, $use_cases, $author, $source_created_at,
            $source_updated_at, $license, $topics, $readme_preview,
            $ai_summary, $ai_applications, $ai_project_ideas, $ai_target_audience, $ai_integrations, $ai_analyzed_at,
            $crawled_at, $updated_at, $is_active
          )
          ON CONFLICT(id) DO UPDATE SET
            rank = excluded.rank,
            title = excluded.title,
            source = excluded.source,
            metric = excluded.metric,
            metric_value = excluded.metric_value,
            description = COALESCE(excluded.description, description),
            full_description = COALESCE(excluded.full_description, full_description),
            technologies = COALESCE(excluded.technologies, technologies),
            use_cases = COALESCE(excluded.use_cases, use_cases),
            author = COALESCE(excluded.author, author),
            updated_at = excluded.updated_at,
            is_active = excluded.is_active
        `;
                this.db.prepare(sql).run(params);
            }
        });
        await this.invalidateCachePattern(`${this.cachePrefix}:*`);
        await this.publishEvent("news_bulk_updated", { inserted, updated });
        return { inserted, updated };
    }
    /**
     * Mark items as inactive (fell out of top)
     */
    async markInactive(excludeIds) {
        const placeholders = excludeIds.map(() => "?").join(",");
        const sql = `
      UPDATE ${this.tableName}
      SET is_active = 0, updated_at = ?
      WHERE is_active = 1 AND id NOT IN (${placeholders})
    `;
        const stmt = this.db.prepare(sql);
        const result = stmt.run(Date.now(), ...excludeIds);
        await this.invalidateCachePattern(`${this.cachePrefix}:*`);
        return result.changes;
    }
    /**
     * Update AI analysis for a news item
     */
    async updateAIAnalysis(id, analysis) {
        const sql = `
      UPDATE ${this.tableName}
      SET
        ai_summary = ?,
        ai_applications = ?,
        ai_project_ideas = ?,
        ai_target_audience = ?,
        ai_integrations = ?,
        ai_analyzed_at = ?,
        updated_at = ?
      WHERE id = ?
    `;
        const stmt = this.db.prepare(sql);
        stmt.run(analysis.summary || null, JSON.stringify(analysis.applications), JSON.stringify(analysis.projectIdeas), JSON.stringify(analysis.targetAudience), JSON.stringify(analysis.integrations), analysis.analyzedAt, Date.now(), id);
        await this.invalidateCache(this.entityCacheKey(id));
        await this.invalidateCachePattern(`${this.cachePrefix}:list:*`);
        await this.publishEvent("news_analyzed", { id });
    }
    /**
     * Get crawl history
     */
    async getCrawlHistory(limit = 10) {
        const stmt = this.db.prepare(`
      SELECT * FROM news_crawl_history
      ORDER BY started_at DESC
      LIMIT ?
    `);
        const rows = stmt.all(limit);
        return rows.map((row) => ({
            id: row.id,
            startedAt: row.started_at,
            completedAt: row.completed_at || undefined,
            status: row.status,
            itemsFound: row.items_found,
            itemsUpdated: row.items_updated || undefined,
            itemsNew: row.items_new || undefined,
            errors: row.errors ? JSON.parse(row.errors) : undefined,
            durationMs: row.duration_ms || undefined,
        }));
    }
    /**
     * Get last crawl
     */
    async getLastCrawl() {
        const history = await this.getCrawlHistory(1);
        return history[0];
    }
    /**
     * Save crawl history entry
     */
    async saveCrawlHistory(history) {
        if (history.id) {
            // Update existing
            const sql = `
        UPDATE news_crawl_history
        SET completed_at = ?, status = ?, items_found = ?, items_updated = ?,
            items_new = ?, errors = ?, duration_ms = ?
        WHERE id = ?
      `;
            this.db.prepare(sql).run(history.completedAt || null, history.status, history.itemsFound, history.itemsUpdated || null, history.itemsNew || null, history.errors ? JSON.stringify(history.errors) : null, history.durationMs || null, history.id);
            return history.id;
        }
        else {
            // Insert new
            const sql = `
        INSERT INTO news_crawl_history (started_at, status, items_found)
        VALUES (?, ?, ?)
      `;
            const result = this.db.prepare(sql).run(history.startedAt, history.status, history.itemsFound);
            return Number(result.lastInsertRowid);
        }
    }
    /**
     * Get statistics
     */
    async getStats() {
        const totalStmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${this.tableName}`);
        const activeStmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${this.tableName} WHERE is_active = 1`);
        const analyzedStmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${this.tableName} WHERE ai_analyzed_at IS NOT NULL`);
        const bySourceStmt = this.db.prepare(`
      SELECT source, COUNT(*) as count FROM ${this.tableName}
      WHERE is_active = 1
      GROUP BY source
    `);
        const total = totalStmt.get().count;
        const active = activeStmt.get().count;
        const analyzed = analyzedStmt.get().count;
        const bySourceRows = bySourceStmt.all();
        const bySource = {
            GitHub: 0,
            HuggingFace: 0,
            Replicate: 0,
            Reddit: 0,
        };
        for (const row of bySourceRows) {
            bySource[row.source] = row.count;
        }
        const lastCrawl = await this.getLastCrawl();
        return {
            totalItems: total,
            activeItems: active,
            bySource,
            lastCrawl,
            analyzedCount: analyzed,
        };
    }
}
//# sourceMappingURL=news.repository.js.map