import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { execa } from "execa";
import { stateStore } from "./state/store.js";
import { approvalQueue } from "./approval/queue.js";
import { runAgent, runHealthCheck, runDeepAnalysis, runIdeaPlanning, launchIdea } from "./agent.js";
import { buildChatContext } from "./chat/context.js";
import { chatHistory } from "./chat/history.js";
import { parseMentions } from "./chat/mentions.js";
import { runAgentTaskStreaming } from "./tools/claude-code.js";
const PORT = parseInt(process.env.PORT || "3001", 10);
const HOST = process.env.HOST || "0.0.0.0";
// WebSocket clients
const wsClients = new Set();
// Broadcast to all WebSocket clients
export function broadcast(event) {
    const message = JSON.stringify(event);
    for (const client of wsClients) {
        if (client.readyState === 1) {
            // OPEN
            client.send(message);
        }
    }
}
export async function startServer() {
    const fastify = Fastify({ logger: true });
    // Register plugins
    await fastify.register(cors, {
        origin: true,
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
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
        socket.send(JSON.stringify({
            type: "connected",
            timestamp: Date.now(),
            data: stateStore.getStats(),
        }));
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
    fastify.get("/api/projects/:id", async (request, reply) => {
        const project = stateStore.getProject(request.params.id);
        if (!project) {
            return reply.status(404).send({ error: "Project not found" });
        }
        return project;
    });
    fastify.get("/api/projects/:id/metrics", async (request) => {
        return stateStore.getMetrics(request.params.id);
    });
    fastify.post("/api/projects", async (request) => {
        const { id, name, repo, phase = "planning", goals = [], focusAreas = [] } = request.body;
        const project = {
            id,
            name,
            repo,
            phase: phase,
            monitoringLevel: "standard",
            goals,
            focusAreas: focusAreas,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        stateStore.addProject(project);
        return project;
    });
    fastify.delete("/api/projects/:id", async (request, reply) => {
        const project = stateStore.getProject(request.params.id);
        if (!project) {
            return reply.status(404).send({ error: "Project not found" });
        }
        stateStore.removeProject(request.params.id);
        return { success: true };
    });
    // Tasks
    fastify.get("/api/tasks", async (request) => {
        const { projectId, status } = request.query;
        return stateStore.getTasks({
            projectId,
            status: status,
        });
    });
    fastify.get("/api/tasks/pending", async () => {
        return stateStore.getTasks({ status: "pending" });
    });
    fastify.get("/api/tasks/:id", async (request, reply) => {
        const task = stateStore.getTask(request.params.id);
        if (!task) {
            return reply.status(404).send({ error: "Task not found" });
        }
        return task;
    });
    fastify.post("/api/tasks/:id/status", async (request, reply) => {
        const task = stateStore.updateTask(request.params.id, {
            status: request.body.status,
            completedAt: request.body.status === "completed" ? Date.now() : undefined,
        });
        if (!task) {
            return reply.status(404).send({ error: "Task not found" });
        }
        return task;
    });
    // Update task kanban status (for Kanban board drag-and-drop)
    fastify.patch("/api/tasks/:id/kanban-status", async (request, reply) => {
        const { kanbanStatus } = request.body;
        if (!["not_started", "backlog"].includes(kanbanStatus)) {
            return reply.status(400).send({ error: "Invalid kanbanStatus. Must be 'not_started' or 'backlog'" });
        }
        const task = stateStore.updateTask(request.params.id, {
            kanbanStatus: kanbanStatus,
        });
        if (!task) {
            return reply.status(404).send({ error: "Task not found" });
        }
        broadcast({ type: "task_updated", timestamp: Date.now(), data: { task } });
        return task;
    });
    // Pending Actions (Approvals)
    fastify.get("/api/actions/pending", async () => {
        return approvalQueue.getPending();
    });
    fastify.get("/api/actions/:id", async (request, reply) => {
        const action = approvalQueue.getAction(request.params.id);
        if (!action) {
            return reply.status(404).send({ error: "Action not found" });
        }
        return action;
    });
    fastify.post("/api/actions/:id/approve", async (request, reply) => {
        const result = await approvalQueue.approve(request.params.id);
        if (!result.success) {
            return reply.status(400).send({ error: result.error });
        }
        return result;
    });
    fastify.post("/api/actions/:id/reject", async (request, reply) => {
        const result = approvalQueue.reject(request.params.id, request.body.reason);
        if (!result.success) {
            return reply.status(400).send({ error: result.error });
        }
        return result;
    });
    // Reports
    fastify.get("/api/reports", async () => {
        return stateStore.getReports();
    });
    fastify.get("/api/reports/:id", async (request, reply) => {
        const report = stateStore.getReport(request.params.id);
        if (!report) {
            return reply.status(404).send({ error: "Report not found" });
        }
        return report;
    });
    fastify.delete("/api/reports/:id", async (request, reply) => {
        const deleted = stateStore.deleteReport(request.params.id);
        if (!deleted) {
            return reply.status(404).send({ error: "Report not found" });
        }
        return { success: true };
    });
    // Agent control
    fastify.post("/api/agent/run", async (request) => {
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
    fastify.get("/api/ideas", async (request) => {
        const { status } = request.query;
        return stateStore.getIdeas({
            status: status,
        });
    });
    fastify.get("/api/ideas/:id", async (request, reply) => {
        const idea = stateStore.getIdea(request.params.id);
        if (!idea) {
            return reply.status(404).send({ error: "Idea not found" });
        }
        return idea;
    });
    fastify.post("/api/ideas", async (request) => {
        const { title, description } = request.body;
        const idea = {
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
    fastify.delete("/api/ideas/:id", async (request, reply) => {
        const idea = stateStore.getIdea(request.params.id);
        if (!idea) {
            return reply.status(404).send({ error: "Idea not found" });
        }
        stateStore.removeIdea(request.params.id);
        return { success: true };
    });
    // Ideas - Workflow
    fastify.post("/api/ideas/:id/plan", async (request, reply) => {
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
    fastify.post("/api/ideas/:id/approve", async (request, reply) => {
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
    fastify.post("/api/ideas/:id/launch", async (request, reply) => {
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
    });
    fastify.get("/api/ideas/:id/status", async (request, reply) => {
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
    fastify.post("/api/chat/message", async (request, reply) => {
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
        const steps = [];
        try {
            // Run with streaming
            const result = await runAgentTaskStreaming(prompt, (step) => {
                steps.push(step);
                broadcast({
                    type: "chat_step",
                    timestamp: Date.now(),
                    data: { chatId, step },
                });
            }, { timeout: 300000, allowCommands: true });
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
        }
        catch (error) {
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
    fastify.get("/api/chat/history", async (request) => {
        const limit = request.query.limit || 20;
        return chatHistory.getSessions(limit);
    });
    // Get specific chat session
    fastify.get("/api/chat/sessions/:id", async (request, reply) => {
        const session = chatHistory.getSession(request.params.id);
        if (!session) {
            return reply.status(404).send({ error: "Session not found" });
        }
        return session;
    });
    // Create new chat session
    fastify.post("/api/chat/sessions", async (request) => {
        const session = chatHistory.createSession(request.body.title);
        return session;
    });
    // Switch to a session
    fastify.post("/api/chat/sessions/:id/switch", async (request, reply) => {
        const session = chatHistory.switchSession(request.params.id);
        if (!session) {
            return reply.status(404).send({ error: "Session not found" });
        }
        return session;
    });
    // Delete a session
    fastify.delete("/api/chat/sessions/:id", async (request) => {
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
    fastify.get("/api/github/repos", async (request, reply) => {
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
            const repos = JSON.parse(result.stdout);
            return repos.map((r) => ({
                name: r.name,
                fullName: r.nameWithOwner,
                description: r.description || "",
                isPrivate: r.isPrivate,
                url: r.url,
            }));
        }
        catch (error) {
            console.error("Failed to fetch GitHub repos:", error);
            return reply.status(500).send({ error: "Failed to fetch GitHub repositories" });
        }
    });
    // Get mentionable items (projects + repos combined)
    fastify.get("/api/mentions", async (request, reply) => {
        const limit = request.query.limit || 50;
        // Get projects
        const projects = stateStore.getProjects().map((p) => ({
            id: `project:${p.id}`,
            type: "project",
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
            const repos = JSON.parse(result.stdout);
            const repoMentions = repos.map((r) => ({
                id: `repo:${r.nameWithOwner}`,
                type: "repo",
                label: r.name,
                description: r.nameWithOwner,
                value: `@${r.nameWithOwner}`,
                icon: "i-simple-icons-github",
            }));
            return [...projects, ...repoMentions];
        }
        catch (error) {
            console.error("Failed to fetch GitHub repos for mentions:", error);
            // Return just projects if GitHub fails
            return projects;
        }
    });
    // Start server
    try {
        await fastify.listen({ port: PORT, host: HOST });
        console.log(`Server running at http://${HOST}:${PORT}`);
    }
    catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
}
//# sourceMappingURL=server.js.map