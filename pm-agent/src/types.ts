// Project types
export interface Project {
  id: string;
  name: string;
  repo: string; // owner/repo format
  phase: "idea" | "planning" | "mvp" | "beta" | "launch" | "growth" | "maintenance";
  monitoringLevel: "minimal" | "standard" | "intensive";
  goals: string[];
  focusAreas: FocusArea[];
  createdAt: number;
  updatedAt: number;
}

export type FocusArea = "ci-cd" | "issues" | "prs" | "security" | "dependencies" | "performance";

// Task types
export interface Task {
  id: string;
  projectId: string;
  type: TaskType;
  priority: Priority;
  title: string;
  description: string;
  context: string; // Why this task was generated
  suggestedActions: SuggestedAction[];
  relatedIssues: string[];
  relatedPRs: string[];
  status: TaskStatus;
  kanbanStatus: KanbanStatus;
  generatedAt: number;
  completedAt?: number;
  approvedBy?: "telegram" | "web" | "auto";
  generatedBy?: GeneratedBy;
}

export type TaskType = "development" | "review" | "planning" | "maintenance" | "investigation" | "notification" | "documentation" | "security" | "improvement";
export type Priority = "critical" | "high" | "medium" | "low";
export type TaskStatus = "pending" | "approved" | "rejected" | "in_progress" | "completed" | "failed";
export type KanbanStatus = "not_started" | "backlog" | "in_progress" | "review" | "done";
export type GeneratedBy = "health_check" | "deep_analysis" | "manual" | "chat" | "plan_sync";

export interface SuggestedAction {
  type: "create_issue" | "comment_issue" | "create_pr" | "merge_pr" | "close_issue" | "notify" | "custom";
  description: string;
  payload: Record<string, unknown>;
}

// Pending action for approval
export interface PendingAction {
  id: string;
  taskId: string;
  action: SuggestedAction;
  createdAt: number;
  expiresAt: number;
  status: "pending" | "approved" | "rejected" | "expired";
  telegramMessageId?: number;
}

// Project metrics
export interface ProjectMetrics {
  projectId: string;
  timestamp: number;
  openIssues: number;
  openPRs: number;
  lastCommitAt?: number;
  ciStatus: "passing" | "failing" | "unknown";
  velocity: number; // Issues closed per week
  healthScore: number; // 0-100
  securityAlerts: number;
}

// Project report - snapshot of project status during analysis
export interface ProjectReport {
  projectId: string;
  projectName: string;
  healthScore: number; // 0-100
  openIssues: number;
  openPRs: number;
  ciStatus: "passing" | "failing" | "unknown";
  risks: string[];
}

// Analysis report
export interface AnalysisReport {
  id: string;
  type: "health_check" | "deep_analysis" | "manual";
  projectIds: string[];
  startedAt: number;
  completedAt?: number;
  summary: string;
  findings: Finding[];
  generatedTasks: string[]; // Task IDs
  projectReports?: ProjectReport[]; // Structured project data
}

export interface Finding {
  severity: "info" | "warning" | "error" | "critical";
  category: string;
  title: string;
  description: string;
  projectId: string;
}

// State store
export interface StateStore {
  version: number;
  projects: Project[];
  tasks: Task[];
  pendingActions: PendingAction[];
  metrics: ProjectMetrics[];
  reports: AnalysisReport[];
  ideas: Idea[];
  lastHealthCheck?: number;
  lastDeepAnalysis?: number;
}

// Config
export interface AgentConfig {
  healthCheckInterval: string; // e.g., "4h"
  deepAnalysisTime: string; // e.g., "09:00"
  timezone: string;
  telegramAdminChatId: string;
  approvalTimeoutMinutes: number;
  maxTasksPerProject: number;
}

// Tool definitions for Claude
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// Tool result
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  requiresApproval?: boolean;
  pendingActionId?: string;
}

// WebSocket events
export type WSEventType =
  | "connected"
  | "task_created"
  | "task_updated"
  | "action_pending"
  | "action_approved"
  | "action_rejected"
  | "analysis_started"
  | "analysis_completed"
  | "agent_log"
  | "idea_created"
  | "idea_updated"
  | "idea_plan_ready"
  | "idea_launched"
  // Agent session events (for live gateway)
  | "agent_session_start"
  | "agent_step"
  | "agent_session_end"
  // Chat events
  | "chat_start"
  | "chat_step"
  | "chat_complete"
  // Project analysis events
  | "analysis_progress"
  | "plan_updated"
  | "plan_task_synced";

export interface WSEvent {
  type: WSEventType;
  timestamp: number;
  data: unknown;
}

// Idea types - for launching new projects from scratch
export interface Idea {
  id: string;
  title: string;
  description: string;
  status: IdeaStatus;
  plan?: IdeaPlan;
  projectId?: string; // After project is created
  repoName?: string;
  repoUrl?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export type IdeaStatus =
  | "submitted" // Just created
  | "planning" // Agent is planning
  | "plan_ready" // Plan ready, waiting for approval
  | "approved" // Plan approved
  | "creating_repo" // Creating GitHub repository
  | "generating" // Generating code via Claude Code
  | "completed" // Project created successfully
  | "failed"; // Error occurred

export interface IdeaPlan {
  summary: string;
  techStack: string[];
  structure: ProjectStructure[];
  features: PlannedFeature[];
  estimatedFiles: number;
  repoNameSuggestion: string;
}

export interface ProjectStructure {
  path: string;
  type: "file" | "directory";
  description: string;
}

export interface PlannedFeature {
  name: string;
  description: string;
  priority: "core" | "important" | "nice-to-have";
}

// ============================================
// PROJECT PLAN TYPES (for codebase analysis)
// ============================================

export interface ProjectPlan {
  id: string;
  projectId: string;
  markdown: string;
  version: number;
  generatedAt: number;
  updatedAt: number;
  analysisSummary?: string;
  // Parsed sections from markdown
  sections?: PlanSection[];
}

export interface PlanVersion {
  id: string;
  planId: string;
  version: number;
  markdown: string;
  analysisSummary?: string;
  changeSummary?: string;
  createdAt: number;
}

export interface PlanSection {
  id: string;
  title: string;
  type: "overview" | "current_state" | "roadmap" | "technical_debt" | "risks" | "notes";
  items: PlanItem[];
}

export interface PlanItem {
  id: string;
  content: string;
  completed: boolean;
  taskId?: string; // Link to generated task
  priority?: "critical" | "high" | "medium" | "low";
  phase?: string; // e.g., "MVP", "Beta"
}

export interface AnalysisStatus {
  projectId: string;
  status: "idle" | "cloning" | "analyzing" | "generating" | "syncing" | "completed" | "failed";
  progress: number; // 0-100
  currentStep?: string;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface CodebaseAnalysisResult {
  implemented: string[];
  missing: string[];
  technicalDebt: string[];
  risks: string[];
  suggestedTasks: Array<{
    title: string;
    description: string;
    priority: "critical" | "high" | "medium" | "low";
    type: TaskType;
    phase?: string;
  }>;
  notes: string;
}
