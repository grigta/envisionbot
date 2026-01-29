import type { PendingAction, SuggestedAction } from "../types.js";
declare class ApprovalQueue {
    addAction(action: SuggestedAction, taskId?: string, timeoutMinutes?: number): Promise<string>;
    getPending(): PendingAction[];
    getAction(id: string): PendingAction | undefined;
    approve(id: string): Promise<{
        success: boolean;
        error?: string;
        result?: unknown;
    }>;
    reject(id: string, reason?: string): {
        success: boolean;
        error?: string;
    };
    private expire;
    setTelegramMessageId(id: string, messageId: number): void;
}
export declare const approvalQueue: ApprovalQueue;
export {};
//# sourceMappingURL=queue.d.ts.map