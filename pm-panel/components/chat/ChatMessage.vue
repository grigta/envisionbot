<template>
  <div class="flex gap-3" :class="message.role === 'user' ? 'flex-row-reverse' : ''">
    <!-- Avatar -->
    <div
      class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
      :class="message.role === 'user' ? 'bg-cyan-500/20' : 'bg-purple-500/20'"
    >
      <UIcon
        :name="message.role === 'user' ? 'i-heroicons-user' : 'i-heroicons-sparkles'"
        class="w-4 h-4"
        :class="message.role === 'user' ? 'text-cyan-400' : 'text-purple-400'"
      />
    </div>

    <!-- Message Content -->
    <div
      class="flex-1 min-w-0"
      :class="message.role === 'user' ? 'text-right' : ''"
    >
      <!-- Header -->
      <div class="flex items-center gap-2 mb-1" :class="message.role === 'user' ? 'justify-end' : ''">
        <span class="text-xs font-medium" :class="message.role === 'user' ? 'text-cyan-400' : 'text-purple-400'">
          {{ message.role === 'user' ? 'You' : 'Agent' }}
        </span>
        <span class="text-xs text-gray-600">
          {{ formatTime(message.timestamp) }}
        </span>
        <span
          v-if="message.role === 'assistant' && message.success === false"
          class="text-xs text-red-400"
        >
          (failed)
        </span>
      </div>

      <!-- Content Bubble -->
      <div
        class="inline-block rounded-xl px-4 py-3 text-sm"
        :class="[
          message.role === 'user'
            ? 'bg-cyan-600 text-white max-w-[85%]'
            : message.success === false
            ? 'bg-red-500/10 border border-red-500/20 text-gray-300 max-w-full'
            : 'bg-[#2d2d2d] text-gray-300 max-w-full'
        ]"
      >
        <!-- User message - show with @mentions highlighted -->
        <template v-if="message.role === 'user'">
          <span v-html="highlightMentions(message.content)" />
        </template>

        <!-- Assistant message with Markdown rendering -->
        <template v-else>
          <div v-if="message.error" class="text-red-400 mb-2">
            {{ message.error }}
          </div>
          <div class="markdown-content prose prose-invert prose-sm max-w-none" v-html="renderMarkdown(message.content)" />

          <!-- Show steps toggle if available -->
          <details v-if="message.steps && message.steps.length > 0" class="mt-3">
            <summary class="text-xs text-gray-500 cursor-pointer hover:text-gray-300">
              View {{ message.steps.length }} execution steps
            </summary>
            <div class="mt-2 space-y-2">
              <div
                v-for="step in message.steps.slice(-10)"
                :key="step.id"
                class="text-xs p-2 rounded bg-[#191919]"
              >
                <div class="flex items-center gap-2 mb-1">
                  <span
                    class="px-1.5 py-0.5 rounded text-xs"
                    :class="getStepBadgeClass(step.type)"
                  >
                    {{ step.type }}
                  </span>
                  <span v-if="step.toolName" class="text-purple-400 font-mono">
                    {{ step.toolName }}
                  </span>
                </div>
                <div class="text-gray-500 truncate">
                  {{ truncate(step.content, 100) }}
                </div>
              </div>
            </div>
          </details>
        </template>
      </div>

      <!-- Mentions badges (for user messages) -->
      <div
        v-if="message.role === 'user' && message.mentions && message.mentions.length > 0"
        class="mt-2 flex flex-wrap gap-1"
        :class="message.role === 'user' ? 'justify-end' : ''"
      >
        <span
          v-for="mention in message.mentions"
          :key="mention.value"
          class="text-xs px-2 py-0.5 rounded-full"
          :class="mention.type === 'project' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-purple-500/20 text-purple-400'"
        >
          @{{ mention.value }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { marked } from "marked";

interface AgentStep {
  id: string;
  type: string;
  content: string;
  toolName?: string;
}

interface ChatMessageType {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  mentions?: Array<{ type: string; value: string }>;
  steps?: AgentStep[];
  success?: boolean;
  error?: string;
}

defineProps<{
  message: ChatMessageType;
}>();

// Configure marked for better rendering
marked.setOptions({
  breaks: true, // Convert \n to <br>
  gfm: true, // GitHub Flavored Markdown
});

function renderMarkdown(content: string): string {
  if (!content) return "";

  // Clean up the content
  let cleanContent = content;

  // Remove "Agent initialized with X tools" system messages
  cleanContent = cleanContent.replace(/Agent initialized with \d+ tools/g, "");

  // Remove duplicate greeting patterns (when same text appears twice in a row)
  // Pattern: "TextA?TextA" -> "TextA"
  cleanContent = cleanContent.replace(/^(.{20,})\?\1$/s, "$1");

  // Remove duplicate paragraphs that are stuck together
  const paragraphs = cleanContent.split(/\n\n+/);
  const seen = new Set<string>();
  const uniqueParagraphs = paragraphs.filter((p) => {
    const trimmed = p.trim();
    if (!trimmed || seen.has(trimmed)) return false;
    seen.add(trimmed);
    return true;
  });
  cleanContent = uniqueParagraphs.join("\n\n");

  // If content has duplicate "## Готово!" sections, keep only the first one
  const sections = cleanContent.split(/(?=## Готово!)/);
  if (sections.length > 1) {
    cleanContent = sections[0] + sections[1];
  }

  return marked.parse(cleanContent) as string;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function highlightMentions(text: string): string {
  return text.replace(
    /@([\w\-\/\.]+)/g,
    '<span class="bg-cyan-500/30 px-1 rounded">@$1</span>'
  );
}

function getStepBadgeClass(type: string): string {
  const classes: Record<string, string> = {
    thinking: "bg-yellow-500/20 text-yellow-400",
    tool_use: "bg-purple-500/20 text-purple-400",
    tool_result: "bg-green-500/20 text-green-400",
    text: "bg-blue-500/20 text-blue-400",
    error: "bg-red-500/20 text-red-400",
    complete: "bg-cyan-500/20 text-cyan-400",
  };
  return classes[type] || "bg-gray-500/20 text-gray-400";
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}
</script>

<style scoped>
/* Markdown content styles */
.markdown-content :deep(h1) {
  @apply text-xl font-bold text-white mb-3 mt-4 first:mt-0;
}

.markdown-content :deep(h2) {
  @apply text-lg font-semibold text-white mb-2 mt-3 first:mt-0;
}

.markdown-content :deep(h3) {
  @apply text-base font-medium text-white mb-2 mt-2;
}

.markdown-content :deep(p) {
  @apply mb-2 last:mb-0 leading-relaxed;
}

.markdown-content :deep(ul) {
  @apply list-disc list-inside mb-2 space-y-1;
}

.markdown-content :deep(ol) {
  @apply list-decimal list-inside mb-2 space-y-1;
}

.markdown-content :deep(li) {
  @apply text-gray-300;
}

.markdown-content :deep(a) {
  @apply text-cyan-400 hover:text-cyan-300 underline;
}

.markdown-content :deep(code) {
  @apply bg-[#191919] px-1.5 py-0.5 rounded text-cyan-300 text-xs font-mono;
}

.markdown-content :deep(pre) {
  @apply bg-[#191919] p-3 rounded-lg mb-2 overflow-x-auto;
}

.markdown-content :deep(pre code) {
  @apply bg-transparent p-0;
}

.markdown-content :deep(blockquote) {
  @apply border-l-4 border-cyan-500 pl-3 my-2 text-gray-400 italic;
}

.markdown-content :deep(hr) {
  @apply border-[#404040] my-4;
}

.markdown-content :deep(strong) {
  @apply font-semibold text-white;
}

.markdown-content :deep(em) {
  @apply italic;
}

/* Table styles */
.markdown-content :deep(table) {
  @apply w-full border-collapse mb-4 text-sm;
}

.markdown-content :deep(thead) {
  @apply bg-[#191919];
}

.markdown-content :deep(th) {
  @apply px-3 py-2 text-left text-xs font-semibold text-cyan-400 uppercase tracking-wider border-b border-[#404040];
}

.markdown-content :deep(tbody tr) {
  @apply border-b border-[#353535] hover:bg-[#252525] transition-colors;
}

.markdown-content :deep(tbody tr:last-child) {
  @apply border-b-0;
}

.markdown-content :deep(td) {
  @apply px-3 py-2 text-gray-300;
}

/* Make links in tables more visible */
.markdown-content :deep(td a) {
  @apply text-cyan-400 hover:text-cyan-300 no-underline hover:underline;
}

/* Badge-like styling for status columns */
.markdown-content :deep(td:last-child) {
  @apply text-right;
}
</style>
