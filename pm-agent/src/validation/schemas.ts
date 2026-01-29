import { z } from "zod";
import validator from "validator";

/**
 * Common validation schemas and helpers for API input validation
 */

// ========== Common Validators ==========

/**
 * Sanitizes a string by trimming whitespace and limiting length
 */
export const sanitizeString = (str: string, maxLength = 10000): string => {
  return str.trim().slice(0, maxLength);
};

/**
 * Custom URL validator that's more strict than Zod's default
 */
const urlSchema = z.string().refine(
  (val) => {
    try {
      const url = new URL(val);
      // Only allow http and https protocols
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  },
  { message: "Invalid URL format. Must be http or https URL." }
);

/**
 * Domain validator (for competitor domain inputs)
 */
const domainSchema = z.string().refine(
  (val) => validator.isFQDN(val) || validator.isURL(val, { require_protocol: false }),
  { message: "Invalid domain format" }
);

/**
 * Positive integer validator with max limit
 */
const positiveInt = (max = 1000) =>
  z.number().int().positive().max(max, `Must be at most ${max}`);

/**
 * Limited string validator with sanitization
 */
const limitedString = (minLen = 1, maxLen = 1000) =>
  z
    .string()
    .min(minLen, `Must be at least ${minLen} characters`)
    .max(maxLen, `Must be at most ${maxLen} characters`)
    .transform(sanitizeString);

/**
 * Optional limited string
 */
const optionalLimitedString = (maxLen = 1000) =>
  z.string().max(maxLen).transform(sanitizeString).optional();

/**
 * ID validator (alphanumeric, dashes, underscores)
 */
const idSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/, "ID must contain only alphanumeric characters, dashes, and underscores");

// ========== Auth Schemas ==========

export const loginSchema = z.object({
  code: limitedString(1, 500),
});

// ========== Project Schemas ==========

export const createProjectSchema = z.object({
  id: idSchema,
  name: limitedString(1, 200),
  repo: limitedString(1, 500),
  phase: z.enum(["planning", "development", "testing", "production"]).optional(),
  goals: z.array(limitedString(1, 500)).max(50).optional(),
  focusAreas: z
    .array(z.enum(["ci-cd", "issues", "prs"]))
    .max(10)
    .optional(),
});

export const updatePlanSchema = z.object({
  markdown: limitedString(1, 100000), // Plans can be long
});

export const planVersionSchema = z.object({
  version: z.coerce.number().int().positive(),
});

// ========== Task Schemas ==========

export const taskQuerySchema = z.object({
  projectId: idSchema.optional(),
  status: z.enum(["pending", "in-progress", "completed", "blocked"]).optional(),
});

export const updateTaskStatusSchema = z.object({
  status: z.enum(["pending", "in-progress", "completed", "blocked"]),
});

export const updateKanbanStatusSchema = z.object({
  kanbanStatus: z.enum(["not_started", "backlog", "in_progress", "review", "done"]),
});

// ========== Action/Approval Schemas ==========

export const rejectActionSchema = z.object({
  reason: limitedString(1, 1000).optional(),
});

// ========== Agent Schemas ==========

export const runAgentSchema = z.object({
  prompt: limitedString(1, 10000),
});

// ========== Ideas Schemas ==========

export const ideasQuerySchema = z.object({
  status: z.enum(["submitted", "planning", "plan_ready", "approved", "in_progress", "launched", "failed"]).optional(),
});

export const createIdeaSchema = z.object({
  title: limitedString(1, 200),
  description: limitedString(1, 5000),
});

export const launchIdeaSchema = z.object({
  repoName: limitedString(1, 100).regex(
    /^[a-zA-Z0-9_-]+$/,
    "Repository name must contain only alphanumeric characters, dashes, and underscores"
  ).optional(),
  isPrivate: z.boolean().optional(),
});

// ========== Chat Schemas ==========

export const chatMessageSchema = z.object({
  message: limitedString(1, 10000),
  projectId: idSchema.optional(),
  sessionId: idSchema.optional(),
});

export const createChatSessionSchema = z.object({
  title: optionalLimitedString(200),
});

export const chatHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(1000).optional(),
});

// ========== GitHub Schemas ==========

export const githubReposQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(1000).optional(),
});

export const mentionsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(1000).optional(),
});

// ========== News Schemas ==========

export const newsQuerySchema = z.object({
  source: limitedString(1, 100).optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
  active: z.coerce.boolean().optional(),
});

export const newsCrawlSchema = z.object({
  fetchDetails: z.boolean().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
});

export const newsCrawlHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

// ========== Universal Crawler Schemas ==========

export const crawlerSourcesQuerySchema = z.object({
  enabled: z.coerce.boolean().optional(),
});

export const createCrawlerSourceSchema = z.object({
  name: limitedString(1, 200),
  url: urlSchema,
  prompt: limitedString(1, 5000),
  schema: z.record(z.any()).optional(), // JSON schema
  requiresBrowser: z.boolean().optional(),
  crawlIntervalHours: z.number().int().positive().max(720).optional(), // Max 30 days
});

