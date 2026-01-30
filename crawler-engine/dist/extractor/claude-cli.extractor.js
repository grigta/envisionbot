/**
 * Claude CLI Extractor
 * Uses Claude Code CLI with Max subscription instead of direct API
 * This bypasses the OAuth limitation by using `claude --print` mode
 */
import { spawn } from 'child_process';
const DEFAULT_TIMEOUT = 180000; // 3 minutes - Opus 4.5 needs more time
export class ClaudeCLIExtractor {
    claudePath;
    timeout;
    constructor(options = {}) {
        this.claudePath = options.claudePath || 'claude';
        this.timeout = options.timeout || DEFAULT_TIMEOUT;
    }
    /**
     * Extract structured data from content using Claude Code CLI
     */
    async extract(content, config) {
        const startTime = Date.now();
        const prompt = this.buildPrompt(content, config);
        console.log(`[ClaudeCLI] Starting extraction, content length: ${content.length}, prompt length: ${prompt.length}`);
        try {
            const response = await this.runClaudeCLI(prompt);
            const elapsed = Date.now() - startTime;
            console.log(`[ClaudeCLI] Extraction completed in ${elapsed}ms, response length: ${response.length}`);
            const parsed = this.parseResponse(response, config);
            return {
                data: parsed.data,
                raw: response,
                model: 'claude-cli-subscription',
                inputTokens: 0, // CLI doesn't report tokens
                outputTokens: 0,
                extractedAt: Date.now(),
            };
        }
        catch (error) {
            const elapsed = Date.now() - startTime;
            console.error(`[ClaudeCLI] Extraction failed after ${elapsed}ms:`, error);
            throw new Error(`Claude CLI extraction failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Run claude CLI with --print flag using subscription auth
     */
    runClaudeCLI(prompt) {
        return new Promise((resolve, reject) => {
            // Prepare environment - remove API key to force subscription usage
            const env = { ...process.env };
            delete env.ANTHROPIC_API_KEY;
            env.ANTHROPIC_API_KEY = ''; // Also set to empty
            env.CLAUDE_USE_SUBSCRIPTION = 'true';
            env.CLAUDE_CODE_ENTRYPOINT = 'crawler-engine';
            // Optimize CLI for speed:
            // --print: non-interactive mode (reads from stdin if no prompt arg)
            // --max-turns 3: allow up to 3 iterations (enough for extraction)
            // --output-format json: structured output with metadata
            // --model: use Opus 4.5 for best extraction quality
            // --dangerously-skip-permissions: no permission prompts
            // NOTE: Passing prompt via stdin to avoid command-line length limits
            const args = [
                '--print',
                '--max-turns', '3',
                '--output-format', 'json',
                '--model', 'claude-opus-4-5-20251101',
                '--dangerously-skip-permissions',
            ];
            const proc = spawn(this.claudePath, args, {
                env,
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            let stdout = '';
            let stderr = '';
            let timeoutId;
            // Write prompt to stdin
            if (proc.stdin) {
                proc.stdin.write(prompt);
                proc.stdin.end();
            }
            proc.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            proc.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            proc.on('close', (code) => {
                clearTimeout(timeoutId);
                if (code === 0) {
                    resolve(stdout.trim());
                }
                else {
                    reject(new Error(`Claude CLI exited with code ${code}: ${stderr || stdout}`));
                }
            });
            proc.on('error', (error) => {
                clearTimeout(timeoutId);
                reject(new Error(`Failed to start Claude CLI: ${error.message}`));
            });
            // Handle timeout
            timeoutId = setTimeout(() => {
                proc.kill('SIGTERM');
                reject(new Error(`Claude CLI timed out after ${this.timeout}ms`));
            }, this.timeout);
        });
    }
    /**
     * Build extraction prompt
     */
    buildPrompt(content, config) {
        const lang = config.outputLanguage || 'ru';
        // Limit content aggressively to avoid CLI timeout - take first 10K chars
        const truncatedContent = content.slice(0, 10000);
        if (config.extractionType === 'schema' && config.schema) {
            return `${config.prompt || 'Извлеки данные из контента.'} Schema: ${JSON.stringify(config.schema)}. Контент: ${truncatedContent}. Верни ТОЛЬКО JSON:`;
        }
        return `${config.prompt || 'Извлеки элементы.'} Формат:[{"title":"...","url":"...","description":"..."}]. Контент: ${truncatedContent}. JSON (${lang}):`;
    }
    /**
     * Parse Claude's response
     */
    parseResponse(response, config) {
        let actualResult = response.trim();
        // Check if response is in JSON output format (from --output-format json)
        try {
            const outputJson = JSON.parse(response);
            if (outputJson.type === 'result' && outputJson.result) {
                actualResult = outputJson.result;
                console.log(`[ClaudeCLI] Extracted result from JSON output format (${outputJson.num_turns} turns, ${outputJson.duration_ms}ms)`);
            }
        }
        catch {
            // Not JSON output format, continue with raw response
        }
        // Remove markdown code blocks if present
        const jsonMatch = actualResult.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            actualResult = jsonMatch[1].trim();
        }
        // Try to find JSON array or object
        const arrayMatch = actualResult.match(/\[[\s\S]*\]/);
        const objectMatch = actualResult.match(/\{[\s\S]*\}/);
        let jsonStr = actualResult;
        if (arrayMatch) {
            jsonStr = arrayMatch[0];
        }
        else if (objectMatch) {
            jsonStr = objectMatch[0];
        }
        try {
            const data = JSON.parse(jsonStr);
            return { data };
        }
        catch (e) {
            console.error('[ClaudeCLI] Failed to parse JSON:', e);
            // If parsing fails, return raw response wrapped in array
            return {
                data: [{
                        title: 'Extracted Content',
                        content: actualResult,
                        metadata: { parseError: 'Failed to parse JSON' },
                    }],
            };
        }
    }
}
export function createClaudeCLIExtractor(options) {
    return new ClaudeCLIExtractor(options);
}
//# sourceMappingURL=claude-cli.extractor.js.map