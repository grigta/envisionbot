import type { Task, Project, AnalysisReport } from "./types.js";
export declare function runAgent(prompt: string, context?: {
    projects?: Project[];
    type?: "health_check" | "deep_analysis" | "manual";
}): Promise<{
    response: string;
    tasks: Task[];
    report?: AnalysisReport;
}>;
export declare function runHealthCheck(): Promise<AnalysisReport | undefined>;
export declare function runDeepAnalysis(): Promise<AnalysisReport | undefined>;
export declare function runIdeaPlanning(ideaId: string): Promise<void>;
export declare function launchIdea(ideaId: string, repoName?: string, isPrivate?: boolean): Promise<void>;
//# sourceMappingURL=agent.d.ts.map