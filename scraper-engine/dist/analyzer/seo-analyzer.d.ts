import type { CrawledPage, SEOAnalysisResult, SEOIssue } from '../types.js';
/**
 * Analyze SEO across all crawled pages
 */
export declare function analyzeSEO(pages: CrawledPage[]): SEOAnalysisResult;
/**
 * Get severity color for issue
 */
export declare function getIssueSeverityColor(type: SEOIssue['type']): string;
/**
 * Get score color
 */
export declare function getScoreColor(score: number): string;
/**
 * Get score label
 */
export declare function getScoreLabel(score: number): string;
//# sourceMappingURL=seo-analyzer.d.ts.map