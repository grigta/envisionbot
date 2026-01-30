/**
 * Extraction Worker
 * Runs in a separate thread to process content chunks
 * Isolates memory and allows parallel processing
 */
import type { ExtractionConfig, ExtractionResult } from '../types.js';
export interface WorkerPayload {
    content: string;
    config: ExtractionConfig;
    extractorMode: 'api' | 'cli' | 'openrouter';
    apiKey?: string;
    model?: string;
}
/**
 * Main worker function called by Piscina
 * Must be exported as default or named export
 */
export default function extractChunk(payload: WorkerPayload): Promise<ExtractionResult>;
export { extractChunk };
//# sourceMappingURL=extraction-worker.d.ts.map