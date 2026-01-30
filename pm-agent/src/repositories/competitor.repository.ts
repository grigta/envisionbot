/**
 * Competitor Repository
 * Handles CRUD operations for competitor analysis (Guerrilla Marketing)
 */

import { BaseRepository, type RepositoryDeps, type PubSubChannel } from "./base.repository.js";

// ============================================
// TYPES
// ============================================

export type CompetitorStatus = "pending" | "crawling" | "analyzing" | "completed" | "failed";
export type CrawlJobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type AnalysisType = "positioning" | "swot" | "recommendations" | "full";
export type ReportType = "single" | "comparison" | "market_overview";
export type ReportFormat = "json" | "markdown" | "html";

export interface Competitor {
  id: string;
  name: string;
  domain: string;
  description?: string;
  industry?: string;
  status: CompetitorStatus;
  createdAt: number;
  updatedAt: number;
  lastCrawledAt?: number;
  lastAnalyzedAt?: number;
}

export interface CompetitorCrawlJob {
  id: string;
  competitorId: string;
  status: CrawlJobStatus;
  config: Record<string, unknown>;
  pagesFound: number;
  pagesCrawled: number;
  errors?: Array<{ url: string; message: string }>;
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
}

export interface CompetitorPage {
  id: string;
  competitorId: string;
  crawlJobId?: string;
  url: string;
  path: string;
  depth: number;
  statusCode?: number;
  contentType?: string;
  // SEO
  title?: string;
  metaDescription?: string;
  metaKeywords?: string;
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  // Headings
  h1Tags?: string[];
  h2Tags?: string[];
  h3Tags?: string[];
  h4H6Tags?: string[];
  // Images
  imagesCount?: number;
  imagesWithoutAlt?: number;
  imagesData?: Array<{ src: string; alt?: string; isLazyLoaded?: boolean }>;
  // Links
  internalLinksCount?: number;
  externalLinksCount?: number;
  linksData?: Array<{ href: string; text: string; isExternal: boolean; isNofollow: boolean }>;
  // Content
  wordCount?: number;
  textContent?: string;
  // Performance
  responseTimeMs?: number;
  crawledAt: number;
}

export interface CompetitorTechStack {
  id?: number;
  competitorId: string;
  category: string;
  name: string;
  version?: string;
  confidence: number;
  detectedBy?: string;
  evidence?: string[];
  detectedAt: number;
}

export interface CompetitorSiteStructure {
  id?: number;
  competitorId: string;
  path: string;
  parentPath?: string;
  depth: number;
  pageCount: number;
  childCount: number;
  nodeType: "page" | "folder" | "root";
}

export interface CompetitorAnalysis {
  id: string;
  competitorId: string;
  analysisType: AnalysisType;
  // Positioning
  positioningSummary?: string;
  valueProposition?: string;
  targetAudience?: string[];
  keyMessages?: string[];
  toneOfVoice?: string;
  // SWOT
  strengths?: Array<{ point: string; evidence: string }>;
  weaknesses?: Array<{ point: string; evidence: string }>;
  opportunities?: Array<{ point: string; rationale: string }>;
  threats?: Array<{ point: string; rationale: string }>;
  // Recommendations
  recommendations?: Array<{
    id: string;
    title: string;
    description: string;
    priority: string;
    category: string;
    effort: string;
    impact: string;
    actionItems: string[];
  }>;
  // SEO
  seoScore?: number;
  seoIssues?: Array<{ type: string; severity: string; message: string; pages?: string[] }>;
  seoOpportunities?: string[];
  // Metadata
  modelUsed?: string;
  tokensUsed?: number;
  generatedAt: number;
  expiresAt?: number;
}

export interface CompetitorReport {
  id: string;
  competitorIds: string[];
  reportType: ReportType;
  title: string;
  format: ReportFormat;
  content: string;
  summary?: string;
  createdAt: number;
  createdBy?: string;
}

// ============================================
// ROW TYPES (Database representation)
// ============================================

interface CompetitorRow {
  id: string;
  name: string;
  domain: string;
  description: string | null;
  industry: string | null;
  status: string;
  created_at: number;
  updated_at: number;
  last_crawled_at: number | null;
  last_analyzed_at: number | null;
}

