/**
 * Content Chunker - Splits large content into manageable chunks for LLM
 * Preserves context by including headers and using overlap
 */
import type { ChunkOptions, ContentChunk } from '../types.js';
export declare class Chunker {
    private options;
    constructor(options?: Partial<ChunkOptions>);
    /**
     * Split content into chunks
     */
    chunk(content: string): ContentChunk[];
    /**
     * Chunk by estimated token count
     */
    private chunkByTokens;
    /**
     * Chunk by paragraphs (double newlines)
     */
    private chunkByParagraphs;
    /**
     * Chunk by sentences
     */
    private chunkBySentences;
    /**
     * Estimate token count (rough approximation)
     * Claude uses ~1.3 tokens per word on average
     */
    private estimateTokens;
}
export declare function createChunker(options?: Partial<ChunkOptions>): Chunker;
//# sourceMappingURL=chunker.d.ts.map