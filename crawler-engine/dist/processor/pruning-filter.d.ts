/**
 * Pruning Filter - Removes low-quality content blocks
 * Based on text density analysis (like Crawl4AI)
 */
import type { PruningOptions } from '../types.js';
export declare class PruningFilter {
    private options;
    constructor(options?: Partial<PruningOptions>);
    /**
     * Filter markdown content to remove low-quality blocks
     */
    filter(markdown: string): string;
    /**
     * Split markdown into logical blocks
     */
    private splitIntoBlocks;
    /**
     * Analyze a content block
     */
    private analyzeBlock;
    /**
     * Decide whether to keep a block
     */
    private shouldKeepBlock;
    /**
     * Extract plain text from markdown
     */
    private extractPlainText;
    /**
     * Count words in text
     */
    private countWords;
    /**
     * Calculate text density (ratio of text to markdown formatting)
     */
    private calculateTextDensity;
    /**
     * Calculate link density (ratio of link text to total text)
     */
    private calculateLinkDensity;
}
export declare function createPruningFilter(options?: Partial<PruningOptions>): PruningFilter;
//# sourceMappingURL=pruning-filter.d.ts.map