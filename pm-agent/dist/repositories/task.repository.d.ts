/**
 * Task Repository
 */
import type { Task, TaskStatus, KanbanStatus } from "../types.js";
import { BaseRepository } from "./base.repository.js";
interface TaskFilter {
    projectId?: string;
    status?: TaskStatus;
    kanbanStatus?: KanbanStatus;
}
export declare class TaskRepository extends BaseRepository<Task> {
    protected readonly tableName = "tasks";
    protected readonly cachePrefix = "pm:task";
    protected readonly cacheTTL = 120;
    protected readonly pubsubChannel: "pm:events:tasks";
    private rowToTask;
    getAll(filter?: TaskFilter): Promise<Task[]>;
    getPending(): Promise<Task[]>;
    getByProjectId(projectId: string): Promise<Task[]>;
    getById(id: string): Promise<Task | undefined>;
    /**
     * Find next executable task from backlog
     * Returns task with highest priority that is approved and in backlog
     */
    findNextExecutableTask(): Promise<Task | null>;
    /**
     * Update specific fields of a task
     */
    update(id: string, updates: Partial<Task>): Promise<Task | undefined>;
    upsert(task: Task): Promise<Task>;
    updateStatus(id: string, updates: Partial<Pick<Task, "status" | "kanbanStatus" | "completedAt" | "approvedBy">>): Promise<Task | undefined>;
    delete(id: string): Promise<boolean>;
}
export {};
//# sourceMappingURL=task.repository.d.ts.map