interface CrawlJobRow {
  id: string;
  competitor_id: string;
  status: string;
  config: string;
  pages_found: number;
  pages_crawled: number;
  errors: string | null;
  started_at: number | null;
  completed_at: number | null;
  duration_ms: number | null;
}

interface PageRow {
  id: string;
  competitor_id: string;
  crawl_job_id: string | null;
  url: string;
  path: string;
  depth: number;
  status_code: number | null;
  content_type: string | null;
  title: string | null;
  meta_description: string | null;
  meta_keywords: string | null;
  canonical_url: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  h1_tags: string | null;
  h2_tags: string | null;
  h3_tags: string | null;
  h4_h6_tags: string | null;
  images_count: number | null;
  images_without_alt: number | null;
  images_data: string | null;
  internal_links_count: number | null;
  external_links_count: number | null;
  links_data: string | null;
  word_count: number | null;
  text_content: string | null;
  response_time_ms: number | null;
  crawled_at: number;
}

interface TechStackRow {
  id: number;
  competitor_id: string;
  category: string;
  name: string;
  version: string | null;
  confidence: number;
  detected_by: string | null;
  evidence: string | null;
  detected_at: number;
}

interface SiteStructureRow {
  id: number;
  competitor_id: string;
  path: string;
  parent_path: string | null;
  depth: number;
  page_count: number;
  child_count: number;
  node_type: string;
}

interface AnalysisRow {
  id: string;
  competitor_id: string;
  analysis_type: string;
  positioning_summary: string | null;
  value_proposition: string | null;
  target_audience: string | null;
  key_messages: string | null;
  tone_of_voice: string | null;
  strengths: string | null;
  weaknesses: string | null;
  opportunities: string | null;
  threats: string | null;
  recommendations: string | null;
  action_items: string | null;
  quick_wins: string | null;
  seo_score: number | null;
  seo_issues: string | null;
  seo_opportunities: string | null;
  model_used: string | null;
  tokens_used: number | null;
  generated_at: number;
  expires_at: number | null;
}

interface ReportRow {
  id: string;
  competitor_ids: string;
  report_type: string;
  title: string;
  format: string;
  content: string;
  summary: string | null;
  created_at: number;
  created_by: string | null;
}

// ============================================
// CONVERSION FUNCTIONS
// ============================================

function rowToCompetitor(row: CompetitorRow): Competitor {
  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    description: row.description || undefined,
    industry: row.industry || undefined,
    status: row.status as CompetitorStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastCrawledAt: row.last_crawled_at || undefined,
    lastAnalyzedAt: row.last_analyzed_at || undefined,
  };
}

function rowToCrawlJob(row: CrawlJobRow): CompetitorCrawlJob {
  return {
    id: row.id,
    competitorId: row.competitor_id,
    status: row.status as CrawlJobStatus,
    config: row.config ? JSON.parse(row.config) : {},
    pagesFound: row.pages_found,
    pagesCrawled: row.pages_crawled,
    errors: row.errors ? JSON.parse(row.errors) : undefined,
    startedAt: row.started_at || undefined,
    completedAt: row.completed_at || undefined,
    durationMs: row.duration_ms || undefined,
  };
}

function rowToPage(row: PageRow): CompetitorPage {
  return {
    id: row.id,
    competitorId: row.competitor_id,
    crawlJobId: row.crawl_job_id || undefined,
    url: row.url,
    path: row.path,
    depth: row.depth,
    statusCode: row.status_code || undefined,
    contentType: row.content_type || undefined,
    title: row.title || undefined,
    metaDescription: row.meta_description || undefined,
    metaKeywords: row.meta_keywords || undefined,
    canonicalUrl: row.canonical_url || undefined,
    ogTitle: row.og_title || undefined,
    ogDescription: row.og_description || undefined,
    ogImage: row.og_image || undefined,
    h1Tags: row.h1_tags ? JSON.parse(row.h1_tags) : undefined,
    h2Tags: row.h2_tags ? JSON.parse(row.h2_tags) : undefined,
    h3Tags: row.h3_tags ? JSON.parse(row.h3_tags) : undefined,
    h4H6Tags: row.h4_h6_tags ? JSON.parse(row.h4_h6_tags) : undefined,
    imagesCount: row.images_count || undefined,
    imagesWithoutAlt: row.images_without_alt || undefined,
    imagesData: row.images_data ? JSON.parse(row.images_data) : undefined,
    internalLinksCount: row.internal_links_count || undefined,
    externalLinksCount: row.external_links_count || undefined,
    linksData: row.links_data ? JSON.parse(row.links_data) : undefined,
    wordCount: row.word_count || undefined,
    textContent: row.text_content || undefined,
    responseTimeMs: row.response_time_ms || undefined,
    crawledAt: row.crawled_at,
  };
}

