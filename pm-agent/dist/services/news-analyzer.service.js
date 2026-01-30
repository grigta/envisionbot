/**
 * News Analyzer Service
 * Uses Claude AI to analyze news items and generate application recommendations
 */
import { OpenRouterClient } from "../llm/openrouter-client.js";
import { NewsRepository } from "../repositories/news.repository.js";
const ANALYSIS_PROMPT = `Ты эксперт в области AI/ML технологий. Проанализируй следующую технологию/проект и создай подробное описание на русском языке.

Технология: {title}
Источник: {source}
Описание: {description}
{details}

Верни JSON со следующей структурой:
{
  "summary": "Полное описание в Markdown формате на русском языке",
  "applications": ["сфера применения 1", "сфера применения 2", ...],
  "projectIdeas": ["идея проекта 1", "идея проекта 2", ...],
  "targetAudience": ["целевая аудитория 1", "целевая аудитория 2", ...],
  "integrations": ["технология/сервис для интеграции 1", ...]
}

Требования к полю "summary" (ОБЯЗАТЕЛЬНО на русском языке, в Markdown формате):
Создай структурированное описание с заголовками:

## Что это такое
Краткое и понятное описание что это за технология/проект (2-3 предложения).

## Ключевые возможности
- Возможность 1
- Возможность 2
- Возможность 3

## Для чего используется
Опиши основные сценарии использования (2-3 абзаца).

## Преимущества
- Преимущество 1
- Преимущество 2

## Как начать
Краткие шаги для начала работы с технологией.

Требования к остальным полям:
- applications: 3-5 конкретных сфер применения на русском
- projectIdeas: 3-5 конкретных идей проектов на русском
- targetAudience: 2-4 категории пользователей на русском
- integrations: 3-5 технологий/сервисов для интеграции

ВАЖНО: Весь текст должен быть на русском языке. Названия технологий можно оставлять на английском.
Ответь ТОЛЬКО валидным JSON.`;
export class NewsAnalyzerService {
    deps;
    client;
    model;
    newsRepository;
    constructor(deps) {
        this.deps = deps;
        this.client = new OpenRouterClient({
            apiKey: process.env.OPENROUTER_API_KEY,
            model: process.env.OPENROUTER_MODEL || 'google/gemini-3-flash-preview'
        });
        this.model = process.env.OPENROUTER_MODEL || 'google/gemini-3-flash-preview';
        this.newsRepository = new NewsRepository(deps);
        console.log('🤖 News Analyzer using OpenRouter with', this.model);
    }
    /**
     * Analyze a single news item
     */
    async analyzeItem(item) {
        // Build details string
        let details = "";
        if (item.details?.fullDescription) {
            details += `\nПолное описание: ${item.details.fullDescription.slice(0, 500)}`;
        }
        if (item.details?.technologies?.length) {
            details += `\nТехнологии: ${item.details.technologies.join(", ")}`;
        }
        if (item.details?.topics?.length) {
            details += `\nТопики: ${item.details.topics.join(", ")}`;
        }
        if (item.details?.useCases?.length) {
            details += `\nИспользование: ${item.details.useCases.join(", ")}`;
        }
        const prompt = ANALYSIS_PROMPT
            .replace("{title}", item.title)
            .replace("{source}", item.source)
            .replace("{description}", item.description || "Нет описания")
            .replace("{details}", details || "Нет дополнительной информации");
        try {
            const response = await this.client.createCompletion({
                model: this.model,
                max_tokens: 1024,
                messages: [
                    {
                        role: "user",
                        content: prompt,
                    },
                ],
                response_format: { type: "json_object" } // Форсируем JSON ответ
            });
            // OpenRouter в режиме response_format: json_object возвращает чистый JSON
            const content = response.choices[0].message.content;
            const parsed = JSON.parse(content);
            const analysis = {
                summary: parsed.summary || undefined,
                applications: parsed.applications || [],
                projectIdeas: parsed.projectIdeas || [],
                targetAudience: parsed.targetAudience || [],
                integrations: parsed.integrations || [],
                analyzedAt: Date.now(),
            };
            return analysis;
        }
        catch (error) {
            console.error("AI analysis failed:", error);
            // Return empty analysis on error
            return {
                summary: undefined,
                applications: [],
                projectIdeas: [],
                targetAudience: [],
                integrations: [],
                analyzedAt: Date.now(),
            };
        }
    }
    /**
     * Analyze a news item by ID and save results
     */
    async analyzeAndSave(id) {
        const item = await this.newsRepository.getById(id);
        if (!item) {
            console.error(`News item not found: ${id}`);
            return undefined;
        }
        console.log(`Analyzing: ${item.title}`);
        const analysis = await this.analyzeItem(item);
        // Save to database
        await this.newsRepository.updateAIAnalysis(id, analysis);
        return analysis;
    }
    /**
     * Analyze all items without analysis
     */
    async analyzeUnanalyzed(onProgress) {
        const items = await this.newsRepository.getAll({ isActive: true });
        const unanalyzed = items.filter((item) => !item.aiAnalysis);
        console.log(`Found ${unanalyzed.length} items to analyze`);
        for (let i = 0; i < unanalyzed.length; i++) {
            const item = unanalyzed[i];
            onProgress?.(i + 1, unanalyzed.length, item);
            try {
                await this.analyzeAndSave(item.id);
            }
            catch (error) {
                console.error(`Failed to analyze ${item.id}:`, error);
            }
            // Rate limit: wait between requests
            if (i < unanalyzed.length - 1) {
                await new Promise((resolve) => setTimeout(resolve, 2000));
            }
        }
        return unanalyzed.length;
    }
    /**
     * Re-analyze a specific item (even if already analyzed)
     */
    async reanalyze(id) {
        return this.analyzeAndSave(id);
    }
}
//# sourceMappingURL=news-analyzer.service.js.map