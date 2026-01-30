/**
 * Content Chunker - Splits large content into manageable chunks for LLM
 * Preserves context by including headers and using overlap
 */
import { DEFAULT_CHUNK_OPTIONS } from '../types.js';
export class Chunker {
    options;
    constructor(options = {}) {
        this.options = { ...DEFAULT_CHUNK_OPTIONS, ...options };
    }
    /**
     * Split content into chunks
     */
    chunk(content) {
        const tokenCount = this.estimateTokens(content);
        // If content fits in a single chunk, return as is
        if (tokenCount <= this.options.maxTokens) {
            return [
                {
                    index: 0,
                    content,
                    tokenCount,
                    startOffset: 0,
                    endOffset: content.length,
                },
            ];
        }
        // Choose chunking strategy
        switch (this.options.chunkBy) {
            case 'paragraphs':
                return this.chunkByParagraphs(content);
            case 'sentences':
                return this.chunkBySentences(content);
            case 'tokens':
            default:
                return this.chunkByTokens(content);
        }
    }
    /**
     * Chunk by estimated token count
     */
    chunkByTokens(content) {
        const chunks = [];
        const words = content.split(/\s+/);
        const wordsPerChunk = Math.floor(this.options.maxTokens * 0.75); // ~0.75 words per token
        const overlapWords = Math.floor(this.options.overlapTokens * 0.75);
        let currentHeader = '';
        let start = 0;
        let chunkIndex = 0;
        while (start < words.length) {
            const end = Math.min(start + wordsPerChunk, words.length);
            let chunkWords = words.slice(start, end);
            // Find current header for context
            const headerMatch = chunkWords.join(' ').match(/^(#{1,6}\s+.+?)(?:\n|$)/m);
            if (headerMatch) {
                currentHeader = headerMatch[1];
            }
            // Prepend header for context if not at start
            let chunkContent = chunkWords.join(' ');
            if (this.options.preserveHeaders && currentHeader && start > 0) {
                if (!chunkContent.startsWith('#')) {
                    chunkContent = currentHeader + '\n\n' + chunkContent;
                }
            }
            const startOffset = content.indexOf(words[start]);
            const endOffset = end < words.length ? content.indexOf(words[end - 1]) + words[end - 1].length : content.length;
            chunks.push({
                index: chunkIndex++,
                content: chunkContent.trim(),
                tokenCount: this.estimateTokens(chunkContent),
                startOffset,
                endOffset,
            });
            // Move start with overlap
            start = end - overlapWords;
            if (start <= chunks[chunks.length - 1]?.startOffset) {
                start = end; // Prevent infinite loop
            }
        }
        return chunks;
    }
    /**
     * Chunk by paragraphs (double newlines)
     */
    chunkByParagraphs(content) {
        const paragraphs = content.split(/\n{2,}/);
        const chunks = [];
        let currentChunk = [];
        let currentTokens = 0;
        let currentHeader = '';
        let chunkIndex = 0;
        let startOffset = 0;
        for (const paragraph of paragraphs) {
            const trimmed = paragraph.trim();
            if (!trimmed)
                continue;
            // Track headers
            if (/^#{1,6}\s/.test(trimmed)) {
                currentHeader = trimmed;
            }
            const paragraphTokens = this.estimateTokens(trimmed);
            // If adding this paragraph would exceed limit
            if (currentTokens + paragraphTokens > this.options.maxTokens && currentChunk.length > 0) {
                // Save current chunk
                const chunkContent = currentChunk.join('\n\n');
                const endOffset = startOffset + chunkContent.length;
                chunks.push({
                    index: chunkIndex++,
                    content: chunkContent,
                    tokenCount: currentTokens,
                    startOffset,
                    endOffset,
                });
                // Start new chunk with header context
                if (this.options.preserveHeaders && currentHeader && !trimmed.startsWith('#')) {
                    currentChunk = [currentHeader, trimmed];
                    currentTokens = this.estimateTokens(currentHeader) + paragraphTokens;
                }
                else {
                    currentChunk = [trimmed];
                    currentTokens = paragraphTokens;
                }
                startOffset = endOffset + 2; // Account for paragraph separator
            }
            else {
                currentChunk.push(trimmed);
                currentTokens += paragraphTokens;
            }
        }
        // Don't forget the last chunk
        if (currentChunk.length > 0) {
            const chunkContent = currentChunk.join('\n\n');
            chunks.push({
                index: chunkIndex,
                content: chunkContent,
                tokenCount: currentTokens,
                startOffset,
                endOffset: content.length,
            });
        }
        return chunks;
    }
    /**
     * Chunk by sentences
     */
    chunkBySentences(content) {
        // Split by sentence boundaries
        const sentences = content.match(/[^.!?]+[.!?]+|\n+|[^.!?\n]+$/g) || [content];
        const chunks = [];
        let currentChunk = [];
        let currentTokens = 0;
        let currentHeader = '';
        let chunkIndex = 0;
        let startOffset = 0;
        for (const sentence of sentences) {
            const trimmed = sentence.trim();
            if (!trimmed)
                continue;
            // Track headers
            if (/^#{1,6}\s/.test(trimmed)) {
                currentHeader = trimmed;
            }
            const sentenceTokens = this.estimateTokens(trimmed);
            // If adding this sentence would exceed limit
            if (currentTokens + sentenceTokens > this.options.maxTokens && currentChunk.length > 0) {
                // Save current chunk
                const chunkContent = currentChunk.join(' ');
                const endOffset = startOffset + chunkContent.length;
                chunks.push({
                    index: chunkIndex++,
                    content: chunkContent,
                    tokenCount: currentTokens,
                    startOffset,
                    endOffset,
                });
                // Start new chunk with header context
                if (this.options.preserveHeaders && currentHeader && !trimmed.startsWith('#')) {
                    currentChunk = [currentHeader, trimmed];
                    currentTokens = this.estimateTokens(currentHeader) + sentenceTokens;
                }
                else {
                    currentChunk = [trimmed];
                    currentTokens = sentenceTokens;
                }
                startOffset = endOffset;
            }
            else {
                currentChunk.push(trimmed);
                currentTokens += sentenceTokens;
            }
        }
        // Don't forget the last chunk
        if (currentChunk.length > 0) {
            const chunkContent = currentChunk.join(' ');
            chunks.push({
                index: chunkIndex,
                content: chunkContent,
                tokenCount: currentTokens,
                startOffset,
                endOffset: content.length,
            });
        }
        return chunks;
    }
    /**
     * Estimate token count (rough approximation)
     * Claude uses ~1.3 tokens per word on average
     */
    estimateTokens(text) {
        const words = text.split(/\s+/).filter((w) => w.length > 0);
        return Math.ceil(words.length * 1.3);
    }
}
export function createChunker(options) {
    return new Chunker(options);
}
//# sourceMappingURL=chunker.js.map