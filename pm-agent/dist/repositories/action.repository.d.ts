/**
 * Pending Action Repository
 */
import type { PendingAction } from "../types.js";
import { BaseRepository } from "./base.repository.js";
export declare class ActionRepository extends BaseRepository<PendingAction> {
    protected readonly tableName = "pending_actions";
    protected readonly cachePrefix = "pm:action";
    protected readonly cacheTTL = 60;
    protected readonly pubsubChannel: "pm:events:actions";
    private rowToAction;
    getAll(): Promise<PendingAction[]>;
    getPending(): Promise<PendingAction[]>;
    getById(id: string): Promise<PendingAction | undefined>;
    getByTaskId(taskId: string): Promise<PendingAction[]>;
    create(action: PendingAction): Promise<PendingAction>;
    updateStatus(id: string, status: PendingAction["status"], telegramMessageId?: number): Promise<PendingAction | undefined>;
    expireOld(): Promise<number>;
}
//# sourceMappingURL=action.repository.d.ts.map