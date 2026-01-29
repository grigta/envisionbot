import { z } from "zod";

// ============================================
// Sanitization Helpers
// ============================================

// Sanitized string that trims whitespace
const sanitizedString = (maxLength = 1000) =>
  z.string().trim().max(maxLength, `Must be ${maxLength} characters or less`);

// Sanitized short string (for names, titles, etc.)
const shortString = () => sanitizedString(200).min(1, "This field is required");

// Sanitized long string (for descriptions, content, etc.)
const longString = (max = 5000) =>
  z.string().trim().max(max, `Must be ${max} characters or less`).min(1, "This field is required");

// Sanitized optional string
const optionalString = (max = 1000) => z.string().trim().max(max).optional();

// ID validation (alphanumeric, dashes, underscores only)
const idString = () =>
  z.string().trim().min(1).regex(/^[\w-]+$/, "Invalid ID format - only alphanumeric, dashes, and underscores allowed");

// URL validation (strict HTTP/HTTPS only)
const strictUrl = () => z.string().trim().url("Invalid URL").refine(
  (url) => url.startsWith("http://") || url.startsWith("https://"),
  "URL must use HTTP or HTTPS protocol"
);

// ============================================
// Auth Schemas
// ============================================

export const LoginRequestSchema = z.object({
  code: sanitizedString(100).min(1, "Access code is required"),
});

// ============================================
// Project Schemas
// ============================================

export const CreateProjectSchema = z.object({
  id: idString(),
  name: shortString(),
  repo: z.string().trim().regex(/^[\w-]+\/[\w-]+$/, "Repository must be in owner/repo format"),
  phase: z.enum(["idea", "planning", "mvp", "beta", "launch", "growth", "maintenance"]).optional().default("planning"),
  goals: z.array(sanitizedString(500)).max(50, "Too many goals (max 50)").optional().default([]),
  focusAreas: z.array(z.enum(["ci-cd", "issues", "prs", "security", "dependencies", "performance"])).max(10).optional().default([]),
});

export const UpdatePlanMarkdownSchema = z.object({
  markdown: z.string().trim().min(1, "Markdown content is required").max(100000, "Markdown too large"),
});

// ============================================
// Task Schemas
// ============================================

export const UpdateTaskStatusSchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "in_progress", "completed", "failed"]),
});

export const UpdateKanbanStatusSchema = z.object({
  kanbanStatus: z.enum(["not_started", "backlog", "in_progress", "review", "done"]),
});

export const AddTaskDependencySchema = z.object({
  dependsOnTaskId: z.string().min(1, "Dependency task ID is required"),
  type: z.enum(["depends_on", "blocks"]).optional().default("depends_on"),
});

// ============================================
// Agent Schemas
// ============================================

export const RunAgentSchema = z.object({
  prompt: longString(10000),
});

// ============================================
// Ideas Schemas
// ============================================

export const CreateIdeaSchema = z.object({
  title: shortString(),
  description: longString(),
});

export const LaunchIdeaSchema = z.object({
  repoName: z.string().trim().regex(/^[\w-]+$/, "Invalid repository name").optional(),
  isPrivate: z.boolean().optional(),
});

// ============================================
// Chat Schemas
// ============================================

export const SendChatMessageSchema = z.object({
  message: longString(10000),
  projectId: idString().optional(),
  sessionId: idString().optional(),
});

export const CreateChatSessionSchema = z.object({
  title: optionalString(200),
});

// ============================================
// News Schemas
// ============================================

export const TriggerNewsCrawlSchema = z.object({
  fetchDetails: z.boolean().optional().default(false),
  limit: z.number().int().positive().max(100).optional().default(25),
});

export const AnalyzeNewsSchema = z.object({
  analysisType: z.string().optional(),
});

// ============================================
// Crawler Schemas
// ============================================

export const CreateCrawlerSourceSchema = z.object({
  name: shortString(),
  url: strictUrl(),
  prompt: optionalString(5000),
  schema: z.record(z.any()).optional(),
  requiresBrowser: z.boolean().optional().default(false),
  crawlIntervalHours: z.number().int().positive().max(720, "Interval too large").optional().default(24),
});

export const UpdateCrawlerSourceSchema = z.object({
  name: optionalString(200),
  url: strictUrl().optional(),
  prompt: optionalString(5000),
  schema: z.record(z.any()).optional(),
  requiresBrowser: z.boolean().optional(),
  crawlIntervalHours: z.number().int().positive().max(720).optional(),
  isEnabled: z.boolean().optional(),
});

