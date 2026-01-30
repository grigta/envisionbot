/**
 * Store - Database-backed state management
 * Migrated from file-based JSON storage to SQLite + Redis
 */
import { type RepositoryDeps } from "../db/index.js";
import type { Project, Task, PendingAction, ProjectMetrics, AnalysisReport, Idea } from "../types.js";
declare class Store {
    private db;
    private initialized;
    private initPromise;
    private _projects;
    private _tasks;
    private _actions;
    private _metrics;
    private _reports;
    private _ideas;
    private _chat;
    private _state;
    constructor();
    private initialize;
    private get projects();
    private get tasks();
    private get actions();
    private get metrics();
    private get reports();
    private get ideas();
    private get state();
    getProjects(): Project[];
    getProject(id: string): Project | undefined;
    getProjectByName(name: string): Project | undefined;
    getProjectByRepo(repo: string): Project | undefined;
    addProject(project: Project): void;
    removeProject(id: string): void;
    getTasks(filter?: {
        projectId?: string;
        status?: Task["status"];
    }): Task[];
    getTask(id: string): Task | undefined;
    addTask(task: Task): void;
    updateTask(id: string, updates: Partial<Task>): Task | undefined;
    getPendingActions(): PendingAction[];
    getPendingAction(id: string): PendingAction | undefined;
    addPendingAction(action: PendingAction): void;
    updatePendingAction(id: string, updates: Partial<PendingAction>): PendingAction | undefined;
    addMetrics(metrics: ProjectMetrics): void;
    getMetrics(projectId: string, limit?: number): ProjectMetrics[];
    getReports(limit?: number): AnalysisReport[];
    getReport(id: string): AnalysisReport | undefined;
    addReport(report: AnalysisReport): void;
    deleteReport(id: string): boolean;
    getIdeas(filter?: {
        status?: Idea["status"];
    }): Idea[];
    getIdea(id: string): Idea | undefined;
    addIdea(idea: Idea): void;
    updateIdea(id: string, updates: Partial<Idea>): Idea | undefined;
    removeIdea(id: string): void;
    getLastHealthCheck(): number | undefined;
    setLastHealthCheck(timestamp: number): void;
    getLastDeepAnalysis(): number | undefined;
    setLastDeepAnalysis(timestamp: number): void;
    getStats(): {
        projectCount: number;
        taskCount: number;
        pendingActionsCount: number;
        ideaCount: number;
        activeIdeasCount: number;
        lastHealthCheck?: number;
        lastDeepAnalysis?: number;
    };
    getRepositoryDeps(): RepositoryDeps | null;
    save(): void;
    close(): Promise<void>;
}
export declare const stateStore: Store;
export declare const store: Store;
export {};
//# sourceMappingURL=store.d.ts.map