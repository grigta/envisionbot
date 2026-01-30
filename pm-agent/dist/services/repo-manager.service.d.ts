/**
 * Repository Manager Service
 * Handles cloning and updating repositories for analysis
 */
export interface RepoManagerConfig {
    projectsDir: string;
}
export interface CloneResult {
    success: boolean;
    localPath: string;
    isNewClone: boolean;
    error?: string;
}
export interface RepoInfo {
    owner: string;
    name: string;
    fullName: string;
    isPrivate: boolean;
    defaultBranch: string;
}
export declare class RepoManagerService {
    private readonly projectsDir;
    constructor(config: RepoManagerConfig);
    /**
     * Get the local path for a project's repository
     */
    getProjectPath(projectId: string): string;
    /**
     * Get the repository path within a project directory
     */
    getRepoPath(projectId: string): string;
    /**
     * Check if a repository is already cloned
     */
    isCloned(projectId: string): boolean;
    /**
     * Check if user has access to a repository
     */
    checkRepoAccess(repo: string): Promise<{
        hasAccess: boolean;
        error?: string;
    }>;
    /**
     * Get repository information
     */
    getRepoInfo(repo: string): Promise<RepoInfo | null>;
    /**
     * Clone or update a repository
     */
    cloneOrUpdate(projectId: string, repo: string, onProgress?: (step: string, progress: number) => void): Promise<CloneResult>;
    /**
     * Remove a cloned repository
     */
    remove(projectId: string): Promise<void>;
    /**
     * Get repository statistics
     */
    getRepoStats(projectId: string): Promise<{
        files: number;
        directories: number;
        languages: string[];
    } | null>;
}
/**
 * Create RepoManagerService instance with default config
 */
export declare function createRepoManager(): RepoManagerService;
//# sourceMappingURL=repo-manager.service.d.ts.map