export const TestCrawlerSourceSchema = z.object({
  url: strictUrl(),
  prompt: optionalString(5000),
  requiresBrowser: z.boolean().optional(),
  schema: z.record(z.any()).optional(),
});

// ============================================
// Competitor Schemas
// ============================================

export const CreateCompetitorSchema = z.object({
  name: shortString(),
  domain: z.string().trim().regex(/^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/, "Invalid domain format"),
  description: optionalString(1000),
  industry: optionalString(100),
});

export const UpdateCompetitorSchema = z.object({
  name: optionalString(200),
  domain: z.string().trim().regex(/^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/, "Invalid domain format").optional(),
  description: optionalString(1000),
  industry: optionalString(100),
});

export const StartCompetitorCrawlSchema = z.object({
  maxDepth: z.number().int().min(1, "Depth must be at least 1").max(10, "Depth too large (max 10)").optional(),
  maxPages: z.number().int().min(1).max(10000, "Too many pages (max 10000)").optional(),
  crawlSitemap: z.boolean().optional(),
  respectRobotsTxt: z.boolean().optional(),
  requestsPerMinute: z.number().int().min(1).max(100, "Rate too high (max 100/min)").optional(),
  maxConcurrency: z.number().int().min(1).max(20, "Concurrency too high (max 20)").optional(),
  proxyUrls: z.array(strictUrl()).max(50, "Too many proxy URLs").optional(),
  delayMin: z.number().int().min(0).max(60000, "Delay too large").optional(),
  delayMax: z.number().int().min(0).max(60000, "Delay too large").optional(),
});

export const AnalyzeCompetitorSchema = z.object({
  analysisType: z.enum(["full", "tech", "content", "seo", "ui"]).optional().default("full"),
});

export const GenerateCompetitorReportSchema = z.object({
  competitorIds: z.array(idString()).min(1, "At least one competitor is required").max(100, "Too many competitors"),
  reportType: z.enum(["comparison", "individual", "market"]),
  format: z.enum(["markdown", "json", "html"]),
  title: optionalString(200),
});

export const RejectActionSchema = z.object({
  reason: optionalString(500),
});

// ============================================
// Common Schemas
// ============================================

// ID parameter validation
export const IdParamSchema = z.object({
  id: idString(),
});

// Query pagination schema
export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(1000, "Limit too large (max 1000)").optional(),
  offset: z.coerce.number().int().min(0).max(100000, "Offset too large").optional(),
});

