export interface Project {
    id: string;
    name: string;
    repo: string;
    phase: "idea" | "planning" | "mvp" | "beta" | "launch" | "growth" | "maintenance";
    monitoringLevel: "minimal" | "standard" | "intensive";
    goals: string[];
    focusAreas: FocusArea[];
    createdAt: number;
    updatedAt: number;
}
export type FocusArea = "ci-cd" | "issues" | "prs" | "security" | "dependencies" | "performance";
export interface Task {
    id: string;
    projectId: string;
    type: TaskType;
    priority: Priority;
    title: string;
    description: string;
    context: string;
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
export type TaskType = "development" | "review" | "planning" | "maintenance" | "investigation" | "notification";
export type Priority = "critical" | "high" | "medium" | "low";
export type TaskStatus = "pending" | "approved" | "rejected" | "in_progress" | "completed" | "failed";
export type KanbanStatus = "not_started" | "backlog";
export type GeneratedBy = "health_check" | "deep_analysis" | "manual" | "chat";
export interface SuggestedAction {
    type: "create_issue" | "comment_issue" | "create_pr" | "merge_pr" | "close_issue" | "notify" | "custom";
    description: string;
    payload: Record<string, unknown>;
}
export interface PendingAction {
    id: string;
    taskId: string;
    action: SuggestedAction;
    createdAt: number;
    expiresAt: number;
    status: "pending" | "approved" | "rejected" | "expired";
    telegramMessageId?: number;
}
export interface ProjectMetrics {
    projectId: string;
    timestamp: number;
    openIssues: number;
    openPRs: number;
    lastCommitAt?: number;
    ciStatus: "passing" | "failing" | "unknown";
    velocity: number;
    healthScore: number;
    securityAlerts: number;
}
export interface ProjectReport {
    projectId: string;
    projectName: string;
    healthScore: number;
    openIssues: number;
    openPRs: number;
    ciStatus: "passing" | "failing" | "unknown";
    risks: string[];
}
export interface AnalysisReport {
    id: string;
    type: "health_check" | "deep_analysis" | "manual";
    projectIds: string[];
    startedAt: number;
    completedAt?: number;
    summary: string;
    findings: Finding[];
    generatedTasks: string[];
    projectReports?: ProjectReport[];
}
export interface Finding {
    severity: "info" | "warning" | "error" | "critical";
    category: string;
    title: string;
    description: string;
    projectId: string;
}
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
export interface AgentConfig {
    healthCheckInterval: string;
    deepAnalysisTime: string;
    timezone: string;
    telegramAdminChatId: string;
    approvalTimeoutMinutes: number;
    maxTasksPerProject: number;
}
export interface ToolDefinition {
    name: string;
    description: string;
    input_schema: {
        type: "object";
        properties: Record<string, unknown>;
        required?: string[];
    };
}
export interface ToolResult {
    success: boolean;
    data?: unknown;
    error?: string;
    requiresApproval?: boolean;
    pendingActionId?: string;
}
export type WSEventType = "connected" | "task_created" | "task_updated" | "action_pending" | "action_approved" | "action_rejected" | "analysis_started" | "analysis_completed" | "agent_log" | "idea_created" | "idea_updated" | "idea_plan_ready" | "idea_launched" | "agent_session_start" | "agent_step" | "agent_session_end" | "chat_start" | "chat_step" | "chat_complete";
export interface WSEvent {
    type: WSEventType;
    timestamp: number;
    data: unknown;
}
export interface Idea {
    id: string;
    title: string;
    description: string;
    status: IdeaStatus;
    plan?: IdeaPlan;
    projectId?: string;
    repoName?: string;
    repoUrl?: string;
    error?: string;
    createdAt: number;
    updatedAt: number;
}
export type IdeaStatus = "submitted" | "planning" | "plan_ready" | "approved" | "creating_repo" | "generating" | "completed" | "failed";
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
//# sourceMappingURL=types.d.ts.map