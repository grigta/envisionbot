import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { execa } from "execa";
import type { WebSocket } from "ws";
import type { WSEvent } from "./types.js";
import { stateStore } from "./state/store.js";
import { approvalQueue } from "./approval/queue.js";
import { runAgent, runHealthCheck, runDeepAnalysis, runIdeaPlanning, launchIdea } from "./agent.js";
import type { Idea } from "./types.js";
import { buildChatContext } from "./chat/context.js";
import { chatHistory } from "./chat/history.js";
import { parseMentions } from "./chat/mentions.js";
import { runAgentTaskStreaming, type AgentStep } from "./tools/claude-code.js";
import { createProjectAnalyzer } from "./services/project-analyzer.service.js";
import { PlanRepository } from "./repositories/plan.repository.js";
import { AuthRepository } from "./repositories/auth.repository.js";
import { createAuthHook, signToken, decodeToken } from "./auth/index.js";
import { getAuthConfig } from "./auth.js";
import type { AnalysisStatus, ProjectPlan, KanbanStatus } from "./types.js";
import type { CrawlerServiceAuthConfig } from "./services/crawler.service.js";

const PORT = parseInt(process.env.PORT || "3001", 10);

// Helper to get auth config for crawler service
function getCrawlerAuthConfig(): CrawlerServiceAuthConfig {
  try {
    const config = getAuthConfig();
    if (config.type === "oauth_token") {
      return { authToken: config.token };
    }
    return { apiKey: config.token };
  } catch {
    // Fallback to env var
    return { apiKey: process.env.ANTHROPIC_API_KEY };
  }
}

// Helper to get auth config for competitor service (AI analysis)
function getCompetitorAuthConfig(): { anthropicApiKey?: string; anthropicAuthToken?: string } {
  try {
    const config = getAuthConfig();
    if (config.type === "oauth_token") {
      return { anthropicAuthToken: config.token };
    }
    return { anthropicApiKey: config.token };
  } catch {
    // Fallback to env var
    return { anthropicApiKey: process.env.ANTHROPIC_API_KEY };
  }
}

const HOST = process.env.HOST || "0.0.0.0";

// WebSocket clients
const wsClients = new Set<WebSocket>();

// Broadcast to all WebSocket clients
export function broadcast(event: WSEvent): void {
  const message = JSON.stringify(event);
  for (const client of wsClients) {
    if (client.readyState === 1) {
      // OPEN
      client.send(message);
    }
  }
}

