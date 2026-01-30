/**
 * Extraction Worker
 * Runs in a separate thread to process content chunks
 * Isolates memory and allows parallel processing
 */

import type { ExtractionConfig, ExtractionResult } from '../types.js';

// Worker payload interface
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
export default async function extractChunk(payload: WorkerPayload): Promise<ExtractionResult> {
  const { content, config, extractorMode, apiKey, model } = payload;

  try {
    // Dynamically import the appropriate extractor
    let extractor: any;

    if (extractorMode === 'openrouter') {
      const { OpenRouterExtractor } = await import('../extractor/openrouter.extractor.js');
      extractor = new OpenRouterExtractor({
        apiKey: apiKey!,
        defaultModel: model,
      });
    } else if (extractorMode === 'api') {
      const { ClaudeExtractor } = await import('../extractor/claude.extractor.js');
      extractor = new ClaudeExtractor({
        apiKey: apiKey!,
      });
    } else if (extractorMode === 'cli') {
      const { ClaudeCLIExtractor } = await import('../extractor/claude-cli.extractor.js');
      extractor = new ClaudeCLIExtractor({});
    } else {
      throw new Error(`Unknown extractor mode: ${extractorMode}`);
    }

    // Extract data from this chunk
    const result = await extractor.extract(content, config);

    return result;
  } catch (error) {
    // Return error as extraction result
    return {
      data: {
        error: error instanceof Error ? error.message : String(error),
        parseError: 'Worker extraction failed',
      },
      raw: '',
      model: model || 'unknown',
      inputTokens: 0,
      outputTokens: 0,
      extractedAt: Date.now(),
    };
  }
}

// Named export for Piscina
export { extractChunk };
