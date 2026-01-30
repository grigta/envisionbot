/**
 * Parsers Index
 * Exports all source-specific parsers
 */
export { parseGitHubRepo } from "./github-parser.js";
export { parseHuggingFace } from "./huggingface-parser.js";
export { parseReplicate } from "./replicate-parser.js";
export { parseReddit } from "./reddit-parser.js";
import type { NewsSource, NewsItemDetails } from "../types.js";
/**
 * Parse details from any source
 */
export declare function parseSourceDetails(url: string, source: NewsSource): Promise<NewsItemDetails>;
//# sourceMappingURL=index.d.ts.map