/**
 * Claude Extractor - LLM-powered content extraction using Claude API
 */

import Anthropic from '@anthropic-ai/sdk';
import type { Extractor, ExtractionConfig, ExtractionResult } from '../types.js';

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_MAX_TOKENS = 4096;

export interface ClaudeExtractorOptions {
  apiKey?: string;
  authToken?: string;
  defaultModel?: string;
}

export class ClaudeExtractor implements Extractor {
  private client: Anthropic;
  private defaultModel: string;

  constructor(options: ClaudeExtractorOptions) {
    // Support both apiKey and authToken (OAuth)
    if (options.authToken) {
      this.client = new Anthropic({ authToken: options.authToken });
    } else if (options.apiKey) {
      this.client = new Anthropic({ apiKey: options.apiKey });
    } else {
      throw new Error('Either apiKey or authToken must be provided');
    }
    this.defaultModel = options.defaultModel || DEFAULT_MODEL;
  }

  /**
   * Extract structured data from content using Claude
   */
  async extract(content: string, config: ExtractionConfig): Promise<ExtractionResult> {
    const systemPrompt = this.buildSystemPrompt(config);
    const model = config.model || this.defaultModel;
    const maxTokens = config.maxTokens || DEFAULT_MAX_TOKENS;

    const response = await this.client.messages.create({
      model,
      max_tokens: maxTokens,
      temperature: config.temperature ?? 0.1,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Контент для анализа:\n\n${content}`,
        },
      ],
    });

    const textContent = response.content[0];
    if (textContent.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    const rawResponse = textContent.text;
    const data = this.parseResponse(rawResponse, config);

    return {
      data,
      raw: rawResponse,
      model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      extractedAt: Date.now(),
    };
  }

  /**
   * Build system prompt based on extraction config
   */
  private buildSystemPrompt(config: ExtractionConfig): string {
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

    // Auto mode - let Claude decide the best structure
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
   * Parse Claude's response and extract JSON
   */
  private parseResponse(response: string, config: ExtractionConfig): unknown {
    // Try to extract JSON from the response
    let jsonStr = response.trim();

    // Remove markdown code blocks if present
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    // Try to find JSON array or object
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    const objectMatch = jsonStr.match(/\{[\s\S]*\}/);

    if (arrayMatch && config.extractionType === 'block') {
      jsonStr = arrayMatch[0];
    } else if (objectMatch) {
      jsonStr = objectMatch[0];
    }

    try {
      return JSON.parse(jsonStr);
    } catch {
      // If JSON parsing fails, return the raw response wrapped in an object
      return {
        raw: response,
        parseError: 'Failed to parse JSON from response',
      };
    }
  }
}

export function createClaudeExtractor(options: ClaudeExtractorOptions): ClaudeExtractor {
  return new ClaudeExtractor(options);
}
