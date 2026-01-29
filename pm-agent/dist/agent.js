import Anthropic from "@anthropic-ai/sdk";
import { execa } from "execa";
import { githubTools, executeGitHubTool } from "./tools/github.js";
import { ideaTools, executeIdeaTool } from "./tools/ideas.js";
import { generateProject, planIdeaWithClaudeCode, runAgentTaskStreaming } from "./tools/claude-code.js";
import { stateStore } from "./state/store.js";
import { broadcast } from "./server.js";
import { getAnthropicClientOptions } from "./auth.js";
// Initialize client with auto-detected auth
// Supports: ANTHROPIC_API_KEY env, CLAUDE_CODE_OAUTH_TOKEN env, or Claude Code keychain (subscription)
const client = new Anthropic(getAnthropicClientOptions());
const SYSTEM_PROMPT = `You are an autonomous Project Manager Agent acting as a CEO overseeing software projects.

Your responsibilities:
1. Monitor project health (CI/CD, issues, PRs, security)
2. Generate actionable tasks for project development
3. Track progress from idea to launch
4. Identify bottlenecks and risks
5. Propose improvements and optimizations

Available tools:
- github_repo_status: Get repository status (issues, PRs, CI)
- github_list_issues: List issues with filters
- github_list_prs: List pull requests
- github_create_issue: Propose creating an issue (requires approval)
- github_comment_issue: Propose adding a comment (requires approval)
- github_run_status: Check CI/CD status

Guidelines:
- Be proactive in identifying problems
- Prioritize tasks by impact and urgency
- Provide clear reasoning for each task
- Actions that modify data require user approval
- Generate structured reports

Current projects and their status will be provided in the user message.`;
// All available tools
const tools = [...githubTools, ...ideaTools];
// Parse structured JSON from Claude's response
function parseReportJson(response, projects) {
    const findings = [];
    const projectReports = [];
    let summary;
    // Try to find JSON in markdown code block first, then raw JSON
    const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/) ||
        response.match(/(\{[\s\S]*\})/);
    if (!jsonMatch)
        return { findings, projectReports };
    try {
        const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        summary = parsed.summary;
        // Parse findings from health_check format
        if (parsed.findings && Array.isArray(parsed.findings)) {
            for (const f of parsed.findings) {
                const project = projects.find((p) => p.name.toLowerCase() === f.project?.toLowerCase());
                findings.push({
                    severity: mapStatus(f.status),
                    category: "health",
                    title: f.project || "Unknown",
                    description: f.issues?.join(", ") || f.description || "",
                    projectId: project?.id || "unknown",
                });
            }
        }
        // Parse projects from deep_analysis format
        if (parsed.projects && Array.isArray(parsed.projects)) {
            for (const p of parsed.projects) {
                const project = projects.find((proj) => proj.name.toLowerCase() === p.name?.toLowerCase());
                projectReports.push({
                    projectId: project?.id || "unknown",
                    projectName: p.name,
                    healthScore: p.healthScore || 0,
                    openIssues: p.openIssues || 0,
                    openPRs: p.openPRs || 0,
                    ciStatus: p.ciStatus || "unknown",
                    risks: p.risks || [],
                });
                // Create findings from risks
                for (const risk of p.risks || []) {
                    findings.push({
                        severity: "warning",
                        category: "risk",
                        title: risk,
                        description: `Risk identified for ${p.name}`,
                        projectId: project?.id || "unknown",
                    });
                }
                // Create finding from low health score
                if (p.healthScore !== undefined && p.healthScore < 70) {
                    findings.push({
                        severity: p.healthScore < 50 ? "error" : "warning",
                        category: "health",
                        title: `Low health score: ${p.healthScore}`,
                        description: `${p.name} has a health score of ${p.healthScore}/100`,
                        projectId: project?.id || "unknown",
                    });
                }
                // Create finding from failing CI
                if (p.ciStatus === "failing") {
                    findings.push({
                        severity: "error",
                        category: "ci-cd",
                        title: "CI/CD Failing",
                        description: `${p.name} has failing CI/CD pipelines`,
                        projectId: project?.id || "unknown",
                    });
                }
            }
        }
    }
    catch {
        // JSON parse failed, continue with empty results
    }
    return { summary, findings, projectReports };
}
function mapStatus(status) {
    switch (status?.toLowerCase()) {
        case "critical":
            return "critical";
        case "warning":
            return "warning";
        case "healthy":
            return "info";
        default:
            return "info";
    }
}
export async function runAgent(prompt, context) {
    const projects = context?.projects || stateStore.getProjects();
    const analysisType = context?.type || "manual";
    // Build context message
    const projectsContext = projects.map((p) => ({
        id: p.id,
        name: p.name,
        repo: p.repo,
        phase: p.phase,
        goals: p.goals,
        focusAreas: p.focusAreas,
    }));
    const userMessage = `
## Current Projects
${JSON.stringify(projectsContext, null, 2)}

## Task
${prompt}

Analyze the projects and provide actionable insights. For any actions that modify data, use the appropriate tools.
`;
    const messages = [{ role: "user", content: userMessage }];
    const generatedTasks = [];
    const findings = [];
    let finalResponse = "";
    // Start analysis report
    const report = {
        id: `report-${Date.now()}`,
        type: analysisType,
        projectIds: projects.map((p) => p.id),
        startedAt: Date.now(),
        summary: "",
        findings: [],
        generatedTasks: [],
    };
    broadcast({ type: "analysis_started", timestamp: Date.now(), data: { reportId: report.id, type: analysisType } });
    // Agent loop
    let continueLoop = true;
    while (continueLoop) {
        const response = await client.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 4096,
            system: SYSTEM_PROMPT,
            tools: tools,
            messages: messages,
        });
        // Process response
        const assistantContent = [];
        let hasToolUse = false;
        for (const block of response.content) {
            assistantContent.push(block);
            if (block.type === "text") {
                finalResponse += block.text;
                broadcast({ type: "agent_log", timestamp: Date.now(), data: { text: block.text } });
            }
            else if (block.type === "tool_use") {
                hasToolUse = true;
                const toolResult = await executeToolCall(block.name, block.input);
                // Add tool result to messages
                messages.push({ role: "assistant", content: assistantContent });
                messages.push({
                    role: "user",
                    content: [
                        {
                            type: "tool_result",
                            tool_use_id: block.id,
                            content: JSON.stringify(toolResult),
                        },
                    ],
                });
                // If tool requires approval, note it
                if (toolResult.requiresApproval && toolResult.pendingActionId) {
                    broadcast({
                        type: "action_pending",
                        timestamp: Date.now(),
                        data: { actionId: toolResult.pendingActionId },
                    });
                }
                // Extract findings from tool results
                if (toolResult.success && toolResult.data) {
                    const data = toolResult.data;
                    if (data.healthScore !== undefined) {
                        const healthScore = data.healthScore;
                        if (healthScore < 50) {
                            findings.push({
                                severity: "error",
                                category: "health",
                                title: "Low health score",
                                description: `Project health score is ${healthScore}/100`,
                                projectId: data.projectId || "unknown",
                            });
                        }
                    }
                }
            }
        }
        if (!hasToolUse) {
            messages.push({ role: "assistant", content: assistantContent });
        }
        // Check if we should continue
        if (response.stop_reason === "end_turn" && !hasToolUse) {
            continueLoop = false;
        }
        else if (response.stop_reason === "tool_use") {
            // Continue to process tool results
            continueLoop = true;
        }
        else {
            continueLoop = false;
        }
    }
    // Parse tasks from response
    const parsedTasks = parseTasksFromResponse(finalResponse, projects);
    generatedTasks.push(...parsedTasks);
    // Save tasks to store
    for (const task of generatedTasks) {
        stateStore.addTask(task);
        report.generatedTasks.push(task.id);
        broadcast({ type: "task_created", timestamp: Date.now(), data: { task } });
    }
    // Finalize report
    report.completedAt = Date.now();
    report.summary = finalResponse.slice(0, 500);
    report.findings = findings;
    stateStore.addReport(report);
    broadcast({ type: "analysis_completed", timestamp: Date.now(), data: { reportId: report.id } });
    return { response: finalResponse, tasks: generatedTasks, report };
}
async function executeToolCall(toolName, input) {
    // GitHub tools
    if (toolName.startsWith("github_")) {
        return executeGitHubTool(toolName, input);
    }
    // Idea tools
    if (toolName.startsWith("idea_")) {
        return executeIdeaTool(toolName, input);
    }
    return { success: false, error: `Unknown tool: ${toolName}` };
}
function parseTasksFromResponse(response, projects) {
    const tasks = [];
    // Simple pattern matching for task-like content
    const taskPatterns = [
        /(?:task|action|todo|recommendation):\s*(.+?)(?:\n|$)/gi,
        /(?:\d+\.|\-|\*)\s*(?:should|need to|must|recommend)\s+(.+?)(?:\n|$)/gi,
    ];
    for (const pattern of taskPatterns) {
        let match;
        while ((match = pattern.exec(response)) !== null) {
            const taskDescription = match[1].trim();
            if (taskDescription.length > 10 && taskDescription.length < 500) {
                // Find related project
                const relatedProject = projects.find((p) => response.toLowerCase().includes(p.name.toLowerCase()) ||
                    response.toLowerCase().includes(p.repo.toLowerCase()));
                tasks.push({
                    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    projectId: relatedProject?.id || projects[0]?.id || "unknown",
                    type: "development",
                    priority: determinePriority(taskDescription),
                    title: taskDescription.slice(0, 100),
                    description: taskDescription,
                    context: "Generated from agent analysis",
                    suggestedActions: [],
                    relatedIssues: [],
                    relatedPRs: [],
                    status: "pending",
                    kanbanStatus: "not_started",
                    generatedAt: Date.now(),
                    generatedBy: "manual",
                });
            }
        }
    }
    return tasks;
}
function determinePriority(text) {
    const lowercased = text.toLowerCase();
    if (lowercased.includes("critical") || lowercased.includes("urgent") || lowercased.includes("security")) {
        return "critical";
    }
    if (lowercased.includes("important") || lowercased.includes("high priority")) {
        return "high";
    }
    if (lowercased.includes("low") || lowercased.includes("minor")) {
        return "low";
    }
    return "medium";
}
// Health check prompt - uses Claude Code CLI with streaming for real-time updates
export async function runHealthCheck() {
    const projects = stateStore.getProjects();
    if (projects.length === 0) {
        console.log("No projects configured for health check");
        return;
    }
    const projectsContext = projects.map((p) => `- ${p.name} (${p.repo}): ${p.phase} phase`).join("\n");
    const report = {
        id: `report-${Date.now()}`,
        type: "health_check",
        projectIds: projects.map((p) => p.id),
        startedAt: Date.now(),
        summary: "",
        findings: [],
        generatedTasks: [],
    };
    // Create a session ID for this task
    const sessionId = `session-${Date.now()}`;
    broadcast({
        type: "agent_session_start",
        timestamp: Date.now(),
        data: {
            sessionId,
            reportId: report.id,
            taskType: "health_check",
            title: "Health Check",
            description: `Checking ${projects.length} project(s)`,
        },
    });
    const prompt = `You are a Project Manager Agent. Perform a quick health check on these projects:

${projectsContext}

For each project with a GitHub repo, analyze:
1. Recent CI/CD status
2. Critical or blocking issues
3. Stale PRs
4. Any immediate concerns

Use the GitHub CLI (gh) to get real data. Run commands like:
- gh repo view {repo} --json description,issues,pullRequests
- gh issue list -R {repo} --state open --limit 5
- gh pr list -R {repo} --state open --limit 5
- gh run list -R {repo} --limit 3

Provide a concise summary of findings. Format as JSON:
{
  "summary": "Brief overall status",
  "findings": [
    {"project": "name", "status": "healthy|warning|critical", "issues": ["issue 1", "issue 2"]}
  ]
}`;
    try {
        // Stream callback to broadcast each step
        const onStep = (step) => {
            broadcast({
                type: "agent_step",
                timestamp: step.timestamp,
                data: {
                    sessionId,
                    step: {
                        id: step.id,
                        type: step.type,
                        content: step.content,
                        toolName: step.toolName,
                        toolInput: step.toolInput,
                        toolOutput: step.toolOutput,
                        status: step.status,
                    },
                },
            });
        };
        const result = await runAgentTaskStreaming(prompt, onStep, { timeout: 180000 });
        if (result.success) {
            // Parse structured data from Claude's response
            const parsed = parseReportJson(result.response, projects);
            report.summary = parsed.summary || result.response.slice(0, 1000);
            report.findings = parsed.findings;
            report.projectReports = parsed.projectReports;
        }
        else {
            report.summary = `Health check failed: ${result.error}`;
        }
    }
    catch (error) {
        report.summary = `Health check error: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
    report.completedAt = Date.now();
    stateStore.addReport(report);
    stateStore.setLastHealthCheck(Date.now());
    broadcast({
        type: "agent_session_end",
        timestamp: Date.now(),
        data: {
            sessionId,
            reportId: report.id,
            success: !report.summary.includes("failed") && !report.summary.includes("error"),
        },
    });
    return report;
}
// Deep analysis prompt - uses Claude Code CLI with streaming for real-time updates
export async function runDeepAnalysis() {
    const projects = stateStore.getProjects();
    if (projects.length === 0) {
        console.log("No projects configured for deep analysis");
        return;
    }
    const projectsContext = projects.map((p) => ({
        name: p.name,
        repo: p.repo,
        phase: p.phase,
        goals: p.goals,
        focusAreas: p.focusAreas,
    }));
    const report = {
        id: `report-${Date.now()}`,
        type: "deep_analysis",
        projectIds: projects.map((p) => p.id),
        startedAt: Date.now(),
        summary: "",
        findings: [],
        generatedTasks: [],
    };
    const sessionId = `session-${Date.now()}`;
    broadcast({
        type: "agent_session_start",
        timestamp: Date.now(),
        data: {
            sessionId,
            reportId: report.id,
            taskType: "deep_analysis",
            title: "Deep Analysis",
            description: `Analyzing ${projects.length} project(s) in detail`,
        },
    });
    const prompt = `You are a Project Manager Agent acting as CEO. Perform a comprehensive analysis of these projects:

${JSON.stringify(projectsContext, null, 2)}

For each project:
1. Use GitHub CLI to get detailed info: gh repo view, gh issue list, gh pr list, gh run list
2. Analyze open issues and PRs
3. Check CI/CD status and recent failures
4. Evaluate progress toward project goals
5. Identify risks and blockers
6. Suggest prioritized tasks

Provide actionable insights. Format as JSON:
{
  "summary": "Executive summary of all projects",
  "projects": [
    {
      "name": "project name",
      "healthScore": 85,
      "openIssues": 5,
      "openPRs": 2,
      "ciStatus": "passing|failing",
      "risks": ["risk 1"],
      "recommendedTasks": [
        {"title": "Task title", "priority": "high|medium|low", "description": "What to do"}
      ]
    }
  ]
}`;
    try {
        const onStep = (step) => {
            broadcast({
                type: "agent_step",
                timestamp: step.timestamp,
                data: {
                    sessionId,
                    step: {
                        id: step.id,
                        type: step.type,
                        content: step.content,
                        toolName: step.toolName,
                        toolInput: step.toolInput,
                        toolOutput: step.toolOutput,
                        status: step.status,
                    },
                },
            });
        };
        const result = await runAgentTaskStreaming(prompt, onStep, { timeout: 300000 });
        if (result.success) {
            // Parse structured data from Claude's response
            const parsed = parseReportJson(result.response, projects);
            report.summary = parsed.summary || result.response.slice(0, 2000);
            report.findings = parsed.findings;
            report.projectReports = parsed.projectReports;
            // Parse and create tasks from recommendedTasks
            try {
                const jsonMatch = result.response.match(/```json\n?([\s\S]*?)\n?```/) ||
                    result.response.match(/(\{[\s\S]*\})/);
                if (jsonMatch) {
                    const parsedJson = JSON.parse(jsonMatch[1] || jsonMatch[0]);
                    if (parsedJson.projects) {
                        for (const proj of parsedJson.projects) {
                            if (proj.recommendedTasks) {
                                for (const task of proj.recommendedTasks) {
                                    const newTask = {
                                        id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                                        projectId: projects.find((p) => p.name === proj.name)?.id || projects[0]?.id || "unknown",
                                        type: "development",
                                        priority: task.priority || "medium",
                                        title: task.title,
                                        description: task.description || task.title,
                                        context: "Generated from deep analysis",
                                        suggestedActions: [],
                                        relatedIssues: [],
                                        relatedPRs: [],
                                        status: "pending",
                                        kanbanStatus: "not_started",
                                        generatedAt: Date.now(),
                                        generatedBy: "deep_analysis",
                                    };
                                    stateStore.addTask(newTask);
                                    report.generatedTasks.push(newTask.id);
                                    broadcast({ type: "task_created", timestamp: Date.now(), data: { task: newTask } });
                                }
                            }
                        }
                    }
                }
            }
            catch {
                // Failed to parse tasks, continue
            }
        }
        else {
            report.summary = `Deep analysis failed: ${result.error}`;
        }
    }
    catch (error) {
        report.summary = `Deep analysis error: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
    report.completedAt = Date.now();
    stateStore.addReport(report);
    stateStore.setLastDeepAnalysis(Date.now());
    broadcast({
        type: "agent_session_end",
        timestamp: Date.now(),
        data: {
            sessionId,
            reportId: report.id,
            success: !report.summary.includes("failed") && !report.summary.includes("error"),
        },
    });
    return report;
}
// Run idea planning using Claude Code CLI (uses subscription auth)
export async function runIdeaPlanning(ideaId) {
    const idea = stateStore.getIdea(ideaId);
    if (!idea) {
        throw new Error(`Idea not found: ${ideaId}`);
    }
    console.log(`Planning idea: ${idea.title}`);
    stateStore.updateIdea(ideaId, { status: "planning" });
    broadcast({ type: "idea_updated", timestamp: Date.now(), data: { ideaId, status: "planning" } });
    try {
        // Use Claude Code CLI for planning (supports subscription auth)
        const result = await planIdeaWithClaudeCode({
            title: idea.title,
            description: idea.description,
        });
        if (!result.success || !result.plan) {
            throw new Error(result.error || "Planning failed");
        }
        // Save the plan
        stateStore.updateIdea(ideaId, {
            status: "plan_ready",
            plan: result.plan,
        });
        broadcast({
            type: "idea_updated",
            timestamp: Date.now(),
            data: { ideaId, status: "plan_ready", plan: result.plan },
        });
        console.log("Plan saved successfully");
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("Planning failed:", errorMessage);
        stateStore.updateIdea(ideaId, { status: "failed", error: errorMessage });
        broadcast({ type: "idea_updated", timestamp: Date.now(), data: { ideaId, status: "failed", error: errorMessage } });
        throw error;
    }
}
// Launch idea - create repo and generate code
export async function launchIdea(ideaId, repoName, isPrivate) {
    const idea = stateStore.getIdea(ideaId);
    if (!idea) {
        throw new Error(`Idea not found: ${ideaId}`);
    }
    if (!idea.plan) {
        throw new Error("Idea has no plan");
    }
    const finalRepoName = repoName || idea.plan.repoNameSuggestion || idea.title.toLowerCase().replace(/\s+/g, "-");
    console.log(`Launching idea: ${idea.title} -> ${finalRepoName}`);
    // Step 1: Create GitHub repository
    stateStore.updateIdea(ideaId, { status: "creating_repo" });
    broadcast({ type: "idea_updated", timestamp: Date.now(), data: { ideaId, status: "creating_repo" } });
    try {
        // Create the repository
        const args = ["repo", "create", finalRepoName];
        if (isPrivate) {
            args.push("--private");
        }
        else {
            args.push("--public");
        }
        args.push("--clone");
        args.push("--description", idea.plan.summary.slice(0, 250));
        await execa("gh", args, { timeout: 60000 });
        // Get repo URL
        const repoUrlResult = await execa("gh", ["repo", "view", finalRepoName, "--json", "url", "-q", ".url"]);
        const repoUrl = repoUrlResult.stdout.trim();
        stateStore.updateIdea(ideaId, { repoName: finalRepoName, repoUrl });
        console.log(`Repository created: ${repoUrl}`);
        // Step 2: Generate code using Claude Code
        stateStore.updateIdea(ideaId, { status: "generating" });
        broadcast({ type: "idea_updated", timestamp: Date.now(), data: { ideaId, status: "generating" } });
        const repoPath = `./${finalRepoName}`;
        const result = await generateProject(repoPath, {
            name: idea.title,
            description: idea.description,
            techStack: idea.plan.techStack,
            features: idea.plan.features,
        });
        if (!result.success) {
            throw new Error(`Code generation failed: ${result.output}`);
        }
        console.log("Code generated successfully");
        // Step 3: Commit and push
        try {
            await execa("git", ["add", "."], { cwd: repoPath });
            await execa("git", ["commit", "-m", "Initial project setup by PM Agent\n\nGenerated from idea: " + idea.title], {
                cwd: repoPath,
            });
            await execa("git", ["push", "-u", "origin", "main"], { cwd: repoPath });
            console.log("Code pushed to repository");
        }
        catch (gitError) {
            console.error("Git push failed:", gitError);
            // Continue - code was generated locally
        }
        // Step 4: Create project and mark idea as completed
        const owner = await getGitHubUser();
        const projectId = `project-${Date.now()}`;
        stateStore.addProject({
            id: projectId,
            name: idea.title,
            repo: `${owner}/${finalRepoName}`,
            phase: "idea",
            monitoringLevel: "standard",
            goals: idea.plan.features.filter((f) => f.priority === "core").map((f) => f.name),
            focusAreas: ["ci-cd", "issues", "prs"],
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
        stateStore.updateIdea(ideaId, {
            status: "completed",
            projectId,
        });
        broadcast({ type: "idea_launched", timestamp: Date.now(), data: { ideaId, projectId, repoUrl } });
        console.log(`Idea launched successfully! Project ID: ${projectId}`);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("Launch failed:", errorMessage);
        stateStore.updateIdea(ideaId, { status: "failed", error: errorMessage });
        throw error;
    }
}
async function getGitHubUser() {
    try {
        const result = await execa("gh", ["api", "user", "-q", ".login"]);
        return result.stdout.trim();
    }
    catch {
        return "unknown";
    }
}
//# sourceMappingURL=agent.js.map