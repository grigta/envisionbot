import type {
  CrawledPage,
  SWOTAnalysis,
  TechStackItem,
  SEOAnalysisResult,
  SiteStructureAnalysis,
} from '../types.js';
import { OpenRouterClient } from './openrouter-client.js';

const SWOT_PROMPT = `You are an expert competitive analyst performing a SWOT analysis of a competitor's website.

CRITICAL INSTRUCTION: You MUST respond with ONLY a valid JSON object. No explanatory text, no markdown formatting, no code blocks. Start your response with { and end with }.

Based on the following comprehensive data about the competitor, generate a detailed SWOT analysis.

## Competitor Data

Domain: {domain}
Total Pages: {pageCount}

### Technology Stack:
{techStack}

### SEO Summary:
{seoSummary}

### Site Structure:
{structureSummary}

## Required Output Format (JSON only)

{
  "strengths": [{"title": "...", "description": "...", "evidence": "...", "priority": "high|medium|low"}],
  "weaknesses": [{"title": "...", "description": "...", "evidence": "...", "priority": "high|medium|low"}],
  "opportunities": [{"title": "...", "description": "...", "potentialImpact": "...", "priority": "high|medium|low"}],
  "threats": [{"title": "...", "description": "...", "likelihood": "...", "priority": "high|medium|low"}]
}

OUTPUT ONLY THE JSON OBJECT. NO OTHER TEXT.`;

export interface SWOTGeneratorOptions {
  openrouterApiKey?: string;
  model?: string;
  maxTokens?: number;
}

export class SWOTGenerator {
  private client: OpenRouterClient;
  private model: string;
  private maxTokens: number;

  constructor(options: SWOTGeneratorOptions = {}) {
    const apiKey = options.openrouterApiKey || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OpenRouter API key is required.');
    }

    this.model = options.model || process.env.OPENROUTER_MODEL || 'google/gemini-3-flash-preview';
    this.maxTokens = options.maxTokens || 3000;

    this.client = new OpenRouterClient({ apiKey, model: this.model });
    console.log('🤖 SWOT Generator using OpenRouter with', this.model);
  }

  async generate(
    domain: string,
    pages: CrawledPage[],
    techStack: TechStackItem[],
    seoAnalysis: SEOAnalysisResult,
    structureAnalysis: SiteStructureAnalysis
  ): Promise<{ analysis: SWOTAnalysis; tokensUsed: number }> {
    const prompt = this.buildPrompt(domain, pages, techStack, seoAnalysis, structureAnalysis);

    const response = await this.client.createCompletion({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: this.maxTokens,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    const analysis = JSON.parse(content.trim()) as SWOTAnalysis;

    return { analysis, tokensUsed: response.usage.total_tokens };
  }

  private buildPrompt(
    domain: string,
    pages: CrawledPage[],
    techStack: TechStackItem[],
    seoAnalysis: SEOAnalysisResult,
    structureAnalysis: SiteStructureAnalysis
  ): string {
    const techStackStr = techStack.map((t) => `${t.name} (${t.category})`).join(', ');
    const seoSummary = `Issues found: ${seoAnalysis.issues.length}`;
    const structureSummary = `Max depth: ${structureAnalysis.maxDepth}, Pages: ${pages.length}`;

    return SWOT_PROMPT
      .replace('{domain}', domain)
      .replace('{pageCount}', String(pages.length))
      .replace('{techStack}', techStackStr || 'Unknown')
      .replace('{seoSummary}', seoSummary)
      .replace('{structureSummary}', structureSummary);
  }
}

export async function generateSWOT(
  domain: string,
  pages: CrawledPage[],
  techStack: TechStackItem[],
  seoAnalysis: SEOAnalysisResult,
  structureAnalysis: SiteStructureAnalysis,
  options?: SWOTGeneratorOptions
): Promise<SWOTAnalysis> {
  const generator = new SWOTGenerator(options);
  const result = await generator.generate(domain, pages, techStack, seoAnalysis, structureAnalysis);
  return result.analysis;
}
