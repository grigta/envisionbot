/**
 * Smart Chunker with Overlap Strategy
 * Based on LangChain's RecursiveCharacterTextSplitter
 * Splits large content intelligently while preserving context
 */
const DEFAULT_SEPARATORS = [
    '\n\n', // Paragraph breaks
    '\n', // Line breaks
    '. ', // Sentence endings
    '! ',
    '? ',
    '; ',
    ': ',
    ', ', // Clauses
    ' ', // Words
    '', // Characters
];
export class SmartChunker {
    options;
    constructor(options = {}) {
        this.options = {
            chunkSize: options.chunkSize ?? 2000,
            chunkOverlap: options.chunkOverlap ?? 400,
            separators: options.separators ?? DEFAULT_SEPARATORS,
            keepSeparator: options.keepSeparator ?? true,
        };
        // Validate options
        if (this.options.chunkOverlap >= this.options.chunkSize) {
            throw new Error('chunkOverlap must be less than chunkSize');
        }
    }
    /**
     * Split text into smart chunks with overlap
     */
    chunk(text) {
        if (!text || text.length === 0) {
            return [];
        }
        // If text is smaller than chunk size, return as single chunk
        if (text.length <= this.options.chunkSize) {
            return [{
                    content: text,
                    index: 0,
                    startChar: 0,
                    endChar: text.length,
                }];
        }
        // Recursively split using separators
        const splits = this.recursiveSplit(text, this.options.separators);
        // Merge splits into chunks with overlap
        return this.mergeWithOverlap(splits);
    }
    /**
     * Recursively split text using separators hierarchy
     */
    recursiveSplit(text, separators) {
        if (separators.length === 0) {
            return [text];
        }
        const [separator, ...restSeparators] = separators;
        const splits = [];
        if (separator === '') {
            // Character-level split
            return text.split('');
        }
        // Split by current separator
        const parts = text.split(separator);
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            // Add separator back if keepSeparator is true (except for last part)
            const textWithSeparator = this.options.keepSeparator && i < parts.length - 1
                ? part + separator
                : part;
            // If part is too large, recursively split with next separator
            if (textWithSeparator.length > this.options.chunkSize) {
                const subSplits = this.recursiveSplit(textWithSeparator, restSeparators);
                splits.push(...subSplits);
            }
            else if (textWithSeparator.trim().length > 0) {
                splits.push(textWithSeparator);
            }
        }
        return splits.filter(s => s.trim().length > 0);
    }
    /**
     * Merge splits into chunks with overlap to preserve context
     */
    mergeWithOverlap(splits) {
        const chunks = [];
        let currentChunk = '';
        let currentStart = 0;
        let chunkIndex = 0;
        for (let i = 0; i < splits.length; i++) {
            const split = splits[i];
            // If adding this split would exceed chunk size
            if (currentChunk.length + split.length > this.options.chunkSize && currentChunk.length > 0) {
                // Save current chunk
                chunks.push({
                    content: currentChunk.trim(),
                    index: chunkIndex++,
                    startChar: currentStart,
                    endChar: currentStart + currentChunk.length,
                });
                // Start new chunk with overlap from previous chunk
                const overlapText = this.getOverlapText(currentChunk);
                currentStart = currentStart + currentChunk.length - overlapText.length;
                currentChunk = overlapText + split;
            }
            else {
                // Add to current chunk
                currentChunk += split;
            }
        }
        // Don't forget the last chunk
        if (currentChunk.trim().length > 0) {
            chunks.push({
                content: currentChunk.trim(),
                index: chunkIndex,
                startChar: currentStart,
                endChar: currentStart + currentChunk.length,
            });
        }
        return chunks;
    }
    /**
     * Get overlap text from the end of a chunk
     */
    getOverlapText(text) {
        if (text.length <= this.options.chunkOverlap) {
            return text;
        }
        // Try to find a good break point (sentence, paragraph, etc.)
        const overlapStart = text.length - this.options.chunkOverlap;
        const overlapText = text.substring(overlapStart);
        // Try to find a sentence boundary in the overlap
        for (const separator of ['\n\n', '\n', '. ', '! ', '? ']) {
            const index = overlapText.indexOf(separator);
            if (index !== -1) {
                return overlapText.substring(index + separator.length);
            }
        }
        // No good break point found, use raw overlap
        return overlapText;
    }
}
/**
 * Factory function for creating a smart chunker
 */
export function createSmartChunker(options) {
    return new SmartChunker(options);
}
//# sourceMappingURL=smart-chunker.js.map