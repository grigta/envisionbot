<template>
  <div class="max-w-3xl">
    <!-- Back link -->
    <NuxtLink
      to="/news"
      class="inline-flex items-center gap-1 text-gray-500 hover:text-white text-sm mb-6 transition-colors"
    >
      <UIcon name="i-heroicons-arrow-left" class="w-4 h-4" />
      Back to News
    </NuxtLink>

    <!-- Loading state -->
    <div v-if="loading" class="space-y-4">
      <div class="animate-pulse bg-[#2d2d2d] rounded-xl h-32" />
      <div class="animate-pulse bg-[#2d2d2d] rounded-xl h-48" />
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="text-center py-12">
      <UIcon name="i-heroicons-exclamation-circle" class="w-12 h-12 text-red-500 mx-auto mb-4" />
      <p class="text-gray-500">{{ error }}</p>
    </div>

    <!-- Content -->
    <template v-else-if="item">
      <!-- Header -->
      <div class="flex items-start gap-4 mb-8">
        <div
          class="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-cyan-500 to-blue-600"
        >
          <UIcon name="i-heroicons-document-text" class="w-7 h-7 text-white" />
        </div>
        <div class="flex-1 min-w-0">
          <h1 class="text-2xl font-bold text-white mb-2">{{ item.title }}</h1>
          <div class="flex items-center gap-3 flex-wrap">
            <span class="px-2 py-0.5 rounded text-xs font-medium bg-cyan-900/50 text-cyan-300">
              {{ sourceName }}
            </span>
            <a
              :href="item.url"
              target="_blank"
              rel="noopener noreferrer"
              class="text-cyan-400 hover:text-cyan-300 text-sm flex items-center gap-1 transition-colors"
            >
              {{ getDomain(item.url) }}
              <UIcon name="i-heroicons-arrow-top-right-on-square" class="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      <!-- Description -->
      <div
        v-if="item.description"
        class="bg-[#1e1e1e] border border-[#2d2d2d] rounded-xl p-5 mb-6"
      >
        <h3 class="text-sm font-medium text-gray-400 mb-3">Description</h3>
        <p class="text-gray-300 whitespace-pre-wrap">{{ item.description }}</p>
      </div>

      <!-- Content -->
      <div
        v-if="item.content"
        class="bg-[#1e1e1e] border border-[#2d2d2d] rounded-xl p-5 mb-6"
      >
        <h3 class="text-sm font-medium text-gray-400 mb-3">Content</h3>
        <div class="markdown-content prose prose-invert prose-sm max-w-none" v-html="renderMarkdown(item.content)" />
      </div>

      <!-- Metadata -->
      <div
        v-if="item.metadata && Object.keys(item.metadata).length > 0"
        class="bg-[#1e1e1e] border border-[#2d2d2d] rounded-xl p-5 mb-6"
      >
        <h3 class="text-sm font-medium text-gray-400 mb-3">Extracted Data</h3>
        <div class="space-y-2">
          <div
            v-for="(value, key) in item.metadata"
            :key="key"
            class="flex items-start gap-2 text-sm"
          >
            <span class="text-gray-500 flex-shrink-0">{{ formatKey(key as string) }}:</span>
            <span class="text-gray-300">{{ formatValue(value) }}</span>
          </div>
        </div>
      </div>

      <!-- Details -->
      <div class="bg-[#1e1e1e] border border-[#2d2d2d] rounded-xl p-5">
        <h3 class="text-sm font-medium text-gray-400 mb-3">Details</h3>
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span class="text-gray-600">Source:</span>
            <span class="text-gray-300 ml-2">{{ sourceName }}</span>
          </div>
          <div>
            <span class="text-gray-600">Extracted:</span>
            <span class="text-gray-300 ml-2">{{ formatDate(item.extractedAt) }}</span>
          </div>
          <div>
            <span class="text-gray-600">Status:</span>
            <span class="ml-2" :class="item.isProcessed ? 'text-green-400' : 'text-yellow-400'">
              {{ item.isProcessed ? 'Processed' : 'Pending' }}
            </span>
          </div>
          <div v-if="item.relevanceScore">
            <span class="text-gray-600">Relevance:</span>
            <span class="text-gray-300 ml-2">{{ Math.round(item.relevanceScore * 100) }}%</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { marked } from "marked";
import type { CrawledItem, CrawlerSource } from "~/composables/useApi";

// Configure marked for better rendering
marked.setOptions({
  breaks: true,
  gfm: true,
});

const route = useRoute();
const api = useApi();

const item = ref<CrawledItem | null>(null);
const source = ref<CrawlerSource | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

const id = computed(() => route.params.id as string);

const sourceName = computed(() => source.value?.name || "Unknown Source");

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function formatKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  if (typeof value === "object" && value !== null) {
    return JSON.stringify(value);
  }
  return String(value);
}

function renderMarkdown(content: string): string {
  if (!content) return "";
  return marked.parse(content) as string;
}

async function fetchItem() {
  loading.value = true;
  error.value = null;
  try {
    item.value = await api.getCrawledItem(id.value);
    if (item.value?.sourceId) {
      try {
        source.value = await api.getCrawlerSource(item.value.sourceId);
      } catch {
        // Source may have been deleted
      }
    }
  } catch (e) {
    console.error("Failed to fetch item:", e);
    error.value = "Failed to load item";
  } finally {
    loading.value = false;
  }
}

// Fetch on mount and when ID changes
watch(id, fetchItem, { immediate: true });
</script>

<style scoped>
/* Markdown content styles */
.markdown-content :deep(h1) {
  @apply text-xl font-bold text-white mb-3 mt-4 first:mt-0;
}

.markdown-content :deep(h2) {
  @apply text-lg font-semibold text-white mb-2 mt-4 first:mt-0;
}

.markdown-content :deep(h3) {
  @apply text-base font-medium text-white mb-2 mt-3;
}

.markdown-content :deep(p) {
  @apply mb-3 last:mb-0 leading-relaxed text-gray-300;
}

.markdown-content :deep(ul) {
  @apply list-disc list-inside mb-3 space-y-1.5 ml-2;
}

.markdown-content :deep(ol) {
  @apply list-decimal list-inside mb-3 space-y-1.5 ml-2;
}

.markdown-content :deep(li) {
  @apply text-gray-300;
}

.markdown-content :deep(a) {
  @apply text-cyan-400 hover:text-cyan-300 underline;
}

.markdown-content :deep(code) {
  @apply bg-[#2d2d2d] px-1.5 py-0.5 rounded text-cyan-300 text-xs font-mono;
}

.markdown-content :deep(pre) {
  @apply bg-[#2d2d2d] p-3 rounded-lg mb-3 overflow-x-auto;
}

.markdown-content :deep(pre code) {
  @apply bg-transparent p-0;
}

.markdown-content :deep(blockquote) {
  @apply border-l-4 border-cyan-500 pl-4 my-3 text-gray-400 italic;
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
</style>
