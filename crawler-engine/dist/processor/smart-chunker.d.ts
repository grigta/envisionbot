/**
 * Smart Chunker with Overlap Strategy
 * Based on LangChain's RecursiveCharacterTextSplitter
 * Splits large content intelligently while preserving context
 */
export interface ChunkOptions {
    chunkSize?: number;
    chunkOverlap?: number;
    separators?: string[];
    keepSeparator?: boolean;
}
export interface TextChunk {
    content: string;
    index: number;
    startChar: number;
    endChar: number;
}
export declare class SmartChunker {
    private options;
    constructor(options?: ChunkOptions);
    /**
     * Split text into smart chunks with overlap
     */
    chunk(text: string): TextChunk[];
    /**
     * Recursively split text using separators hierarchy
     */
    private recursiveSplit;
    /**
     * Merge splits into chunks with overlap to preserve context
     */
    private mergeWithOverlap;
    /**
     * Get overlap text from the end of a chunk
     */
    private getOverlapText;
}
/**
 * Factory function for creating a smart chunker
 */
export declare function createSmartChunker(options?: ChunkOptions): SmartChunker;
//# sourceMappingURL=smart-chunker.d.ts.map