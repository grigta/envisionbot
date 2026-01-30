/**
 * Markdown Converter - Converts HTML to Markdown for LLM processing
 * Uses Turndown library with custom rules
 */
import type { MarkdownOptions, MarkdownRule } from '../types.js';
export declare class MarkdownConverter {
    private turndown;
    private options;
    constructor(options?: Partial<MarkdownOptions>);
    private setupDefaultRules;
    private setupCustomRules;
    /**
     * Convert HTML to Markdown
     */
    convert(html: string): string;
    private postProcess;
    /**
     * Add a custom conversion rule
     */
    addRule(rule: MarkdownRule): void;
}
export declare function createMarkdownConverter(options?: Partial<MarkdownOptions>): MarkdownConverter;
//# sourceMappingURL=markdown.d.ts.map