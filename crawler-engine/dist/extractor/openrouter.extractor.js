/**
 * OpenRouter Extractor - LLM-powered content extraction using OpenRouter API
 */
const DEFAULT_MODEL = 'google/gemini-3-flash-preview';
const DEFAULT_MAX_TOKENS = 4096;
export class OpenRouterExtractor {
    apiKey;
    defaultModel;
    baseUrl;
    constructor(options) {
        this.apiKey = options.apiKey;
        this.defaultModel = options.defaultModel || DEFAULT_MODEL;
        this.baseUrl = options.baseUrl || 'https://openrouter.ai/api/v1';
    }
    /**
     * Extract structured data from content using OpenRouter
     */
    async extract(content, config) {
        const systemPrompt = this.buildSystemPrompt(config);
        const model = config.model || this.defaultModel;
        const maxTokens = config.maxTokens || DEFAULT_MAX_TOKENS;
        const messages = [
            {
                role: 'system',
                content: systemPrompt,
            },
            {
                role: 'user',
                content: `Контент для анализа:\n\n${content}`,
            },
        ];
        const response = await this.createCompletion({
            model,
            messages,
            max_tokens: maxTokens,
            temperature: config.temperature ?? 0.1,
            response_format: { type: 'json_object' }, // Force JSON response
        });
        const rawResponse = response.choices[0].message.content;
        const data = this.parseResponse(rawResponse, config);
        return {
            data,
            raw: rawResponse,
            model: response.model,
            inputTokens: response.usage.prompt_tokens,
            outputTokens: response.usage.completion_tokens,
            extractedAt: Date.now(),
        };
    }
    /**
     * Create a chat completion via OpenRouter API
     */
    async createCompletion(request) {
        const url = `${this.baseUrl}/chat/completions`;
        let lastError = null;
        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${this.apiKey}`,
                        'HTTP-Referer': 'https://github.com/envisionbot/crawler-engine',
                        'X-Title': 'Crawler Engine',
                    },
                    body: JSON.stringify({
                        model: request.model,
                        messages: request.messages,
                        max_tokens: request.max_tokens,
                        temperature: request.temperature,
                        response_format: request.response_format,
                        stream: false,
                    }),
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}\n${errorText}`);
                }
                return (await response.json());
            }
            catch (error) {
                lastError = error;
                console.error(`❌ OpenRouter API error (attempt ${attempt}/${maxRetries}):`, lastError.message);
                if (attempt < maxRetries) {
                    // Exponential backoff
                    const delay = Math.pow(2, attempt - 1) * 1000;
                    console.log(`⏳ Retrying in ${delay}ms...`);
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
            }
        }
        throw new Error(`OpenRouter API failed after ${maxRetries} attempts: ${lastError?.message}`);
    }
    /**
     * Build system prompt based on extraction config
     */
    buildSystemPrompt(config) {
        const language = config.outputLanguage === 'ru' ? 'русском' : 'английском';
        if (config.extractionType === 'schema' && config.schema) {
            return `Ты эксперт по извлечению структурированных данных из веб-контента.

${config.prompt || 'Извлеки данные из предоставленного контента.'}

ВАЖНО: Используй следующую JSON схему для структурирования ответа:
\`\`\`json
${JSON.stringify(config.schema, null, 2)}
\`\`\`

Требования:
1. Верни ТОЛЬКО валидный JSON, соответствующий схеме
2. Не добавляй никакого текста до или после JSON
3. Если данные отсутствуют, используй null или пустой массив []
4. Текстовые значения должны быть на ${language} языке
5. Сохраняй оригинальные названия и термины если это технические названия`;
        }
        if (config.extractionType === 'block') {
            return `Ты эксперт по извлечению контента из веб-страниц.

${config.prompt || 'Извлеки основные элементы контента в виде структурированного списка.'}

Требования:
1. Верни JSON массив объектов
2. Каждый объект должен содержать: title, url (если есть), description, metadata
3. Не добавляй никакого текста до или после JSON
4. Текстовые описания должны быть на ${language} языке
5. Сохраняй оригинальные названия и URL

Формат ответа:
\`\`\`json
[
  {
    "title": "Название элемента",
    "url": "https://...",
    "description": "Описание",
    "metadata": {}
  }
]
\`\`\``;
        }
        // Auto mode - let LLM decide the best structure
        return `Ты эксперт по анализу веб-контента и извлечению структурированных данных.

${config.prompt || 'Проанализируй контент и извлеки все значимые элементы.'}

Требования:
1. Определи тип контента (список товаров, статьи, новости, и т.д.)
2. Извлеки все значимые элементы в структурированном виде
3. Верни JSON с полями: type, items, metadata
4. Текстовые описания на ${language} языке
5. Сохраняй оригинальные названия и URL

Формат ответа:
\`\`\`json
{
  "type": "тип контента",
  "items": [...],
  "metadata": {
    "totalItems": N,
    "source": "описание источника"
  }
}
\`\`\``;
    }
    /**
     * Parse response and extract JSON
     */
    parseResponse(response, config) {
        // With response_format: json_object, OpenRouter should return clean JSON
        // But we still handle markdown code blocks for safety
        let jsonStr = response.trim();
        // Remove markdown code blocks if present
        const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1].trim();
        }
        // Try to find JSON array or object
        const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
        const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
        // Extract array for both 'block' and 'schema' types (schema can have array type)
        if (arrayMatch) {
            jsonStr = arrayMatch[0];
        }
        else if (objectMatch) {
            jsonStr = objectMatch[0];
        }
        try {
            return JSON.parse(jsonStr);
        }
        catch {
            // If JSON parsing fails, return the raw response wrapped in an object
            return {
                raw: response,
                parseError: 'Failed to parse JSON from response',
            };
        }
    }
}
export function createOpenRouterExtractor(options) {
    return new OpenRouterExtractor(options);
}
//# sourceMappingURL=openrouter.extractor.js.map