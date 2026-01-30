/**
 * Competitor Repository
 * Handles CRUD operations for competitor analysis (Guerrilla Marketing)
 */
import { BaseRepository, type RepositoryDeps, type PubSubChannel } from "./base.repository.js";
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
    errors?: Array<{
        url: string;
        message: string;
    }>;
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
    title?: string;
    metaDescription?: string;
    metaKeywords?: string;
    canonicalUrl?: string;
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    h1Tags?: string[];
    h2Tags?: string[];
    h3Tags?: string[];
    h4H6Tags?: string[];
    imagesCount?: number;
    imagesWithoutAlt?: number;
    imagesData?: Array<{
        src: string;
        alt?: string;
        isLazyLoaded?: boolean;
    }>;
    internalLinksCount?: number;
    externalLinksCount?: number;
    linksData?: Array<{
        href: string;
        text: string;
        isExternal: boolean;
        isNofollow: boolean;
    }>;
    wordCount?: number;
    textContent?: string;
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
    positioningSummary?: string;
    valueProposition?: string;
    targetAudience?: string[];
    keyMessages?: string[];
    toneOfVoice?: string;
    strengths?: Array<{
        point: string;
        evidence: string;
    }>;
    weaknesses?: Array<{
        point: string;
        evidence: string;
    }>;
    opportunities?: Array<{
        point: string;
        rationale: string;
    }>;
    threats?: Array<{
        point: string;
        rationale: string;
    }>;
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
    seoScore?: number;
    seoIssues?: Array<{
        type: string;
        severity: string;
        message: string;
        pages?: string[];
    }>;
    seoOpportunities?: string[];
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
export declare class CompetitorRepository extends BaseRepository<Competitor> {
    protected readonly tableName = "competitors";
    protected readonly cachePrefix = "pm:competitors";
    protected readonly cacheTTL = 300;
    protected readonly pubsubChannel: PubSubChannel;
    constructor(deps: RepositoryDeps);
    getAll(filter?: {
        status?: CompetitorStatus;
        limit?: number;
    }): Promise<Competitor[]>;
    getById(id: string): Promise<Competitor | undefined>;
    getByDomain(domain: string): Promise<Competitor | undefined>;
    create(data: Omit<Competitor, "createdAt" | "updatedAt">): Promise<Competitor>;
    update(id: string, data: Partial<Competitor>): Promise<Competitor | undefined>;
    delete(id: string): Promise<boolean>;
    updateStatus(id: string, status: CompetitorStatus): Promise<void>;
    createCrawlJob(job: Omit<CompetitorCrawlJob, "pagesFound" | "pagesCrawled">): Promise<CompetitorCrawlJob>;
    getCrawlJob(id: string): Promise<CompetitorCrawlJob | undefined>;
    getCrawlJobsByCompetitor(competitorId: string): Promise<CompetitorCrawlJob[]>;
    updateCrawlJob(id: string, data: Partial<CompetitorCrawlJob>): Promise<void>;
    savePage(page: CompetitorPage): Promise<void>;
    savePages(pages: CompetitorPage[]): Promise<void>;
    getPages(competitorId: string, filter?: {
        path?: string;
        depth?: number;
        limit?: number;
    }): Promise<CompetitorPage[]>;
    getPageCount(competitorId: string): Promise<number>;
    deletePages(competitorId: string): Promise<void>;
    saveTechStack(items: CompetitorTechStack[]): Promise<void>;
    getTechStack(competitorId: string): Promise<CompetitorTechStack[]>;
    deleteTechStack(competitorId: string): Promise<void>;
    saveSiteStructure(items: CompetitorSiteStructure[]): Promise<void>;
    getSiteStructure(competitorId: string): Promise<CompetitorSiteStructure[]>;
    deleteSiteStructure(competitorId: string): Promise<void>;
    saveAnalysis(analysis: CompetitorAnalysis): Promise<void>;
    getAnalysis(competitorId: string, type?: AnalysisType): Promise<CompetitorAnalysis | undefined>;
    getAllAnalyses(competitorId: string): Promise<CompetitorAnalysis[]>;
    createReport(report: CompetitorReport): Promise<CompetitorReport>;
    getReport(id: string): Promise<CompetitorReport | undefined>;
    getReports(filter?: {
        type?: ReportType;
        limit?: number;
    }): Promise<CompetitorReport[]>;
    deleteReport(id: string): Promise<boolean>;
    getStats(): Promise<{
        total: number;
        byStatus: Record<CompetitorStatus, number>;
        totalPages: number;
        totalAnalyses: number;
        totalReports: number;
    }>;
}
//# sourceMappingURL=competitor.repository.d.ts.map