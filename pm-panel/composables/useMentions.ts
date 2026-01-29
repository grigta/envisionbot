export interface Mentionable {
  id: string;
  type: "project" | "repo";
  label: string;
  description: string;
  value: string;
  icon: string;
}

export function useMentions() {
  const config = useRuntimeConfig();
  const baseUrl = config.public.apiBaseUrl;

  const mentionables = ref<Mentionable[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  /**
   * Load all mentionable items (projects + GitHub repos)
   */
  async function loadMentionables() {
    loading.value = true;
    error.value = null;

    try {
      const response = await fetch(`${baseUrl}/api/mentions?limit=100`);
      if (!response.ok) {
        throw new Error("Failed to load mentionables");
      }
      mentionables.value = await response.json();
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Unknown error";
      console.error("Failed to load mentionables:", err);
    } finally {
      loading.value = false;
    }
  }

  /**
   * Filter mentionables by query
   */
  function filterMentions(query: string): Mentionable[] {
    if (!query) return mentionables.value.slice(0, 10);

    const q = query.toLowerCase();
    return mentionables.value.filter(
      (m) =>
        m.label.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q)
    );
  }

  /**
   * Parse @-mentions from text and return their positions
   */
  function findMentionTrigger(
    text: string,
    cursorPosition: number
  ): { trigger: boolean; query: string; startIndex: number } | null {
    // Look backwards from cursor for @ symbol
    let startIndex = cursorPosition - 1;

    while (startIndex >= 0) {
      const char = text[startIndex];

      // Found @ - this is the start of a mention
      if (char === "@") {
        const query = text.slice(startIndex + 1, cursorPosition);
        // Make sure there's no space between @ and cursor
        if (!query.includes(" ")) {
          return {
            trigger: true,
            query,
            startIndex,
          };
        }
        return null;
      }

      // If we hit a space or newline, no active mention
      if (char === " " || char === "\n") {
        return null;
      }

      startIndex--;
    }

    return null;
  }

  /**
   * Replace the mention trigger with the selected mention value
   */
  function insertMention(
    text: string,
    cursorPosition: number,
    mention: Mentionable
  ): { newText: string; newCursorPosition: number } {
    const trigger = findMentionTrigger(text, cursorPosition);
    if (!trigger) {
      return { newText: text, newCursorPosition: cursorPosition };
    }

    const before = text.slice(0, trigger.startIndex);
    const after = text.slice(cursorPosition);
    const newText = `${before}${mention.value} ${after}`;
    const newCursorPosition = before.length + mention.value.length + 1;

    return { newText, newCursorPosition };
  }

  // Load mentionables on mount
  onMounted(() => {
    loadMentionables();
  });

  return {
    mentionables,
    loading,
    error,
    loadMentionables,
    filterMentions,
    findMentionTrigger,
    insertMention,
  };
}
