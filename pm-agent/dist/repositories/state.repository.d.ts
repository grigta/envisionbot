/**
 * Agent State Repository
 * Key-value store for global agent state
 */
import { BaseRepository } from "./base.repository.js";
export declare class StateRepository extends BaseRepository<unknown> {
    protected readonly tableName = "agent_state";
    protected readonly cachePrefix = "pm:state";
    protected readonly cacheTTL = 60;
    protected readonly pubsubChannel: "pm:events:analysis";
    get<T>(key: string): Promise<T | undefined>;
    set<T>(key: string, value: T): Promise<void>;
    delete(key: string): Promise<boolean>;
    getLastHealthCheck(): Promise<number | undefined>;
    setLastHealthCheck(timestamp: number): Promise<void>;
    getLastDeepAnalysis(): Promise<number | undefined>;
    setLastDeepAnalysis(timestamp: number): Promise<void>;
    isMigrationCompleted(): Promise<boolean>;
    setMigrationCompleted(): Promise<void>;
    getCurrentChatSessionId(): Promise<string | undefined>;
    setCurrentChatSessionId(sessionId: string): Promise<void>;
    getStats(deps: {
        projectCount: number;
        taskCount: number;
        pendingActionsCount: number;
        ideaCount: number;
        activeIdeasCount: number;
    }): Promise<{
        projectCount: number;
        taskCount: number;
        pendingActionsCount: number;
        ideaCount: number;
        activeIdeasCount: number;
        lastHealthCheck?: number;
        lastDeepAnalysis?: number;
    }>;
}
//# sourceMappingURL=state.repository.d.ts.map