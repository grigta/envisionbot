// Analyzer module exports
export {
  detectTechStack,
  groupByCategory,
  getCategoryLabel,
  type TechDetectionContext,
} from './tech-detector.js';

export {
  analyzeSEO,
  getIssueSeverityColor,
  getScoreColor,
  getScoreLabel,
} from './seo-analyzer.js';

export {
  analyzeSiteStructure,
  flattenTree,
  getPathsAtDepth,
  findNodeByPath,
  getStructureStats,
  generateStructureSummary,
} from './structure-analyzer.js';
