export function useApi() {
  const config = useRuntimeConfig();
  const baseUrl = config.public.apiBaseUrl;
  const { token, clearAuth } = useAuth();

  async function fetchApi<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${baseUrl}${endpoint}`;

    // Build headers with auth token
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    // Only set Content-Type if there's a body
    if (options.body) {
      headers["Content-Type"] = "application/json";
    }

    // Add auth header if token exists
    if (token.value) {
      headers["Authorization"] = `Bearer ${token.value}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle 401 - token expired or invalid
    if (response.status === 401) {
      if (import.meta.client) {
        clearAuth();
        navigateTo("/login");
      }
      throw new Error("Authentication required");
    }

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

  // Project Analysis
  const startProjectAnalysis = (projectId: string) =>
    fetchApi<{ status: string; projectId: string }>(`/api/projects/${projectId}/analyze`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  const getAnalysisStatus = (projectId: string) =>
    fetchApi<AnalysisStatus>(`/api/projects/${projectId}/analyze/status`);
  const getProjectPlan = (projectId: string) =>
    fetchApi<ProjectPlan>(`/api/projects/${projectId}/plan`);
  const updateProjectPlan = (projectId: string, markdown: string) =>
    fetchApi<ProjectPlan>(`/api/projects/${projectId}/plan`, {
      method: "PUT",
      body: JSON.stringify({ markdown }),
    });
  const syncTasksFromPlan = (projectId: string) =>
    fetchApi<{ success: boolean; message: string }>(`/api/projects/${projectId}/sync-tasks`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  const getPlanVersions = (projectId: string) =>
    fetchApi<PlanVersion[]>(`/api/projects/${projectId}/plan/versions`);
  const getPlanVersion = (projectId: string, version: number) =>
    fetchApi<PlanVersion>(`/api/projects/${projectId}/plan/versions/${version}`);

  // News
  const getNews = (filter?: { source?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (filter?.source) params.set("source", filter.source);
    if (filter?.limit) params.set("limit", String(filter.limit));
    const query = params.toString();
    return fetchApi<NewsItem[]>(`/api/news${query ? `?${query}` : ""}`);
  };
  const getNewsItem = (id: string) => fetchApi<NewsItem>(`/api/news/${id}`);
  const triggerNewsCrawl = (options?: { fetchDetails?: boolean; limit?: number }) =>
    fetchApi<{ status: string }>("/api/news/crawl", {
      method: "POST",
      body: JSON.stringify(options || {}),
    });
  const analyzeNewsItem = (id: string) =>
    fetchApi<AIApplicationAnalysis>(`/api/news/${id}/analyze`, {
      method: "POST",
    });
  const getNewsStats = () => fetchApi<NewsStats>("/api/news/stats");
  const getNewsCrawlHistory = (limit?: number) => {
    const params = new URLSearchParams();
    if (limit) params.set("limit", String(limit));
    const query = params.toString();
    return fetchApi<CrawlHistory[]>(`/api/news/crawl/history${query ? `?${query}` : ""}`);
  };

  // Universal Crawler
  const getCrawlerSources = (filter?: { enabled?: boolean }) => {
    const params = new URLSearchParams();
    if (filter?.enabled !== undefined) params.set("enabled", String(filter.enabled));
    const query = params.toString();
    return fetchApi<CrawlerSource[]>(`/api/crawler/sources${query ? `?${query}` : ""}`);
  };
  const getCrawlerSource = (id: string) => fetchApi<CrawlerSource>(`/api/crawler/sources/${id}`);
  const createCrawlerSource = (data: {
    name: string;
    url: string;
    prompt?: string;
    schema?: object;
    requiresBrowser?: boolean;
    crawlIntervalHours?: number;
  }) =>
    fetchApi<CrawlerSource>("/api/crawler/sources", {
      method: "POST",
      body: JSON.stringify(data),
    });
  const updateCrawlerSource = (id: string, data: Partial<CrawlerSource>) =>
    fetchApi<CrawlerSource>(`/api/crawler/sources/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  const deleteCrawlerSource = (id: string) =>
    fetchApi<{ success: boolean }>(`/api/crawler/sources/${id}`, { method: "DELETE" });
  const testCrawlerSource = (data: {
    url: string;
    prompt?: string;
    requiresBrowser?: boolean;
    schema?: object;
  }) =>
    fetchApi<CrawlerTestResult>("/api/crawler/test", {
      method: "POST",
      body: JSON.stringify(data),
    });
  const runCrawlerSource = (id: string) =>
    fetchApi<{ success: boolean; itemCount: number }>(`/api/crawler/sources/${id}/crawl`, {
      method: "POST",
    });
  const getCrawledItems = (filter?: {
    sourceId?: string;
    projectId?: string;
    processed?: boolean;
    limit?: number;
  }) => {
    const params = new URLSearchParams();
    if (filter?.sourceId) params.set("sourceId", filter.sourceId);
    if (filter?.projectId) params.set("projectId", filter.projectId);
    if (filter?.processed !== undefined) params.set("processed", String(filter.processed));
    if (filter?.limit) params.set("limit", String(filter.limit));
    const query = params.toString();
    return fetchApi<CrawledItem[]>(`/api/crawler/items${query ? `?${query}` : ""}`);
  };
  const getCrawledItem = (id: string) => fetchApi<CrawledItem>(`/api/crawler/items/${id}`);
  const getCrawlerStats = () => fetchApi<CrawlerStats>("/api/crawler/stats");

  // Competitors
  const getCompetitors = (filter?: { status?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (filter?.status) params.set("status", filter.status);
    if (filter?.limit) params.set("limit", String(filter.limit));
    const query = params.toString();
    return fetchApi<Competitor[]>(`/api/competitors${query ? `?${query}` : ""}`);
  };
  const getCompetitor = (id: string) => fetchApi<Competitor>(`/api/competitors/${id}`);
  const createCompetitor = (data: { domain: string; name: string; description?: string; industry?: string }) =>
    fetchApi<Competitor>("/api/competitors", {
      method: "POST",
      body: JSON.stringify(data),
    });
  const updateCompetitor = (id: string, data: Partial<Competitor>) =>
    fetchApi<Competitor>(`/api/competitors/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  const deleteCompetitor = (id: string) =>
    fetchApi<{ success: boolean }>(`/api/competitors/${id}`, { method: "DELETE" });
  const startCompetitorCrawl = (id: string, config?: Partial<CompetitorCrawlConfig>) =>
    fetchApi<{ status: string; jobId: string }>(`/api/competitors/${id}/crawl`, {
      method: "POST",
      body: JSON.stringify(config || {}),
    });
  const getCompetitorCrawlJob = (id: string, jobId: string) =>
    fetchApi<CompetitorCrawlJob>(`/api/competitors/${id}/crawl/${jobId}`);
  const getCompetitorPages = (id: string, filter?: { path?: string; depth?: number; limit?: number }) => {
    const params = new URLSearchParams();
    if (filter?.path) params.set("path", filter.path);
    if (filter?.depth !== undefined) params.set("depth", String(filter.depth));
    if (filter?.limit) params.set("limit", String(filter.limit));
    const query = params.toString();
    return fetchApi<CompetitorPage[]>(`/api/competitors/${id}/pages${query ? `?${query}` : ""}`);
  };
  const getCompetitorTechStack = (id: string) =>
    fetchApi<CompetitorTechStackItem[]>(`/api/competitors/${id}/tech-stack`);
  const getCompetitorStructure = (id: string) =>
    fetchApi<CompetitorSiteStructure>(`/api/competitors/${id}/structure`);
  const analyzeCompetitor = (id: string, analysisType: string) =>
    fetchApi<CompetitorAnalysis>(`/api/competitors/${id}/analyze`, {
      method: "POST",
      body: JSON.stringify({ analysisType }),
    });
  const getCompetitorAnalysis = (id: string, type?: string) => {
    const params = type ? `?type=${type}` : "";
    return fetchApi<CompetitorAnalysis>(`/api/competitors/${id}/analysis${params}`);
  };
  const generateCompetitorReport = (
    competitorIds: string[],
    reportType: "single" | "comparison" | "market_overview",
    format: "json" | "markdown" | "html",
    title?: string
  ) =>
    fetchApi<CompetitorReport>("/api/competitors/reports", {
      method: "POST",
      body: JSON.stringify({ competitorIds, reportType, format, title }),
    });
  const getCompetitorReports = (filter?: { type?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (filter?.type) params.set("type", filter.type);
    if (filter?.limit) params.set("limit", String(filter.limit));
    const query = params.toString();
    return fetchApi<CompetitorReport[]>(`/api/competitors/reports${query ? `?${query}` : ""}`);
  };
  const getCompetitorReport = (reportId: string) =>
    fetchApi<CompetitorReport>(`/api/competitors/reports/${reportId}`);
  const deleteCompetitorReport = (reportId: string) =>
    fetchApi<{ success: boolean }>(`/api/competitors/reports/${reportId}`, { method: "DELETE" });

  // Notification Preferences
  const getNotificationPreferences = () =>
    fetchApi<NotificationPreferences>("/api/user/notification-preferences");
  const updateNotificationPreferences = (data: Partial<NotificationPreferences>) =>
    fetchApi<NotificationPreferences>("/api/user/notification-preferences", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  const checkQuietHours = () =>
    fetchApi<{ isQuietTime: boolean; reason?: string; nextAllowedTime?: string }>(
      "/api/user/notification-preferences/quiet-hours-check"
    );

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
    // Project Analysis
    startProjectAnalysis,
    getAnalysisStatus,
    getProjectPlan,
    updateProjectPlan,
    syncTasksFromPlan,
    getPlanVersions,
    getPlanVersion,
    // News (legacy)
    getNews,
    getNewsItem,
    triggerNewsCrawl,
    analyzeNewsItem,
    getNewsStats,
    getNewsCrawlHistory,
    // Universal Crawler
    getCrawlerSources,
    getCrawlerSource,
    createCrawlerSource,
    updateCrawlerSource,
    deleteCrawlerSource,
    testCrawlerSource,
    runCrawlerSource,
    getCrawledItems,
    getCrawledItem,
    getCrawlerStats,
    // Competitors
    getCompetitors,
    getCompetitor,
    createCompetitor,
    updateCompetitor,
    deleteCompetitor,
    startCompetitorCrawl,
    getCompetitorCrawlJob,
    getCompetitorPages,
    getCompetitorTechStack,
    getCompetitorStructure,
    analyzeCompetitor,
    getCompetitorAnalysis,
    generateCompetitorReport,
    getCompetitorReports,
    getCompetitorReport,
    deleteCompetitorReport,
    // Notification Preferences
    getNotificationPreferences,
    updateNotificationPreferences,
    checkQuietHours,
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

export type KanbanStatus = "not_started" | "backlog" | "in_progress" | "review" | "done";
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

// Project Analysis types
export interface AnalysisStatus {
  projectId: string;
  status: "idle" | "cloning" | "analyzing" | "generating" | "syncing" | "completed" | "failed";
  progress: number;
  currentStep?: string;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface ProjectPlan {
  id: string;
  projectId: string;
  markdown: string;
  version: number;
  generatedAt: number;
  updatedAt: number;
  analysisSummary?: string;
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

// News types
export type NewsSource = "GitHub" | "HuggingFace" | "Replicate" | "Reddit";

export interface NewsItemDetails {
  fullDescription?: string;
  technologies?: string[];
  useCases?: string[];
  author?: string;
  createdAt?: string;
  lastUpdated?: string;
  license?: string;
  topics?: string[];
  readmePreview?: string;
}

export interface AIApplicationAnalysis {
  summary?: string;
  applications: string[];
  projectIdeas: string[];
  targetAudience: string[];
  integrations: string[];
  analyzedAt: number;
}

export interface NewsItem {
  id: string;
  rank: number;
  title: string;
  url: string;
  source: NewsSource;
  metric: string;
  metricValue: number;
  description?: string;
  details?: NewsItemDetails;
  aiAnalysis?: AIApplicationAnalysis;
  crawledAt: number;
  updatedAt: number;
  isActive: boolean;
}

export interface CrawlHistory {
  id?: number;
  startedAt: number;
  completedAt?: number;
  status: "running" | "completed" | "failed";
  itemsFound: number;
  itemsUpdated?: number;
  itemsNew?: number;
  errors?: string[];
  durationMs?: number;
}

export interface NewsStats {
  totalItems: number;
  activeItems: number;
  bySource: Record<NewsSource, number>;
  lastCrawl?: CrawlHistory;
  analyzedCount: number;
}

// Competitor types
export type CompetitorStatus = "pending" | "crawling" | "crawled" | "analyzing" | "analyzed" | "error";

export interface Competitor {
  id: string;
  name: string;
  domain: string;
  description?: string;
  industry?: string;
  status: CompetitorStatus;
  createdAt: number;
  updatedAt: number;
  lastCrawledAt?: number;
  lastAnalyzedAt?: number;
}

export interface CompetitorCrawlConfig {
  maxDepth?: number;
  maxPages?: number;
  crawlSitemap?: boolean;
  respectRobotsTxt?: boolean;
  requestsPerMinute?: number;
  maxConcurrency?: number;
  proxyUrls?: string[];
  userAgent?: string;
  delayMin?: number;
  delayMax?: number;
}

export type CompetitorCrawlJobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface CompetitorCrawlJob {
  id: string;
  competitorId: string;
  status: CompetitorCrawlJobStatus;
  config: CompetitorCrawlConfig;
  pagesFound: number;
  pagesCrawled: number;
  errors?: Array<{ url: string; message: string }>;
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
}

export interface CompetitorPageSEO {
  title?: string;
  metaDescription?: string;
  metaKeywords?: string;
  canonicalUrl?: string;
  robots?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  schemaTypes?: string[];
  hasStructuredData?: boolean;
}

export interface CompetitorPageHeadings {
  h1: string[];
  h2: string[];
  h3: string[];
  h4: string[];
  h5: string[];
  h6: string[];
}

export interface CompetitorPage {
  id: string;
  competitorId: string;
  crawlJobId?: string;
  url: string;
  path: string;
  depth: number;
  statusCode?: number;
  contentType?: string;
  seo?: CompetitorPageSEO;
  headings?: CompetitorPageHeadings;
  images?: Array<{ src: string; alt?: string; isLazyLoaded?: boolean }>;
  links?: Array<{ href: string; text: string; isExternal: boolean; isNofollow: boolean }>;
  wordCount?: number;
  textContent?: string;
  responseTimeMs?: number;
  crawledAt: number;
}

export type TechCategory =
  | "cms"
  | "ecommerce"
  | "framework"
  | "css"
  | "analytics"
  | "marketing"
  | "chat"
  | "cdn"
  | "hosting"
  | "payment"
  | "other";

export interface CompetitorTechStackItem {
  id?: number;
  competitorId: string;
  category: TechCategory;
  name: string;
  version?: string;
  confidence: number;
  evidence?: string[];
  detectedAt: number;
}

export interface CompetitorSiteStructureNode {
  path: string;
  name: string;
  depth: number;
  pageCount: number;
  children: CompetitorSiteStructureNode[];
}

export interface CompetitorSiteStructure {
  competitorId: string;
  root: CompetitorSiteStructureNode;
  totalPages: number;
  maxDepth: number;
  patterns: {
    hasBlog: boolean;
    hasProducts: boolean;
    hasDocs: boolean;
    hasCategories: boolean;
  };
  analyzedAt: number;
}

export interface CompetitorPositioning {
  valueProposition: string;
  targetAudience: string[];
  keyMessages: string[];
  tone: string;
  uniqueSellingPoints: string[];
}

export interface CompetitorSWOT {
  strengths: Array<{ point: string; evidence: string }>;
  weaknesses: Array<{ point: string; evidence: string }>;
  opportunities: Array<{ point: string; rationale: string }>;
  threats: Array<{ point: string; rationale: string }>;
}

export type RecommendationPriority = "critical" | "high" | "medium" | "low";
export type RecommendationCategory = "seo" | "content" | "technical" | "marketing" | "ux" | "positioning";
export type EffortLevel = "low" | "medium" | "high";
export type ImpactLevel = "low" | "medium" | "high";

export interface CompetitorRecommendation {
  id: string;
  title: string;
  description: string;
  priority: RecommendationPriority;
  category: RecommendationCategory;
  effort: EffortLevel;
  impact: ImpactLevel;
  actionItems: string[];
}

export type CompetitorAnalysisType = "positioning" | "swot" | "recommendations" | "full";

export interface CompetitorAnalysis {
  id: string;
  competitorId: string;
  analysisType: CompetitorAnalysisType;
  positioning?: CompetitorPositioning;
  swot?: CompetitorSWOT;
  recommendations?: CompetitorRecommendation[];
  seoScore?: number;
  seoIssues?: Array<{ type: string; severity: string; message: string; pages?: string[] }>;
  modelUsed?: string;
  tokensUsed?: number;
  generatedAt: number;
}

export type CompetitorReportType = "single" | "comparison" | "market_overview";
export type CompetitorReportFormat = "json" | "markdown" | "html";

export interface CompetitorReport {
  id: string;
  competitorIds: string[];
  reportType: CompetitorReportType;
  format: CompetitorReportFormat;
  title: string;
  content: string;
  createdAt: number;
}

// Universal Crawler types
export interface CrawlerSource {
  id: string;
  name: string;
  url: string;
  prompt?: string;
  schema?: object;
  requiresBrowser: boolean;
  crawlIntervalHours: number;
  isEnabled: boolean;
  lastCrawlAt?: number;
  lastCrawlStatus?: "success" | "error";
  lastCrawlItemCount?: number;
  lastCrawlError?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CrawledItem {
  id: string;
  sourceId: string;
  title: string;
  url: string;
  description?: string;
  content?: string;
  metadata: Record<string, unknown>;
  extractedAt: number;
  projectId?: string;
  relevanceScore?: number;
  isProcessed: boolean;
}

export interface CrawlerTestResult {
  success: boolean;
  items?: Array<{
    id: string;
    title: string;
    url: string;
    description?: string;
  }>;
  itemCount?: number;
  error?: string;
}

export interface CrawlerStats {
  totalSources: number;
  enabledSources: number;
  totalItems: number;
  processedItems: number;
  lastCrawlAt?: number;
}

export interface NotificationPreferences {
  id?: string;
  userId?: string;
  emailEnabled: boolean;
  emailAddress?: string;
  telegramEnabled: boolean;
  telegramChatId?: string;
  quietHoursEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  quietHoursTimezone: string;
  minPriority: "low" | "medium" | "high" | "critical";
}
