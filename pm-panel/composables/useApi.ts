export function useApi() {
  const config = useRuntimeConfig();
  const baseUrl = config.public.apiBaseUrl;

  async function fetchApi<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Projects
  const getProjects = () => fetchApi<Project[]>("/api/projects");
  const getProject = (id: string) => fetchApi<Project>(`/api/projects/${id}`);
  const createProject = (data: Partial<Project>) =>
    fetchApi<Project>("/api/projects", {
      method: "POST",
      body: JSON.stringify(data),
    });
  const deleteProject = (id: string) =>
    fetchApi<{ success: boolean }>(`/api/projects/${id}`, { method: "DELETE" });

  // Tasks
  const getTasks = (filter?: { projectId?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filter?.projectId) params.set("projectId", filter.projectId);
    if (filter?.status) params.set("status", filter.status);
    const query = params.toString();
    return fetchApi<Task[]>(`/api/tasks${query ? `?${query}` : ""}`);
  };
  const getPendingTasks = () => fetchApi<Task[]>("/api/tasks/pending");
  const updateTaskStatus = (id: string, status: string) =>
    fetchApi<Task>(`/api/tasks/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    });
  const updateTaskKanbanStatus = (id: string, kanbanStatus: KanbanStatus) =>
    fetchApi<Task>(`/api/tasks/${id}/kanban-status`, {
      method: "PATCH",
      body: JSON.stringify({ kanbanStatus }),
    });

  // Actions
  const getPendingActions = () => fetchApi<PendingAction[]>("/api/actions/pending");
  const approveAction = (id: string) =>
    fetchApi<{ success: boolean; result?: unknown }>(`/api/actions/${id}/approve`, {
      method: "POST",
    });
  const rejectAction = (id: string, reason?: string) =>
    fetchApi<{ success: boolean }>(`/api/actions/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });

  // Reports
  const getReports = () => fetchApi<AnalysisReport[]>("/api/reports");
  const getReport = (id: string) => fetchApi<AnalysisReport>(`/api/reports/${id}`);
  const deleteReport = (id: string) =>
    fetchApi<{ success: boolean }>(`/api/reports/${id}`, { method: "DELETE" });

  // Agent
  const getAgentStatus = () =>
    fetchApi<{
      running: boolean;
      lastHealthCheck?: number;
      lastDeepAnalysis?: number;
      pendingActionsCount: number;
    }>("/api/agent/status");
  const runHealthCheck = () =>
    fetchApi<{ success: boolean; reportId?: string }>("/api/agent/health-check", {
      method: "POST",
      body: JSON.stringify({}),
    });
  const runDeepAnalysis = () =>
    fetchApi<{ success: boolean; reportId?: string }>("/api/agent/deep-analysis", {
      method: "POST",
      body: JSON.stringify({}),
    });
  const runAgent = (prompt: string) =>
    fetchApi<{ response: string; tasksCount: number; reportId?: string }>("/api/agent/run", {
      method: "POST",
      body: JSON.stringify({ prompt }),
    });

  // Stats
  const getStats = () =>
    fetchApi<{
      projectCount: number;
      taskCount: number;
      pendingActionsCount: number;
      ideaCount: number;
      activeIdeasCount: number;
      lastHealthCheck?: number;
      lastDeepAnalysis?: number;
    }>("/api/stats");

  // Ideas
  const getIdeas = (filter?: { status?: string }) => {
    const params = new URLSearchParams();
    if (filter?.status) params.set("status", filter.status);
    const query = params.toString();
    return fetchApi<Idea[]>(`/api/ideas${query ? `?${query}` : ""}`);
  };
  const getIdea = (id: string) => fetchApi<Idea>(`/api/ideas/${id}`);
  const createIdea = (data: { title: string; description: string }) =>
    fetchApi<Idea>("/api/ideas", {
      method: "POST",
      body: JSON.stringify(data),
    });
  const deleteIdea = (id: string) =>
    fetchApi<{ success: boolean }>(`/api/ideas/${id}`, { method: "DELETE" });
  const planIdea = (id: string) =>
    fetchApi<{ success: boolean; message: string }>(`/api/ideas/${id}/plan`, {
      method: "POST",
    });
  const approveIdea = (id: string) =>
    fetchApi<{ success: boolean; message: string }>(`/api/ideas/${id}/approve`, {
      method: "POST",
    });
  const launchIdea = (id: string, config?: { repoName?: string; isPrivate?: boolean }) =>
    fetchApi<{ success: boolean; message: string }>(`/api/ideas/${id}/launch`, {
      method: "POST",
      body: JSON.stringify(config || {}),
    });
  const getIdeaStatus = (id: string) =>
    fetchApi<{
      id: string;
      status: string;
      error?: string;
      projectId?: string;
      repoUrl?: string;
    }>(`/api/ideas/${id}/status`);

  // Chat
  const sendChatMessage = (message: string, options?: { projectId?: string; sessionId?: string }) =>
    fetchApi<{ chatId: string; success: boolean; response?: string; projectIds?: string[] }>("/api/chat/message", {
      method: "POST",
      body: JSON.stringify({ message, ...options }),
    });
  const getChatHistory = (limit?: number) => {
    const params = new URLSearchParams();
    if (limit) params.set("limit", String(limit));
    const query = params.toString();
    return fetchApi<ChatSession[]>(`/api/chat/history${query ? `?${query}` : ""}`);
  };
  const getChatSession = (id: string) => fetchApi<ChatSession>(`/api/chat/sessions/${id}`);
  const createChatSession = (title?: string) =>
    fetchApi<ChatSession>("/api/chat/sessions", {
      method: "POST",
      body: JSON.stringify({ title }),
    });
  const switchChatSession = (id: string) =>
    fetchApi<ChatSession>(`/api/chat/sessions/${id}/switch`, { method: "POST" });
  const deleteChatSession = (id: string) =>
    fetchApi<{ success: boolean }>(`/api/chat/sessions/${id}`, { method: "DELETE" });
  const getCurrentChatSession = () => fetchApi<ChatSession>("/api/chat/current");

  // GitHub
  const getGitHubRepos = (limit?: number) => {
    const params = new URLSearchParams();
    if (limit) params.set("limit", String(limit));
    const query = params.toString();
    return fetchApi<GitHubRepo[]>(`/api/github/repos${query ? `?${query}` : ""}`);
  };
  const getMentionables = (limit?: number) => {
    const params = new URLSearchParams();
    if (limit) params.set("limit", String(limit));
    const query = params.toString();
    return fetchApi<Mentionable[]>(`/api/mentions${query ? `?${query}` : ""}`);
  };

  return {
    // Projects
    getProjects,
    getProject,
    createProject,
    deleteProject,
    // Tasks
    getTasks,
    getPendingTasks,
    updateTaskStatus,
    updateTaskKanbanStatus,
    // Actions
    getPendingActions,
    approveAction,
    rejectAction,
    // Reports
    getReports,
    getReport,
    deleteReport,
    // Agent
    getAgentStatus,
    runHealthCheck,
    runDeepAnalysis,
    runAgent,
    // Stats
    getStats,
    // Ideas
    getIdeas,
    getIdea,
    createIdea,
    deleteIdea,
    planIdea,
    approveIdea,
    launchIdea,
    getIdeaStatus,
    // Chat
    sendChatMessage,
    getChatHistory,
    getChatSession,
    createChatSession,
    switchChatSession,
    deleteChatSession,
    getCurrentChatSession,
    // GitHub
    getGitHubRepos,
    getMentionables,
  };
}

