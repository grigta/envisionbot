import { OpenRouterClient } from './openrouter-client.js';
const RECOMMENDATIONS_PROMPT = `You are an expert business strategist providing actionable recommendations based on competitive analysis.

CRITICAL INSTRUCTION: You MUST respond with ONLY a valid JSON object. No explanatory text, no markdown formatting, no code blocks. Start your response with { and end with }.

Based on the following competitive intelligence, provide specific, actionable recommendations.

## Input Data

### Competitor Positioning:
{positioning}

### SWOT Analysis:
{swot}

### SEO Insights:
{seo}

### Technology Stack:
{techStack}

## Required Output Format (JSON only)

{
  "strategicRecommendations": [{"title": "...", "description": "...", "rationale": "...", "priority": "high|medium|low", "effort": "high|medium|low", "impact": "high|medium|low", "category": "positioning|product|marketing|technology|operations"}],
  "quickWins": [{"title": "...", "description": "...", "expectedImpact": "...", "timeframe": "..."}],
  "longTermInitiatives": [{"title": "...", "description": "...", "expectedImpact": "...", "timeframe": "..."}]
}

OUTPUT ONLY THE JSON OBJECT. NO OTHER TEXT.`;
export class RecommendationsGenerator {
    client;
    model;
    maxTokens;
    constructor(options = {}) {
        const apiKey = options.openrouterApiKey || process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            throw new Error('OpenRouter API key is required.');
        }
        this.model = options.model || process.env.OPENROUTER_MODEL || 'google/gemini-3-flash-preview';
        this.maxTokens = options.maxTokens || 3000;
        this.client = new OpenRouterClient({ apiKey, model: this.model });
        console.log('🤖 Recommendations Generator using OpenRouter with', this.model);
    }
    async generate(positioning, swot, seo, techStack) {
        const prompt = this.buildPrompt(positioning, swot, seo, techStack);
        const response = await this.client.createCompletion({
            model: this.model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: this.maxTokens,
            response_format: { type: 'json_object' },
        });
        const content = response.choices[0].message.content;
        const report = JSON.parse(content.trim());
        return { report, tokensUsed: response.usage.total_tokens };
    }
    buildPrompt(positioning, swot, seo, techStack) {
        const positioningSummary = positioning.summary.substring(0, 500);
        const swotSummary = `Strengths: ${swot.strengths.length}, Weaknesses: ${swot.weaknesses.length}, Opportunities: ${swot.opportunities.length}, Threats: ${swot.threats.length}`;
        const seoSummary = `Issues: ${seo.issues.length}`;
        const techStackStr = techStack.map((t) => t.name).join(', ');
        return RECOMMENDATIONS_PROMPT
            .replace('{positioning}', positioningSummary)
            .replace('{swot}', swotSummary)
            .replace('{seo}', seoSummary)
            .replace('{techStack}', techStackStr || 'Unknown');
    }
}
export async function generateRecommendations(positioning, swot, seo, techStack, options) {
    const generator = new RecommendationsGenerator(options);
    const result = await generator.generate(positioning, swot, seo, techStack);
    return result.report;
}
export function filterByPriority(recommendations, priority) {
    return recommendations.filter((r) => r.priority === priority);
}
export function filterByCategory(recommendations, category) {
    return recommendations.filter((r) => r.category === category);
}
export function sortByImpactEffort(recommendations) {
    const impactScore = (i) => (i === 'high' ? 3 : i === 'medium' ? 2 : 1);
    const effortScore = (e) => (e === 'high' ? 1 : e === 'medium' ? 2 : 3);
    return [...recommendations].sort((a, b) => impactScore(b.impact) * effortScore(b.effort) - impactScore(a.impact) * effortScore(a.effort));
}
export function getEffortImpactMatrix(recommendations) {
    return {
        highImpactLowEffort: recommendations.filter((r) => r.impact === 'high' && r.effort === 'low'),
        highImpactMediumEffort: recommendations.filter((r) => r.impact === 'high' && r.effort === 'medium'),
        highImpactHighEffort: recommendations.filter((r) => r.impact === 'high' && r.effort === 'high'),
        mediumImpactLowEffort: recommendations.filter((r) => r.impact === 'medium' && r.effort === 'low'),
        lowImpactLowEffort: recommendations.filter((r) => r.impact === 'low' && r.effort === 'low'),
    };
}
//# sourceMappingURL=recommendations.js.map