export async function startServer(): Promise<void> {
  const fastify = Fastify({ logger: true });

  // Register plugins
  await fastify.register(cors, {
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  await fastify.register(websocket);

  // WebSocket endpoint
  fastify.get("/ws/live", { websocket: true }, (connection) => {
    const socket = connection.socket;
    wsClients.add(socket);
    console.log("WebSocket client connected");

    socket.on("close", () => {
      wsClients.delete(socket);
      console.log("WebSocket client disconnected");
    });

    // Send initial state
    socket.send(
      JSON.stringify({
        type: "connected",
        timestamp: Date.now(),
        data: stateStore.getStats(),
      })
    );
  });

  // Register auth hook (protects all routes except public ones)
  // Wait for store initialization before registering auth
  await stateStore.waitForInit();
  const deps = stateStore.getRepositoryDeps();
  if (!deps) {
    throw new Error("Failed to initialize database - cannot start server without auth");
  }
  fastify.addHook("onRequest", createAuthHook(deps));

  // ============================================
  // AUTH API
  // ============================================

  // Login with access code
  fastify.post<{ Body: { code: string } }>("/api/auth/login", async (request, reply) => {
    const { code } = request.body;

    if (!code) {
      return reply.status(400).send({ error: "Access code is required" });
    }

    const authDeps = stateStore.getRepositoryDeps();
    if (!authDeps) {
      return reply.status(500).send({ error: "Database not initialized" });
    }

    const authRepo = new AuthRepository(authDeps);
    const accessCode = await authRepo.validateCode(code);

    if (!accessCode) {
      return reply.status(401).send({ error: "Invalid access code" });
    }

    // Generate JWT
    const token = signToken({
      sub: accessCode.id,
      name: accessCode.name,
      role: accessCode.role,
    });

    // Decode to get jti and exp
    const decoded = decodeToken(token)!;

    // Create session record
    await authRepo.createSession({
      accessCodeId: accessCode.id,
      tokenJti: decoded.jti,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
      createdAt: Date.now(),
      expiresAt: decoded.exp * 1000,
    });

    return {
      token,
      user: {
        name: accessCode.name,
        role: accessCode.role,
      },
      expiresAt: decoded.exp * 1000,
    };
  });

  // Validate token
  fastify.get("/api/auth/validate", async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return reply.status(401).send({ valid: false });
    }

    const authDeps = stateStore.getRepositoryDeps();
    if (!authDeps) {
      return reply.status(500).send({ error: "Database not initialized" });
    }

    try {
      const token = authHeader.slice(7);
      const { verifyToken } = await import("./auth/index.js");
      const payload = verifyToken(token);

      const authRepo = new AuthRepository(authDeps);
      const isRevoked = await authRepo.isTokenRevoked(payload.jti);

      if (isRevoked) {
        return reply.status(401).send({ valid: false });
      }

      return {
        valid: true,
        user: {
          name: payload.name,
          role: payload.role,
        },
        expiresAt: payload.exp * 1000,
      };
    } catch {
      return reply.status(401).send({ valid: false });
    }
  });

  // Logout (revoke token)
  fastify.post("/api/auth/logout", async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return { success: true };
    }

    const authDeps = stateStore.getRepositoryDeps();
    if (!authDeps) {
      return { success: true };
    }

    try {
      const token = authHeader.slice(7);
      const decoded = decodeToken(token);
      if (decoded?.jti) {
        const authRepo = new AuthRepository(authDeps);
        await authRepo.revokeToken(decoded.jti);
      }
    } catch {
      // Ignore errors
    }

    return { success: true };
  });

  // Health check
  fastify.get("/api/health", async () => {
    return { status: "ok", timestamp: Date.now() };
  });

  // Stats
  fastify.get("/api/stats", async () => {
    return stateStore.getStats();
  });

  // Projects
  fastify.get("/api/projects", async () => {
    return stateStore.getProjects();
  });

  fastify.get<{ Params: { id: string } }>("/api/projects/:id", async (request, reply) => {
    const project = stateStore.getProject(request.params.id);
    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }
    return project;
  });

  fastify.get<{ Params: { id: string } }>("/api/projects/:id/metrics", async (request) => {
    return stateStore.getMetrics(request.params.id);
  });

  fastify.post<{ Body: { id: string; name: string; repo: string; phase?: string; goals?: string[]; focusAreas?: string[] } }>(
    "/api/projects",
    async (request) => {
      const { id, name, repo, phase = "planning", goals = [], focusAreas = [] } = request.body;
      const project = {
        id,
        name,
        repo,
        phase: phase as "planning",
        monitoringLevel: "standard" as const,
        goals,
        focusAreas: focusAreas as ("ci-cd" | "issues" | "prs")[],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      stateStore.addProject(project);
      return project;
    }
  );

  fastify.delete<{ Params: { id: string } }>("/api/projects/:id", async (request, reply) => {
    const project = stateStore.getProject(request.params.id);
    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }
    stateStore.removeProject(request.params.id);
    return { success: true };
  });

  // Project Analysis Endpoints
  // Start project analysis
  fastify.post<{ Params: { id: string } }>("/api/projects/:id/analyze", async (request, reply) => {
    const project = stateStore.getProject(request.params.id);
    if (!project) {
      return reply.status(404).send({ error: "Project not found" });
    }

    // Get repository deps from store
    const deps = stateStore.getRepositoryDeps();
    if (!deps) {
      return reply.status(500).send({ error: "Database not initialized" });
    }

    // Create analyzer with progress broadcast
    const analyzer = createProjectAnalyzer(deps, {
      onProgress: (status: AnalysisStatus) => {
        broadcast({
          type: "analysis_progress",
          timestamp: Date.now(),
          data: status,
        });
      },
      onStep: (step) => {
        broadcast({
          type: "agent_step",
          timestamp: Date.now(),
          data: step,
        });
      },
    });

    // Start analysis in background
    analyzer.analyzeProject(request.params.id).then((result) => {
      if (result.success) {
        broadcast({
          type: "analysis_completed",
          timestamp: Date.now(),
          data: {
            projectId: request.params.id,
            tasksCreated: result.tasksCreated,
          },
        });
      }
    });

    return { status: "started", projectId: request.params.id };
  });

  // Get analysis status
  fastify.get<{ Params: { id: string } }>("/api/projects/:id/analyze/status", async (request, reply) => {
    const deps = stateStore.getRepositoryDeps();
    if (!deps) {
      return reply.status(500).send({ error: "Database not initialized" });
    }

    const planRepo = new PlanRepository(deps);
    const status = await planRepo.getAnalysisStatus(request.params.id);

    if (!status) {
      return { status: "idle", progress: 0, projectId: request.params.id };
    }

    return status;
  });

  // Get project plan
  fastify.get<{ Params: { id: string } }>("/api/projects/:id/plan", async (request, reply) => {
    const deps = stateStore.getRepositoryDeps();
    if (!deps) {
      return reply.status(500).send({ error: "Database not initialized" });
    }

    const planRepo = new PlanRepository(deps);
    const plan = await planRepo.getByProjectId(request.params.id);

    if (!plan) {
      return reply.status(404).send({ error: "Plan not found" });
    }

    return plan;
  });

  // Update project plan
  fastify.put<{ Params: { id: string }; Body: { markdown: string } }>(
    "/api/projects/:id/plan",
    async (request, reply) => {
      const deps = stateStore.getRepositoryDeps();
      if (!deps) {
        return reply.status(500).send({ error: "Database not initialized" });
      }

      const analyzer = createProjectAnalyzer(deps);
      const updated = await analyzer.updatePlanMarkdown(request.params.id, request.body.markdown);

      if (!updated) {
        return reply.status(404).send({ error: "Plan not found" });
      }

      broadcast({
        type: "plan_updated",
        timestamp: Date.now(),
        data: updated,
      });

      return updated;
    }
  );

  // Sync tasks from plan
  fastify.post<{ Params: { id: string } }>("/api/projects/:id/sync-tasks", async (request, reply) => {
    const deps = stateStore.getRepositoryDeps();
    if (!deps) {
      return reply.status(500).send({ error: "Database not initialized" });
    }

    const planRepo = new PlanRepository(deps);
    const plan = await planRepo.getByProjectId(request.params.id);

    if (!plan) {
      return reply.status(404).send({ error: "Plan not found" });
    }

    // Re-analyze to sync tasks (uses existing plan)
    const analyzer = createProjectAnalyzer(deps);
    // For now, just return success - full sync would require re-parsing
    return { success: true, message: "Tasks synced from plan" };
  });

  // Get all plan versions (including current)
  fastify.get<{ Params: { id: string } }>("/api/projects/:id/plan/versions", async (request, reply) => {
    const deps = stateStore.getRepositoryDeps();
    if (!deps) {
      return reply.status(500).send({ error: "Database not initialized" });
    }

    const analyzer = createProjectAnalyzer(deps);
    const versions = await analyzer.getPlanVersions(request.params.id);

    return versions;
  });

  // Get specific plan version
  fastify.get<{ Params: { id: string; version: string } }>(
    "/api/projects/:id/plan/versions/:version",
    async (request, reply) => {
      const deps = stateStore.getRepositoryDeps();
      if (!deps) {
        return reply.status(500).send({ error: "Database not initialized" });
      }

      const versionNum = parseInt(request.params.version, 10);
      if (isNaN(versionNum)) {
        return reply.status(400).send({ error: "Invalid version number" });
      }

      const analyzer = createProjectAnalyzer(deps);
      const version = await analyzer.getPlanVersion(request.params.id, versionNum);

      if (!version) {
        return reply.status(404).send({ error: "Version not found" });
      }

      return version;
    }
  );

  // Tasks
  fastify.get<{ Querystring: { projectId?: string; status?: string } }>("/api/tasks", async (request) => {
    const { projectId, status } = request.query;
    return stateStore.getTasks({
      projectId,
      status: status as "pending" | undefined,
    });
  });

  fastify.get("/api/tasks/pending", async () => {
    return stateStore.getTasks({ status: "pending" });
  });

  fastify.get<{ Params: { id: string } }>("/api/tasks/:id", async (request, reply) => {
    const task = stateStore.getTask(request.params.id);
    if (!task) {
      return reply.status(404).send({ error: "Task not found" });
    }
    return task;
  });

  fastify.post<{ Params: { id: string }; Body: { status: string } }>(
    "/api/tasks/:id/status",
    async (request, reply) => {
      const { id } = request.params;
      const { status } = request.body;

      const task = stateStore.updateTask(id, {
        status: status as "completed",
        completedAt: status === "completed" ? Date.now() : undefined,
      });
      if (!task) {
        return reply.status(404).send({ error: "Task not found" });
      }

      // Auto-create GitHub issue when task is approved
      if (status === "approved" && process.env.GITHUB_AUTO_CREATE_ISSUE === "true") {
        const deps = stateStore.getRepositoryDeps();
        if (deps) {
          const { GitHubIssueService } = await import("./services/github-issue.service.js");
          const { TaskRepository } = await import("./repositories/task.repository.js");
          const { ProjectRepository } = await import("./repositories/project.repository.js");

          const taskRepo = new TaskRepository(deps);
          const projectRepo = new ProjectRepository(deps);
          const githubService = new GitHubIssueService(taskRepo, projectRepo);

          try {
            const result = await githubService.createIssueForTask(id);
            if (result.success) {
              console.log(
                `[GitHub] ✅ Created issue #${result.issueNumber} for task ${id}: ${result.issueUrl}`
              );
            } else {
              console.error(`[GitHub] ❌ Failed to create issue for task ${id}: ${result.error}`);
            }
          } catch (error) {
            console.error(
              `[GitHub] ❌ Exception while creating issue for task ${id}:`,
              error
            );
          }
        }
      }

      return task;
    }
  );

  // Update task kanban status (for Kanban board drag-and-drop)
  fastify.patch<{ Params: { id: string }; Body: { kanbanStatus: string } }>(
    "/api/tasks/:id/kanban-status",
    async (request, reply) => {
      const { kanbanStatus } = request.body;
      if (!["not_started", "backlog", "in_progress", "review", "done"].includes(kanbanStatus)) {
        return reply.status(400).send({ error: "Invalid kanbanStatus. Must be one of: 'not_started', 'backlog', 'in_progress', 'review', 'done'" });
      }
      const task = stateStore.updateTask(request.params.id, {
        kanbanStatus: kanbanStatus as KanbanStatus,
      });
      if (!task) {
        return reply.status(404).send({ error: "Task not found" });
      }
      broadcast({ type: "task_updated", timestamp: Date.now(), data: { task } });
      return task;
    }
  );

  // GitHub Issue Integration - Create GitHub Issue for task
  fastify.post<{ Params: { id: string } }>(
    "/api/tasks/:id/create-github-issue",
    async (request, reply) => {
      const { id } = request.params;

      const deps = stateStore.getRepositoryDeps();
      if (!deps) {
        return reply.status(500).send({ error: "Database not initialized" });
      }

      const { GitHubIssueService } = await import("./services/github-issue.service.js");
      const { TaskRepository } = await import("./repositories/task.repository.js");
      const { ProjectRepository } = await import("./repositories/project.repository.js");

      const taskRepo = new TaskRepository(deps);
      const projectRepo = new ProjectRepository(deps);
      const githubService = new GitHubIssueService(taskRepo, projectRepo);

      const result = await githubService.createIssueForTask(id);

      if (!result.success) {
        return reply.status(400).send({ error: result.error });
      }

      // Broadcast update
      broadcast({
        type: "task_updated",
        timestamp: Date.now(),
        data: { taskId: id, action: "github_issue_created" },
      });

      return reply.send(result);
    }
  );

  // GitHub Issue Integration - Sync GitHub Issue state for task
  fastify.post<{ Params: { id: string } }>(
    "/api/tasks/:id/sync-github-issue",
    async (request, reply) => {
      const { id } = request.params;

      const deps = stateStore.getRepositoryDeps();
      if (!deps) {
        return reply.status(500).send({ error: "Database not initialized" });
      }

      const { GitHubIssueService } = await import("./services/github-issue.service.js");
      const { TaskRepository } = await import("./repositories/task.repository.js");
      const { ProjectRepository } = await import("./repositories/project.repository.js");

      const taskRepo = new TaskRepository(deps);
      const projectRepo = new ProjectRepository(deps);
      const githubService = new GitHubIssueService(taskRepo, projectRepo);

      const result = await githubService.syncIssueState(id);

      if (!result.success) {
        return reply.status(400).send({ error: result.error });
      }

      return reply.send(result);
    }
  );

  // GitHub Issue Integration - Sync all GitHub Issues
  fastify.post("/api/tasks/sync-all-github-issues", async (request, reply) => {
    const deps = stateStore.getRepositoryDeps();
    if (!deps) {
      return reply.status(500).send({ error: "Database not initialized" });
    }

    const { GitHubIssueService } = await import("./services/github-issue.service.js");
    const { TaskRepository } = await import("./repositories/task.repository.js");
    const { ProjectRepository } = await import("./repositories/project.repository.js");

    const taskRepo = new TaskRepository(deps);
    const projectRepo = new ProjectRepository(deps);
    const githubService = new GitHubIssueService(taskRepo, projectRepo);

    const result = await githubService.syncAllTasks();

    return reply.send(result);
  });

  // Pending Actions (Approvals)
  fastify.get("/api/actions/pending", async () => {
    return approvalQueue.getPending();
  });

  fastify.get<{ Params: { id: string } }>("/api/actions/:id", async (request, reply) => {
    const action = approvalQueue.getAction(request.params.id);
    if (!action) {
      return reply.status(404).send({ error: "Action not found" });
    }
    return action;
  });

  fastify.post<{ Params: { id: string } }>("/api/actions/:id/approve", async (request, reply) => {
    const result = await approvalQueue.approve(request.params.id);
    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }
    return result;
  });

  fastify.post<{ Params: { id: string }; Body: { reason?: string } }>(
    "/api/actions/:id/reject",
    async (request, reply) => {
      const result = approvalQueue.reject(request.params.id, request.body.reason);
      if (!result.success) {
        return reply.status(400).send({ error: result.error });
      }
      return result;
    }
  );

  // Reports
  fastify.get("/api/reports", async () => {
    return stateStore.getReports();
  });

  fastify.get<{ Params: { id: string } }>("/api/reports/:id", async (request, reply) => {
    const report = stateStore.getReport(request.params.id);
    if (!report) {
      return reply.status(404).send({ error: "Report not found" });
    }
    return report;
  });

  fastify.delete<{ Params: { id: string } }>("/api/reports/:id", async (request, reply) => {
    const deleted = stateStore.deleteReport(request.params.id);
    if (!deleted) {
      return reply.status(404).send({ error: "Report not found" });
    }
    return { success: true };
  });

  // Agent control
  fastify.post<{ Body: { prompt: string } }>("/api/agent/run", async (request) => {
    const { prompt } = request.body;
    const result = await runAgent(prompt, { type: "manual" });
    return {
      response: result.response,
      tasksCount: result.tasks.length,
      reportId: result.report?.id,
    };
  });

  fastify.post("/api/agent/health-check", async () => {
    const report = await runHealthCheck();
    return { success: true, reportId: report?.id };
  });

  fastify.post("/api/agent/deep-analysis", async () => {
    const report = await runDeepAnalysis();
    return { success: true, reportId: report?.id };
  });

  fastify.get("/api/agent/status", async () => {
    return {
      running: true,
      lastHealthCheck: stateStore.getLastHealthCheck(),
      lastDeepAnalysis: stateStore.getLastDeepAnalysis(),
      pendingActionsCount: approvalQueue.getPending().length,
    };
  });

  // Ideas - CRUD
  fastify.get<{ Querystring: { status?: string } }>("/api/ideas", async (request) => {
    const { status } = request.query;
    return stateStore.getIdeas({
      status: status as Idea["status"] | undefined,
    });
  });

  fastify.get<{ Params: { id: string } }>("/api/ideas/:id", async (request, reply) => {
    const idea = stateStore.getIdea(request.params.id);
    if (!idea) {
      return reply.status(404).send({ error: "Idea not found" });
    }
    return idea;
  });

  fastify.post<{
    Body: { title: string; description: string };
  }>("/api/ideas", async (request) => {
    const { title, description } = request.body;
    const idea: Idea = {
      id: `idea-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      description,
      status: "submitted",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    stateStore.addIdea(idea);
    broadcast({ type: "idea_created", timestamp: Date.now(), data: { idea } });
    return idea;
  });

  fastify.delete<{ Params: { id: string } }>("/api/ideas/:id", async (request, reply) => {
    const idea = stateStore.getIdea(request.params.id);
    if (!idea) {
      return reply.status(404).send({ error: "Idea not found" });
    }
    stateStore.removeIdea(request.params.id);
    return { success: true };
  });

  // Ideas - Workflow
  fastify.post<{ Params: { id: string } }>("/api/ideas/:id/plan", async (request, reply) => {
    const idea = stateStore.getIdea(request.params.id);
    if (!idea) {
      return reply.status(404).send({ error: "Idea not found" });
    }
    if (idea.status !== "submitted") {
      return reply.status(400).send({ error: `Cannot plan idea in status: ${idea.status}` });
    }

    // Run planning in background
    runIdeaPlanning(idea.id).catch((err) => {
      console.error("Idea planning failed:", err);
      stateStore.updateIdea(idea.id, { status: "failed", error: String(err) });
    });

    return { success: true, message: "Planning started" };
  });

  fastify.post<{ Params: { id: string } }>("/api/ideas/:id/approve", async (request, reply) => {
    const idea = stateStore.getIdea(request.params.id);
    if (!idea) {
      return reply.status(404).send({ error: "Idea not found" });
    }
    if (idea.status !== "plan_ready") {
      return reply.status(400).send({ error: `Cannot approve idea in status: ${idea.status}` });
    }

    stateStore.updateIdea(request.params.id, { status: "approved" });
    broadcast({ type: "idea_updated", timestamp: Date.now(), data: { ideaId: idea.id, status: "approved" } });

    return { success: true, message: "Plan approved" };
  });

  fastify.post<{ Params: { id: string }; Body: { repoName?: string; isPrivate?: boolean } }>(
    "/api/ideas/:id/launch",
    async (request, reply) => {
      const idea = stateStore.getIdea(request.params.id);
      if (!idea) {
        return reply.status(404).send({ error: "Idea not found" });
      }
      if (idea.status !== "approved") {
        return reply.status(400).send({ error: `Cannot launch idea in status: ${idea.status}` });
      }

      const { repoName, isPrivate } = request.body;

      // Launch the idea (create repo + generate code) in background
      launchIdea(idea.id, repoName, isPrivate).catch((err) => {
        console.error("Idea launch failed:", err);
        stateStore.updateIdea(idea.id, { status: "failed", error: String(err) });
      });

      return { success: true, message: "Launch started" };
    }
  );

  fastify.get<{ Params: { id: string } }>("/api/ideas/:id/status", async (request, reply) => {
    const idea = stateStore.getIdea(request.params.id);
    if (!idea) {
      return reply.status(404).send({ error: "Idea not found" });
    }
    return {
      id: idea.id,
      status: idea.status,
      error: idea.error,
      projectId: idea.projectId,
      repoUrl: idea.repoUrl,
    };
  });

  // ============================================
  // Chat API
  // ============================================

  // Send a chat message
  fastify.post<{
    Body: { message: string; projectId?: string; sessionId?: string };
  }>("/api/chat/message", async (request, reply) => {
    const { message, projectId, sessionId } = request.body;

    if (!message || message.trim().length === 0) {
      return reply.status(400).send({ error: "Message is required" });
    }

    const chatId = `chat-${Date.now()}`;

    // Parse mentions
    const { mentions } = parseMentions(message);

    // Add user message to history
    chatHistory.addUserMessage(message, {
      sessionId,
      projectIds: projectId ? [projectId] : undefined,
      mentions: mentions.map((m) => ({ type: m.type, value: m.value })),
    });

    // Broadcast start event
    broadcast({
      type: "chat_start",
      timestamp: Date.now(),
      data: { chatId, message },
    });

    // Build context prompt
    const { prompt, projectIds } = buildChatContext(message, projectId);

    // Collect steps for history
    const steps: AgentStep[] = [];

    try {
      // Run with streaming
      const result = await runAgentTaskStreaming(
        prompt,
        (step) => {
          steps.push(step);
          broadcast({
            type: "chat_step",
            timestamp: Date.now(),
            data: { chatId, step },
          });
        },
        { timeout: 300000, allowCommands: true }
      );

      // Broadcast completion
      broadcast({
        type: "chat_complete",
        timestamp: Date.now(),
        data: { chatId, response: result.response, success: result.success },
      });

      // Save assistant message to history
      chatHistory.addAssistantMessage(result.response, {
        sessionId,
        steps,
        success: result.success,
        error: result.error,
      });

      return {
        chatId,
        success: result.success,
        response: result.response,
        projectIds,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      broadcast({
        type: "chat_complete",
        timestamp: Date.now(),
        data: { chatId, response: "", success: false, error: errorMessage },
      });

      chatHistory.addAssistantMessage("", {
        sessionId,
        steps,
        success: false,
        error: errorMessage,
      });

      return reply.status(500).send({ error: errorMessage });
    }
  });

  // Get chat history (sessions)
  fastify.get<{ Querystring: { limit?: number } }>("/api/chat/history", async (request) => {
    const limit = request.query.limit || 20;
    return chatHistory.getSessions(limit);
  });

  // Get specific chat session
  fastify.get<{ Params: { id: string } }>("/api/chat/sessions/:id", async (request, reply) => {
    const session = chatHistory.getSession(request.params.id);
    if (!session) {
      return reply.status(404).send({ error: "Session not found" });
    }
    return session;
  });

  // Create new chat session
  fastify.post<{ Body: { title?: string } }>("/api/chat/sessions", async (request) => {
    const session = chatHistory.createSession(request.body.title);
    return session;
  });

  // Switch to a session
  fastify.post<{ Params: { id: string } }>("/api/chat/sessions/:id/switch", async (request, reply) => {
    const session = chatHistory.switchSession(request.params.id);
    if (!session) {
      return reply.status(404).send({ error: "Session not found" });
    }
    return session;
  });

  // Delete a session
  fastify.delete<{ Params: { id: string } }>("/api/chat/sessions/:id", async (request) => {
    chatHistory.deleteSession(request.params.id);
    return { success: true };
  });

  // Get current session
  fastify.get("/api/chat/current", async () => {
    return chatHistory.getCurrentSession();
  });

  // ============================================
  // GitHub API (for @-mentions autocomplete)
  // ============================================

  // Get user's GitHub repositories
  fastify.get<{ Querystring: { limit?: number } }>("/api/github/repos", async (request, reply) => {
    const limit = request.query.limit || 50;

    try {
      const result = await execa("gh", [
        "repo",
        "list",
        "--json",
        "name,nameWithOwner,description,isPrivate,url",
        "--limit",
        String(limit),
      ]);

      const repos = JSON.parse(result.stdout) as Array<{
        name: string;
        nameWithOwner: string;
        description: string;
        isPrivate: boolean;
        url: string;
      }>;

      return repos.map((r) => ({
        name: r.name,
        fullName: r.nameWithOwner,
        description: r.description || "",
        isPrivate: r.isPrivate,
        url: r.url,
      }));
    } catch (error) {
      console.error("Failed to fetch GitHub repos:", error);
      return reply.status(500).send({ error: "Failed to fetch GitHub repositories" });
    }
  });

  // Get mentionable items (projects + repos combined)
  fastify.get<{ Querystring: { limit?: number } }>("/api/mentions", async (request, reply) => {
    const limit = request.query.limit || 50;

    // Get projects
    const projects = stateStore.getProjects().map((p) => ({
      id: `project:${p.id}`,
      type: "project" as const,
      label: p.name,
      description: p.repo,
      value: `@${p.name}`,
      icon: "i-heroicons-folder",
    }));

    // Get GitHub repos
    try {
      const result = await execa("gh", [
        "repo",
        "list",
        "--json",
        "name,nameWithOwner,description",
        "--limit",
        String(limit),
      ]);

      const repos = JSON.parse(result.stdout) as Array<{
        name: string;
        nameWithOwner: string;
        description: string;
      }>;

      const repoMentions = repos.map((r) => ({
        id: `repo:${r.nameWithOwner}`,
        type: "repo" as const,
        label: r.name,
        description: r.nameWithOwner,
        value: `@${r.nameWithOwner}`,
        icon: "i-simple-icons-github",
      }));

      return [...projects, ...repoMentions];
    } catch (error) {
      console.error("Failed to fetch GitHub repos for mentions:", error);
      // Return just projects if GitHub fails
      return projects;
    }
  });

  // ============================================
  // News API
  // ============================================

  // Get news list
  fastify.get<{
    Querystring: { source?: string; limit?: number; active?: boolean };
  }>("/api/news", async (request) => {
    const deps = stateStore.getRepositoryDeps();
    if (!deps) {
      return [];
    }

    const { NewsService } = await import("./services/news.service.js");
    const newsService = new NewsService(deps);

    const { source, limit, active } = request.query;
    return newsService.getAll({
      source: source as "GitHub" | "HuggingFace" | "Replicate" | "Reddit" | undefined,
      limit,
      isActive: active !== false,
    });
  });

  // Get single news item
  fastify.get<{ Params: { id: string } }>("/api/news/:id", async (request, reply) => {
    const deps = stateStore.getRepositoryDeps();
    if (!deps) {
      return reply.status(500).send({ error: "Database not initialized" });
    }

    const { NewsService } = await import("./services/news.service.js");
    const newsService = new NewsService(deps);

    const item = await newsService.getById(request.params.id);
    if (!item) {
      return reply.status(404).send({ error: "News item not found" });
    }
    return item;
  });

  // Trigger news crawl
  fastify.post<{
    Body: { fetchDetails?: boolean; limit?: number };
  }>("/api/news/crawl", async (request, reply) => {
    const deps = stateStore.getRepositoryDeps();
    if (!deps) {
      return reply.status(500).send({ error: "Database not initialized" });
    }

    const { NewsService } = await import("./services/news.service.js");
    const newsService = new NewsService(deps);

    const { fetchDetails = false, limit = 25 } = request.body || {};

    // Run crawl in background
    newsService
      .runCrawl({
        fetchDetails,
        limit,
        onProgress: (progress) => {
          broadcast({
            type: "news_crawl_progress",
            timestamp: Date.now(),
            data: progress,
          });
        },
      })
      .then((result) => {
        broadcast({
          type: "news_updated",
          timestamp: Date.now(),
          data: {
            success: result.success,
            newCount: result.newCount,
            updatedCount: result.updatedCount,
          },
        });
      })
      .catch((error) => {
        console.error("News crawl failed:", error);
        broadcast({
          type: "news_crawl_progress",
          timestamp: Date.now(),
          data: { stage: "failed", message: String(error) },
        });
      });

    return { status: "started" };
  });

  // AI analyze a specific news item
  fastify.post<{ Params: { id: string } }>("/api/news/:id/analyze", async (request, reply) => {
    const deps = stateStore.getRepositoryDeps();
    if (!deps) {
      return reply.status(500).send({ error: "Database not initialized" });
    }

    const { NewsAnalyzerService } = await import("./services/news-analyzer.service.js");
    const analyzerService = new NewsAnalyzerService(deps);

    broadcast({
      type: "news_analyzing",
      timestamp: Date.now(),
      data: { id: request.params.id },
    });

    try {
      const analysis = await analyzerService.analyzeAndSave(request.params.id);
      if (!analysis) {
        return reply.status(404).send({ error: "News item not found" });
      }

      broadcast({
        type: "news_analyzed",
        timestamp: Date.now(),
        data: { id: request.params.id, analysis },
      });

      return analysis;
    } catch (error) {
      console.error("AI analysis failed:", error);
      return reply.status(500).send({ error: "AI analysis failed" });
    }
  });

  // Get news stats
  fastify.get("/api/news/stats", async (request, reply) => {
    const deps = stateStore.getRepositoryDeps();
    if (!deps) {
      return reply.status(500).send({ error: "Database not initialized" });
    }

    const { NewsService } = await import("./services/news.service.js");
    const newsService = new NewsService(deps);

    return newsService.getStats();
  });

  // Get crawl history
  fastify.get<{ Querystring: { limit?: number } }>("/api/news/crawl/history", async (request, reply) => {
    const deps = stateStore.getRepositoryDeps();
    if (!deps) {
      return reply.status(500).send({ error: "Database not initialized" });
    }

    const { NewsService } = await import("./services/news.service.js");
    const newsService = new NewsService(deps);

    const limit = request.query.limit || 10;
    return newsService.getCrawlHistory(limit);
  });

  // ============================================
  // Universal Crawler API
  // ============================================

  // Get all crawler sources
  fastify.get<{
    Querystring: { enabled?: boolean };
  }>("/api/crawler/sources", async (request, reply) => {
    const deps = stateStore.getRepositoryDeps();
    if (!deps) {
      return reply.status(500).send({ error: "Database not initialized" });
    }

    const { CrawlerRepository } = await import("./repositories/crawler.repository.js");
    const repo = new CrawlerRepository(deps);

    const { enabled } = request.query;
    return repo.getAllSources(enabled !== undefined ? { isEnabled: enabled } : undefined);
  });

  // Get single crawler source
  fastify.get<{ Params: { id: string } }>("/api/crawler/sources/:id", async (request, reply) => {
    const deps = stateStore.getRepositoryDeps();
    if (!deps) {
      return reply.status(500).send({ error: "Database not initialized" });
    }

    const { CrawlerRepository } = await import("./repositories/crawler.repository.js");
    const repo = new CrawlerRepository(deps);

    const source = await repo.getSourceById(request.params.id);
    if (!source) {
      return reply.status(404).send({ error: "Source not found" });
    }
    return source;
  });

  // Create crawler source
  fastify.post<{
    Body: {
      name: string;
      url: string;
      prompt?: string;
      schema?: object;
      requiresBrowser?: boolean;
      crawlIntervalHours?: number;
    };
  }>("/api/crawler/sources", async (request, reply) => {
    const deps = stateStore.getRepositoryDeps();
    if (!deps) {
      return reply.status(500).send({ error: "Database not initialized" });
    }

    const { CrawlerService } = await import("./services/crawler.service.js");
    const { CrawlerRepository } = await import("./repositories/crawler.repository.js");

    const repo = new CrawlerRepository(deps);
    const service = new CrawlerService(repo, getCrawlerAuthConfig());

    return service.createSource(request.body);
  });

  // Update crawler source
  fastify.put<{
    Params: { id: string };
    Body: Partial<{
      name: string;
      url: string;
      prompt: string;
      schema: object;
      requiresBrowser: boolean;
      crawlIntervalHours: number;
      isEnabled: boolean;
    }>;
  }>("/api/crawler/sources/:id", async (request, reply) => {
    const deps = stateStore.getRepositoryDeps();
    if (!deps) {
      return reply.status(500).send({ error: "Database not initialized" });
    }

    const { CrawlerService } = await import("./services/crawler.service.js");
    const { CrawlerRepository } = await import("./repositories/crawler.repository.js");

    const repo = new CrawlerRepository(deps);
    const service = new CrawlerService(repo, getCrawlerAuthConfig());

    const updated = await service.updateSource(request.params.id, request.body);
    if (!updated) {
      return reply.status(404).send({ error: "Source not found" });
    }
    return updated;
  });

  // Delete crawler source
  fastify.delete<{ Params: { id: string } }>("/api/crawler/sources/:id", async (request, reply) => {
    const deps = stateStore.getRepositoryDeps();
    if (!deps) {
      return reply.status(500).send({ error: "Database not initialized" });
    }

    const { CrawlerService } = await import("./services/crawler.service.js");
    const { CrawlerRepository } = await import("./repositories/crawler.repository.js");

    const repo = new CrawlerRepository(deps);
    const service = new CrawlerService(repo, getCrawlerAuthConfig());

    const deleted = await service.deleteSource(request.params.id);
    if (!deleted) {
      return reply.status(404).send({ error: "Source not found" });
    }
    return { success: true };
  });

  // Test a URL before adding as source
  fastify.post<{
    Body: {
      url: string;
      prompt?: string;
      requiresBrowser?: boolean;
      schema?: object;
    };
  }>("/api/crawler/test", async (request, reply) => {
    const deps = stateStore.getRepositoryDeps();
    if (!deps) {
      return reply.status(500).send({ error: "Database not initialized" });
    }

    const { CrawlerService } = await import("./services/crawler.service.js");
    const { CrawlerRepository } = await import("./repositories/crawler.repository.js");

    const repo = new CrawlerRepository(deps);
    const service = new CrawlerService(repo, getCrawlerAuthConfig());

    const { url, prompt, requiresBrowser, schema } = request.body;
    return service.testSource(url, prompt, { requiresBrowser, schema });
  });

  // Run crawl for a specific source
  fastify.post<{ Params: { id: string } }>("/api/crawler/sources/:id/crawl", async (request, reply) => {
    const deps = stateStore.getRepositoryDeps();
    if (!deps) {
      return reply.status(500).send({ error: "Database not initialized" });
    }

    const { CrawlerService } = await import("./services/crawler.service.js");
    const { CrawlerRepository } = await import("./repositories/crawler.repository.js");

    const repo = new CrawlerRepository(deps);
    const service = new CrawlerService(repo, getCrawlerAuthConfig());

    try {
      const result = await service.crawlSource(request.params.id);
      return {
        success: true,
        itemCount: result.items.length,
        stats: result.stats,
      };
    } catch (error) {
      return reply.status(500).send({
        error: error instanceof Error ? error.message : "Crawl failed",
      });
    }
  });

  // Get crawled items
  fastify.get<{
    Querystring: {
      sourceId?: string;
      projectId?: string;
      processed?: boolean;
      limit?: number;
    };
  }>("/api/crawler/items", async (request, reply) => {
    const deps = stateStore.getRepositoryDeps();
    if (!deps) {
      return reply.status(500).send({ error: "Database not initialized" });
    }

    const { CrawlerRepository } = await import("./repositories/crawler.repository.js");
    const repo = new CrawlerRepository(deps);

    const { sourceId, projectId, processed, limit } = request.query;
    return repo.getItems({
      sourceId,
      projectId,
      isProcessed: processed,
      limit,
    });
  });

  // Get single crawled item
  fastify.get<{ Params: { id: string } }>("/api/crawler/items/:id", async (request, reply) => {
    const deps = stateStore.getRepositoryDeps();
    if (!deps) {
      return reply.status(500).send({ error: "Database not initialized" });
    }

    const { CrawlerRepository } = await import("./repositories/crawler.repository.js");
    const repo = new CrawlerRepository(deps);

    const item = await repo.getItemById(request.params.id);
    if (!item) {
      return reply.status(404).send({ error: "Item not found" });
    }
    return item;
  });

  // Get crawler statistics
  fastify.get("/api/crawler/stats", async (request, reply) => {
    const deps = stateStore.getRepositoryDeps();
    if (!deps) {
      return reply.status(500).send({ error: "Database not initialized" });
    }

    const { CrawlerRepository } = await import("./repositories/crawler.repository.js");
    const repo = new CrawlerRepository(deps);

    return repo.getStats();
  });

  // ============================================
  // Competitors API (Guerrilla Marketing)
  // ============================================

  // Get all competitors
  fastify.get<{
    Querystring: { status?: string; limit?: number };
  }>("/api/competitors", async (request, reply) => {
    const deps = stateStore.getRepositoryDeps();
    if (!deps) {
      return reply.status(500).send({ error: "Database not initialized" });
    }

    const { CompetitorService } = await import("./services/competitor.service.js");
    const service = new CompetitorService(deps, {
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    });

    const { status, limit } = request.query;
    return service.getAll({
      status: status as any,
      limit,
    });
  });

  // Get single competitor
  fastify.get<{ Params: { id: string } }>("/api/competitors/:id", async (request, reply) => {
    const deps = stateStore.getRepositoryDeps();
    if (!deps) {
      return reply.status(500).send({ error: "Database not initialized" });
    }

    const { CompetitorService } = await import("./services/competitor.service.js");
    const service = new CompetitorService(deps);

    const competitor = await service.getById(request.params.id);
    if (!competitor) {
      return reply.status(404).send({ error: "Competitor not found" });
    }
    return competitor;
  });

  // Create competitor
  fastify.post<{
    Body: {
      name: string;
      domain: string;
      description?: string;
      industry?: string;
    };
  }>("/api/competitors", async (request, reply) => {
    const deps = stateStore.getRepositoryDeps();
    if (!deps) {
      return reply.status(500).send({ error: "Database not initialized" });
    }

    const { CompetitorService } = await import("./services/competitor.service.js");
    const service = new CompetitorService(deps);

    try {
      const competitor = await service.create(request.body);
      broadcast({
        type: "competitor_created",
        timestamp: Date.now(),
        data: competitor,
      });
      return competitor;
    } catch (error) {
      return reply.status(400).send({
        error: error instanceof Error ? error.message : "Failed to create competitor",
      });
    }
  });

  // Update competitor
  fastify.put<{
    Params: { id: string };
    Body: Partial<{
      name: string;
      domain: string;
      description: string;
      industry: string;
    }>;
  }>("/api/competitors/:id", async (request, reply) => {
    const deps = stateStore.getRepositoryDeps();
    if (!deps) {
      return reply.status(500).send({ error: "Database not initialized" });
    }

    const { CompetitorService } = await import("./services/competitor.service.js");
    const service = new CompetitorService(deps);

    const updated = await service.update(request.params.id, request.body);
    if (!updated) {
      return reply.status(404).send({ error: "Competitor not found" });
    }

    broadcast({
      type: "competitor_updated",
      timestamp: Date.now(),
      data: updated,
    });

    return updated;
  });

  // Delete competitor
  fastify.delete<{ Params: { id: string } }>("/api/competitors/:id", async (request, reply) => {
    const deps = stateStore.getRepositoryDeps();
    if (!deps) {
      return reply.status(500).send({ error: "Database not initialized" });
    }

    const { CompetitorService } = await import("./services/competitor.service.js");
    const service = new CompetitorService(deps);

    const deleted = await service.delete(request.params.id);
    if (!deleted) {
      return reply.status(404).send({ error: "Competitor not found" });
    }

    broadcast({
      type: "competitor_deleted",
      timestamp: Date.now(),
      data: { id: request.params.id },
    });

    return { success: true };
  });

  // Start competitor crawl
  fastify.post<{
    Params: { id: string };
    Body: {
      maxDepth?: number;
      maxPages?: number;
      crawlSitemap?: boolean;
      respectRobotsTxt?: boolean;
      requestsPerMinute?: number;
      maxConcurrency?: number;
      proxyUrls?: string[];
      delayMin?: number;
      delayMax?: number;
    };
  }>("/api/competitors/:id/crawl", async (request, reply) => {
    const deps = stateStore.getRepositoryDeps();
    if (!deps) {
      return reply.status(500).send({ error: "Database not initialized" });
    }

    const { CompetitorService } = await import("./services/competitor.service.js");
    const service = new CompetitorService(deps, {
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      proxyUrls: process.env.PROXY_LIST?.split(",").filter(Boolean),
      onCrawlProgress: (event) => {
        broadcast({
          type: "competitor_crawl_progress",
          timestamp: Date.now(),
          data: event,
        });
      },
    });

    try {
      const result = await service.startCrawl(request.params.id, request.body);
      broadcast({
        type: "competitor_crawl_started",
        timestamp: Date.now(),
        data: { competitorId: request.params.id, jobId: result.jobId },
      });
      return result;
    } catch (error) {
      return reply.status(400).send({
        error: error instanceof Error ? error.message : "Failed to start crawl",
      });
    }
  });

  // Get crawl job status
  fastify.get<{ Params: { id: string; jobId: string } }>(
    "/api/competitors/:id/crawl/:jobId",
    async (request, reply) => {
      const deps = stateStore.getRepositoryDeps();
      if (!deps) {
        return reply.status(500).send({ error: "Database not initialized" });
      }

      const { CompetitorService } = await import("./services/competitor.service.js");
      const service = new CompetitorService(deps);

      const job = await service.getCrawlJob(request.params.jobId);
      if (!job) {
        return reply.status(404).send({ error: "Crawl job not found" });
      }
      return job;
    }
  );

  // Get competitor pages
  fastify.get<{
    Params: { id: string };
    Querystring: { path?: string; depth?: number; limit?: number };
  }>("/api/competitors/:id/pages", async (request, reply) => {
    const deps = stateStore.getRepositoryDeps();
    if (!deps) {
      return reply.status(500).send({ error: "Database not initialized" });
    }

    const { CompetitorService } = await import("./services/competitor.service.js");
    const service = new CompetitorService(deps);

    const { path, depth, limit } = request.query;
    return service.getPages(request.params.id, {
      path,
      depth: depth !== undefined ? Number(depth) : undefined,
      limit: limit !== undefined ? Number(limit) : undefined,
    });
  });

  // Get competitor tech stack
  fastify.get<{ Params: { id: string } }>("/api/competitors/:id/tech-stack", async (request, reply) => {
    const deps = stateStore.getRepositoryDeps();
    if (!deps) {
      return reply.status(500).send({ error: "Database not initialized" });
    }

    const { CompetitorService } = await import("./services/competitor.service.js");
    const service = new CompetitorService(deps);

    return service.getTechStack(request.params.id);
  });

  // Get competitor site structure
  fastify.get<{ Params: { id: string } }>("/api/competitors/:id/structure", async (request, reply) => {
    const deps = stateStore.getRepositoryDeps();
    if (!deps) {
      return reply.status(500).send({ error: "Database not initialized" });
    }

    const { CompetitorService } = await import("./services/competitor.service.js");
    const service = new CompetitorService(deps);

    return service.getSiteStructure(request.params.id);
  });

  // Analyze competitor (AI)
  fastify.post<{
    Params: { id: string };
    Body: { analysisType?: string };
  }>("/api/competitors/:id/analyze", async (request, reply) => {
    const deps = stateStore.getRepositoryDeps();
    if (!deps) {
      return reply.status(500).send({ error: "Database not initialized" });
    }

    const { CompetitorService } = await import("./services/competitor.service.js");
    const service = new CompetitorService(deps, {
      ...getCompetitorAuthConfig(),
      onAnalysisProgress: (event) => {
        broadcast({
          type: event.stage === "completed" ? "competitor_analyzed" : "competitor_analyzing",
          timestamp: Date.now(),
          data: event,
        });
      },
    });

    try {
      broadcast({
        type: "competitor_analyzing",
        timestamp: Date.now(),
        data: { competitorId: request.params.id },
      });

      const analysis = await service.analyze(
        request.params.id,
        (request.body.analysisType || "full") as any
      );

      return analysis;
    } catch (error) {
      return reply.status(500).send({
        error: error instanceof Error ? error.message : "Analysis failed",
      });
    }
  });

  // Get competitor analysis
  fastify.get<{
    Params: { id: string };
    Querystring: { type?: string };
  }>("/api/competitors/:id/analysis", async (request, reply) => {
    const deps = stateStore.getRepositoryDeps();
    if (!deps) {
      return reply.status(500).send({ error: "Database not initialized" });
    }

    const { CompetitorService } = await import("./services/competitor.service.js");
    const service = new CompetitorService(deps);

    const analysis = await service.getAnalysis(
      request.params.id,
      request.query.type as any
    );

    if (!analysis) {
      return reply.status(404).send({ error: "Analysis not found" });
    }
    return analysis;
  });

  // Generate competitor report
  fastify.post<{
    Body: {
      competitorIds: string[];
      reportType: string;
      format: string;
      title?: string;
    };
  }>("/api/competitors/reports", async (request, reply) => {
    const deps = stateStore.getRepositoryDeps();
    if (!deps) {
      return reply.status(500).send({ error: "Database not initialized" });
    }

    const { CompetitorService } = await import("./services/competitor.service.js");
    const service = new CompetitorService(deps);

    try {
      const report = await service.generateReport(
        request.body.competitorIds,
        request.body.reportType as any,
        request.body.format as any,
        request.body.title
      );

      broadcast({
        type: "competitor_report_generated",
        timestamp: Date.now(),
        data: { id: report.id },
      });

      return report;
    } catch (error) {
      return reply.status(500).send({
        error: error instanceof Error ? error.message : "Failed to generate report",
      });
    }
  });

  // Get competitor reports
  fastify.get<{
    Querystring: { type?: string; limit?: number };
  }>("/api/competitors/reports", async (request, reply) => {
    const deps = stateStore.getRepositoryDeps();
    if (!deps) {
      return reply.status(500).send({ error: "Database not initialized" });
    }

    const { CompetitorService } = await import("./services/competitor.service.js");
    const service = new CompetitorService(deps);

    const { type, limit } = request.query;
    return service.getReports({
      type: type as any,
      limit,
    });
  });

  // Get single competitor report
  fastify.get<{ Params: { reportId: string } }>(
    "/api/competitors/reports/:reportId",
    async (request, reply) => {
      const deps = stateStore.getRepositoryDeps();
      if (!deps) {
        return reply.status(500).send({ error: "Database not initialized" });
      }

      const { CompetitorService } = await import("./services/competitor.service.js");
      const service = new CompetitorService(deps);

      const report = await service.getReport(request.params.reportId);
      if (!report) {
        return reply.status(404).send({ error: "Report not found" });
      }
      return report;
    }
  );

  // Delete competitor report
  fastify.delete<{ Params: { reportId: string } }>(
    "/api/competitors/reports/:reportId",
    async (request, reply) => {
      const deps = stateStore.getRepositoryDeps();
      if (!deps) {
        return reply.status(500).send({ error: "Database not initialized" });
      }

      const { CompetitorService } = await import("./services/competitor.service.js");
      const service = new CompetitorService(deps);

      const deleted = await service.deleteReport(request.params.reportId);
      if (!deleted) {
        return reply.status(404).send({ error: "Report not found" });
      }
      return { success: true };
    }
  );

  // ============================================
  // Notification Preferences API
  // ============================================

  // Get notification preferences
  fastify.get("/api/user/notification-preferences", async (request, reply) => {
    const deps = stateStore.getRepositoryDeps();
    if (!deps) {
      return reply.status(500).send({ error: "Database not initialized" });
    }

    const { NotificationService } = await import("./services/notification.service.js");
    const service = new NotificationService(deps.db);

    // Get user ID from JWT (if authenticated) or use global settings
    const userId = (request as any).user?.sub;

    const preferences = service.getPreferences(userId);

    if (!preferences) {
      // Return default preferences
      return {
        emailEnabled: false,
        telegramEnabled: true,
        quietHoursEnabled: false,
        quietHoursStart: "22:00",
        quietHoursEnd: "08:00",
        quietHoursTimezone: process.env.TIMEZONE || "UTC",
        notificationTypes: ["all"],
        minPriority: "low",
      };
    }

    return preferences;
  });

  // Update notification preferences
  fastify.put<{
    Body: {
      emailEnabled?: boolean;
      emailAddress?: string;
      telegramEnabled?: boolean;
      telegramChatId?: string;
      quietHoursEnabled?: boolean;
      quietHoursStart?: string;
      quietHoursEnd?: string;
      quietHoursTimezone?: string;
      notificationTypes?: string[];
      minPriority?: string;
    };
  }>("/api/user/notification-preferences", async (request, reply) => {
    const deps = stateStore.getRepositoryDeps();
    if (!deps) {
      return reply.status(500).send({ error: "Database not initialized" });
    }

    const { NotificationService } = await import("./services/notification.service.js");
    const service = new NotificationService(deps.db);

    // Get user ID from JWT (if authenticated) or use global settings
    const userId = (request as any).user?.sub;

    try {
      const updated = service.updatePreferences({
        userId,
        ...request.body,
      } as any);

      return updated;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return reply.status(400).send({ error: errorMessage });
    }
  });

  // Check if current time is in quiet hours
  fastify.get("/api/user/notification-preferences/quiet-hours-check", async (request, reply) => {
    const deps = stateStore.getRepositoryDeps();
    if (!deps) {
      return reply.status(500).send({ error: "Database not initialized" });
    }

    const { NotificationService } = await import("./services/notification.service.js");
    const service = new NotificationService(deps.db);

    const userId = (request as any).user?.sub;
    const preferences = service.getPreferences(userId);

    if (!preferences) {
      return { isQuietTime: false };
    }

    return service.isQuietTime(preferences);
  });

  // Start server
  try {
    await fastify.listen({ port: PORT, host: HOST });
    console.log(`Server running at http://${HOST}:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}
