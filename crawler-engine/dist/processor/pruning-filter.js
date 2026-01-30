/**
 * Pruning Filter - Removes low-quality content blocks
 * Based on text density analysis (like Crawl4AI)
 */
import { DEFAULT_PRUNING_OPTIONS } from '../types.js';
export class PruningFilter {
    options;
    constructor(options = {}) {
        this.options = { ...DEFAULT_PRUNING_OPTIONS, ...options };
    }
    /**
     * Filter markdown content to remove low-quality blocks
     */
    filter(markdown) {
        // If pruning is disabled, return content as-is
        if (!this.options.enabled) {
            return markdown;
        }
        const blocks = this.splitIntoBlocks(markdown);
        const analyzed = blocks.map((block) => this.analyzeBlock(block));
        // Filter blocks
        const filtered = analyzed.filter((block) => this.shouldKeepBlock(block));
        // Reconstruct markdown
        return filtered.map((block) => block.content).join('\n\n');
    }
    /**
     * Split markdown into logical blocks
     */
    splitIntoBlocks(markdown) {
        // Split by double newlines (paragraphs)
        const rawBlocks = markdown.split(/\n{2,}/);
        // Merge consecutive headers with their content
        const blocks = [];
        let currentBlock = '';
        for (const rawBlock of rawBlocks) {
            const trimmed = rawBlock.trim();
            if (!trimmed)
                continue;
            const isHeader = /^#{1,6}\s/.test(trimmed);
            if (isHeader) {
                // If we have accumulated content, save it
                if (currentBlock.trim()) {
                    blocks.push(currentBlock.trim());
                }
                // Start new block with header
                currentBlock = trimmed;
            }
            else if (currentBlock && /^#{1,6}\s/.test(currentBlock.split('\n')[0])) {
                // Append to header block
                currentBlock += '\n\n' + trimmed;
                blocks.push(currentBlock.trim());
                currentBlock = '';
            }
            else {
                // Standalone paragraph
                if (currentBlock.trim()) {
                    blocks.push(currentBlock.trim());
                }
                currentBlock = trimmed;
            }
        }
        // Don't forget the last block
        if (currentBlock.trim()) {
            blocks.push(currentBlock.trim());
        }
        return blocks;
    }
    /**
     * Analyze a content block
     */
    analyzeBlock(content) {
        const text = this.extractPlainText(content);
        const wordCount = this.countWords(text);
        const textDensity = this.calculateTextDensity(content);
        const linkDensity = this.calculateLinkDensity(content);
        const isHeader = /^#{1,6}\s/.test(content);
        return {
            content,
            wordCount,
            textDensity,
            linkDensity,
            isHeader,
        };
    }
    /**
     * Decide whether to keep a block
     */
    shouldKeepBlock(block) {
        // Always keep headers (they provide structure)
        if (block.isHeader) {
            return true;
        }
        // Check for patterns that should always be removed
        for (const pattern of this.options.removePatterns) {
            if (pattern.test(block.content)) {
                return false;
            }
        }
        // Check for keywords that should always be kept
        if (this.options.keepKeywords.length > 0) {
            const lowerContent = block.content.toLowerCase();
            for (const keyword of this.options.keepKeywords) {
                if (lowerContent.includes(keyword.toLowerCase())) {
                    return true;
                }
            }
        }
        // Filter by word count
        if (block.wordCount < this.options.minWordCount) {
            return false;
        }
        // Filter by text density
        if (block.textDensity < this.options.minTextDensity) {
            return false;
        }
        // Filter by link density (too many links = probably navigation)
        if (block.linkDensity > this.options.maxLinkDensity) {
            return false;
        }
        return true;
    }
    /**
     * Extract plain text from markdown
     */
    extractPlainText(markdown) {
        let text = markdown;
        // Remove markdown formatting
        text = text.replace(/#{1,6}\s+/g, ''); // Headers
        text = text.replace(/\*\*([^*]+)\*\*/g, '$1'); // Bold
        text = text.replace(/\*([^*]+)\*/g, '$1'); // Italic
        text = text.replace(/__([^_]+)__/g, '$1'); // Bold
        text = text.replace(/_([^_]+)_/g, '$1'); // Italic
        text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Links
        text = text.replace(/!\[[^\]]*\]\([^)]+\)/g, ''); // Images
        text = text.replace(/`{1,3}[^`]*`{1,3}/g, ''); // Code
        text = text.replace(/^\s*[-*+]\s+/gm, ''); // List markers
        text = text.replace(/^\s*\d+\.\s+/gm, ''); // Numbered lists
        text = text.replace(/^\s*>\s+/gm, ''); // Blockquotes
        text = text.replace(/\|[^|]*\|/g, ''); // Tables
        return text.trim();
    }
    /**
     * Count words in text
     */
    countWords(text) {
        const words = text.split(/\s+/).filter((word) => word.length > 0);
        return words.length;
    }
    /**
     * Calculate text density (ratio of text to markdown formatting)
     */
    calculateTextDensity(markdown) {
        if (markdown.length === 0)
            return 0;
        const plainText = this.extractPlainText(markdown);
        const textLength = plainText.replace(/\s+/g, '').length;
        const totalLength = markdown.replace(/\s+/g, '').length;
        if (totalLength === 0)
            return 0;
        return textLength / totalLength;
    }
    /**
     * Calculate link density (ratio of link text to total text)
     */
    calculateLinkDensity(markdown) {
        const plainText = this.extractPlainText(markdown);
        const totalLength = plainText.length;
        if (totalLength === 0)
            return 0;
        // Find all links and calculate their text length
        const linkRegex = /\[([^\]]+)\]\([^)]+\)/g;
        let linkTextLength = 0;
        let match;
        while ((match = linkRegex.exec(markdown)) !== null) {
            linkTextLength += match[1].length;
        }
        return linkTextLength / totalLength;
    }
}
export function createPruningFilter(options) {
    return new PruningFilter(options);
}
//# sourceMappingURL=pruning-filter.js.map