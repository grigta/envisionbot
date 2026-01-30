import type {
  SWOTAnalysis,
  PositioningAnalysis,
  SEOAnalysisResult,
  TechStackItem,
} from '../types.js';
import { OpenRouterClient } from './openrouter-client.js';

export interface RecommendationsReport {
  strategicRecommendations: Array<{
    title: string;
    description: string;
    rationale: string;
    priority: 'high' | 'medium' | 'low';
    effort: 'high' | 'medium' | 'low';
    impact: 'high' | 'medium' | 'low';
    category: 'positioning' | 'product' | 'marketing' | 'technology' | 'operations';
  }>;
  quickWins: Array<{
    title: string;
    description: string;
    expectedImpact: string;
    timeframe: string;
  }>;
  longTermInitiatives: Array<{
    title: string;
    description: string;
    expectedImpact: string;
    timeframe: string;
  }>;
}

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

export interface RecommendationsGeneratorOptions {
  openrouterApiKey?: string;
  model?: string;
  maxTokens?: number;
}

export class RecommendationsGenerator {
  private client: OpenRouterClient;
  private model: string;
  private maxTokens: number;

  constructor(options: RecommendationsGeneratorOptions = {}) {
    const apiKey = options.openrouterApiKey || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OpenRouter API key is required.');
    }

    this.model = options.model || process.env.OPENROUTER_MODEL || 'google/gemini-3-flash-preview';
    this.maxTokens = options.maxTokens || 3000;

    this.client = new OpenRouterClient({ apiKey, model: this.model });
    console.log('🤖 Recommendations Generator using OpenRouter with', this.model);
  }

  async generate(
    positioning: PositioningAnalysis,
    swot: SWOTAnalysis,
    seo: SEOAnalysisResult,
    techStack: TechStackItem[]
  ): Promise<{ report: RecommendationsReport; tokensUsed: number }> {
    const prompt = this.buildPrompt(positioning, swot, seo, techStack);

    const response = await this.client.createCompletion({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: this.maxTokens,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    const report = JSON.parse(content.trim()) as RecommendationsReport;

    return { report, tokensUsed: response.usage.total_tokens };
  }

  private buildPrompt(
    positioning: PositioningAnalysis,
    swot: SWOTAnalysis,
    seo: SEOAnalysisResult,
    techStack: TechStackItem[]
  ): string {
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

export async function generateRecommendations(
  positioning: PositioningAnalysis,
  swot: SWOTAnalysis,
  seo: SEOAnalysisResult,
  techStack: TechStackItem[],
  options?: RecommendationsGeneratorOptions
): Promise<RecommendationsReport> {
  const generator = new RecommendationsGenerator(options);
  const result = await generator.generate(positioning, swot, seo, techStack);
  return result.report;
}

export function filterByPriority(recommendations: any[], priority: string): any[] {
  return recommendations.filter((r) => r.priority === priority);
}

export function filterByCategory(recommendations: any[], category: string): any[] {
  return recommendations.filter((r) => r.category === category);
}

export function sortByImpactEffort(recommendations: any[]): any[] {
  const impactScore = (i: string) => (i === 'high' ? 3 : i === 'medium' ? 2 : 1);
  const effortScore = (e: string) => (e === 'high' ? 1 : e === 'medium' ? 2 : 3);
  return [...recommendations].sort(
    (a, b) => impactScore(b.impact) * effortScore(b.effort) - impactScore(a.impact) * effortScore(a.effort)
  );
}

export function getEffortImpactMatrix(recommendations: any[]): any {
  return {
    highImpactLowEffort: recommendations.filter((r) => r.impact === 'high' && r.effort === 'low'),
    highImpactMediumEffort: recommendations.filter((r) => r.impact === 'high' && r.effort === 'medium'),
    highImpactHighEffort: recommendations.filter((r) => r.impact === 'high' && r.effort === 'high'),
    mediumImpactLowEffort: recommendations.filter((r) => r.impact === 'medium' && r.effort === 'low'),
    lowImpactLowEffort: recommendations.filter((r) => r.impact === 'low' && r.effort === 'low'),
  };
}
