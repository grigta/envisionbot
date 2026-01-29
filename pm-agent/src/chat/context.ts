import { store } from "../state/store.js";
import { parseMentions, buildMentionContext, extractProjectIds } from "./mentions.js";

export interface ChatContext {
  prompt: string;
  projectIds: string[];
  mentions: ReturnType<typeof parseMentions>["mentions"];
}

/**
 * Build a complete prompt for the chat agent
 * Includes system context, project info, and the user's message
 */
export function buildChatContext(message: string, projectId?: string): ChatContext {
  try {
    // Parse @-mentions from the message
    const { mentions } = parseMentions(message);
    const mentionContext = buildMentionContext(mentions);

    // Extract project IDs from mentions
    const projectIds = extractProjectIds(mentions);

    // If a project ID was explicitly provided, add it
    if (projectId && !projectIds.includes(projectId)) {
      projectIds.push(projectId);
    }

  // Build the system context
  let context = `Ты Envision CEO ассистент. Помогаешь пользователю управлять его проектами.

## Возможности

- **GitHub** — issues, PR, репозитории
- **Файлы** — чтение, анализ, редактирование кода
- **Веб-поиск** — исследование и сбор информации
- **Анализ кода** — структура, качество, улучшения

## Правила

- Отвечай кратко и по делу
- На приветствия отвечай дружелюбно, без лишних действий
- Выполняй задачи напрямую когда возможно
- Для опасных операций (удаление, force push) спрашивай подтверждение
`;

  // Add project context if available
  if (projectIds.length > 0) {
    context += "\n## Project Context\n\n";
    for (const pid of projectIds) {
      const project = store.getProject(pid);
      if (project) {
        context += `**${project.name}**\n`;
        context += `- Repository: ${project.repo}\n`;
        context += `- Phase: ${project.phase}\n`;
        if (project.goals.length > 0) {
          context += `- Goals: ${project.goals.join(", ")}\n`;
        }
        context += "\n";
      }
    }
  } else if (projectId) {
    const project = store.getProject(projectId);
    if (project) {
      context += `\n## Current Project Context\n\n`;
      context += `Working with project: **${project.name}**\n`;
      context += `- Repository: ${project.repo}\n`;
      context += `- Phase: ${project.phase}\n`;
      if (project.goals.length > 0) {
        context += `- Goals: ${project.goals.join(", ")}\n`;
      }
      context += "\n";
    }
  }

  // Add mention context
  if (mentionContext) {
    context += mentionContext;
  }

    // Add the user's message
    context += `\n## Сообщение пользователя\n\n${message}`;

    return {
      prompt: context,
      projectIds,
      mentions,
    };
  } catch (error) {
    console.error("Error building chat context:", error);
    // Return a minimal context to prevent complete failure
    return {
      prompt: `Ты Envision CEO ассистент.\n\n## Сообщение пользователя\n\n${message}`,
      projectIds: projectId ? [projectId] : [],
      mentions: [],
    };
  }
}

/**
 * Build a simpler prompt for quick queries
 */
export function buildQuickQueryContext(query: string): string {
  return `You are an Envision CEO assistant. Answer the following query concisely:

${query}

Provide a direct, helpful response.`;
}
