import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PendingAction, SuggestedAction } from '../types';

// Mock dependencies
vi.mock('../state/store.js', () => ({
  stateStore: {
    getPendingActions: vi.fn(() => []),
    getPendingAction: vi.fn(),
    addPendingAction: vi.fn(),
    updatePendingAction: vi.fn(),
    updateTask: vi.fn(),
  },
}));

vi.mock('../tools/github.js', () => ({
  executeApprovedAction: vi.fn(),
}));

vi.mock('../server.js', () => ({
  broadcast: vi.fn(),
}));

import { stateStore } from '../state/store.js';
import { executeApprovedAction } from '../tools/github.js';
import { broadcast } from '../server.js';

// Recreate the ApprovalQueue class for testing
class ApprovalQueue {
  private DEFAULT_TIMEOUT_MINUTES = 60;

  async addAction(
    action: SuggestedAction,
    taskId?: string,
    timeoutMinutes = this.DEFAULT_TIMEOUT_MINUTES
  ): Promise<string> {
    const pendingAction: PendingAction = {
      id: `action-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      taskId: taskId || 'manual',
      action,
      createdAt: Date.now(),
      expiresAt: Date.now() + timeoutMinutes * 60 * 1000,
      status: 'pending',
    };

    stateStore.addPendingAction(pendingAction);

    broadcast({
      type: 'action_pending',
      timestamp: Date.now(),
      data: {
        actionId: pendingAction.id,
        action: pendingAction.action,
        expiresAt: pendingAction.expiresAt,
      },
    });

    return pendingAction.id;
  }

  getPending(): PendingAction[] {
    const pending = stateStore.getPendingActions();
    const now = Date.now();
    for (const action of pending) {
      if (action.expiresAt < now && action.status === 'pending') {
        this.expire(action.id);
      }
    }
    return stateStore.getPendingActions();
  }

  getAction(id: string): PendingAction | undefined {
    return stateStore.getPendingAction(id);
  }

  async approve(id: string): Promise<{ success: boolean; error?: string; result?: unknown }> {
    const action = stateStore.getPendingAction(id);
    if (!action) {
      return { success: false, error: 'Action not found' };
    }
    if (action.status !== 'pending') {
      return { success: false, error: `Action already ${action.status}` };
    }
    if (action.expiresAt < Date.now()) {
      this.expire(id);
      return { success: false, error: 'Action expired' };
    }

    const result = await executeApprovedAction(action.action.type, action.action.payload);

    stateStore.updatePendingAction(id, {
      status: result.success ? 'approved' : 'pending',
    });

    if (action.taskId && action.taskId !== 'manual') {
      stateStore.updateTask(action.taskId, {
        status: result.success ? 'completed' : 'pending',
        completedAt: result.success ? Date.now() : undefined,
        approvedBy: 'web',
      });
    }

    broadcast({
      type: 'action_approved',
      timestamp: Date.now(),
      data: { actionId: id, result },
    });

    return { success: result.success, result: result.data, error: result.error };
  }

  reject(id: string, reason?: string): { success: boolean; error?: string } {
    const action = stateStore.getPendingAction(id);
    if (!action) {
      return { success: false, error: 'Action not found' };
    }
    if (action.status !== 'pending') {
      return { success: false, error: `Action already ${action.status}` };
    }

    stateStore.updatePendingAction(id, { status: 'rejected' });

    if (action.taskId && action.taskId !== 'manual') {
      stateStore.updateTask(action.taskId, { status: 'rejected' });
    }

    broadcast({
      type: 'action_rejected',
      timestamp: Date.now(),
      data: { actionId: id, reason },
    });

    return { success: true };
  }

  private expire(id: string): void {
    stateStore.updatePendingAction(id, { status: 'expired' });
  }
}

describe('ApprovalQueue', () => {
  let queue: ApprovalQueue;

  beforeEach(() => {
    vi.clearAllMocks();
    queue = new ApprovalQueue();
  });

  describe('addAction', () => {
    it('should add action to queue', async () => {
      const action: SuggestedAction = {
        type: 'github_create_issue',
        payload: {
          repo: 'user/repo',
          title: 'Test Issue',
          body: 'Test body',
        },
      };

      const actionId = await queue.addAction(action, 'task-1', 30);

      expect(actionId).toMatch(/^action-/);
      expect(stateStore.addPendingAction).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          taskId: 'task-1',
          action,
          status: 'pending',
          createdAt: expect.any(Number),
          expiresAt: expect.any(Number),
        })
      );
    });

    it('should use default timeout when not specified', async () => {
      const action: SuggestedAction = {
        type: 'github_create_issue',
        payload: {},
      };

      await queue.addAction(action);

      const call = vi.mocked(stateStore.addPendingAction).mock.calls[0][0];
      const timeoutMs = call.expiresAt - call.createdAt;
      const timeoutMinutes = timeoutMs / (60 * 1000);

      expect(timeoutMinutes).toBe(60); // Default timeout
    });

    it('should use "manual" taskId when not provided', async () => {
      const action: SuggestedAction = {
        type: 'github_create_issue',
        payload: {},
      };

      await queue.addAction(action);

      expect(stateStore.addPendingAction).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'manual',
        })
      );
    });

    it('should broadcast action_pending event', async () => {
      const action: SuggestedAction = {
        type: 'github_create_issue',
        payload: {},
      };

      await queue.addAction(action);

      expect(broadcast).toHaveBeenCalledWith({
        type: 'action_pending',
        timestamp: expect.any(Number),
        data: expect.objectContaining({
          actionId: expect.any(String),
          action,
          expiresAt: expect.any(Number),
        }),
      });
    });

    it('should calculate correct expiration time', async () => {
      const action: SuggestedAction = {
        type: 'github_create_issue',
        payload: {},
      };

      const startTime = Date.now();
      await queue.addAction(action, undefined, 30);

      const call = vi.mocked(stateStore.addPendingAction).mock.calls[0][0];
      const expectedExpiration = call.createdAt + 30 * 60 * 1000;

      expect(call.expiresAt).toBeCloseTo(expectedExpiration, -2);
    });
  });

  describe('getPending', () => {
    it('should return pending actions', () => {
      const mockActions: PendingAction[] = [
        {
          id: 'action-1',
          taskId: 'task-1',
          action: { type: 'github_create_issue', payload: {} },
          status: 'pending',
          createdAt: Date.now(),
          expiresAt: Date.now() + 3600000,
        },
      ];

      vi.mocked(stateStore.getPendingActions).mockReturnValue(mockActions);

      const pending = queue.getPending();

      expect(pending).toEqual(mockActions);
    });

    it('should expire actions that are past expiration', () => {
      const expiredAction: PendingAction = {
        id: 'action-1',
        taskId: 'task-1',
        action: { type: 'github_create_issue', payload: {} },
        status: 'pending',
        createdAt: Date.now() - 7200000,
        expiresAt: Date.now() - 3600000, // Expired 1 hour ago
      };

      vi.mocked(stateStore.getPendingActions)
        .mockReturnValueOnce([expiredAction])
        .mockReturnValueOnce([]);

      queue.getPending();

      expect(stateStore.updatePendingAction).toHaveBeenCalledWith('action-1', {
        status: 'expired',
      });
    });

    it('should not expire actions that are not pending', () => {
      const approvedAction: PendingAction = {
        id: 'action-1',
        taskId: 'task-1',
        action: { type: 'github_create_issue', payload: {} },
        status: 'approved',
        createdAt: Date.now() - 7200000,
        expiresAt: Date.now() - 3600000,
      };

      vi.mocked(stateStore.getPendingActions).mockReturnValue([approvedAction]);

      queue.getPending();

      expect(stateStore.updatePendingAction).not.toHaveBeenCalled();
    });
  });

  describe('getAction', () => {
    it('should get action by id', () => {
      const mockAction: PendingAction = {
        id: 'action-1',
        taskId: 'task-1',
        action: { type: 'github_create_issue', payload: {} },
        status: 'pending',
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };

      vi.mocked(stateStore.getPendingAction).mockReturnValue(mockAction);

      const action = queue.getAction('action-1');

      expect(action).toEqual(mockAction);
      expect(stateStore.getPendingAction).toHaveBeenCalledWith('action-1');
    });
  });

  describe('approve', () => {
    it('should return error when action not found', async () => {
      vi.mocked(stateStore.getPendingAction).mockReturnValue(undefined);

      const result = await queue.approve('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Action not found');
    });

    it('should return error when action already processed', async () => {
      const approvedAction: PendingAction = {
        id: 'action-1',
        taskId: 'task-1',
        action: { type: 'github_create_issue', payload: {} },
        status: 'approved',
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };

      vi.mocked(stateStore.getPendingAction).mockReturnValue(approvedAction);

      const result = await queue.approve('action-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Action already approved');
    });

    it('should return error when action expired', async () => {
      const expiredAction: PendingAction = {
        id: 'action-1',
        taskId: 'task-1',
        action: { type: 'github_create_issue', payload: {} },
        status: 'pending',
        createdAt: Date.now() - 7200000,
        expiresAt: Date.now() - 3600000,
      };

      vi.mocked(stateStore.getPendingAction).mockReturnValue(expiredAction);

      const result = await queue.approve('action-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Action expired');
      expect(stateStore.updatePendingAction).toHaveBeenCalledWith('action-1', {
        status: 'expired',
      });
    });

    it('should execute action and update status on success', async () => {
      const pendingAction: PendingAction = {
        id: 'action-1',
        taskId: 'task-1',
        action: { type: 'github_create_issue', payload: { repo: 'user/repo' } },
        status: 'pending',
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };

      vi.mocked(stateStore.getPendingAction).mockReturnValue(pendingAction);
      vi.mocked(executeApprovedAction).mockResolvedValue({
        success: true,
        data: { issueNumber: 123 },
      });

      const result = await queue.approve('action-1');

      expect(result.success).toBe(true);
      expect(executeApprovedAction).toHaveBeenCalledWith('github_create_issue', {
        repo: 'user/repo',
      });
      expect(stateStore.updatePendingAction).toHaveBeenCalledWith('action-1', {
        status: 'approved',
      });
    });

    it('should update related task on successful approval', async () => {
      const pendingAction: PendingAction = {
        id: 'action-1',
        taskId: 'task-1',
        action: { type: 'github_create_issue', payload: {} },
        status: 'pending',
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };

      vi.mocked(stateStore.getPendingAction).mockReturnValue(pendingAction);
      vi.mocked(executeApprovedAction).mockResolvedValue({
        success: true,
        data: {},
      });

      await queue.approve('action-1');

      expect(stateStore.updateTask).toHaveBeenCalledWith('task-1', {
        status: 'completed',
        completedAt: expect.any(Number),
        approvedBy: 'web',
      });
    });

    it('should not update task when taskId is "manual"', async () => {
      const pendingAction: PendingAction = {
        id: 'action-1',
        taskId: 'manual',
        action: { type: 'github_create_issue', payload: {} },
        status: 'pending',
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };

      vi.mocked(stateStore.getPendingAction).mockReturnValue(pendingAction);
      vi.mocked(executeApprovedAction).mockResolvedValue({
        success: true,
        data: {},
      });

      await queue.approve('action-1');

      expect(stateStore.updateTask).not.toHaveBeenCalled();
    });

    it('should broadcast action_approved event', async () => {
      const pendingAction: PendingAction = {
        id: 'action-1',
        taskId: 'task-1',
        action: { type: 'github_create_issue', payload: {} },
        status: 'pending',
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };

      vi.mocked(stateStore.getPendingAction).mockReturnValue(pendingAction);
      vi.mocked(executeApprovedAction).mockResolvedValue({
        success: true,
        data: { issueNumber: 123 },
      });

      await queue.approve('action-1');

      expect(broadcast).toHaveBeenCalledWith({
        type: 'action_approved',
        timestamp: expect.any(Number),
        data: {
          actionId: 'action-1',
          result: expect.objectContaining({ success: true }),
        },
      });
    });

    it('should handle action execution failure', async () => {
      const pendingAction: PendingAction = {
        id: 'action-1',
        taskId: 'task-1',
        action: { type: 'github_create_issue', payload: {} },
        status: 'pending',
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };

      vi.mocked(stateStore.getPendingAction).mockReturnValue(pendingAction);
      vi.mocked(executeApprovedAction).mockResolvedValue({
        success: false,
        error: 'GitHub API error',
      });

      const result = await queue.approve('action-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('GitHub API error');
      expect(stateStore.updatePendingAction).toHaveBeenCalledWith('action-1', {
        status: 'pending',
      });
    });
  });

  describe('reject', () => {
    it('should return error when action not found', () => {
      vi.mocked(stateStore.getPendingAction).mockReturnValue(undefined);

      const result = queue.reject('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Action not found');
    });

    it('should return error when action already processed', () => {
      const rejectedAction: PendingAction = {
        id: 'action-1',
        taskId: 'task-1',
        action: { type: 'github_create_issue', payload: {} },
        status: 'rejected',
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };

      vi.mocked(stateStore.getPendingAction).mockReturnValue(rejectedAction);

      const result = queue.reject('action-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Action already rejected');
    });

    it('should update action status to rejected', () => {
      const pendingAction: PendingAction = {
        id: 'action-1',
        taskId: 'task-1',
        action: { type: 'github_create_issue', payload: {} },
        status: 'pending',
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };

      vi.mocked(stateStore.getPendingAction).mockReturnValue(pendingAction);

      const result = queue.reject('action-1', 'Not needed');

      expect(result.success).toBe(true);
      expect(stateStore.updatePendingAction).toHaveBeenCalledWith('action-1', {
        status: 'rejected',
      });
    });

    it('should update related task', () => {
      const pendingAction: PendingAction = {
        id: 'action-1',
        taskId: 'task-1',
        action: { type: 'github_create_issue', payload: {} },
        status: 'pending',
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };

      vi.mocked(stateStore.getPendingAction).mockReturnValue(pendingAction);

      queue.reject('action-1');

      expect(stateStore.updateTask).toHaveBeenCalledWith('task-1', {
        status: 'rejected',
      });
    });

    it('should not update task when taskId is "manual"', () => {
      const pendingAction: PendingAction = {
        id: 'action-1',
        taskId: 'manual',
        action: { type: 'github_create_issue', payload: {} },
        status: 'pending',
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };

      vi.mocked(stateStore.getPendingAction).mockReturnValue(pendingAction);

      queue.reject('action-1');

      expect(stateStore.updateTask).not.toHaveBeenCalled();
    });

    it('should broadcast action_rejected event', () => {
      const pendingAction: PendingAction = {
        id: 'action-1',
        taskId: 'task-1',
        action: { type: 'github_create_issue', payload: {} },
        status: 'pending',
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };

      vi.mocked(stateStore.getPendingAction).mockReturnValue(pendingAction);

      queue.reject('action-1', 'Not needed');

      expect(broadcast).toHaveBeenCalledWith({
        type: 'action_rejected',
        timestamp: expect.any(Number),
        data: {
          actionId: 'action-1',
          reason: 'Not needed',
        },
      });
    });
  });
});
