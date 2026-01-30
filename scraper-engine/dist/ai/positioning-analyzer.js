import { OpenRouterClient } from './openrouter-client.js';
// ============================================
// POSITIONING ANALYZER
// ============================================
const POSITIONING_PROMPT = `You are an expert marketing strategist analyzing a competitor's website positioning.

CRITICAL INSTRUCTION: You MUST respond with ONLY a valid JSON object. No explanatory text, no markdown formatting, no code blocks. Start your response with { and end with }.

Based on the following data from the competitor's website, provide a detailed positioning analysis.

## Website Data

Domain: {domain}
Total Pages Analyzed: {pageCount}

### Page Titles (sample):
{titles}

### Meta Descriptions (sample):
{descriptions}

### H1 Headings (sample):
{h1Headings}

### Key Content Excerpts:
{contentExcerpts}

### Technologies Used:
{techStack}

## Required Output Format (JSON only)

{
  "summary": "2-3 paragraph comprehensive positioning summary",
  "valueProposition": "Their core value proposition in 1-2 sentences",
  "targetAudience": ["Primary audience segment 1", "Audience segment 2", "..."],
  "keyMessages": ["Key message 1", "Key message 2", "..."],
  "toneOfVoice": "Description of their brand voice and communication style",
  "uniqueSellingPoints": ["USP 1", "USP 2", "..."],
  "competitiveAdvantages": ["Advantage 1", "Advantage 2", "..."]
}

Focus on actionable insights. Be specific based on the actual content provided.
OUTPUT ONLY THE JSON OBJECT. NO OTHER TEXT.`;
export class PositioningAnalyzer {
    client;
    model;
    maxTokens;
    constructor(options = {}) {
        const apiKey = options.openrouterApiKey || process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            throw new Error('OpenRouter API key is required. Set OPENROUTER_API_KEY or pass openrouterApiKey option.');
        }
        this.model = options.model || process.env.OPENROUTER_MODEL || 'google/gemini-3-flash-preview';
        this.maxTokens = options.maxTokens || 2000;
        this.client = new OpenRouterClient({
            apiKey,
            model: this.model,
        });
        console.log('🤖 Positioning Analyzer using OpenRouter with', this.model);
    }
    /**
     * Analyze competitor positioning
     */
    async analyze(domain, pages, techStack) {
        const prompt = this.buildPrompt(domain, pages, techStack);
        const response = await this.client.createCompletion({
            model: this.model,
            messages: [
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            max_tokens: this.maxTokens,
            response_format: { type: 'json_object' },
        });
        const content = response.choices[0].message.content;
        try {
            let jsonStr = content.trim();
            if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
            }
            const analysis = JSON.parse(jsonStr);
            return {
                analysis,
                tokensUsed: response.usage.total_tokens,
            };
        }
        catch (error) {
            throw new Error(`Failed to parse positioning analysis: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    buildPrompt(domain, pages, techStack) {
        const titles = pages
            .slice(0, 10)
            .map((p) => p.seo.title)
            .filter(Boolean)
            .join('\n- ');
        const descriptions = pages
            .slice(0, 10)
            .map((p) => p.seo.metaDescription)
            .filter(Boolean)
            .join('\n- ');
        const h1Headings = pages
            .slice(0, 15)
            .flatMap((p) => p.headings.h1)
            .join('\n- ');
        const contentExcerpts = pages
            .slice(0, 5)
            .map((p) => p.textContent?.substring(0, 500))
            .filter(Boolean)
            .join('\n\n---\n\n');
        const techStackStr = techStack
            .map((t) => `${t.name} (${t.category})`)
            .join(', ');
        return POSITIONING_PROMPT
            .replace('{domain}', domain)
            .replace('{pageCount}', String(pages.length))
            .replace('{titles}', titles ? `- ${titles}` : 'No titles available')
            .replace('{descriptions}', descriptions ? `- ${descriptions}` : 'No descriptions available')
            .replace('{h1Headings}', h1Headings ? `- ${h1Headings}` : 'No H1 headings available')
            .replace('{contentExcerpts}', contentExcerpts || 'No content excerpts available')
            .replace('{techStack}', techStackStr || 'Unknown');
    }
}
/**
 * Quick analysis function
 */
export async function analyzePositioning(domain, pages, techStack, options) {
    const analyzer = new PositioningAnalyzer(options);
    const result = await analyzer.analyze(domain, pages, techStack);
    return result.analysis;
}
//# sourceMappingURL=positioning-analyzer.js.map