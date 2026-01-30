/**
 * Idea Repository
 */
import type { Idea, IdeaStatus } from "../types.js";
import { BaseRepository } from "./base.repository.js";
interface IdeaFilter {
    status?: IdeaStatus;
}
export declare class IdeaRepository extends BaseRepository<Idea> {
    protected readonly tableName = "ideas";
    protected readonly cachePrefix = "pm:idea";
    protected readonly cacheTTL = 300;
    protected readonly pubsubChannel: "pm:events:ideas";
    private rowToIdea;
    getAll(filter?: IdeaFilter): Promise<Idea[]>;
    getActive(): Promise<Idea[]>;
    getById(id: string): Promise<Idea | undefined>;
    create(idea: Idea): Promise<Idea>;
    update(id: string, updates: Partial<Idea>): Promise<Idea | undefined>;
    delete(id: string): Promise<boolean>;
}
export {};
//# sourceMappingURL=idea.repository.d.ts.map