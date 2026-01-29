import { store } from "../state/store.js";

export interface ParsedMention {
  type: "project" | "repo" | "path";
  value: string;
  original: string;
}

export interface ParseMentionsResult {
  mentions: ParsedMention[];
  cleanMessage: string;
}

/**
 * Parse @-mentions from a message
 * Supports:
 * - @project-name - reference to a saved project
 * - @owner/repo - reference to a GitHub repository
 * - @/path/to/dir - reference to a local path
 */
export function parseMentions(message: string): ParseMentionsResult {
  // Match @ followed by alphanumeric, dashes, slashes, dots, or underscores
  const mentionRegex = /@([\w\-\/\.]+)/g;
  const mentions: ParsedMention[] = [];

  let match;
  while ((match = mentionRegex.exec(message)) !== null) {
    const value = match[1];
    let type: "project" | "repo" | "path";

    if (value.startsWith("/")) {
      // Starts with / - local path
      type = "path";
    } else if (value.includes("/")) {
      // Contains / but doesn't start with it - GitHub repo (owner/repo)
      type = "repo";
    } else {
      // No slash - project name
      type = "project";
    }

    mentions.push({
      type,
      value,
      original: match[0],
    });
  }

  return {
    mentions,
    cleanMessage: message,
  };
}

/**
 * Build context string from parsed mentions
 * This is appended to the agent prompt to provide context about referenced items
 */
export function buildMentionContext(mentions: ParsedMention[]): string {
  if (mentions.length === 0) return "";

  let context = "\n\nReferenced items in the user's message:\n";

  for (const m of mentions) {
    switch (m.type) {
      case "project": {
        const project = store.getProjectByName(m.value);
        if (project) {
          context += `- Project "${m.value}": GitHub repo=${project.repo}, phase=${project.phase}, goals=[${project.goals.join(", ")}]\n`;
        } else {
          context += `- Project "${m.value}": (not found in saved projects, treat as name reference)\n`;
        }
        break;
      }
      case "repo":
        context += `- GitHub repository: ${m.value} (use gh CLI to interact with this repo)\n`;
        break;
      case "path":
        context += `- Local path: ${m.value} (filesystem path on the user's machine)\n`;
        break;
    }
  }

  context += "\nWhen the user mentions these items, they are referring to the above resources.\n";

  return context;
}

/**
 * Extract project IDs from mentions
 * Useful for associating chat messages with projects
 */
export function extractProjectIds(mentions: ParsedMention[]): string[] {
  const projectIds: string[] = [];

  for (const m of mentions) {
    if (m.type === "project") {
      const project = store.getProjectByName(m.value);
      if (project) {
        projectIds.push(project.id);
      }
    } else if (m.type === "repo") {
      // Try to find project by repo name
      const project = store.getProjectByRepo(m.value);
      if (project) {
        projectIds.push(project.id);
      }
    }
  }

  return [...new Set(projectIds)]; // Remove duplicates
}

/**
 * Get all mentionable items for autocomplete
 */
export async function getMentionables(): Promise<
  Array<{
    id: string;
    type: "project" | "repo";
    label: string;
    description: string;
    value: string;
  }>
> {
  const projects = store.getProjects();

  const mentionables = projects.map((p) => ({
    id: `project:${p.id}`,
    type: "project" as const,
    label: p.name,
    description: p.repo,
    value: `@${p.name}`,
  }));

  // GitHub repos will be fetched via separate API endpoint
  // to avoid blocking and to keep this function synchronous-friendly

  return mentionables;
}