function rowToTechStack(row: TechStackRow): CompetitorTechStack {
  return {
    id: row.id,
    competitorId: row.competitor_id,
    category: row.category,
    name: row.name,
    version: row.version || undefined,
    confidence: row.confidence,
    detectedBy: row.detected_by || undefined,
    evidence: row.evidence ? JSON.parse(row.evidence) : undefined,
    detectedAt: row.detected_at,
  };
}

function rowToSiteStructure(row: SiteStructureRow): CompetitorSiteStructure {
  return {
    id: row.id,
    competitorId: row.competitor_id,
    path: row.path,
    parentPath: row.parent_path || undefined,
    depth: row.depth,
    pageCount: row.page_count,
    childCount: row.child_count,
    nodeType: row.node_type as "page" | "folder" | "root",
  };
}

function rowToAnalysis(row: AnalysisRow): CompetitorAnalysis {
  return {
    id: row.id,
    competitorId: row.competitor_id,
    analysisType: row.analysis_type as AnalysisType,
    positioningSummary: row.positioning_summary || undefined,
    valueProposition: row.value_proposition || undefined,
    targetAudience: row.target_audience ? JSON.parse(row.target_audience) : undefined,
    keyMessages: row.key_messages ? JSON.parse(row.key_messages) : undefined,
    toneOfVoice: row.tone_of_voice || undefined,
    strengths: row.strengths ? JSON.parse(row.strengths) : undefined,
    weaknesses: row.weaknesses ? JSON.parse(row.weaknesses) : undefined,
    opportunities: row.opportunities ? JSON.parse(row.opportunities) : undefined,
    threats: row.threats ? JSON.parse(row.threats) : undefined,
    recommendations: row.recommendations ? JSON.parse(row.recommendations) : undefined,
    seoScore: row.seo_score || undefined,
    seoIssues: row.seo_issues ? JSON.parse(row.seo_issues) : undefined,
    seoOpportunities: row.seo_opportunities ? JSON.parse(row.seo_opportunities) : undefined,
    modelUsed: row.model_used || undefined,
    tokensUsed: row.tokens_used || undefined,
    generatedAt: row.generated_at,
    expiresAt: row.expires_at || undefined,
  };
}

function rowToReport(row: ReportRow): CompetitorReport {
  return {
    id: row.id,
    competitorIds: JSON.parse(row.competitor_ids),
    reportType: row.report_type as ReportType,
    title: row.title,
    format: row.format as ReportFormat,
    content: row.content,
    summary: row.summary || undefined,
    createdAt: row.created_at,
    createdBy: row.created_by || undefined,
  };
}

// ============================================
// REPOSITORY
// ============================================

export class CompetitorRepository extends BaseRepository<Competitor> {
  protected readonly tableName = "competitors";
  protected readonly cachePrefix = "pm:competitors";
  protected readonly cacheTTL = 300; // 5 minutes
  protected readonly pubsubChannel = "pm:events:analysis" as PubSubChannel;

  constructor(deps: RepositoryDeps) {
    super(deps);
  }

  // ==========================================
  // COMPETITOR CRUD
  // ==========================================

