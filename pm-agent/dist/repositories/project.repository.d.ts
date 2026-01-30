/**
 * Project Repository
 */
import type { Project } from "../types.js";
import { BaseRepository } from "./base.repository.js";
export declare class ProjectRepository extends BaseRepository<Project> {
    protected readonly tableName = "projects";
    protected readonly cachePrefix = "pm:project";
    protected readonly cacheTTL = 300;
    protected readonly pubsubChannel: "pm:events:projects";
    private rowToProject;
    getAll(): Promise<Project[]>;
    getById(id: string): Promise<Project | undefined>;
    getByName(name: string): Promise<Project | undefined>;
    getByRepo(repo: string): Promise<Project | undefined>;
    upsert(project: Project): Promise<Project>;
    delete(id: string): Promise<boolean>;
}
//# sourceMappingURL=project.repository.d.ts.map