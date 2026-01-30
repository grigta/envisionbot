/**
 * HTML Cleaner - Removes unwanted elements from HTML
 * Inspired by Crawl4AI's content cleaning approach
 */
import type { CleanerOptions } from '../types.js';
export declare class HTMLCleaner {
    private options;
    constructor(options?: Partial<CleanerOptions>);
    /**
     * Clean HTML by removing unwanted elements
     */
    clean(html: string): string;
    /**
     * Extract only the body content (without html/head)
     */
    cleanBody(html: string): string;
    private removeComments;
    private removeAdElements;
    private keepMainContentOnly;
    private removeEmptyElements;
    private cleanAttributes;
}
export declare function createHTMLCleaner(options?: Partial<CleanerOptions>): HTMLCleaner;
//# sourceMappingURL=html-cleaner.d.ts.map