// Types (should match pm-agent types)
export interface Project {
  id: string;
  name: string;
  repo: string;
  phase: string;
  monitoringLevel: string;
  goals: string[];
  focusAreas: string[];
  createdAt: number;
  updatedAt: number;
}

export type KanbanStatus = "not_started" | "backlog";
export type GeneratedBy = "health_check" | "deep_analysis" | "manual" | "chat";

export interface Task {
  id: string;
  projectId: string;
  type: string;
  priority: string;
  title: string;
  description: string;
  context: string;
  suggestedActions: SuggestedAction[];
  relatedIssues: string[];
  relatedPRs: string[];
  status: string;
  kanbanStatus: KanbanStatus;
  generatedAt: number;
  completedAt?: number;
  generatedBy?: GeneratedBy;
}

export interface SuggestedAction {
  type: string;
  description: string;
  payload: Record<string, unknown>;
}

export interface PendingAction {
  id: string;
  taskId: string;
  action: SuggestedAction;
  createdAt: number;
  expiresAt: number;
  status: string;
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
  type: string;
  projectIds: string[];
  startedAt: number;
  completedAt?: number;
  summary: string;
  findings: Finding[];
  generatedTasks: string[];
  projectReports?: ProjectReport[];
}

export interface Finding {
  severity: string;
  category: string;
  title: string;
  description: string;
  projectId: string;
}

// Idea types
export interface Idea {
  id: string;
  title: string;
  description: string;
  status: string;
  plan?: IdeaPlan;
  projectId?: string;
  repoName?: string;
  repoUrl?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

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
  type: string;
  description: string;
}

export interface PlannedFeature {
  name: string;
  description: string;
  priority: string;
}

// Chat types
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  projectIds?: string[];
  mentions?: Array<{ type: string; value: string }>;
  steps?: AgentStep[];
  success?: boolean;
  error?: string;
}

export interface ChatSession {
  id: string;
  title?: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface AgentStep {
  id: string;
  type: string;
  timestamp: number;
  content: string;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  status?: string;
}

// GitHub types
export interface GitHubRepo {
  name: string;
  fullName: string;
  description: string;
  isPrivate: boolean;
  url: string;
}

export interface Mentionable {
  id: string;
  type: "project" | "repo";
  label: string;
  description: string;
  value: string;
  icon: string;
}
