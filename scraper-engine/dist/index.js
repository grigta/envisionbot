/**
 * Scraper Engine - AI-powered web scraper for competitive analysis
 *
 * @packageDocumentation
 */
// Re-export all types
export * from './types.js';
// Re-export crawler module
export * from './crawler/index.js';
// Re-export analyzer module
export * from './analyzer/index.js';
// Re-export AI module
export * from './ai/index.js';
// ============================================
// CONVENIENCE FUNCTIONS
// ============================================
import { CompetitorCrawler } from './crawler/competitor-crawler.js';
import { analyzeSEO } from './analyzer/seo-analyzer.js';
import { PositioningAnalyzer } from './ai/positioning-analyzer.js';
import { SWOTGenerator } from './ai/swot-generator.js';
import { RecommendationsGenerator } from './ai/recommendations.js';
/**
 * Run complete competitor analysis: crawl + analyze + AI insights
 */
export async function analyzeCompetitor(competitorId, domain, options = {}) {
    const { crawlConfig, openrouterApiKey, model, onCrawlProgress, } = options;
    // 1. Crawl the website
    const crawler = new CompetitorCrawler(competitorId, crawlConfig);
    const crawlResult = await crawler.crawl(domain, onCrawlProgress);
    if (!crawlResult.success || crawlResult.pages.length === 0) {
        throw new Error(`Crawl failed: ${crawlResult.errors.map((e) => e.message).join(', ')}`);
    }
    // 2. Analyze SEO
    const seoAnalysis = analyzeSEO(crawlResult.pages);
    // 3. Analyze structure
    const structureAnalysis = crawlResult.structure;
    // 4. Tech stack (already from crawl)
    const techStack = crawlResult.techStack;
    // 5. AI Analysis with OpenRouter
    const aiOptions = { openrouterApiKey, model };
    const positioningAnalyzer = new PositioningAnalyzer(aiOptions);
    const { analysis: positioning, tokensUsed: posTokens } = await positioningAnalyzer.analyze(domain, crawlResult.pages, techStack);
    const swotGenerator = new SWOTGenerator(aiOptions);
    const { analysis: swot, tokensUsed: swotTokens } = await swotGenerator.generate(domain, crawlResult.pages, techStack, seoAnalysis, structureAnalysis);
    const recommendationsGenerator = new RecommendationsGenerator(aiOptions);
    const { report: recReport, tokensUsed: recTokens } = await recommendationsGenerator.generate(positioning, swot, seoAnalysis, techStack);
    // Transform RecommendationsReport to CompetitiveRecommendations
    const categoryMap = {
        'positioning': 'positioning',
        'product': 'content',
        'marketing': 'marketing',
        'technology': 'technical',
        'operations': 'technical',
    };
    const recommendations = {
        recommendations: recReport.strategicRecommendations.map(r => ({
            title: r.title,
            description: r.description,
            priority: r.priority,
            category: categoryMap[r.category] || 'marketing',
            effort: r.effort,
            impact: r.impact,
            actionItems: [r.rationale],
        })),
        quickWins: recReport.quickWins.map(qw => `${qw.title}: ${qw.description}`),
        longTermStrategies: recReport.longTermInitiatives.map(lt => `${lt.title}: ${lt.description}`),
        gaps: (swot.weaknesses || []).map(w => typeof w === 'string' ? w : w.description || ''),
    };
    return {
        competitorId,
        domain,
        analyzedAt: Date.now(),
        positioning,
        swot,
        recommendations,
        seo: seoAnalysis,
        techStack,
        structure: structureAnalysis,
        modelUsed: model || 'google/gemini-3-flash-preview',
        tokensUsed: posTokens + swotTokens + recTokens,
    };
}
/**
 * Get package version
 */
export function getVersion() {
    return '1.0.0';
}
//# sourceMappingURL=index.js.map