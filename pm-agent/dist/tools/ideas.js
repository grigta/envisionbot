import { execa } from "execa";
import { stateStore } from "../state/store.js";
import { broadcast } from "../server.js";
import { runClaudeCode } from "./claude-code.js";
// Idea tools for the agent
export const ideaTools = [
    {
        name: "idea_analyze",
        description: "Analyze an idea and generate an implementation plan with tech stack, file structure, and features",
        input_schema: {
            type: "object",
            properties: {
                ideaId: { type: "string", description: "The idea ID to analyze" },
                title: { type: "string", description: "The idea title" },
                description: { type: "string", description: "The detailed idea description" },
            },
            required: ["ideaId", "title", "description"],
        },
    },
    {
        name: "idea_save_plan",
        description: "Save the generated plan for an idea",
        input_schema: {
            type: "object",
            properties: {
                ideaId: { type: "string", description: "The idea ID" },
                plan: {
                    type: "object",
                    description: "The implementation plan",
                    properties: {
                        summary: { type: "string" },
                        techStack: { type: "array", items: { type: "string" } },
                        structure: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    path: { type: "string" },
                                    type: { type: "string" },
                                    description: { type: "string" },
                                },
                            },
                        },
                        features: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    name: { type: "string" },
                                    description: { type: "string" },
                                    priority: { type: "string" },
                                },
                            },
                        },
                        estimatedFiles: { type: "number" },
                        repoNameSuggestion: { type: "string" },
                    },
                },
            },
            required: ["ideaId", "plan"],
        },
    },
    {
        name: "idea_create_repo",
        description: "Create a GitHub repository for the idea (requires approval)",
        input_schema: {
            type: "object",
            properties: {
                ideaId: { type: "string", description: "The idea ID" },
                repoName: { type: "string", description: "Repository name (without owner)" },
                description: { type: "string", description: "Repository description" },
                isPrivate: { type: "boolean", description: "Whether the repository should be private" },
            },
            required: ["ideaId", "repoName"],
        },
    },
    {
        name: "idea_generate_code",
        description: "Generate initial code for the project using Claude Code CLI",
        input_schema: {
            type: "object",
            properties: {
                ideaId: { type: "string", description: "The idea ID" },
                repoPath: { type: "string", description: "Local path to the cloned repository" },
                prompt: { type: "string", description: "The prompt for Claude Code to generate the project" },
            },
            required: ["ideaId", "repoPath", "prompt"],
        },
    },
];
export async function executeIdeaTool(toolName, input) {
    switch (toolName) {
        case "idea_analyze":
            return handleIdeaAnalyze(input);
        case "idea_save_plan":
            return handleIdeaSavePlan(input);
        case "idea_create_repo":
            return handleIdeaCreateRepo(input);
        case "idea_generate_code":
            return handleIdeaGenerateCode(input);
        default:
            return { success: false, error: `Unknown idea tool: ${toolName}` };
    }
}
async function handleIdeaAnalyze(input) {
    const { ideaId } = input;
    const idea = stateStore.getIdea(ideaId);
    if (!idea) {
        return { success: false, error: `Idea not found: ${ideaId}` };
    }
    // Update idea status to planning
    stateStore.updateIdea(ideaId, { status: "planning" });
    broadcast({ type: "idea_updated", timestamp: Date.now(), data: { ideaId, status: "planning" } });
    // The actual analysis is done by the agent through Claude API
    // This tool just marks the idea as being analyzed
    return {
        success: true,
        data: {
            message: "Idea marked as planning. Please analyze and generate a plan.",
            idea: {
                id: idea.id,
                title: idea.title,
                description: idea.description,
            },
        },
    };
}
async function handleIdeaSavePlan(input) {
    const { ideaId, plan } = input;
    const idea = stateStore.getIdea(ideaId);
    if (!idea) {
        return { success: false, error: `Idea not found: ${ideaId}` };
    }
    // Update idea with plan
    stateStore.updateIdea(ideaId, {
        status: "plan_ready",
        plan,
    });
    broadcast({ type: "idea_plan_ready", timestamp: Date.now(), data: { ideaId, plan } });
    return {
        success: true,
        data: {
            message: "Plan saved. Waiting for user approval.",
            planSummary: plan.summary,
            techStack: plan.techStack,
            estimatedFiles: plan.estimatedFiles,
        },
    };
}
async function handleIdeaCreateRepo(input) {
    const { ideaId, repoName, description, isPrivate } = input;
    const idea = stateStore.getIdea(ideaId);
    if (!idea) {
        return { success: false, error: `Idea not found: ${ideaId}` };
    }
    // Check if idea is approved (approval happens at plan level, not repo creation)
    if (idea.status !== "approved" && idea.status !== "creating_repo") {
        return {
            success: false,
            error: `Idea must be approved before creating repository. Current status: ${idea.status}`,
        };
    }
    // Execute repository creation directly (approval already happened)
    return executeCreateRepo(ideaId, repoName, description, isPrivate);
}
async function executeCreateRepo(ideaId, repoName, description, isPrivate) {
    try {
        stateStore.updateIdea(ideaId, { status: "creating_repo" });
        broadcast({ type: "idea_updated", timestamp: Date.now(), data: { ideaId, status: "creating_repo" } });
        // Build gh repo create command
        const args = ["repo", "create", repoName];
        if (description) {
            args.push("--description", description);
        }
        if (isPrivate) {
            args.push("--private");
        }
        else {
            args.push("--public");
        }
        args.push("--clone");
        const result = await execa("gh", args, { timeout: 60000 });
        // Get the repo URL
        const repoUrlResult = await execa("gh", ["repo", "view", repoName, "--json", "url", "-q", ".url"]);
        const repoUrl = repoUrlResult.stdout.trim();
        stateStore.updateIdea(ideaId, {
            repoName,
            repoUrl,
        });
        return {
            success: true,
            data: {
                repoName,
                repoUrl,
                localPath: `./${repoName}`,
                output: result.stdout,
            },
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        stateStore.updateIdea(ideaId, { status: "failed", error: errorMessage });
        return { success: false, error: errorMessage };
    }
}
async function handleIdeaGenerateCode(input) {
    const { ideaId, repoPath, prompt } = input;
    const idea = stateStore.getIdea(ideaId);
    if (!idea) {
        return { success: false, error: `Idea not found: ${ideaId}` };
    }
    try {
        stateStore.updateIdea(ideaId, { status: "generating" });
        broadcast({ type: "idea_updated", timestamp: Date.now(), data: { ideaId, status: "generating" } });
        // Run Claude Code to generate the project
        const result = await runClaudeCode(repoPath, prompt);
        if (!result.success) {
            stateStore.updateIdea(ideaId, { status: "failed", error: result.output });
            return { success: false, error: result.output };
        }
        // Commit and push the generated code
        try {
            await execa("git", ["add", "."], { cwd: repoPath });
            await execa("git", ["commit", "-m", "Initial project setup by PM Agent"], { cwd: repoPath });
            await execa("git", ["push", "-u", "origin", "main"], { cwd: repoPath });
        }
        catch (gitError) {
            console.error("Git operations failed:", gitError);
            // Continue even if git fails - the code was generated
        }
        // Create a project from this idea
        const projectId = `project-${Date.now()}`;
        const owner = await getGitHubUser();
        const repoFullName = `${owner}/${idea.repoName}`;
        stateStore.addProject({
            id: projectId,
            name: idea.title,
            repo: repoFullName,
            phase: "idea",
            monitoringLevel: "standard",
            goals: idea.plan?.features.filter((f) => f.priority === "core").map((f) => f.name) || [],
            focusAreas: ["ci-cd", "issues", "prs"],
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
        stateStore.updateIdea(ideaId, {
            status: "completed",
            projectId,
        });
        broadcast({ type: "idea_launched", timestamp: Date.now(), data: { ideaId, projectId } });
        return {
            success: true,
            data: {
                message: "Project generated and added to monitoring",
                projectId,
                repoPath,
                output: result.output,
            },
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        stateStore.updateIdea(ideaId, { status: "failed", error: errorMessage });
        return { success: false, error: errorMessage };
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
//# sourceMappingURL=ideas.js.map