  async getAll(filter?: {
    status?: CompetitorStatus;
    limit?: number;
  }): Promise<Competitor[]> {
    const cacheKey = this.listCacheKey(
      filter ? `${filter.status || "all"}_${filter.limit || "all"}` : "all"
    );

    const cached = await this.getFromCache<Competitor[]>(cacheKey);
    if (cached) return cached;

    let sql = `SELECT * FROM ${this.tableName} WHERE 1=1`;
    const params: unknown[] = [];

    if (filter?.status) {
      sql += " AND status = ?";
      params.push(filter.status);
    }

    sql += " ORDER BY updated_at DESC";

    if (filter?.limit) {
      sql += " LIMIT ?";
      params.push(filter.limit);
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as CompetitorRow[];
    const items = rows.map(rowToCompetitor);

    await this.setCache(cacheKey, items);
    return items;
  }

  async getById(id: string): Promise<Competitor | undefined> {
    const cacheKey = this.entityCacheKey(id);

    const cached = await this.getFromCache<Competitor>(cacheKey);
    if (cached) return cached;

    const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`);
    const row = stmt.get(id) as CompetitorRow | undefined;

    if (!row) return undefined;

    const item = rowToCompetitor(row);
    await this.setCache(cacheKey, item);
    return item;
  }

  async getByDomain(domain: string): Promise<Competitor | undefined> {
    const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE domain = ?`);
    const row = stmt.get(domain) as CompetitorRow | undefined;
    return row ? rowToCompetitor(row) : undefined;
  }

  async create(data: Omit<Competitor, "createdAt" | "updatedAt">): Promise<Competitor> {
    const now = Date.now();
    const competitor: Competitor = {
      ...data,
      createdAt: now,
      updatedAt: now,
    };

    const sql = `
      INSERT INTO ${this.tableName} (
        id, name, domain, description, industry, status,
        created_at, updated_at, last_crawled_at, last_analyzed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    this.db.prepare(sql).run(
      competitor.id,
      competitor.name,
      competitor.domain,
      competitor.description || null,
      competitor.industry || null,
      competitor.status,
      competitor.createdAt,
      competitor.updatedAt,
      competitor.lastCrawledAt || null,
      competitor.lastAnalyzedAt || null
    );

    await this.invalidateCachePattern(`${this.cachePrefix}:*`);
    await this.publishEvent("competitor_created", { id: competitor.id });

    return competitor;
  }

  async update(id: string, data: Partial<Competitor>): Promise<Competitor | undefined> {
    const existing = await this.getById(id);
    if (!existing) return undefined;

    const updated: Competitor = {
      ...existing,
      ...data,
      id, // Ensure ID doesn't change
      updatedAt: Date.now(),
    };

    const sql = `
      UPDATE ${this.tableName}
      SET name = ?, domain = ?, description = ?, industry = ?, status = ?,
          updated_at = ?, last_crawled_at = ?, last_analyzed_at = ?
      WHERE id = ?
    `;

    this.db.prepare(sql).run(
      updated.name,
      updated.domain,
      updated.description || null,
      updated.industry || null,
      updated.status,
      updated.updatedAt,
      updated.lastCrawledAt || null,
      updated.lastAnalyzedAt || null,
      id
    );

    await this.invalidateCachePattern(`${this.cachePrefix}:*`);
    await this.publishEvent("competitor_updated", { id });

    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const result = this.db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`).run(id);

    if (result.changes > 0) {
      await this.invalidateCachePattern(`${this.cachePrefix}:*`);
      await this.publishEvent("competitor_deleted", { id });
      return true;
    }

