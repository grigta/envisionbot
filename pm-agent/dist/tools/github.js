import { execa } from "execa";
import { approvalQueue } from "../approval/queue.js";
// Tool definitions for Claude
export const githubTools = [
    {
        name: "github_repo_status",
        description: "Get comprehensive repository status including issues count, PRs, and CI status",
        input_schema: {
            type: "object",
            properties: {
                repo: {
                    type: "string",
                    description: "Repository in owner/repo format",
                },
            },
            required: ["repo"],
        },
    },
    {
        name: "github_list_issues",
        description: "List issues in a repository with optional filters",
        input_schema: {
            type: "object",
            properties: {
                repo: {
                    type: "string",
                    description: "Repository in owner/repo format",
                },
                state: {
                    type: "string",
                    enum: ["open", "closed", "all"],
                    description: "Issue state filter",
                },
                labels: {
                    type: "string",
                    description: "Comma-separated list of labels",
                },
                limit: {
                    type: "number",
                    description: "Maximum number of issues to return (default: 10)",
                },
            },
            required: ["repo"],
        },
    },
    {
        name: "github_list_prs",
        description: "List pull requests in a repository",
        input_schema: {
            type: "object",
            properties: {
                repo: {
                    type: "string",
                    description: "Repository in owner/repo format",
                },
                state: {
                    type: "string",
                    enum: ["open", "closed", "merged", "all"],
                    description: "PR state filter",
                },
                limit: {
                    type: "number",
                    description: "Maximum number of PRs to return (default: 10)",
                },
            },
            required: ["repo"],
        },
    },
    {
        name: "github_run_status",
        description: "Check CI/CD workflow run status",
        input_schema: {
            type: "object",
            properties: {
                repo: {
                    type: "string",
                    description: "Repository in owner/repo format",
                },
                limit: {
                    type: "number",
                    description: "Maximum number of runs to return (default: 5)",
                },
            },
            required: ["repo"],
        },
    },
    {
        name: "github_create_issue",
        description: "Propose creating a new GitHub issue (requires user approval)",
        input_schema: {
            type: "object",
            properties: {
                repo: {
                    type: "string",
                    description: "Repository in owner/repo format",
                },
                title: {
                    type: "string",
                    description: "Issue title",
                },
                body: {
                    type: "string",
                    description: "Issue body/description",
                },
                labels: {
                    type: "array",
                    items: { type: "string" },
                    description: "Labels to add",
                },
            },
            required: ["repo", "title", "body"],
        },
    },
    {
        name: "github_comment_issue",
        description: "Propose adding a comment to an issue (requires user approval)",
        input_schema: {
            type: "object",
            properties: {
                repo: {
                    type: "string",
                    description: "Repository in owner/repo format",
                },
                issue_number: {
                    type: "number",
                    description: "Issue number",
                },
                body: {
                    type: "string",
                    description: "Comment body",
                },
            },
            required: ["repo", "issue_number", "body"],
        },
    },
];
// Execute GitHub tool
export async function executeGitHubTool(toolName, input) {
    try {
        switch (toolName) {
            case "github_repo_status":
                return await getRepoStatus(input.repo);
            case "github_list_issues":
                return await listIssues(input.repo, input.state, input.labels, input.limit);
            case "github_list_prs":
                return await listPRs(input.repo, input.state, input.limit);
            case "github_run_status":
                return await getRunStatus(input.repo, input.limit);
            case "github_create_issue":
                return await createIssue(input.repo, input.title, input.body, input.labels);
            case "github_comment_issue":
                return await commentIssue(input.repo, input.issue_number, input.body);
            default:
                return { success: false, error: `Unknown GitHub tool: ${toolName}` };
        }
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
// Get repository status
async function getRepoStatus(repo) {
    const [owner, repoName] = repo.split("/");
    if (!owner || !repoName) {
        return { success: false, error: "Invalid repo format. Use owner/repo" };
    }
    // Get repo info
    const repoInfo = await gh(["repo", "view", repo, "--json", "name,description,stargazerCount,forkCount,isArchived,defaultBranchRef"]);
    // Get open issues count
    const issues = await gh(["issue", "list", "-R", repo, "--state", "open", "--json", "number", "--limit", "100"]);
    // Get open PRs count
    const prs = await gh(["pr", "list", "-R", repo, "--state", "open", "--json", "number", "--limit", "100"]);
    // Get latest workflow runs
    let ciStatus = "unknown";
    try {
        const runs = await gh(["run", "list", "-R", repo, "--limit", "1", "--json", "conclusion,status"]);
        const runsData = JSON.parse(runs);
        if (runsData.length > 0) {
            const latestRun = runsData[0];
            if (latestRun.status === "completed") {
                ciStatus = latestRun.conclusion === "success" ? "passing" : "failing";
            }
            else {
                ciStatus = "in_progress";
            }
        }
    }
    catch {
        // No workflows or error
    }
    const repoData = JSON.parse(repoInfo);
    const issuesData = JSON.parse(issues);
    const prsData = JSON.parse(prs);
    // Calculate health score (simple formula)
    let healthScore = 100;
    if (ciStatus === "failing")
        healthScore -= 30;
    if (issuesData.length > 50)
        healthScore -= 20;
    if (prsData.length > 20)
        healthScore -= 10;
    healthScore = Math.max(0, healthScore);
    return {
        success: true,
        data: {
            repo,
            name: repoData.name,
            description: repoData.description,
            stars: repoData.stargazerCount,
            forks: repoData.forkCount,
            isArchived: repoData.isArchived,
            openIssues: issuesData.length,
            openPRs: prsData.length,
            ciStatus,
            healthScore,
        },
    };
}
// List issues
async function listIssues(repo, state = "open", labels, limit = 10) {
    const args = [
        "issue",
        "list",
        "-R",
        repo,
        "--state",
        state,
        "--json",
        "number,title,state,labels,createdAt,updatedAt,author",
        "--limit",
        String(limit),
    ];
    if (labels) {
        args.push("--label", labels);
    }
    const result = await gh(args);
    const issues = JSON.parse(result);
    return {
        success: true,
        data: {
            repo,
            state,
            count: issues.length,
            issues: issues.map((i) => ({
                number: i.number,
                title: i.title,
                state: i.state,
                labels: i.labels?.map((l) => l.name) || [],
                createdAt: i.createdAt,
                author: i.author?.login,
            })),
        },
    };
}
// List PRs
async function listPRs(repo, state = "open", limit = 10) {
    const args = [
        "pr",
        "list",
        "-R",
        repo,
        "--state",
        state,
        "--json",
        "number,title,state,isDraft,createdAt,author,reviewDecision",
        "--limit",
        String(limit),
    ];
    const result = await gh(args);
    const prs = JSON.parse(result);
    return {
        success: true,
        data: {
            repo,
            state,
            count: prs.length,
            prs: prs.map((p) => ({
                number: p.number,
                title: p.title,
                state: p.state,
                isDraft: p.isDraft,
                createdAt: p.createdAt,
                author: p.author?.login,
                reviewDecision: p.reviewDecision,
            })),
        },
    };
}
// Get workflow run status
async function getRunStatus(repo, limit = 5) {
    const args = [
        "run",
        "list",
        "-R",
        repo,
        "--json",
        "databaseId,name,status,conclusion,createdAt,headBranch",
        "--limit",
        String(limit),
    ];
    const result = await gh(args);
    const runs = JSON.parse(result);
    return {
        success: true,
        data: {
            repo,
            count: runs.length,
            runs: runs.map((r) => ({
                id: r.databaseId,
                name: r.name,
                status: r.status,
                conclusion: r.conclusion,
                createdAt: r.createdAt,
                branch: r.headBranch,
            })),
        },
    };
}
// Create issue (requires approval)
async function createIssue(repo, title, body, labels) {
    // Add to approval queue instead of executing directly
    const actionId = await approvalQueue.addAction({
        type: "create_issue",
        description: `Create issue "${title}" in ${repo}`,
        payload: { repo, title, body, labels },
    });
    return {
        success: true,
        requiresApproval: true,
        pendingActionId: actionId,
        data: {
            message: `Issue creation queued for approval. Action ID: ${actionId}`,
            repo,
            title,
        },
    };
}
// Comment on issue (requires approval)
async function commentIssue(repo, issueNumber, body) {
    // Add to approval queue
    const actionId = await approvalQueue.addAction({
        type: "comment_issue",
        description: `Comment on issue #${issueNumber} in ${repo}`,
        payload: { repo, issueNumber, body },
    });
    return {
        success: true,
        requiresApproval: true,
        pendingActionId: actionId,
        data: {
            message: `Comment queued for approval. Action ID: ${actionId}`,
            repo,
            issueNumber,
        },
    };
}
// Execute approved action
export async function executeApprovedAction(actionType, payload) {
    try {
        switch (actionType) {
            case "create_issue": {
                const { repo, title, body, labels } = payload;
                const args = ["issue", "create", "-R", repo, "--title", title, "--body", body];
                if (labels && Array.isArray(labels)) {
                    for (const label of labels) {
                        args.push("--label", label);
                    }
                }
                const result = await gh(args);
                return { success: true, data: { message: "Issue created", url: result.trim() } };
            }
            case "comment_issue": {
                const { repo, issueNumber, body } = payload;
                await gh(["issue", "comment", String(issueNumber), "-R", repo, "--body", body]);
                return { success: true, data: { message: "Comment added" } };
            }
            default:
                return { success: false, error: `Unknown action type: ${actionType}` };
        }
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
// Helper to run gh CLI
async function gh(args) {
    const { stdout } = await execa("gh", args);
    return stdout;
}
//# sourceMappingURL=github.js.map