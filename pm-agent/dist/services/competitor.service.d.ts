/**
 * Competitor Service
 * Orchestrates competitor crawling, tech detection, and AI analysis
 * Uses the scraper-engine package for actual scraping and analysis
 */
import type { RepositoryDeps } from "../db/index.js";
import { type Competitor, type CompetitorCrawlJob, type CompetitorPage, type CompetitorTechStack, type CompetitorAnalysis, type CompetitorReport, type CompetitorStatus, type AnalysisType, type ReportType, type ReportFormat } from "../repositories/competitor.repository.js";
import { type SiteStructureNode } from "scraper-engine";
export interface CrawlOptions {
    maxDepth?: number;
    maxPages?: number;
    crawlSitemap?: boolean;
    respectRobotsTxt?: boolean;
    requestsPerMinute?: number;
    maxConcurrency?: number;
    proxyUrls?: string[];
    userAgent?: string;
    delayMin?: number;
    delayMax?: number;
}
export interface CrawlProgressEvent {
    competitorId: string;
    jobId: string;
    stage: "starting" | "crawling" | "extracting" | "detecting_tech" | "analyzing_structure" | "saving" | "completed" | "failed";
    pagesFound?: number;
    pagesCrawled?: number;
    message: string;
    error?: string;
}
export interface AnalysisProgressEvent {
    competitorId: string;
    analysisType: AnalysisType;
    stage: "starting" | "positioning" | "swot" | "recommendations" | "saving" | "completed" | "failed";
    message: string;
    error?: string;
}
export interface CompetitorServiceOptions {
    anthropicApiKey?: string;
    anthropicAuthToken?: string;
    useClaudeCli?: boolean;
    model?: string;
    proxyUrls?: string[];
    onCrawlProgress?: (event: CrawlProgressEvent) => void;
    onAnalysisProgress?: (event: AnalysisProgressEvent) => void;
}
export declare class CompetitorService {
    private repository;
    private anthropicApiKey?;
    private anthropicAuthToken?;
    private useClaudeCli?;
    private model;
    private proxyUrls;
    private onCrawlProgress?;
    private onAnalysisProgress?;
    private activeCrawlers;
    constructor(deps: RepositoryDeps, options?: CompetitorServiceOptions);
    getAll(filter?: {
        status?: CompetitorStatus;
        limit?: number;
    }): Promise<Competitor[]>;
    getById(id: string): Promise<Competitor | undefined>;
    getByDomain(domain: string): Promise<Competitor | undefined>;
    create(data: {
        name: string;
        domain: string;
        description?: string;
        industry?: string;
    }): Promise<Competitor>;
    update(id: string, data: Partial<Competitor>): Promise<Competitor | undefined>;
    delete(id: string): Promise<boolean>;
    startCrawl(competitorId: string, options?: CrawlOptions): Promise<{
        jobId: string;
        status: string;
    }>;
    private executeCrawl;
    cancelCrawl(competitorId: string): Promise<boolean>;
    getCrawlJob(jobId: string): Promise<CompetitorCrawlJob | undefined>;
    getCrawlJobs(competitorId: string): Promise<CompetitorCrawlJob[]>;
    getPages(competitorId: string, filter?: {
        path?: string;
        depth?: number;
        limit?: number;
    }): Promise<CompetitorPage[]>;
    getTechStack(competitorId: string): Promise<CompetitorTechStack[]>;
    getSiteStructure(competitorId: string): Promise<{
        competitorId: string;
        root: SiteStructureNode | null;
        totalPages: number;
        maxDepth: number;
        patterns: {
            hasBlog: boolean;
            hasProducts: boolean;
            hasDocs: boolean;
            hasCategories: boolean;
        };
        analyzedAt: number;
    }>;
    analyze(competitorId: string, analysisType?: AnalysisType): Promise<CompetitorAnalysis>;
    getAnalysis(competitorId: string, type?: AnalysisType): Promise<CompetitorAnalysis | undefined>;
    getAllAnalyses(competitorId: string): Promise<CompetitorAnalysis[]>;
    generateReport(competitorIds: string[], reportType: ReportType, format: ReportFormat, title?: string): Promise<CompetitorReport>;
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
    private generateId;
    private normalizeDomain;
    private savePages;
    private saveTechStack;
    private saveSiteStructure;
    private flattenStructureTree;
    private buildStructureTree;
    private convertPagesToScraperFormat;
    private convertTechStackToScraperFormat;
    private generateReportTitle;
    private generateReportSummary;
    private generateMarkdownReport;
    private generateHtmlReport;
}
//# sourceMappingURL=competitor.service.d.ts.map