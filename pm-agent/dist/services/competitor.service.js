/**
 * Competitor Service
 * Orchestrates competitor crawling, tech detection, and AI analysis
 * Uses the scraper-engine package for actual scraping and analysis
 */
import { CompetitorRepository, } from "../repositories/competitor.repository.js";
// Import from scraper-engine (local package)
import { CompetitorCrawler, analyzeSEO, PositioningAnalyzer, SWOTGenerator, RecommendationsGenerator, } from "scraper-engine";
// ============================================
// SERVICE
// ============================================
export class CompetitorService {
    repository;
    anthropicApiKey;
    anthropicAuthToken;
    useClaudeCli;
    model;
    proxyUrls;
    onCrawlProgress;
    onAnalysisProgress;
    activeCrawlers = new Map();
    constructor(deps, options = {}) {
        this.repository = new CompetitorRepository(deps);
        this.anthropicApiKey = options.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
        this.anthropicAuthToken = options.anthropicAuthToken;
        this.useClaudeCli = options.useClaudeCli; // undefined means auto-detect
        this.model = options.model || "claude-sonnet-4-20250514";
        this.proxyUrls = options.proxyUrls || [];
        this.onCrawlProgress = options.onCrawlProgress;
        this.onAnalysisProgress = options.onAnalysisProgress;
    }
    // ==========================================
    // COMPETITOR CRUD
    // ==========================================
    async getAll(filter) {
        return this.repository.getAll(filter);
    }
    async getById(id) {
        return this.repository.getById(id);
    }
    async getByDomain(domain) {
        return this.repository.getByDomain(domain);
    }
    async create(data) {
        const id = this.generateId();
        // Normalize domain (remove protocol, trailing slashes)
        const normalizedDomain = this.normalizeDomain(data.domain);
        // Check if domain already exists
        const existing = await this.repository.getByDomain(normalizedDomain);
        if (existing) {
            throw new Error(`Competitor with domain ${normalizedDomain} already exists`);
        }
        return this.repository.create({
            id,
            name: data.name,
            domain: normalizedDomain,
            description: data.description,
            industry: data.industry,
            status: "pending",
        });
    }
    async update(id, data) {
        if (data.domain) {
            data.domain = this.normalizeDomain(data.domain);
        }
        return this.repository.update(id, data);
    }
    async delete(id) {
        // Cancel any active crawl
        this.cancelCrawl(id);
        return this.repository.delete(id);
    }
    // ==========================================
    // CRAWLING
    // ==========================================
    async startCrawl(competitorId, options = {}) {
        const competitor = await this.repository.getById(competitorId);
        if (!competitor) {
            throw new Error(`Competitor ${competitorId} not found`);
        }
        // Create crawl job
        const jobId = this.generateId();
        const config = {
            depth: options.maxDepth ?? 2,
            maxPages: options.maxPages ?? 100,
            useSitemap: options.crawlSitemap ?? true,
            respectRobotsTxt: options.respectRobotsTxt ?? true,
            proxyRotation: (options.proxyUrls && options.proxyUrls.length > 0) || this.proxyUrls.length > 0,
            proxyList: options.proxyUrls || this.proxyUrls,
            userAgentRotation: true,
            minDelay: options.delayMin ?? 2000,
            maxDelay: options.delayMax ?? 5000,
            useHeadless: true,
            maxConcurrency: options.maxConcurrency ?? 3,
            maxRequestsPerMinute: options.requestsPerMinute ?? 20,
        };
        await this.repository.createCrawlJob({
            id: jobId,
            competitorId,
            status: "pending",
            config: config,
            startedAt: Date.now(),
        });
        // Update competitor status
        await this.repository.updateStatus(competitorId, "crawling");
        // Start crawl asynchronously
        this.executeCrawl(competitorId, jobId, competitor.domain, config).catch((error) => {
            console.error(`Crawl failed for ${competitorId}:`, error);
        });
        return { jobId, status: "started" };
    }
    async executeCrawl(competitorId, jobId, domain, config) {
        const emitProgress = (stage, message, extra) => {
            this.onCrawlProgress?.({
                competitorId,
                jobId,
                stage,
                message,
                ...extra,
            });
        };
        try {
            // Update job status
            await this.repository.updateCrawlJob(jobId, { status: "running" });
            emitProgress("starting", `Starting crawl of ${domain}...`);
            // Create crawler
            const crawler = new CompetitorCrawler(competitorId, config);
            this.activeCrawlers.set(competitorId, crawler);
            // Progress callback
            const progressCallback = (progress) => {
                emitProgress("crawling", `Crawling ${progress.currentUrl || domain}...`, {
                    pagesFound: progress.pagesFound,
                    pagesCrawled: progress.pagesCrawled
                });
                this.repository.updateCrawlJob(jobId, {
                    pagesFound: progress.pagesFound,
                    pagesCrawled: progress.pagesCrawled
                });
            };
            // Execute crawl
            emitProgress("crawling", `Crawling ${domain}...`);
            const result = await crawler.crawl(domain, progressCallback);
            // Remove from active crawlers
            this.activeCrawlers.delete(competitorId);
            if (!result.success || result.pages.length === 0) {
                throw new Error(result.errors.map((e) => e.message).join(", ") || "Crawl returned no pages");
            }
            // Save pages
            emitProgress("saving", `Saving ${result.pages.length} pages...`);
            await this.savePages(competitorId, jobId, result.pages);
            // Save tech stack
            emitProgress("detecting_tech", "Detecting technology stack...");
            await this.saveTechStack(competitorId, result.techStack);
            // Analyze and save site structure
            emitProgress("analyzing_structure", "Analyzing site structure...");
            await this.saveSiteStructure(competitorId, result.structure);
            // Update job as completed
            const durationMs = Date.now() - (result.job.startedAt || Date.now());
            await this.repository.updateCrawlJob(jobId, {
                status: "completed",
                pagesFound: result.pages.length,
                pagesCrawled: result.pages.length,
                completedAt: Date.now(),
                durationMs,
                errors: result.errors.length > 0 ? result.errors : undefined,
            });
            // Update competitor status
            await this.repository.update(competitorId, {
                status: "completed",
                lastCrawledAt: Date.now(),
            });
            emitProgress("completed", `Crawl completed! Found ${result.pages.length} pages.`);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`Crawl error for ${competitorId}:`, errorMessage);
            // Remove from active crawlers
            this.activeCrawlers.delete(competitorId);
            // Update job as failed
            await this.repository.updateCrawlJob(jobId, {
                status: "failed",
                completedAt: Date.now(),
                errors: [{ url: domain, message: errorMessage }],
            });
            // Update competitor status
            await this.repository.updateStatus(competitorId, "failed");
            emitProgress("failed", `Crawl failed: ${errorMessage}`, { error: errorMessage });
        }
    }
    async cancelCrawl(competitorId) {
        const crawler = this.activeCrawlers.get(competitorId);
        if (crawler) {
            crawler.abort();
            this.activeCrawlers.delete(competitorId);
            // Get active job and mark as cancelled
            const jobs = await this.repository.getCrawlJobsByCompetitor(competitorId);
            const activeJob = jobs.find((j) => j.status === "running" || j.status === "pending");
            if (activeJob) {
                await this.repository.updateCrawlJob(activeJob.id, {
                    status: "cancelled",
                    completedAt: Date.now(),
                });
            }
            await this.repository.updateStatus(competitorId, "pending");
            return true;
        }
        return false;
    }
    // ==========================================
    // DATA ACCESS
    // ==========================================
    async getCrawlJob(jobId) {
        return this.repository.getCrawlJob(jobId);
    }
    async getCrawlJobs(competitorId) {
        return this.repository.getCrawlJobsByCompetitor(competitorId);
    }
    async getPages(competitorId, filter) {
        return this.repository.getPages(competitorId, filter);
    }
    async getTechStack(competitorId) {
        return this.repository.getTechStack(competitorId);
    }
    async getSiteStructure(competitorId) {
        const structures = await this.repository.getSiteStructure(competitorId);
        const pageCount = await this.repository.getPageCount(competitorId);
        if (structures.length === 0) {
            return {
                competitorId,
                root: null,
                totalPages: pageCount,
                maxDepth: 0,
                patterns: { hasBlog: false, hasProducts: false, hasDocs: false, hasCategories: false },
                analyzedAt: Date.now(),
            };
        }
        // Build tree from flat structure
        const root = this.buildStructureTree(structures);
        const maxDepth = Math.max(...structures.map((s) => s.depth));
        // Detect patterns
        const paths = structures.map((s) => s.path.toLowerCase());
        const patterns = {
            hasBlog: paths.some((p) => p.includes("/blog") || p.includes("/posts") || p.includes("/articles")),
            hasProducts: paths.some((p) => p.includes("/product") || p.includes("/shop") || p.includes("/store")),
            hasDocs: paths.some((p) => p.includes("/docs") || p.includes("/documentation") || p.includes("/help")),
            hasCategories: paths.some((p) => p.includes("/category") || p.includes("/categories")),
        };
        return {
            competitorId,
            root,
            totalPages: pageCount,
            maxDepth,
            patterns,
            analyzedAt: Date.now(),
        };
    }
    // ==========================================
    // AI ANALYSIS
    // ==========================================
    async analyze(competitorId, analysisType = "full") {
        const competitor = await this.repository.getById(competitorId);
        if (!competitor) {
            throw new Error(`Competitor ${competitorId} not found`);
        }
        const emitProgress = (stage, message, error) => {
            this.onAnalysisProgress?.({
                competitorId,
                analysisType,
                stage,
                message,
                error,
            });
        };
        try {
            // Update status
            await this.repository.updateStatus(competitorId, "analyzing");
            emitProgress("starting", `Starting ${analysisType} analysis...`);
            // Get crawled data
            const pages = await this.repository.getPages(competitorId, { limit: 100 });
            const techStack = await this.repository.getTechStack(competitorId);
            const structureData = await this.getSiteStructure(competitorId);
            if (pages.length === 0) {
                throw new Error("No crawled pages found. Please run a crawl first.");
            }
            // Convert to scraper-engine format
            const scraperPages = this.convertPagesToScraperFormat(pages);
            const scraperTechStack = this.convertTechStackToScraperFormat(techStack);
            // Run SEO analysis
            const seoAnalysis = analyzeSEO(scraperPages);
            // AI Analysis options - using OpenRouter
            const aiOptions = {
                openrouterApiKey: process.env.OPENROUTER_API_KEY,
                model: process.env.OPENROUTER_MODEL || 'google/gemini-3-flash-preview',
            };
            let positioning = undefined;
            let swot = undefined;
            let recommendations = undefined;
            let tokensUsed = 0;
            // Positioning analysis
            if (analysisType === "positioning" || analysisType === "full") {
                emitProgress("positioning", "Analyzing market positioning...");
                const positioningAnalyzer = new PositioningAnalyzer(aiOptions);
                const posResult = await positioningAnalyzer.analyze(competitor.domain, scraperPages, scraperTechStack);
                positioning = posResult.analysis;
                tokensUsed += posResult.tokensUsed;
            }
            // SWOT analysis
            if (analysisType === "swot" || analysisType === "full") {
                emitProgress("swot", "Generating SWOT analysis...");
                const swotGenerator = new SWOTGenerator(aiOptions);
                // Build SiteStructureAnalysis from structureData
                const structureAnalysis = structureData.root ? {
                    totalPages: structureData.totalPages,
                    maxDepth: structureData.maxDepth,
                    rootNode: structureData.root,
                    topLevelFolders: structureData.root.children?.map(c => c.path) || [],
                    flatStructure: structureData.maxDepth <= 1,
                    hasProductCatalog: structureData.patterns.hasProducts,
                    hasBlog: structureData.patterns.hasBlog,
                    hasDocumentation: structureData.patterns.hasDocs,
                } : {
                    totalPages: 0,
                    maxDepth: 0,
                    rootNode: { path: "/", depth: 0, pageCount: 0, childCount: 0, nodeType: "root" },
                    topLevelFolders: [],
                    flatStructure: true,
                    hasProductCatalog: false,
                    hasBlog: false,
                    hasDocumentation: false,
                };
                const swotResult = await swotGenerator.generate(competitor.domain, scraperPages, scraperTechStack, seoAnalysis, structureAnalysis);
                swot = swotResult.analysis;
                tokensUsed += swotResult.tokensUsed;
            }
            // Recommendations
            if (analysisType === "recommendations" || analysisType === "full") {
                emitProgress("recommendations", "Generating recommendations...");
                const recsGenerator = new RecommendationsGenerator(aiOptions);
                const recsResult = await recsGenerator.generate(positioning, swot, seoAnalysis, scraperTechStack);
                recommendations = recsResult.report;
                tokensUsed += recsResult.tokensUsed;
            }
            // Build analysis object
            const analysis = {
                id: this.generateId(),
                competitorId,
                analysisType,
                positioningSummary: positioning?.valueProposition,
                valueProposition: positioning?.valueProposition,
                targetAudience: positioning?.targetAudience,
                keyMessages: positioning?.keyMessages,
                toneOfVoice: positioning?.tone,
                strengths: swot?.strengths,
                weaknesses: swot?.weaknesses,
                opportunities: swot?.opportunities,
                threats: swot?.threats,
                recommendations,
                seoScore: seoAnalysis.score,
                seoIssues: seoAnalysis.issues.map(issue => ({
                    type: issue.type,
                    severity: issue.type, // Map type to severity (both are 'error' | 'warning' | 'info')
                    message: issue.message,
                    pages: issue.affectedPages,
                })),
                seoOpportunities: seoAnalysis.opportunities,
                modelUsed: this.model,
                tokensUsed,
                generatedAt: Date.now(),
            };
            // Save analysis
            emitProgress("saving", "Saving analysis results...");
            await this.repository.saveAnalysis(analysis);
            // Update competitor status
            await this.repository.update(competitorId, {
                status: "completed",
                lastAnalyzedAt: Date.now(),
            });
            emitProgress("completed", "Analysis completed successfully!");
            return analysis;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`Analysis error for ${competitorId}:`, errorMessage);
            await this.repository.updateStatus(competitorId, "failed");
            emitProgress("failed", `Analysis failed: ${errorMessage}`, errorMessage);
            throw error;
        }
    }
    async getAnalysis(competitorId, type) {
        return this.repository.getAnalysis(competitorId, type);
    }
    async getAllAnalyses(competitorId) {
        return this.repository.getAllAnalyses(competitorId);
    }
    // ==========================================
    // REPORTS
    // ==========================================
    async generateReport(competitorIds, reportType, format, title) {
        // Gather data for all competitors
        const competitors = await Promise.all(competitorIds.map((id) => this.repository.getById(id)));
        const validCompetitors = competitors.filter((c) => c !== undefined);
        if (validCompetitors.length === 0) {
            throw new Error("No valid competitors found");
        }
        const analyses = await Promise.all(validCompetitors.map((c) => this.repository.getAnalysis(c.id)));
        // Generate report content based on format
        let content;
        const reportTitle = title || this.generateReportTitle(reportType, validCompetitors);
        if (format === "markdown") {
            content = this.generateMarkdownReport(validCompetitors, analyses, reportType);
        }
        else if (format === "html") {
            content = this.generateHtmlReport(validCompetitors, analyses, reportType);
        }
        else {
            content = JSON.stringify({
                competitors: validCompetitors,
                analyses,
                generatedAt: Date.now(),
            }, null, 2);
        }
        const report = {
            id: this.generateId(),
            competitorIds,
            reportType,
            title: reportTitle,
            format,
            content,
            summary: this.generateReportSummary(validCompetitors, analyses),
            createdAt: Date.now(),
            createdBy: "system",
        };
        return this.repository.createReport(report);
    }
    async getReport(id) {
        return this.repository.getReport(id);
    }
    async getReports(filter) {
        return this.repository.getReports(filter);
    }
    async deleteReport(id) {
        return this.repository.deleteReport(id);
    }
    // ==========================================
    // STATS
    // ==========================================
    async getStats() {
        return this.repository.getStats();
    }
    // ==========================================
    // PRIVATE HELPERS
    // ==========================================
    generateId() {
        return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    }
    normalizeDomain(domain) {
        // Remove protocol
        let normalized = domain.replace(/^https?:\/\//, "");
        // Remove www.
        normalized = normalized.replace(/^www\./, "");
        // Remove trailing slash
        normalized = normalized.replace(/\/$/, "");
        // Remove path
        normalized = normalized.split("/")[0];
        return normalized.toLowerCase();
    }
    async savePages(competitorId, jobId, pages) {
        // Clear existing pages
        await this.repository.deletePages(competitorId);
        // Convert and save new pages
        const convertedPages = pages.map((page) => ({
            id: page.id,
            competitorId,
            crawlJobId: jobId,
            url: page.url,
            path: page.path,
            depth: page.depth,
            statusCode: page.statusCode,
            contentType: page.contentType,
            title: page.seo?.title,
            metaDescription: page.seo?.metaDescription,
            metaKeywords: page.seo?.metaKeywords,
            canonicalUrl: page.seo?.canonicalUrl,
            ogTitle: page.seo?.ogTitle,
            ogDescription: page.seo?.ogDescription,
            ogImage: page.seo?.ogImage,
            h1Tags: page.headings?.h1,
            h2Tags: page.headings?.h2,
            h3Tags: page.headings?.h3,
            h4H6Tags: [...(page.headings?.h4 || []), ...(page.headings?.h5 || []), ...(page.headings?.h6 || [])],
            imagesCount: page.images?.length || 0,
            imagesWithoutAlt: page.images?.filter((i) => !i.alt).length || 0,
            imagesData: page.images,
            internalLinksCount: page.links?.filter((l) => !l.isExternal).length || 0,
            externalLinksCount: page.links?.filter((l) => l.isExternal).length || 0,
            linksData: page.links,
            wordCount: page.wordCount,
            textContent: page.textContent?.substring(0, 10000), // Limit text content
            responseTimeMs: page.responseTimeMs,
            crawledAt: page.crawledAt,
        }));
        await this.repository.savePages(convertedPages);
    }
    async saveTechStack(competitorId, techStack) {
        // Clear existing tech stack
        await this.repository.deleteTechStack(competitorId);
        // Save new tech stack
        const now = Date.now();
        const items = techStack.map((item) => ({
            competitorId,
            category: item.category,
            name: item.name,
            version: item.version,
            confidence: item.confidence,
            detectedBy: item.detectedBy,
            evidence: item.evidence ? [item.evidence] : undefined, // Convert string to array
            detectedAt: now,
        }));
        await this.repository.saveTechStack(items);
    }
    async saveSiteStructure(competitorId, structure) {
        // Clear existing structure
        await this.repository.deleteSiteStructure(competitorId);
        if (!structure?.root)
            return;
        // Flatten tree to array for storage
        const items = this.flattenStructureTree(competitorId, structure.root);
        await this.repository.saveSiteStructure(items);
    }
    flattenStructureTree(competitorId, node, parentPath) {
        const items = [];
        const children = node.children || [];
        items.push({
            competitorId,
            path: node.path,
            parentPath,
            depth: node.depth,
            pageCount: node.pageCount,
            childCount: children.length,
            nodeType: node.depth === 0 ? "root" : children.length > 0 ? "folder" : "page",
        });
        for (const child of children) {
            items.push(...this.flattenStructureTree(competitorId, child, node.path));
        }
        return items;
    }
    buildStructureTree(structures) {
        const root = structures.find((s) => s.nodeType === "root");
        if (!root)
            return null;
        const buildNode = (structure) => {
            const children = structures
                .filter((s) => s.parentPath === structure.path)
                .map(buildNode);
            return {
                path: structure.path,
                depth: structure.depth,
                pageCount: structure.pageCount,
                childCount: children.length,
                nodeType: structure.nodeType,
                children: children.length > 0 ? children : undefined,
                title: structure.path.split("/").pop() || "/",
            };
        };
        return buildNode(root);
    }
    convertPagesToScraperFormat(pages) {
        return pages.map((page) => ({
            id: page.id,
            competitorId: page.competitorId,
            crawlJobId: page.crawlJobId,
            url: page.url,
            path: page.path,
            depth: page.depth,
            statusCode: page.statusCode,
            contentType: page.contentType,
            seo: {
                title: page.title,
                metaDescription: page.metaDescription,
                metaKeywords: page.metaKeywords,
                canonicalUrl: page.canonicalUrl,
                ogTitle: page.ogTitle,
                ogDescription: page.ogDescription,
                ogImage: page.ogImage,
                hasStructuredData: false, // Default - we don't store this in CompetitorPage
            },
            headings: {
                h1: page.h1Tags || [],
                h2: page.h2Tags || [],
                h3: page.h3Tags || [],
                h4: [],
                h5: [],
                h6: [],
            },
            images: (page.imagesData || []).map(img => ({
                src: img.src,
                alt: img.alt,
                isLazyLoaded: img.isLazyLoaded || false,
            })),
            links: (page.linksData || []).map(link => ({
                href: link.href,
                text: link.text,
                isExternal: link.isExternal,
                isNofollow: link.isNofollow,
            })),
            wordCount: page.wordCount || 0,
            textContent: page.textContent,
            responseTimeMs: page.responseTimeMs,
            crawledAt: page.crawledAt,
        }));
    }
    convertTechStackToScraperFormat(techStack) {
        return techStack.map((item) => ({
            category: item.category,
            name: item.name,
            version: item.version,
            confidence: item.confidence,
            detectedBy: (item.detectedBy || "pattern"),
            evidence: item.evidence?.[0], // Convert array back to string
        }));
    }
    generateReportTitle(reportType, competitors) {
        const date = new Date().toISOString().split("T")[0];
        if (reportType === "single") {
            return `Competitive Analysis: ${competitors[0]?.name || "Unknown"} - ${date}`;
        }
        else if (reportType === "comparison") {
            return `Competitive Comparison: ${competitors.map((c) => c.name).join(" vs ")} - ${date}`;
        }
        else {
            return `Market Overview Report - ${date}`;
        }
    }
    generateReportSummary(competitors, analyses) {
        const analyzed = analyses.filter(Boolean).length;
        return `Report covering ${competitors.length} competitor(s) with ${analyzed} analysis(es) completed.`;
    }
    generateMarkdownReport(competitors, analyses, reportType) {
        let md = `# Competitive Analysis Report\n\n`;
        md += `Generated: ${new Date().toISOString()}\n\n`;
        for (let i = 0; i < competitors.length; i++) {
            const competitor = competitors[i];
            const analysis = analyses[i];
            md += `## ${competitor.name}\n\n`;
            md += `**Domain:** ${competitor.domain}\n`;
            md += `**Industry:** ${competitor.industry || "N/A"}\n`;
            md += `**Description:** ${competitor.description || "N/A"}\n\n`;
            if (analysis) {
                if (analysis.valueProposition) {
                    md += `### Value Proposition\n${analysis.valueProposition}\n\n`;
                }
                if (analysis.targetAudience?.length) {
                    md += `### Target Audience\n`;
                    analysis.targetAudience.forEach((ta) => (md += `- ${ta}\n`));
                    md += "\n";
                }
                if (analysis.strengths?.length) {
                    md += `### Strengths\n`;
                    analysis.strengths.forEach((s) => (md += `- **${s.point}**: ${s.evidence}\n`));
                    md += "\n";
                }
                if (analysis.weaknesses?.length) {
                    md += `### Weaknesses\n`;
                    analysis.weaknesses.forEach((w) => (md += `- **${w.point}**: ${w.evidence}\n`));
                    md += "\n";
                }
                if (analysis.seoScore !== undefined) {
                    md += `### SEO Score\n**${analysis.seoScore}/100**\n\n`;
                }
                if (analysis.recommendations?.length) {
                    md += `### Key Recommendations\n`;
                    analysis.recommendations.slice(0, 5).forEach((r) => {
                        md += `- **${r.title}** (${r.priority}): ${r.description}\n`;
                    });
                    md += "\n";
                }
            }
            else {
                md += `*Analysis not yet completed*\n\n`;
            }
            md += "---\n\n";
        }
        return md;
    }
    generateHtmlReport(competitors, analyses, reportType) {
        const md = this.generateMarkdownReport(competitors, analyses, reportType);
        // Simple markdown to HTML conversion (in real implementation, use a proper library)
        return `<!DOCTYPE html>
<html>
<head>
  <title>Competitive Analysis Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
    h1, h2, h3 { color: #333; }
    hr { border: none; border-top: 1px solid #eee; margin: 30px 0; }
    ul { padding-left: 20px; }
    li { margin: 5px 0; }
    strong { color: #222; }
  </style>
</head>
<body>
  <pre style="white-space: pre-wrap;">${md}</pre>
</body>
</html>`;
    }
}
//# sourceMappingURL=competitor.service.js.map