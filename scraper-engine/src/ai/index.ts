// AI Analysis module exports
export {
  PositioningAnalyzer,
  analyzePositioning,
  type PositioningAnalyzerOptions,
} from './positioning-analyzer.js';

export {
  SWOTGenerator,
  generateSWOT,
  type SWOTGeneratorOptions,
} from './swot-generator.js';

export {
  RecommendationsGenerator,
  generateRecommendations,
  filterByPriority,
  filterByCategory,
  sortByImpactEffort,
  getEffortImpactMatrix,
  type RecommendationsGeneratorOptions,
} from './recommendations.js';

// Claude CLI utilities for Max subscription
export {
  isClaudeCliAvailable,
  runClaudeCli,
  parseJsonFromCli,
  type ClaudeCliOptions,
  type ClaudeCliResult,
} from './claude-cli.js';

// OpenRouter API client
export {
  OpenRouterClient,
  type OpenRouterClientOptions,
} from './openrouter-client.js';
