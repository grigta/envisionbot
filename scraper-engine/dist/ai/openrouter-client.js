/**
 * OpenRouter API Client for Scraper Engine
 * Provides OpenAI-compatible interface for OpenRouter API
 */
export class OpenRouterClient {
    apiKey;
    model;
    baseUrl;
    constructor(options) {
        this.apiKey = options.apiKey;
        this.model = options.model || "google/gemini-3-flash-preview";
        this.baseUrl = options.baseUrl || "https://openrouter.ai/api/v1";
    }
    /**
     * Create a chat completion
     */
    async createCompletion(request) {
        const url = `${this.baseUrl}/chat/completions`;
        const body = {
            model: request.model || this.model,
            messages: request.messages,
            max_tokens: request.max_tokens,
            temperature: request.temperature,
            response_format: request.response_format,
            stream: false,
        };
        let lastError = null;
        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${this.apiKey}`,
                        "HTTP-Referer": "https://github.com/envisionbot/scraper-engine",
                        "X-Title": "Scraper Engine",
                    },
                    body: JSON.stringify(body),
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}\n${errorText}`);
                }
                const data = (await response.json());
                return data;
            }
            catch (error) {
                lastError = error;
                console.error(`❌ OpenRouter API error (attempt ${attempt}/${maxRetries}):`, lastError.message);
                if (attempt < maxRetries) {
                    // Exponential backoff: 1s, 2s, 4s
                    const delay = Math.pow(2, attempt - 1) * 1000;
                    console.log(`⏳ Retrying in ${delay}ms...`);
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
            }
        }
        // All retries failed
        throw new Error(`OpenRouter API failed after ${maxRetries} attempts: ${lastError?.message}`);
    }
    /**
     * Get the current model
     */
    getModel() {
        return this.model;
    }
    /**
     * Set a different model
     */
    setModel(model) {
        this.model = model;
    }
}
//# sourceMappingURL=openrouter-client.js.map