/**
 * Parsers Index
 * Exports all source-specific parsers
 */
export { parseGitHubRepo } from "./github-parser.js";
export { parseHuggingFace } from "./huggingface-parser.js";
export { parseReplicate } from "./replicate-parser.js";
export { parseReddit } from "./reddit-parser.js";
import { parseGitHubRepo } from "./github-parser.js";
import { parseHuggingFace } from "./huggingface-parser.js";
import { parseReplicate } from "./replicate-parser.js";
import { parseReddit } from "./reddit-parser.js";
/**
 * Parse details from any source
 */
export async function parseSourceDetails(url, source) {
    switch (source) {
        case "GitHub":
            return parseGitHubRepo(url);
        case "HuggingFace":
            return parseHuggingFace(url);
        case "Replicate":
            return parseReplicate(url);
        case "Reddit":
            return parseReddit(url);
        default:
            console.warn(`Unknown source: ${source}, trying GitHub parser`);
            return parseGitHubRepo(url);
    }
}
//# sourceMappingURL=index.js.map