export const updateCrawlerSourceSchema = z.object({
  name: optionalLimitedString(200),
  url: urlSchema.optional(),
  prompt: optionalLimitedString(5000),
  schema: z.record(z.any()).optional(),
  requiresBrowser: z.boolean().optional(),
  crawlIntervalHours: z.number().int().positive().max(720).optional(),
  enabled: z.boolean().optional(),
});

export const testCrawlerSchema = z.object({
  url: urlSchema,
  prompt: limitedString(1, 5000),
  requiresBrowser: z.boolean().optional(),
  schema: z.record(z.any()).optional(),
});

export const crawlerItemsQuerySchema = z.object({
  sourceId: idSchema.optional(),
  projectId: idSchema.optional(),
  processed: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
});

// ========== Competitors Schemas ==========

export const competitorQuerySchema = z.object({
  status: z.enum(["active", "paused", "archived"]).optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
});

export const createCompetitorSchema = z.object({
  name: limitedString(1, 200),
  domain: domainSchema,
  description: optionalLimitedString(2000),
  industry: optionalLimitedString(100),
});

export const updateCompetitorSchema = z.object({
  name: optionalLimitedString(200),
  domain: domainSchema.optional(),
  description: optionalLimitedString(2000),
  industry: optionalLimitedString(100),
  status: z.enum(["active", "paused", "archived"]).optional(),
});

export const crawlCompetitorSchema = z.object({
  maxPages: z.number().int().positive().max(1000).optional(),
  maxDepth: z.number().int().positive().max(10).optional(),
  includeExternal: z.boolean().optional(),
  followSubdomains: z.boolean().optional(),
  respectRobotsTxt: z.boolean().optional(),
  crawlDelay: z.number().int().min(0).max(10000).optional(), // Max 10 seconds
  userAgent: optionalLimitedString(500),
  proxyUrls: z.array(urlSchema).max(10).optional(),
  patterns: z
    .object({
      include: z.array(limitedString(1, 500)).max(50).optional(),
      exclude: z.array(limitedString(1, 500)).max(50).optional(),
    })
    .optional(),
});

export const analyzeCompetitorSchema = z.object({
  analysisType: z.enum(["positioning", "swot", "tech-stack", "seo", "full"]),
});

export const competitorPagesQuerySchema = z.object({
  path: optionalLimitedString(500),
  depth: z.coerce.number().int().min(0).max(10).optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
});

export const competitorAnalysisQuerySchema = z.object({
  type: z.enum(["positioning", "swot", "tech-stack", "seo", "full"]).optional(),
});

export const generateCompetitorReportSchema = z.object({
  competitorIds: z.array(idSchema).min(1).max(50),
  reportType: z.enum(["comparison", "individual", "market-analysis"]),
  format: z.enum(["pdf", "markdown", "html"]).optional(),
  title: optionalLimitedString(200),
});

export const competitorReportsQuerySchema = z.object({
  type: z.enum(["comparison", "individual", "market-analysis"]).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

// ========== Params Schemas ==========

export const idParamSchema = z.object({
  id: idSchema,
});

export const versionParamSchema = z.object({
  id: idSchema,
  version: z.coerce.number().int().positive(),
});

export const jobIdParamSchema = z.object({
  id: idSchema,
  jobId: idSchema,
});

export const reportIdParamSchema = z.object({
  reportId: idSchema,
});

// ========== Type exports ==========

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type TaskQueryInput = z.infer<typeof taskQuerySchema>;
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;
export type UpdateKanbanStatusInput = z.infer<typeof updateKanbanStatusSchema>;
export type RejectActionInput = z.infer<typeof rejectActionSchema>;
export type RunAgentInput = z.infer<typeof runAgentSchema>;
export type CreateIdeaInput = z.infer<typeof createIdeaSchema>;
export type LaunchIdeaInput = z.infer<typeof launchIdeaSchema>;
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
export type CreateChatSessionInput = z.infer<typeof createChatSessionSchema>;
export type NewsCrawlInput = z.infer<typeof newsCrawlSchema>;
export type CreateCrawlerSourceInput = z.infer<typeof createCrawlerSourceSchema>;
export type UpdateCrawlerSourceInput = z.infer<typeof updateCrawlerSourceSchema>;
export type TestCrawlerInput = z.infer<typeof testCrawlerSchema>;
export type CreateCompetitorInput = z.infer<typeof createCompetitorSchema>;
export type UpdateCompetitorInput = z.infer<typeof updateCompetitorSchema>;
export type CrawlCompetitorInput = z.infer<typeof crawlCompetitorSchema>;
export type AnalyzeCompetitorInput = z.infer<typeof analyzeCompetitorSchema>;
export type GenerateCompetitorReportInput = z.infer<typeof generateCompetitorReportSchema>;
