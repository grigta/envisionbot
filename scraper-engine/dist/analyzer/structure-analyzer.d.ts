import type { CrawledPage, SiteStructureNode, SiteStructureAnalysis } from '../types.js';
/**
 * Analyze site structure from crawled pages
 */
export declare function analyzeSiteStructure(pages: CrawledPage[]): SiteStructureAnalysis;
/**
 * Flatten tree structure to array
 */
export declare function flattenTree(node: SiteStructureNode): SiteStructureNode[];
/**
 * Get paths at specific depth
 */
export declare function getPathsAtDepth(node: SiteStructureNode, depth: number): SiteStructureNode[];
/**
 * Find node by path
 */
export declare function findNodeByPath(root: SiteStructureNode, path: string): SiteStructureNode | null;
/**
 * Get structure statistics
 */
export declare function getStructureStats(analysis: SiteStructureAnalysis): {
    avgDepth: number;
    avgPagesPerFolder: number;
    largestSection: string;
    deepestPath: string;
};
/**
 * Generate structure summary text
 */
export declare function generateStructureSummary(analysis: SiteStructureAnalysis): string;
//# sourceMappingURL=structure-analyzer.d.ts.map