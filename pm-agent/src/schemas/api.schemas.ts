import { z } from "zod";

// ============================================
// Auth Schemas
// ============================================

export const LoginRequestSchema = z.object({
  code: z.string().min(1, "Access code is required"),
});

// ============================================
// Project Schemas
// ============================================

export const CreateProjectSchema = z.object({
  id: z.string().min(1, "Project ID is required"),
  name: z.string().min(1, "Project name is required"),
  repo: z.string().regex(/^[\w-]+\/[\w-]+$/, "Repository must be in owner/repo format"),
  phase: z.enum(["idea", "planning", "mvp", "beta", "launch", "growth", "maintenance"]).optional().default("planning"),
  goals: z.array(z.string()).optional().default([]),
  focusAreas: z.array(z.enum(["ci-cd", "issues", "prs", "security", "dependencies", "performance"])).optional().default([]),
});

export const UpdatePlanMarkdownSchema = z.object({
  markdown: z.string().min(1, "Markdown content is required"),
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

// ============================================
// Agent Schemas
// ============================================

export const RunAgentSchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
});

// ============================================
// Ideas Schemas
// ============================================

export const CreateIdeaSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  description: z.string().min(1, "Description is required").max(5000, "Description too long"),
});

export const LaunchIdeaSchema = z.object({
  repoName: z.string().regex(/^[\w-]+$/, "Invalid repository name").optional(),
  isPrivate: z.boolean().optional(),
});

// ============================================
// Chat Schemas
// ============================================

export const SendChatMessageSchema = z.object({
  message: z.string().min(1, "Message is required").max(10000, "Message too long"),
  projectId: z.string().optional(),
  sessionId: z.string().optional(),
});

export const CreateChatSessionSchema = z.object({
  title: z.string().max(200, "Title too long").optional(),
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
  name: z.string().min(1, "Name is required").max(200, "Name too long"),
  url: z.string().url("Invalid URL"),
  prompt: z.string().max(5000, "Prompt too long").optional(),
  schema: z.record(z.any()).optional(),
  requiresBrowser: z.boolean().optional().default(false),
  crawlIntervalHours: z.number().int().positive().max(720).optional().default(24),
});

export const UpdateCrawlerSourceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  url: z.string().url().optional(),
  prompt: z.string().max(5000).optional(),
  schema: z.record(z.any()).optional(),
  requiresBrowser: z.boolean().optional(),
  crawlIntervalHours: z.number().int().positive().max(720).optional(),
  isEnabled: z.boolean().optional(),
});

export const TestCrawlerSourceSchema = z.object({
  url: z.string().url("Invalid URL"),
  prompt: z.string().max(5000, "Prompt too long").optional(),
  requiresBrowser: z.boolean().optional(),
  schema: z.record(z.any()).optional(),
});

// ============================================
// Competitor Schemas
// ============================================

export const CreateCompetitorSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name too long"),
  domain: z.string().regex(/^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/, "Invalid domain"),
  description: z.string().max(1000, "Description too long").optional(),
  industry: z.string().max(100, "Industry too long").optional(),
});

export const UpdateCompetitorSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  domain: z.string().regex(/^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/).optional(),
  description: z.string().max(1000).optional(),
  industry: z.string().max(100).optional(),
});

export const StartCompetitorCrawlSchema = z.object({
  maxDepth: z.number().int().min(1).max(10).optional(),
  maxPages: z.number().int().min(1).max(10000).optional(),
  crawlSitemap: z.boolean().optional(),
  respectRobotsTxt: z.boolean().optional(),
  requestsPerMinute: z.number().int().min(1).max(100).optional(),
  maxConcurrency: z.number().int().min(1).max(20).optional(),
  proxyUrls: z.array(z.string().url()).optional(),
  delayMin: z.number().int().min(0).optional(),
  delayMax: z.number().int().min(0).optional(),
});

export const AnalyzeCompetitorSchema = z.object({
  analysisType: z.enum(["full", "tech", "content", "seo", "ui"]).optional().default("full"),
});

export const GenerateCompetitorReportSchema = z.object({
  competitorIds: z.array(z.string()).min(1, "At least one competitor is required"),
  reportType: z.enum(["comparison", "individual", "market"]),
  format: z.enum(["markdown", "json", "html"]),
  title: z.string().max(200).optional(),
});

export const RejectActionSchema = z.object({
  reason: z.string().max(500).optional(),
});

// ============================================
// Type exports for use in route handlers
// ============================================

export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type CreateProjectRequest = z.infer<typeof CreateProjectSchema>;
export type UpdatePlanMarkdownRequest = z.infer<typeof UpdatePlanMarkdownSchema>;
export type UpdateTaskStatusRequest = z.infer<typeof UpdateTaskStatusSchema>;
export type UpdateKanbanStatusRequest = z.infer<typeof UpdateKanbanStatusSchema>;
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
