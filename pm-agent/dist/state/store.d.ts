import type { Project, Task, PendingAction, ProjectMetrics, AnalysisReport, Idea } from "../types.js";
declare class Store {
    private state;
    private saveTimeout;
    constructor();
    private load;
    private scheduleSave;
    save(): void;
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
}
export declare const stateStore: Store;
export declare const store: Store;
export {};
//# sourceMappingURL=store.d.ts.map