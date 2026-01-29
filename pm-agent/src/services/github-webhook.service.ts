/**
 * GitHub Webhook Service
 * Handles incoming GitHub webhook events for real-time repository monitoring
 */

import crypto from "crypto";
import type {
  GitHubWebhookEvent,
  GitHubWebhookPayload,
  WebhookProcessingResult,
} from "../types.js";
import type { TaskRepository } from "../repositories/task.repository.js";
import type { ProjectRepository } from "../repositories/project.repository.js";

export class GitHubWebhookService {
  private webhookSecret: string | undefined;

  constructor(
    private taskRepo: TaskRepository,
    private projectRepo: ProjectRepository,
    webhookSecret?: string
  ) {
    this.webhookSecret = webhookSecret;
  }

  /**
   * Verify GitHub webhook signature
   * https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
   */
  verifySignature(payload: string, signature: string): boolean {
    if (!this.webhookSecret) {
      console.warn("GitHub webhook secret not configured - skipping signature verification");
      return true; // Allow webhooks if secret not configured (development mode)
    }

    if (!signature || !signature.startsWith("sha256=")) {
      return false;
    }

    const expectedSignature = signature.slice(7); // Remove 'sha256=' prefix
    const hmac = crypto.createHmac("sha256", this.webhookSecret);
    const computedSignature = hmac.update(payload).digest("hex");

    // Use timingSafeEqual to prevent timing attacks
    try {
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, "hex"),
        Buffer.from(computedSignature, "hex")
      );
    } catch {
      return false;
    }
  }

  /**
   * Process incoming webhook event
   */
  async processWebhook(
    event: GitHubWebhookEvent,
    payload: GitHubWebhookPayload
  ): Promise<WebhookProcessingResult> {
    console.log(
      `[Webhook] Processing ${event} event from ${payload.repository.full_name}`
    );

    switch (event) {
      case "issues":
        return this.handleIssueEvent(payload);
      case "pull_request":
        return this.handlePullRequestEvent(payload);
      case "issue_comment":
        return this.handleIssueCommentEvent(payload);
      case "push":
        return this.handlePushEvent(payload);
      case "pull_request_review":
      case "pull_request_review_comment":
        return this.handlePullRequestReviewEvent(payload);
      case "status":
      case "check_suite":
      case "check_run":
        return this.handleStatusEvent(payload, event);
      default:
        return {
          success: true,
          event,
          message: `Event ${event} received but not processed`,
        };
    }
  }

  /**
   * Handle issue events (opened, closed, edited, labeled, etc.)
   */
  private async handleIssueEvent(
    payload: GitHubWebhookPayload
  ): Promise<WebhookProcessingResult> {
    const { action, issue, repository } = payload;

    if (!issue || !action) {
      return {
        success: false,
        event: "issues",
        message: "Missing issue or action in payload",
      };
    }

    console.log(
      `[Webhook] Issue #${issue.number} ${action} in ${repository.full_name}`
    );

    // Find task linked to this GitHub issue
    const task = await this.taskRepo.getByGitHubIssue(
      repository.full_name,
      issue.number
    );

    if (!task) {
      return {
        success: true,
        event: "issues",
        action,
        message: `Issue #${issue.number} not linked to any task`,
      };
    }

    // Update task based on issue state
    if (action === "closed" && task.status !== "completed") {
      await this.taskRepo.update(task.id, {
        status: "completed",
        completedAt: Date.now(),
        githubIssueState: "closed",
        githubIssueSyncedAt: Date.now(),
      });

      return {
        success: true,
        event: "issues",
        action,
        message: `Task ${task.id} marked as completed (issue closed)`,
        taskUpdated: true,
        taskId: task.id,
      };
    }

    if (action === "reopened" && task.status === "completed") {
      await this.taskRepo.update(task.id, {
        status: "approved",
        githubIssueState: "open",
        githubIssueSyncedAt: Date.now(),
      });

      return {
        success: true,
        event: "issues",
        action,
        message: `Task ${task.id} reopened (issue reopened)`,
        taskUpdated: true,
        taskId: task.id,
      };
    }

    // Just update sync timestamp for other actions
    await this.taskRepo.update(task.id, {
      githubIssueSyncedAt: Date.now(),
    });

    return {
      success: true,
      event: "issues",
      action,
      message: `Task ${task.id} synced`,
      taskUpdated: false,
      taskId: task.id,
    };
  }

  /**
   * Handle pull request events
   */
  private async handlePullRequestEvent(
    payload: GitHubWebhookPayload
  ): Promise<WebhookProcessingResult> {
    const { action, pull_request, repository } = payload;

    if (!pull_request || !action) {
      return {
        success: false,
        event: "pull_request",
        message: "Missing pull_request or action in payload",
      };
    }

    console.log(
      `[Webhook] PR #${pull_request.number} ${action} in ${repository.full_name}`
    );

    // Find tasks that reference this PR
    const tasks = await this.taskRepo.getByRelatedPR(pull_request.html_url);

    if (tasks.length === 0) {
      return {
        success: true,
        event: "pull_request",
        action,
        message: `PR #${pull_request.number} not linked to any task`,
      };
    }

    // If PR merged, mark related tasks as completed
    if (action === "closed" && pull_request.merged) {
      for (const task of tasks) {
        if (task.status !== "completed") {
          await this.taskRepo.update(task.id, {
            status: "completed",
            completedAt: Date.now(),
          });
        }
      }

      return {
        success: true,
        event: "pull_request",
        action,
        message: `${tasks.length} task(s) marked as completed (PR merged)`,
        taskUpdated: true,
      };
    }

    return {
      success: true,
      event: "pull_request",
      action,
      message: `PR #${pull_request.number} ${action}`,
    };
  }

  /**
   * Handle issue comment events
   */
  private async handleIssueCommentEvent(
    payload: GitHubWebhookPayload
  ): Promise<WebhookProcessingResult> {
    const { action, issue, comment } = payload;

    if (!comment || !action) {
      return {
        success: false,
        event: "issue_comment",
        message: "Missing comment or action in payload",
      };
    }

    console.log(
      `[Webhook] Comment ${action} on issue #${issue?.number || "unknown"}`
    );

    // Could implement comment processing here (e.g., @claude mentions)
    // For now, just acknowledge the event

    return {
      success: true,
      event: "issue_comment",
      action,
      message: `Comment ${action} on issue #${issue?.number}`,
    };
  }

  /**
   * Handle push events
   */
  private async handlePushEvent(
    payload: GitHubWebhookPayload
  ): Promise<WebhookProcessingResult> {
    const { ref, commits, repository } = payload;

    console.log(
      `[Webhook] Push to ${ref} in ${repository.full_name} (${commits?.length || 0} commits)`
    );

    // Could implement commit processing here
    // For now, just acknowledge the event

    return {
      success: true,
      event: "push",
      message: `Push to ${ref} with ${commits?.length || 0} commit(s)`,
    };
  }

  /**
   * Handle pull request review events
   */
  private async handlePullRequestReviewEvent(
    payload: GitHubWebhookPayload
  ): Promise<WebhookProcessingResult> {
    const { action, pull_request } = payload;

    console.log(
      `[Webhook] PR review ${action} on PR #${pull_request?.number || "unknown"}`
    );

    return {
      success: true,
      event: "pull_request_review",
      action,
      message: `PR review ${action}`,
    };
  }

  /**
   * Handle status/check events (CI/CD)
   */
  private async handleStatusEvent(
    payload: GitHubWebhookPayload,
    event: GitHubWebhookEvent
  ): Promise<WebhookProcessingResult> {
    console.log(`[Webhook] Status event: ${event}`);

    // Could implement CI/CD status tracking here

    return {
      success: true,
      event,
      message: `Status event ${event} received`,
    };
  }
}
