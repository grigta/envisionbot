/**
 * Types for News Crawler
 */
export type NewsSource = "GitHub" | "HuggingFace" | "Replicate" | "Reddit";
/**
 * Raw item from hype.replicate.dev
 */
export interface HypeNewsItem {
    rank: number;
    title: string;
    url: string;
    source: NewsSource;
    metric: string;
    metricValue: number;
    description?: string;
}
/**
 * Details fetched from source page
 */
export interface NewsItemDetails {
    fullDescription?: string;
    technologies?: string[];
    useCases?: string[];
    author?: string;
    createdAt?: string;
    lastUpdated?: string;
    license?: string;
    topics?: string[];
    readmePreview?: string;
}
/**
 * AI-generated application analysis
 */
export interface AIApplicationAnalysis {
    /** Full summary in Russian Markdown format */
    summary?: string;
    applications: string[];
    projectIdeas: string[];
    targetAudience: string[];
    integrations: string[];
    analyzedAt: number;
}
/**
 * Full news item stored in database
 */
export interface NewsItem extends HypeNewsItem {
    id: string;
    details?: NewsItemDetails;
    aiAnalysis?: AIApplicationAnalysis;
    crawledAt: number;
    updatedAt: number;
    isActive: boolean;
}
/**
 * Database row representation
 */
export interface NewsItemRow {
    id: string;
    rank: number;
    title: string;
    url: string;
    source: string;
    metric: string;
    metric_value: number;
    description: string | null;
    full_description: string | null;
    technologies: string | null;
    use_cases: string | null;
    author: string | null;
    source_created_at: string | null;
    source_updated_at: string | null;
    license: string | null;
    topics: string | null;
    readme_preview: string | null;
    ai_summary: string | null;
    ai_applications: string | null;
    ai_project_ideas: string | null;
    ai_target_audience: string | null;
    ai_integrations: string | null;
    ai_analyzed_at: number | null;
    crawled_at: number;
    updated_at: number;
    is_active: number;
}
/**
 * Crawl history entry
 */
export interface CrawlHistory {
    id?: number;
    startedAt: number;
    completedAt?: number;
    status: "running" | "completed" | "failed";
    itemsFound: number;
    itemsUpdated?: number;
    itemsNew?: number;
    errors?: string[];
    durationMs?: number;
}
/**
 * Crawl result
 */
export interface CrawlResult {
    success: boolean;
    items: NewsItem[];
    newCount: number;
    updatedCount: number;
    errors: string[];
    crawledAt: number;
    durationMs: number;
}
/**
 * News statistics
 */
export interface NewsStats {
    totalItems: number;
    activeItems: number;
    bySource: Record<NewsSource, number>;
    lastCrawl?: CrawlHistory;
    analyzedCount: number;
}
/**
 * Crawl progress event
 */
export interface CrawlProgress {
    stage: "starting" | "fetching_list" | "fetching_details" | "analyzing" | "saving" | "completed" | "failed";
    current?: number;
    total?: number;
    message?: string;
}
//# sourceMappingURL=types.d.ts.map