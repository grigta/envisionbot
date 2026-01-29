/**
 * Repository Manager Service
 * Handles cloning and updating repositories for analysis
 */

import { execa } from "execa";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

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

export class RepoManagerService {
  private readonly projectsDir: string;

  constructor(config: RepoManagerConfig) {
    this.projectsDir = config.projectsDir;

    // Ensure projects directory exists
    if (!existsSync(this.projectsDir)) {
      mkdirSync(this.projectsDir, { recursive: true });
    }
  }

  /**
   * Get the local path for a project's repository
   */
  getProjectPath(projectId: string): string {
    return join(this.projectsDir, projectId);
  }

  /**
   * Get the repository path within a project directory
   */
  getRepoPath(projectId: string): string {
    return join(this.getProjectPath(projectId), "repo");
  }

  /**
   * Check if a repository is already cloned
   */
  isCloned(projectId: string): boolean {
    const repoPath = this.getRepoPath(projectId);
    return existsSync(join(repoPath, ".git"));
  }

  /**
   * Check if user has access to a repository
   */
  async checkRepoAccess(repo: string): Promise<{ hasAccess: boolean; error?: string }> {
    try {
      await execa("gh", ["repo", "view", repo, "--json", "name"], {
        timeout: 30000,
      });
      return { hasAccess: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Could not resolve") || message.includes("not found")) {
        return { hasAccess: false, error: "Repository not found" };
      }
      if (message.includes("permission") || message.includes("403")) {
        return { hasAccess: false, error: "No access to repository" };
      }
      return { hasAccess: false, error: message };
    }
  }

  /**
   * Get repository information
   */
  async getRepoInfo(repo: string): Promise<RepoInfo | null> {
    try {
      const result = await execa(
        "gh",
        ["repo", "view", repo, "--json", "owner,name,isPrivate,defaultBranchRef"],
        { timeout: 30000 }
      );
      const data = JSON.parse(result.stdout);
      return {
        owner: data.owner?.login || repo.split("/")[0],
        name: data.name,
        fullName: repo,
        isPrivate: data.isPrivate || false,
        defaultBranch: data.defaultBranchRef?.name || "main",
      };
    } catch {
      return null;
    }
  }

  /**
   * Clone or update a repository
   */
  async cloneOrUpdate(
    projectId: string,
    repo: string,
    onProgress?: (step: string, progress: number) => void
  ): Promise<CloneResult> {
    const projectPath = this.getProjectPath(projectId);
    const repoPath = this.getRepoPath(projectId);

    try {
      // Ensure project directory exists
      if (!existsSync(projectPath)) {
        mkdirSync(projectPath, { recursive: true });
      }

      // Check if already cloned
      if (this.isCloned(projectId)) {
        onProgress?.("Updating repository...", 10);

        // Pull latest changes
        try {
          await execa("git", ["fetch", "--all"], {
            cwd: repoPath,
            timeout: 120000,
          });
          onProgress?.("Fetched latest...", 30);

          // Get current branch
          const branchResult = await execa("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
            cwd: repoPath,
          });
          const currentBranch = branchResult.stdout.trim();

          // Reset to remote
          await execa("git", ["reset", "--hard", `origin/${currentBranch}`], {
            cwd: repoPath,
            timeout: 60000,
          });
          onProgress?.("Repository updated", 50);

          return {
            success: true,
            localPath: repoPath,
            isNewClone: false,
          };
        } catch (pullError) {
          console.error("Failed to update repo, will re-clone:", pullError);
          // Remove and re-clone if update fails
          rmSync(repoPath, { recursive: true, force: true });
        }
      }

      // Clone repository
      onProgress?.("Cloning repository...", 10);

      // Check access first
      const accessCheck = await this.checkRepoAccess(repo);
      if (!accessCheck.hasAccess) {
        return {
          success: false,
          localPath: repoPath,
          isNewClone: false,
          error: accessCheck.error || "Cannot access repository",
        };
      }

      onProgress?.("Access verified, cloning...", 20);

      // Use shallow clone for faster initial analysis
      await execa(
        "gh",
        ["repo", "clone", repo, repoPath, "--", "--depth", "1"],
        { timeout: 300000 } // 5 minutes timeout for clone
      );

      onProgress?.("Repository cloned", 50);

      return {
        success: true,
        localPath: repoPath,
        isNewClone: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Clone/update failed:", message);

      return {
        success: false,
        localPath: repoPath,
        isNewClone: false,
        error: message,
      };
    }
  }

  /**
   * Remove a cloned repository
   */
  async remove(projectId: string): Promise<void> {
    const projectPath = this.getProjectPath(projectId);
    if (existsSync(projectPath)) {
      rmSync(projectPath, { recursive: true, force: true });
    }
  }

  /**
   * Get repository statistics
   */
  async getRepoStats(
    projectId: string
  ): Promise<{ files: number; directories: number; languages: string[] } | null> {
    const repoPath = this.getRepoPath(projectId);
    if (!this.isCloned(projectId)) {
      return null;
    }

    try {
      // Count files (excluding .git)
      const findResult = await execa(
        "find",
        [repoPath, "-type", "f", "-not", "-path", "*/.git/*"],
        { timeout: 30000 }
      );
      const files = findResult.stdout.split("\n").filter(Boolean).length;

      // Count directories
      const dirResult = await execa(
        "find",
        [repoPath, "-type", "d", "-not", "-path", "*/.git/*"],
        { timeout: 30000 }
      );
      const directories = dirResult.stdout.split("\n").filter(Boolean).length;

      // Detect languages by file extensions
      const extensionResult = await execa(
        "find",
        [repoPath, "-type", "f", "-not", "-path", "*/.git/*", "-name", "*.*"],
        { timeout: 30000 }
      );
      const extensions = new Set<string>();
      for (const file of extensionResult.stdout.split("\n").filter(Boolean)) {
        const ext = file.split(".").pop()?.toLowerCase();
        if (ext) extensions.add(ext);
      }

      const languageMap: Record<string, string> = {
        ts: "TypeScript",
        tsx: "TypeScript",
        js: "JavaScript",
        jsx: "JavaScript",
        py: "Python",
        rb: "Ruby",
        go: "Go",
        rs: "Rust",
        java: "Java",
        kt: "Kotlin",
        swift: "Swift",
        cs: "C#",
        cpp: "C++",
        c: "C",
        vue: "Vue",
        svelte: "Svelte",
      };

      const languages = [...extensions]
        .map((ext) => languageMap[ext])
        .filter(Boolean)
        .filter((v, i, a) => a.indexOf(v) === i);

      return { files, directories, languages };
    } catch {
      return null;
    }
  }
}

/**
 * Create RepoManagerService instance with default config
 */
export function createRepoManager(): RepoManagerService {
  const projectsDir = join(__dirname, "..", "..", "projects");
  return new RepoManagerService({ projectsDir });
}