    return false;
  }

  async updateStatus(id: string, status: CompetitorStatus): Promise<void> {
    const now = Date.now();
    const updates: Record<string, unknown> = { status, updated_at: now };

    if (status === "completed") {
      updates.last_crawled_at = now;
    }

    const sql = `UPDATE ${this.tableName} SET status = ?, updated_at = ? WHERE id = ?`;
    this.db.prepare(sql).run(status, now, id);

    await this.invalidateCachePattern(`${this.cachePrefix}:*`);
    await this.publishEvent("competitor_updated", { id, status });
  }

  // ==========================================
  // CRAWL JOBS
  // ==========================================

  async createCrawlJob(job: Omit<CompetitorCrawlJob, "pagesFound" | "pagesCrawled">): Promise<CompetitorCrawlJob> {
    const fullJob: CompetitorCrawlJob = {
      ...job,
      pagesFound: 0,
      pagesCrawled: 0,
    };

    const sql = `
      INSERT INTO competitor_crawl_jobs (
        id, competitor_id, status, config, pages_found, pages_crawled, errors, started_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    this.db.prepare(sql).run(
      fullJob.id,
      fullJob.competitorId,
      fullJob.status,
      JSON.stringify(fullJob.config),
      fullJob.pagesFound,
      fullJob.pagesCrawled,
      fullJob.errors ? JSON.stringify(fullJob.errors) : null,
      fullJob.startedAt || null
    );

    return fullJob;
  }

  async getCrawlJob(id: string): Promise<CompetitorCrawlJob | undefined> {
    const stmt = this.db.prepare(`SELECT * FROM competitor_crawl_jobs WHERE id = ?`);
    const row = stmt.get(id) as CrawlJobRow | undefined;
    return row ? rowToCrawlJob(row) : undefined;
  }

  async getCrawlJobsByCompetitor(competitorId: string): Promise<CompetitorCrawlJob[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM competitor_crawl_jobs
      WHERE competitor_id = ?
      ORDER BY started_at DESC
    `);
    const rows = stmt.all(competitorId) as CrawlJobRow[];
    return rows.map(rowToCrawlJob);
  }

  async updateCrawlJob(id: string, data: Partial<CompetitorCrawlJob>): Promise<void> {
    const sets: string[] = [];
    const params: unknown[] = [];

    if (data.status !== undefined) {
      sets.push("status = ?");
      params.push(data.status);
    }
    if (data.pagesFound !== undefined) {
      sets.push("pages_found = ?");
      params.push(data.pagesFound);
    }
    if (data.pagesCrawled !== undefined) {
      sets.push("pages_crawled = ?");
      params.push(data.pagesCrawled);
    }
    if (data.errors !== undefined) {
      sets.push("errors = ?");
      params.push(JSON.stringify(data.errors));
    }
    if (data.completedAt !== undefined) {
      sets.push("completed_at = ?");
      params.push(data.completedAt);
    }
    if (data.durationMs !== undefined) {
      sets.push("duration_ms = ?");
      params.push(data.durationMs);
    }

    if (sets.length === 0) return;

    params.push(id);
    const sql = `UPDATE competitor_crawl_jobs SET ${sets.join(", ")} WHERE id = ?`;
    this.db.prepare(sql).run(...params);
  }

  // ==========================================
  // PAGES
  // ==========================================

  async savePage(page: CompetitorPage): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO competitor_crawled_pages (
        id, competitor_id, crawl_job_id, url, path, depth,
        status_code, content_type, title, meta_description, meta_keywords,
        canonical_url, og_title, og_description, og_image,
        h1_tags, h2_tags, h3_tags, h4_h6_tags,
        images_count, images_without_alt, images_data,
        internal_links_count, external_links_count, links_data,
        word_count, text_content, response_time_ms, crawled_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    this.db.prepare(sql).run(
      page.id,
      page.competitorId,
      page.crawlJobId || null,
      page.url,
      page.path,
      page.depth,
      page.statusCode || null,
      page.contentType || null,
      page.title || null,
      page.metaDescription || null,
      page.metaKeywords || null,
      page.canonicalUrl || null,
      page.ogTitle || null,
      page.ogDescription || null,
      page.ogImage || null,
      page.h1Tags ? JSON.stringify(page.h1Tags) : null,
      page.h2Tags ? JSON.stringify(page.h2Tags) : null,
      page.h3Tags ? JSON.stringify(page.h3Tags) : null,
      page.h4H6Tags ? JSON.stringify(page.h4H6Tags) : null,
      page.imagesCount || null,
      page.imagesWithoutAlt || null,
      page.imagesData ? JSON.stringify(page.imagesData) : null,
      page.internalLinksCount || null,
      page.externalLinksCount || null,
      page.linksData ? JSON.stringify(page.linksData) : null,
      page.wordCount || null,
      page.textContent || null,
      page.responseTimeMs || null,
      page.crawledAt
    );
  }

  async savePages(pages: CompetitorPage[]): Promise<void> {
    this.transaction(() => {
      for (const page of pages) {
        this.savePage(page);
      }
    });
  }

  async getPages(
    competitorId: string,
    filter?: { path?: string; depth?: number; limit?: number }
  ): Promise<CompetitorPage[]> {
    let sql = `SELECT * FROM competitor_crawled_pages WHERE competitor_id = ?`;
    const params: unknown[] = [competitorId];

    if (filter?.path) {
      sql += ` AND path LIKE ?`;
      params.push(`${filter.path}%`);
    }
    if (filter?.depth !== undefined) {
      sql += ` AND depth = ?`;
      params.push(filter.depth);
    }

    sql += ` ORDER BY path ASC`;

    if (filter?.limit) {
      sql += ` LIMIT ?`;
      params.push(filter.limit);
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as PageRow[];
    return rows.map(rowToPage);
  }

  async getPageCount(competitorId: string): Promise<number> {
    const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM competitor_crawled_pages WHERE competitor_id = ?`);
    const result = stmt.get(competitorId) as { count: number };
    return result.count;
  }

  async deletePages(competitorId: string): Promise<void> {
    this.db.prepare(`DELETE FROM competitor_crawled_pages WHERE competitor_id = ?`).run(competitorId);
  }

  // ==========================================
  // TECH STACK
  // ==========================================

  async saveTechStack(items: CompetitorTechStack[]): Promise<void> {
    this.transaction(() => {
      for (const item of items) {
        const sql = `
          INSERT OR REPLACE INTO competitor_tech_stack (
            competitor_id, category, name, version, confidence, detected_by, evidence, detected_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        this.db.prepare(sql).run(
          item.competitorId,
          item.category,
          item.name,
          item.version || null,
          item.confidence,
          item.detectedBy || null,
          item.evidence ? JSON.stringify(item.evidence) : null,
          item.detectedAt
        );
      }
    });
  }

  async getTechStack(competitorId: string): Promise<CompetitorTechStack[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM competitor_tech_stack
      WHERE competitor_id = ?
      ORDER BY category, confidence DESC
    `);
    const rows = stmt.all(competitorId) as TechStackRow[];
    return rows.map(rowToTechStack);
  }

  async deleteTechStack(competitorId: string): Promise<void> {
    this.db.prepare(`DELETE FROM competitor_tech_stack WHERE competitor_id = ?`).run(competitorId);
  }

  // ==========================================
  // SITE STRUCTURE
  // ==========================================

  async saveSiteStructure(items: CompetitorSiteStructure[]): Promise<void> {
    this.transaction(() => {
      for (const item of items) {
        const sql = `
          INSERT OR REPLACE INTO competitor_site_structure (
            competitor_id, path, parent_path, depth, page_count, child_count, node_type
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        this.db.prepare(sql).run(
          item.competitorId,
          item.path,
          item.parentPath || null,
          item.depth,
          item.pageCount,
          item.childCount,
          item.nodeType
        );
      }
    });
  }

  async getSiteStructure(competitorId: string): Promise<CompetitorSiteStructure[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM competitor_site_structure
      WHERE competitor_id = ?
      ORDER BY depth, path
    `);
    const rows = stmt.all(competitorId) as SiteStructureRow[];
    return rows.map(rowToSiteStructure);
  }

  async deleteSiteStructure(competitorId: string): Promise<void> {
    this.db.prepare(`DELETE FROM competitor_site_structure WHERE competitor_id = ?`).run(competitorId);
  }

  // ==========================================
  // ANALYSIS
  // ==========================================

  async saveAnalysis(analysis: CompetitorAnalysis): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO competitor_analysis (
        id, competitor_id, analysis_type,
        positioning_summary, value_proposition, target_audience, key_messages, tone_of_voice,
        strengths, weaknesses, opportunities, threats,
        recommendations, action_items, quick_wins,
        seo_score, seo_issues, seo_opportunities,
        model_used, tokens_used, generated_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    this.db.prepare(sql).run(
      analysis.id,
      analysis.competitorId,
      analysis.analysisType,
      analysis.positioningSummary || null,
      analysis.valueProposition || null,
      analysis.targetAudience ? JSON.stringify(analysis.targetAudience) : null,
      analysis.keyMessages ? JSON.stringify(analysis.keyMessages) : null,
      analysis.toneOfVoice || null,
      analysis.strengths ? JSON.stringify(analysis.strengths) : null,
      analysis.weaknesses ? JSON.stringify(analysis.weaknesses) : null,
      analysis.opportunities ? JSON.stringify(analysis.opportunities) : null,
      analysis.threats ? JSON.stringify(analysis.threats) : null,
      analysis.recommendations ? JSON.stringify(analysis.recommendations) : null,
      null, // action_items - extracted from recommendations
      null, // quick_wins - extracted from recommendations
      analysis.seoScore || null,
      analysis.seoIssues ? JSON.stringify(analysis.seoIssues) : null,
      analysis.seoOpportunities ? JSON.stringify(analysis.seoOpportunities) : null,
      analysis.modelUsed || null,
      analysis.tokensUsed || null,
      analysis.generatedAt,
      analysis.expiresAt || null
    );

    await this.publishEvent("competitor_analyzed", { id: analysis.competitorId });
  }

  async getAnalysis(competitorId: string, type?: AnalysisType): Promise<CompetitorAnalysis | undefined> {
    let sql = `
      SELECT * FROM competitor_analysis
      WHERE competitor_id = ?
    `;
    const params: unknown[] = [competitorId];

    if (type) {
      sql += ` AND analysis_type = ?`;
      params.push(type);
    }

    sql += ` ORDER BY generated_at DESC LIMIT 1`;

    const stmt = this.db.prepare(sql);
    const row = stmt.get(...params) as AnalysisRow | undefined;
    return row ? rowToAnalysis(row) : undefined;
  }

  async getAllAnalyses(competitorId: string): Promise<CompetitorAnalysis[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM competitor_analysis
      WHERE competitor_id = ?
      ORDER BY generated_at DESC
    `);
    const rows = stmt.all(competitorId) as AnalysisRow[];
    return rows.map(rowToAnalysis);
  }

  // ==========================================
  // REPORTS
  // ==========================================

  async createReport(report: CompetitorReport): Promise<CompetitorReport> {
    const sql = `
      INSERT INTO competitor_reports (
        id, competitor_ids, report_type, title, format, content, summary, created_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    this.db.prepare(sql).run(
      report.id,
      JSON.stringify(report.competitorIds),
      report.reportType,
      report.title,
      report.format,
      report.content,
      report.summary || null,
      report.createdAt,
      report.createdBy || null
    );

    await this.publishEvent("competitor_report_generated", { id: report.id });
    return report;
  }

  async getReport(id: string): Promise<CompetitorReport | undefined> {
    const stmt = this.db.prepare(`SELECT * FROM competitor_reports WHERE id = ?`);
    const row = stmt.get(id) as ReportRow | undefined;
    return row ? rowToReport(row) : undefined;
  }

  async getReports(filter?: { type?: ReportType; limit?: number }): Promise<CompetitorReport[]> {
    let sql = `SELECT * FROM competitor_reports WHERE 1=1`;
    const params: unknown[] = [];

    if (filter?.type) {
      sql += ` AND report_type = ?`;
      params.push(filter.type);
    }

    sql += ` ORDER BY created_at DESC`;

    if (filter?.limit) {
      sql += ` LIMIT ?`;
      params.push(filter.limit);
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as ReportRow[];
    return rows.map(rowToReport);
  }

  async deleteReport(id: string): Promise<boolean> {
    const result = this.db.prepare(`DELETE FROM competitor_reports WHERE id = ?`).run(id);
    return result.changes > 0;
  }

  // ==========================================
  // STATS
  // ==========================================

  async getStats(): Promise<{
    total: number;
    byStatus: Record<CompetitorStatus, number>;
    totalPages: number;
    totalAnalyses: number;
    totalReports: number;
  }> {
    const totalStmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${this.tableName}`);
    const byStatusStmt = this.db.prepare(`SELECT status, COUNT(*) as count FROM ${this.tableName} GROUP BY status`);
    const pagesStmt = this.db.prepare(`SELECT COUNT(*) as count FROM competitor_crawled_pages`);
    const analysesStmt = this.db.prepare(`SELECT COUNT(*) as count FROM competitor_analysis`);
    const reportsStmt = this.db.prepare(`SELECT COUNT(*) as count FROM competitor_reports`);

    const total = (totalStmt.get() as { count: number }).count;
    const byStatusRows = byStatusStmt.all() as Array<{ status: string; count: number }>;
    const totalPages = (pagesStmt.get() as { count: number }).count;
    const totalAnalyses = (analysesStmt.get() as { count: number }).count;
    const totalReports = (reportsStmt.get() as { count: number }).count;

    const byStatus: Record<CompetitorStatus, number> = {
      pending: 0,
      crawling: 0,
      analyzing: 0,
      completed: 0,
      failed: 0,
    };

    for (const row of byStatusRows) {
      byStatus[row.status as CompetitorStatus] = row.count;
    }

    return {
      total,
      byStatus,
      totalPages,
      totalAnalyses,
      totalReports,
    };
  }
}
