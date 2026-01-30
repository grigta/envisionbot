<template>
  <div class="max-w-4xl">
    <!-- Page header -->
    <div class="mb-8">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-white">AI/ML News</h1>
          <p class="text-gray-500 text-sm mt-1">Latest from crawler sources</p>
        </div>
        <div class="flex items-center gap-3">
          <NuxtLink to="/crawler">
            <UButton color="gray" variant="ghost" icon="i-heroicons-cog-6-tooth">
              Sources
            </UButton>
          </NuxtLink>
          <UButton
            @click="refreshAll"
            :loading="crawling"
            color="gray"
            variant="ghost"
            icon="i-heroicons-arrow-path"
          >
            Refresh All
          </UButton>
        </div>
      </div>
    </div>

    <!-- Source filter tabs -->
    <div class="flex gap-2 mb-6 flex-wrap">
      <button
        @click="currentSourceId = 'all'"
        class="px-3 py-1.5 rounded-lg text-sm transition-colors"
        :class="currentSourceId === 'all' ? 'bg-[#2d2d2d] text-white' : 'text-gray-500 hover:text-gray-300'"
      >
        All
        <span class="text-xs opacity-60 ml-1">({{ items.length }})</span>
      </button>
      <button
        v-for="source in sources"
        :key="source.id"
        @click="currentSourceId = source.id"
        class="px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1.5"
        :class="currentSourceId === source.id ? 'bg-[#2d2d2d] text-white' : 'text-gray-500 hover:text-gray-300'"
      >
        {{ source.name }}
        <span class="text-xs opacity-60">({{ getSourceItemCount(source.id) }})</span>
      </button>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 5" :key="i" class="animate-pulse bg-[#2d2d2d] rounded-xl h-24" />
    </div>

    <!-- Empty state -->
    <div v-else-if="filteredItems.length === 0" class="text-center py-12">
      <UIcon name="i-heroicons-newspaper" class="w-12 h-12 text-gray-600 mx-auto mb-4" />
      <p class="text-gray-500 mb-2">No news items yet</p>
      <p class="text-gray-600 text-sm mb-4">Add crawler sources to start collecting news</p>
      <NuxtLink to="/crawler">
        <UButton color="primary">
          Add Source
        </UButton>
      </NuxtLink>
    </div>

    <!-- News list -->
    <div v-else class="space-y-3">
      <NuxtLink
        v-for="(item, index) in filteredItems"
        :key="item.id"
        :to="`/news/${item.id}`"
        class="block bg-[#1e1e1e] hover:bg-[#252525] border border-[#2d2d2d] rounded-xl p-4 transition-colors"
      >
        <div class="flex items-start gap-4">
          <!-- Rank badge -->
          <div
            class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            :class="getRankGradient(index + 1)"
          >
            <span class="text-lg font-bold text-white">{{ index + 1 }}</span>
          </div>

          <!-- Content -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1 flex-wrap">
              <h3 class="font-medium text-white truncate">{{ item.title }}</h3>
              <span
                class="px-2 py-0.5 rounded text-xs font-medium bg-cyan-900/50 text-cyan-300"
              >
                {{ getSourceName(item.sourceId) }}
              </span>
            </div>
            <p v-if="item.description" class="text-sm text-gray-500 line-clamp-2">
              {{ item.description }}
            </p>
            <div class="flex items-center gap-4 mt-2 text-xs text-gray-600">
              <a
                :href="item.url"
                target="_blank"
                rel="noopener noreferrer"
                @click.stop
                class="flex items-center gap-1 hover:text-cyan-400"
              >
                <UIcon name="i-heroicons-arrow-top-right-on-square" class="w-3 h-3" />
                {{ getDomain(item.url) }}
              </a>
              <span>{{ formatDate(item.extractedAt) }}</span>
            </div>
          </div>

          <!-- Arrow -->
          <UIcon name="i-heroicons-chevron-right" class="w-5 h-5 text-gray-600 flex-shrink-0" />
        </div>
      </NuxtLink>
    </div>

    <!-- Stats -->
    <div v-if="stats" class="mt-8 p-4 bg-[#1e1e1e] border border-[#2d2d2d] rounded-xl">
      <div class="flex items-center justify-between text-sm">
        <span class="text-gray-500">
          {{ stats.totalItems }} total items from {{ stats.totalSources }} sources
        </span>
        <span v-if="stats.lastCrawlAt" class="text-gray-600">
          Last crawl: {{ formatDate(stats.lastCrawlAt) }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CrawlerSource, CrawledItem, CrawlerStats } from "~/composables/useApi";

const api = useApi();
const toast = useToast();

const sources = ref<CrawlerSource[]>([]);
const items = ref<CrawledItem[]>([]);
const stats = ref<CrawlerStats | null>(null);
const loading = ref(true);
const crawling = ref(false);
const currentSourceId = ref<string>("all");

const filteredItems = computed(() => {
  if (currentSourceId.value === "all") return items.value;
  return items.value.filter((item) => item.sourceId === currentSourceId.value);
});

function getSourceItemCount(sourceId: string): number {
  return items.value.filter((item) => item.sourceId === sourceId).length;
}

function getSourceName(sourceId: string): string {
  return sources.value.find((s) => s.id === sourceId)?.name || "Unknown";
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

function getRankGradient(rank: number): string {
  if (rank === 1) return "bg-gradient-to-br from-yellow-400 to-orange-500";
  if (rank === 2) return "bg-gradient-to-br from-gray-300 to-gray-400";
  if (rank === 3) return "bg-gradient-to-br from-amber-600 to-amber-700";
  if (rank <= 10) return "bg-gradient-to-br from-cyan-500 to-blue-600";
  return "bg-[#2d2d2d]";
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

async function fetchData() {
  loading.value = true;
  try {
    const [sourcesData, itemsData, statsData] = await Promise.all([
      api.getCrawlerSources({ enabled: true }),
      api.getCrawledItems({ limit: 100 }),
      api.getCrawlerStats(),
    ]);
    sources.value = sourcesData;
    items.value = itemsData;
    stats.value = statsData;
  } catch (error) {
    console.error("Failed to fetch news:", error);
    toast.add({ title: "Failed to fetch news", color: "red" });
  } finally {
    loading.value = false;
  }
}

async function refreshAll() {
  if (sources.value.length === 0) {
    toast.add({ title: "No sources to crawl", color: "yellow" });
    return;
  }

  crawling.value = true;
  toast.add({ title: "Crawling all sources...", color: "cyan" });

  try {
    // Crawl all enabled sources in sequence
    for (const source of sources.value) {
      try {
        await api.runCrawlerSource(source.id);
      } catch (error) {
        console.error(`Failed to crawl ${source.name}:`, error);
      }
    }

    toast.add({ title: "Crawl complete", color: "green" });
    await fetchData();
  } catch (error) {
    console.error("Failed to crawl:", error);
    toast.add({ title: "Crawl failed", color: "red" });
  } finally {
    crawling.value = false;
  }
}

// Fetch on mount
onMounted(fetchData);
</script>