// Project query schema
export const ProjectQuerySchema = z.object({
  projectId: idString().optional(),
  status: sanitizedString(50).optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

// ============================================
// Project PUT Schema
// ============================================

export const UpdateProjectSchema = z.object({
  name: optionalString(200),
  repo: z.string().trim().regex(/^[\w-]+\/[\w-]+$/, "Invalid repo format").optional(),
  phase: z.enum(["idea", "planning", "mvp", "beta", "launch", "growth", "maintenance"]).optional(),
  goals: z.array(sanitizedString(500)).max(50).optional(),
  focusAreas: z.array(z.enum(["ci-cd", "issues", "prs", "security", "dependencies", "performance"])).max(10).optional(),
});

// ============================================
// Idea Query Schema
// ============================================

export const IdeaQuerySchema = z.object({
  status: z.enum(["submitted", "planning", "plan_ready", "approved", "launching", "launched", "failed"]).optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

// ============================================
// Chat History Query Schema
// ============================================

export const ChatHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

// ============================================
// GitHub Repos Query Schema
// ============================================

export const GitHubReposQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).optional(),
});

// ============================================
// News Query Schemas
// ============================================

export const NewsQuerySchema = z.object({
  source: z.enum(["GitHub", "HuggingFace", "Replicate", "Reddit"]).optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
  active: z.coerce.boolean().optional(),
});

export const NewsCrawlHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

// ============================================
// Crawler Query Schemas
// ============================================

export const CrawlerSourcesQuerySchema = z.object({
  enabled: z.coerce.boolean().optional(),
});

export const CrawlerItemsQuerySchema = z.object({
  sourceId: z.string().optional(),
  projectId: z.string().optional(),
  processed: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
});

// ============================================
// Competitor Query Schemas
// ============================================

export const CompetitorsQuerySchema = z.object({
  status: z.enum(["active", "inactive", "crawling", "analyzing"]).optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
});

export const CompetitorPagesQuerySchema = z.object({
  path: optionalString(500),
  depth: z.coerce.number().int().min(0).max(10, "Depth too large").optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
});

export const CompetitorAnalysisQuerySchema = z.object({
  type: z.enum(["full", "tech", "content", "seo", "ui"]).optional(),
});

export const CompetitorReportsQuerySchema = z.object({
  type: z.enum(["comparison", "individual", "market"]).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

// ============================================
// Version Param Schema
// ============================================

export const VersionParamSchema = z.object({
  id: z.string().min(1),
  version: z.string().regex(/^\d+$/, "Version must be a number"),
});

// ============================================
// Job ID Param Schema
// ============================================

export const CompetitorJobParamSchema = z.object({
  id: z.string().min(1),
  jobId: z.string().min(1),
});

// ============================================
// Report ID Param Schema
// ============================================

export const ReportIdParamSchema = z.object({
  reportId: idString(),
});

// ============================================
// Type exports for use in route handlers
// ============================================

export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type CreateProjectRequest = z.infer<typeof CreateProjectSchema>;
export type UpdatePlanMarkdownRequest = z.infer<typeof UpdatePlanMarkdownSchema>;
export type UpdateTaskStatusRequest = z.infer<typeof UpdateTaskStatusSchema>;
export type UpdateKanbanStatusRequest = z.infer<typeof UpdateKanbanStatusSchema>;
export type AddTaskDependencyRequest = z.infer<typeof AddTaskDependencySchema>;
export type RunAgentRequest = z.infer<typeof RunAgentSchema>;
export type CreateIdeaRequest = z.infer<typeof CreateIdeaSchema>;
export type LaunchIdeaRequest = z.infer<typeof LaunchIdeaSchema>;
export type SendChatMessageRequest = z.infer<typeof SendChatMessageSchema>;
export type CreateChatSessionRequest = z.infer<typeof CreateChatSessionSchema>;
export type TriggerNewsCrawlRequest = z.infer<typeof TriggerNewsCrawlSchema>;
export type AnalyzeNewsRequest = z.infer<typeof AnalyzeNewsSchema>;
export type CreateCrawlerSourceRequest = z.infer<typeof CreateCrawlerSourceSchema>;
export type UpdateCrawlerSourceRequest = z.infer<typeof UpdateCrawlerSourceSchema>;
export type TestCrawlerSourceRequest = z.infer<typeof TestCrawlerSourceSchema>;
export type CreateCompetitorRequest = z.infer<typeof CreateCompetitorSchema>;
export type UpdateCompetitorRequest = z.infer<typeof UpdateCompetitorSchema>;
export type StartCompetitorCrawlRequest = z.infer<typeof StartCompetitorCrawlSchema>;
export type AnalyzeCompetitorRequest = z.infer<typeof AnalyzeCompetitorSchema>;
export type GenerateCompetitorReportRequest = z.infer<typeof GenerateCompetitorReportSchema>;
export type RejectActionRequest = z.infer<typeof RejectActionSchema>;
export type IdParam = z.infer<typeof IdParamSchema>;
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export type ProjectQuery = z.infer<typeof ProjectQuerySchema>;
export type UpdateProjectRequest = z.infer<typeof UpdateProjectSchema>;
export type IdeaQuery = z.infer<typeof IdeaQuerySchema>;
export type ChatHistoryQuery = z.infer<typeof ChatHistoryQuerySchema>;
export type GitHubReposQuery = z.infer<typeof GitHubReposQuerySchema>;
export type NewsQuery = z.infer<typeof NewsQuerySchema>;
export type NewsCrawlHistoryQuery = z.infer<typeof NewsCrawlHistoryQuerySchema>;
export type CrawlerSourcesQuery = z.infer<typeof CrawlerSourcesQuerySchema>;
export type CrawlerItemsQuery = z.infer<typeof CrawlerItemsQuerySchema>;
export type CompetitorsQuery = z.infer<typeof CompetitorsQuerySchema>;
export type CompetitorPagesQuery = z.infer<typeof CompetitorPagesQuerySchema>;
export type CompetitorAnalysisQuery = z.infer<typeof CompetitorAnalysisQuerySchema>;
export type CompetitorReportsQuery = z.infer<typeof CompetitorReportsQuerySchema>;
export type VersionParam = z.infer<typeof VersionParamSchema>;
export type CompetitorJobParam = z.infer<typeof CompetitorJobParamSchema>;
export type ReportIdParam = z.infer<typeof ReportIdParamSchema>;
