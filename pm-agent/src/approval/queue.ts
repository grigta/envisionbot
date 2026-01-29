import type { PendingAction, SuggestedAction } from "../types.js";
import { stateStore } from "../state/store.js";
import { executeApprovedAction } from "../tools/github.js";
import { broadcast } from "../server.js";

const DEFAULT_TIMEOUT_MINUTES = 60;

class ApprovalQueue {
  // Add action to queue
  async addAction(
    action: SuggestedAction,
    taskId?: string,
    timeoutMinutes = DEFAULT_TIMEOUT_MINUTES
  ): Promise<string> {
    const pendingAction: PendingAction = {
      id: `action-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      taskId: taskId || "manual",
      action,
      createdAt: Date.now(),
      expiresAt: Date.now() + timeoutMinutes * 60 * 1000,
      status: "pending",
    };

    stateStore.addPendingAction(pendingAction);

    // Notify via WebSocket
    broadcast({
      type: "action_pending",
      timestamp: Date.now(),
      data: {
        actionId: pendingAction.id,
        action: pendingAction.action,
        expiresAt: pendingAction.expiresAt,
      },
    });

    return pendingAction.id;
  }

  // Get pending actions
  getPending(): PendingAction[] {
    const pending = stateStore.getPendingActions();
    // Check for expired actions
    const now = Date.now();
    for (const action of pending) {
      if (action.expiresAt < now && action.status === "pending") {
        this.expire(action.id);
      }
    }
    return stateStore.getPendingActions();
  }

  // Get action by ID
  getAction(id: string): PendingAction | undefined {
    return stateStore.getPendingAction(id);
  }

  // Approve action
  async approve(id: string): Promise<{ success: boolean; error?: string; result?: unknown }> {
    const action = stateStore.getPendingAction(id);
    if (!action) {
      return { success: false, error: "Action not found" };
    }
    if (action.status !== "pending") {
      return { success: false, error: `Action already ${action.status}` };
    }
    if (action.expiresAt < Date.now()) {
      this.expire(id);
      return { success: false, error: "Action expired" };
    }

    // Execute the action
    const result = await executeApprovedAction(action.action.type, action.action.payload);

    // Update status
    stateStore.updatePendingAction(id, {
      status: result.success ? "approved" : "pending",
    });

    // Update related task if exists
    if (action.taskId && action.taskId !== "manual") {
      stateStore.updateTask(action.taskId, {
        status: result.success ? "completed" : "pending",
        completedAt: result.success ? Date.now() : undefined,
        approvedBy: "web",
      });
    }

    broadcast({
      type: "action_approved",
      timestamp: Date.now(),
      data: { actionId: id, result },
    });

    return { success: result.success, result: result.data, error: result.error };
  }

  // Reject action
  reject(id: string, reason?: string): { success: boolean; error?: string } {
    const action = stateStore.getPendingAction(id);
    if (!action) {
      return { success: false, error: "Action not found" };
    }
    if (action.status !== "pending") {
      return { success: false, error: `Action already ${action.status}` };
    }

    stateStore.updatePendingAction(id, { status: "rejected" });

    // Update related task
    if (action.taskId && action.taskId !== "manual") {
      stateStore.updateTask(action.taskId, { status: "rejected" });
    }

    broadcast({
      type: "action_rejected",
      timestamp: Date.now(),
      data: { actionId: id, reason },
    });

    return { success: true };
  }

  // Expire action
  private expire(id: string): void {
    stateStore.updatePendingAction(id, { status: "expired" });
  }

  // Set Telegram message ID for action
  setTelegramMessageId(id: string, messageId: number): void {
    stateStore.updatePendingAction(id, { telegramMessageId: messageId });
  }
}

export const approvalQueue = new ApprovalQueue();
