<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";

const route = useRoute();
const {
  getCompetitor,
  getCompetitorPages,
  getCompetitorTechStack,
  getCompetitorStructure,
  getCompetitorAnalysis,
  startCompetitorCrawl,
  analyzeCompetitor,
} = useApi();
const { subscribe, unsubscribe } = useWebSocket();

const id = computed(() => route.params.id as string);

// State
const competitor = ref<Competitor | null>(null);
const pages = ref<CompetitorPage[]>([]);
const techStack = ref<CompetitorTechStackItem[]>([]);
const structure = ref<CompetitorSiteStructure | null>(null);
const analysis = ref<CompetitorAnalysis | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const activeTab = ref("overview");
const crawlProgress = ref<{ stage: string; message: string; pagesFound?: number; pagesCrawled?: number } | null>(null);
const analysisProgress = ref<{ stage: string; message: string } | null>(null);

// Tabs
const tabs = [
  { id: "overview", label: "Overview", icon: "i-heroicons-chart-pie" },
  { id: "seo", label: "SEO & Content", icon: "i-heroicons-magnifying-glass" },
  { id: "tech", label: "Tech Stack", icon: "i-heroicons-code-bracket" },
  { id: "structure", label: "Site Structure", icon: "i-heroicons-folder-open" },
  { id: "analysis", label: "AI Analysis", icon: "i-heroicons-sparkles" },
];

// Status badge colors
const statusColors: Record<string, string> = {
  pending: "bg-gray-500/10 text-gray-400",
  crawling: "bg-blue-500/10 text-blue-400",
  analyzing: "bg-purple-500/10 text-purple-400",
  completed: "bg-green-500/10 text-green-400",
  failed: "bg-red-500/10 text-red-400",
};

// Tech category labels
const categoryLabels: Record<string, string> = {
  cms: "CMS",
  ecommerce: "E-commerce",
  framework: "Frontend Framework",
  css: "CSS Framework",
  analytics: "Analytics",
  marketing: "Marketing",
  chat: "Chat/Support",
  cdn: "CDN/Hosting",
  hosting: "Hosting",
  payment: "Payment",
  other: "Other",
};

// Grouped tech stack by category
const groupedTechStack = computed(() => {
  const groups: Record<string, CompetitorTechStackItem[]> = {};
  for (const item of techStack.value) {
    const category = item.category || "other";
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(item);
  }
  return groups;
});

// Page stats
const pageStats = computed(() => {
  const total = pages.value.length;
  const withTitle = pages.value.filter(p => p.seo?.title).length;
  const withDescription = pages.value.filter(p => p.seo?.metaDescription).length;
  const avgWordCount = total > 0
    ? Math.round(pages.value.reduce((sum, p) => sum + (p.wordCount || 0), 0) / total)
    : 0;

  return { total, withTitle, withDescription, avgWordCount };
});

// Fetch data
async function fetchData() {
  loading.value = true;
  error.value = null;

  try {
    const [comp, pgs, tech, struct, anal] = await Promise.all([
      getCompetitor(id.value),
      getCompetitorPages(id.value, { limit: 200 }).catch(() => []),
      getCompetitorTechStack(id.value).catch(() => []),
      getCompetitorStructure(id.value).catch(() => null),
      getCompetitorAnalysis(id.value).catch(() => null),
    ]);

    competitor.value = comp;
    pages.value = pgs;
    techStack.value = tech;
    structure.value = struct;
    analysis.value = anal;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to load competitor";
  } finally {
    loading.value = false;
  }
}

// Start crawl
async function handleStartCrawl() {
  if (!competitor.value) return;

  try {
    crawlProgress.value = { stage: "starting", message: "Starting crawl..." };
    await startCompetitorCrawl(competitor.value.id, {
      maxDepth: 2,
      maxPages: 100,
    });
  } catch (e) {
    crawlProgress.value = null;
    error.value = e instanceof Error ? e.message : "Failed to start crawl";
  }
}

// Start analysis
async function handleStartAnalysis() {
  if (!competitor.value) return;

  try {
    analysisProgress.value = { stage: "starting", message: "Starting analysis..." };
    const result = await analyzeCompetitor(competitor.value.id, "full");
    analysis.value = result;
    analysisProgress.value = null;
    activeTab.value = "analysis";
  } catch (e) {
    analysisProgress.value = null;
    error.value = e instanceof Error ? e.message : "Analysis failed";
  }
}

// WebSocket handlers
function handleWsMessage(event: any) {
  if (event.type === "competitor_crawl_progress" && event.data?.competitorId === id.value) {
    crawlProgress.value = event.data;
    if (event.data.stage === "completed" || event.data.stage === "failed") {
      setTimeout(() => {
        crawlProgress.value = null;
        fetchData();
      }, 2000);
    }
  }

  if (event.type === "competitor_analyzing" && event.data?.competitorId === id.value) {
    analysisProgress.value = event.data;
  }

  if (event.type === "competitor_analyzed" && event.data?.competitorId === id.value) {
    analysisProgress.value = null;
    fetchData();
  }

  if (event.type === "competitor_updated" && event.data?.id === id.value) {
    fetchData();
  }
}

// Format date
function formatDate(timestamp?: number): string {
  if (!timestamp) return "Never";
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Build structure tree for display
function renderStructureTree(nodes: CompetitorSiteStructure["root"][], depth = 0): any[] {
  if (!nodes) return [];
  return nodes.map(node => ({
    ...node,
    indent: depth,
    children: node.children ? renderStructureTree(node.children as any, depth + 1) : [],
  }));
}

onMounted(() => {
  fetchData();
  subscribe(handleWsMessage);
});

onUnmounted(() => {
  unsubscribe(handleWsMessage);
});

// Types
interface Competitor {
  id: string;
  name: string;
  domain: string;
  description?: string;
  industry?: string;
  status: string;
  createdAt: number;
  updatedAt: number;
  lastCrawledAt?: number;
  lastAnalyzedAt?: number;
}

interface CompetitorPage {
  id: string;
  url: string;
  path: string;
  depth: number;
  seo?: {
    title?: string;
    metaDescription?: string;
  };
  wordCount?: number;
  crawledAt: number;
}

interface CompetitorTechStackItem {
  category: string;
  name: string;
  version?: string;
  confidence: number;
}

interface CompetitorSiteStructure {
  competitorId: string;
  root: any;
  totalPages: number;
  maxDepth: number;
  patterns: {
    hasBlog: boolean;
    hasProducts: boolean;
    hasDocs: boolean;
    hasCategories: boolean;
  };
}

interface CompetitorAnalysis {
  id: string;
  analysisType: string;
  valueProposition?: string;
  targetAudience?: string[];
  keyMessages?: string[];
  toneOfVoice?: string;
  strengths?: Array<{ point: string; evidence: string }>;
  weaknesses?: Array<{ point: string; evidence: string }>;
  opportunities?: Array<{ point: string; rationale: string }>;
  threats?: Array<{ point: string; rationale: string }>;
  recommendations?: Array<{
    title: string;
    description: string;
    priority: string;
    category: string;
  }>;
  seoScore?: number;
  seoIssues?: Array<{ type: string; severity: string; message: string }>;
  generatedAt: number;
}
</script>

<template>
  <div class="min-h-screen bg-[#191919] text-white">
    <!-- Header -->
    <div class="border-b border-white/5 bg-[#1e1e1e]">
      <div class="max-w-7xl mx-auto px-6 py-4">
        <!-- Back button -->
        <NuxtLink
          to="/competitors"
          class="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-4"
        >
          <UIcon name="i-heroicons-arrow-left" class="w-4 h-4" />
          Back to Competitors
        </NuxtLink>

        <div v-if="loading" class="animate-pulse">
          <div class="h-8 w-64 bg-white/5 rounded mb-2"></div>
          <div class="h-4 w-48 bg-white/5 rounded"></div>
        </div>

        <div v-else-if="competitor" class="flex items-start justify-between">
          <div>
            <div class="flex items-center gap-3">
              <h1 class="text-2xl font-bold">{{ competitor.name }}</h1>
              <span
                class="px-2.5 py-0.5 rounded-full text-xs font-medium"
                :class="statusColors[competitor.status]"
              >
                {{ competitor.status }}
              </span>
            </div>
            <a
              :href="`https://${competitor.domain}`"
              target="_blank"
              class="text-sm text-gray-400 hover:text-blue-400 flex items-center gap-1 mt-1"
            >
              {{ competitor.domain }}
              <UIcon name="i-heroicons-arrow-top-right-on-square" class="w-3 h-3" />
            </a>
            <p v-if="competitor.description" class="text-sm text-gray-500 mt-2 max-w-2xl">
              {{ competitor.description }}
            </p>
          </div>

          <div class="flex items-center gap-2">
            <UButton
              v-if="competitor.status !== 'crawling'"
              color="gray"
              variant="soft"
              size="sm"
              :loading="!!crawlProgress"
              @click="handleStartCrawl"
            >
              <UIcon name="i-heroicons-globe-alt" class="w-4 h-4 mr-1" />
              {{ crawlProgress ? 'Crawling...' : 'Crawl' }}
            </UButton>

            <UButton
              v-if="pages.length > 0 && competitor.status !== 'analyzing'"
              color="primary"
              variant="soft"
              size="sm"
              :loading="!!analysisProgress"
              @click="handleStartAnalysis"
            >
              <UIcon name="i-heroicons-sparkles" class="w-4 h-4 mr-1" />
              {{ analysisProgress ? 'Analyzing...' : 'Analyze' }}
            </UButton>
          </div>
        </div>
      </div>

      <!-- Progress indicator -->
      <div v-if="crawlProgress || analysisProgress" class="px-6 pb-4 max-w-7xl mx-auto">
        <div class="bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3">
          <div class="flex items-center gap-3">
            <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 text-blue-400 animate-spin" />
            <div>
              <p class="text-sm font-medium text-blue-400">
                {{ crawlProgress?.message || analysisProgress?.message }}
              </p>
              <p v-if="crawlProgress?.pagesCrawled" class="text-xs text-gray-400">
                {{ crawlProgress.pagesCrawled }} / {{ crawlProgress.pagesFound }} pages
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="max-w-7xl mx-auto px-6">
        <div class="flex gap-1 border-b border-white/5">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            class="px-4 py-3 text-sm font-medium transition-colors flex items-center gap-2"
            :class="activeTab === tab.id
              ? 'text-white border-b-2 border-white -mb-px'
              : 'text-gray-400 hover:text-white'"
            @click="activeTab = tab.id"
          >
            <UIcon :name="tab.icon" class="w-4 h-4" />
            {{ tab.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="max-w-7xl mx-auto px-6 py-8">
      <!-- Error state -->
      <div v-if="error" class="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
        <p class="text-red-400">{{ error }}</p>
      </div>

      <!-- Overview Tab -->
      <div v-if="activeTab === 'overview'" class="space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Stats Cards -->
          <div class="bg-[#1e1e1e] rounded-xl p-6 border border-white/5">
            <div class="flex items-center gap-3">
              <div class="p-2 bg-blue-500/10 rounded-lg">
                <UIcon name="i-heroicons-document-text" class="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p class="text-2xl font-bold">{{ pageStats.total }}</p>
                <p class="text-sm text-gray-400">Pages Crawled</p>
              </div>
            </div>
          </div>

          <div class="bg-[#1e1e1e] rounded-xl p-6 border border-white/5">
            <div class="flex items-center gap-3">
              <div class="p-2 bg-purple-500/10 rounded-lg">
                <UIcon name="i-heroicons-code-bracket" class="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p class="text-2xl font-bold">{{ techStack.length }}</p>
                <p class="text-sm text-gray-400">Technologies</p>
              </div>
            </div>
          </div>

          <div class="bg-[#1e1e1e] rounded-xl p-6 border border-white/5">
            <div class="flex items-center gap-3">
              <div class="p-2 bg-green-500/10 rounded-lg">
                <UIcon name="i-heroicons-chart-bar" class="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p class="text-2xl font-bold">{{ analysis?.seoScore || '-' }}</p>
                <p class="text-sm text-gray-400">SEO Score</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Timestamps -->
        <div class="bg-[#1e1e1e] rounded-xl p-6 border border-white/5">
          <h3 class="text-sm font-medium text-gray-400 mb-4">Activity</h3>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p class="text-xs text-gray-500">Created</p>
              <p class="text-sm">{{ formatDate(competitor?.createdAt) }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-500">Last Updated</p>
              <p class="text-sm">{{ formatDate(competitor?.updatedAt) }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-500">Last Crawled</p>
              <p class="text-sm">{{ formatDate(competitor?.lastCrawledAt) }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-500">Last Analyzed</p>
              <p class="text-sm">{{ formatDate(competitor?.lastAnalyzedAt) }}</p>
            </div>
          </div>
        </div>

        <!-- Quick insights -->
        <div v-if="analysis" class="bg-[#1e1e1e] rounded-xl p-6 border border-white/5">
          <h3 class="text-sm font-medium text-gray-400 mb-4">Quick Insights</h3>
          <div v-if="analysis.valueProposition" class="mb-4">
            <p class="text-xs text-gray-500 mb-1">Value Proposition</p>
            <p class="text-sm">{{ analysis.valueProposition }}</p>
          </div>
          <div v-if="analysis.targetAudience?.length" class="mb-4">
            <p class="text-xs text-gray-500 mb-2">Target Audience</p>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="audience in analysis.targetAudience"
                :key="audience"
                class="px-2 py-1 bg-white/5 rounded text-xs"
              >
                {{ audience }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- SEO Tab -->
      <div v-if="activeTab === 'seo'" class="space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div class="bg-[#1e1e1e] rounded-xl p-6 border border-white/5">
            <p class="text-2xl font-bold">{{ pageStats.withTitle }}</p>
            <p class="text-sm text-gray-400">Pages with Title</p>
            <p class="text-xs text-gray-500">{{ Math.round(pageStats.withTitle / pageStats.total * 100) || 0 }}%</p>
          </div>
          <div class="bg-[#1e1e1e] rounded-xl p-6 border border-white/5">
            <p class="text-2xl font-bold">{{ pageStats.withDescription }}</p>
            <p class="text-sm text-gray-400">With Meta Description</p>
            <p class="text-xs text-gray-500">{{ Math.round(pageStats.withDescription / pageStats.total * 100) || 0 }}%</p>
          </div>
          <div class="bg-[#1e1e1e] rounded-xl p-6 border border-white/5">
            <p class="text-2xl font-bold">{{ pageStats.avgWordCount }}</p>
            <p class="text-sm text-gray-400">Avg. Word Count</p>
          </div>
          <div class="bg-[#1e1e1e] rounded-xl p-6 border border-white/5">
            <p class="text-2xl font-bold">{{ analysis?.seoScore || '-' }}</p>
            <p class="text-sm text-gray-400">SEO Score</p>
          </div>
        </div>

        <!-- SEO Issues -->
        <div v-if="analysis?.seoIssues?.length" class="bg-[#1e1e1e] rounded-xl p-6 border border-white/5">
          <h3 class="text-sm font-medium text-gray-400 mb-4">SEO Issues</h3>
          <div class="space-y-3">
            <div
              v-for="(issue, idx) in analysis.seoIssues.slice(0, 10)"
              :key="idx"
              class="flex items-start gap-3 p-3 bg-white/5 rounded-lg"
            >
              <UIcon
                :name="issue.severity === 'critical' ? 'i-heroicons-x-circle' : 'i-heroicons-exclamation-triangle'"
                class="w-5 h-5 flex-shrink-0"
                :class="issue.severity === 'critical' ? 'text-red-400' : 'text-yellow-400'"
              />
              <div>
                <p class="text-sm">{{ issue.message }}</p>
                <p class="text-xs text-gray-500">{{ issue.type }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Pages list -->
        <div class="bg-[#1e1e1e] rounded-xl border border-white/5">
          <div class="p-4 border-b border-white/5">
            <h3 class="text-sm font-medium text-gray-400">Crawled Pages</h3>
          </div>
          <div class="divide-y divide-white/5">
            <div
              v-for="page in pages.slice(0, 20)"
              :key="page.id"
              class="p-4 hover:bg-white/5"
            >
              <div class="flex items-start justify-between">
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium truncate">{{ page.seo?.title || page.path }}</p>
                  <p class="text-xs text-gray-500 truncate">{{ page.path }}</p>
                </div>
                <div class="ml-4 text-right">
                  <p class="text-xs text-gray-400">{{ page.wordCount || 0 }} words</p>
                  <p class="text-xs text-gray-500">Depth {{ page.depth }}</p>
                </div>
              </div>
            </div>
          </div>
          <div v-if="pages.length > 20" class="p-4 border-t border-white/5 text-center">
            <p class="text-sm text-gray-500">+ {{ pages.length - 20 }} more pages</p>
          </div>
        </div>
      </div>

      <!-- Tech Stack Tab -->
      <div v-if="activeTab === 'tech'" class="space-y-6">
        <div v-if="techStack.length === 0" class="text-center py-12">
          <UIcon name="i-heroicons-code-bracket" class="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p class="text-gray-400">No technologies detected yet.</p>
          <p class="text-sm text-gray-500">Run a crawl to detect the tech stack.</p>
        </div>

        <div v-else>
          <div v-for="(items, category) in groupedTechStack" :key="category" class="mb-6">
            <h3 class="text-sm font-medium text-gray-400 mb-3">
              {{ categoryLabels[category] || category }}
            </h3>
            <div class="flex flex-wrap gap-2">
              <div
                v-for="item in items"
                :key="item.name"
                class="px-3 py-2 bg-[#1e1e1e] border border-white/5 rounded-lg"
              >
                <div class="flex items-center gap-2">
                  <span class="font-medium">{{ item.name }}</span>
                  <span v-if="item.version" class="text-xs text-gray-500">v{{ item.version }}</span>
                  <span
                    class="text-xs px-1.5 py-0.5 rounded"
                    :class="item.confidence >= 80 ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'"
                  >
                    {{ item.confidence }}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Structure Tab -->
      <div v-if="activeTab === 'structure'" class="space-y-6">
        <div v-if="!structure?.root" class="text-center py-12">
          <UIcon name="i-heroicons-folder-open" class="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p class="text-gray-400">No structure data available.</p>
          <p class="text-sm text-gray-500">Run a crawl to analyze site structure.</p>
        </div>

        <div v-else>
          <!-- Structure stats -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div class="bg-[#1e1e1e] rounded-xl p-4 border border-white/5">
              <p class="text-xl font-bold">{{ structure.totalPages }}</p>
              <p class="text-sm text-gray-400">Total Pages</p>
            </div>
            <div class="bg-[#1e1e1e] rounded-xl p-4 border border-white/5">
              <p class="text-xl font-bold">{{ structure.maxDepth }}</p>
              <p class="text-sm text-gray-400">Max Depth</p>
            </div>
            <div class="bg-[#1e1e1e] rounded-xl p-4 border border-white/5 col-span-2">
              <p class="text-sm text-gray-400 mb-2">Detected Patterns</p>
              <div class="flex flex-wrap gap-2">
                <span v-if="structure.patterns.hasBlog" class="px-2 py-1 bg-blue-500/10 text-blue-400 rounded text-xs">Blog</span>
                <span v-if="structure.patterns.hasProducts" class="px-2 py-1 bg-green-500/10 text-green-400 rounded text-xs">Products</span>
                <span v-if="structure.patterns.hasDocs" class="px-2 py-1 bg-purple-500/10 text-purple-400 rounded text-xs">Documentation</span>
                <span v-if="structure.patterns.hasCategories" class="px-2 py-1 bg-yellow-500/10 text-yellow-400 rounded text-xs">Categories</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Analysis Tab -->
      <div v-if="activeTab === 'analysis'" class="space-y-6">
        <div v-if="!analysis" class="text-center py-12">
          <UIcon name="i-heroicons-sparkles" class="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p class="text-gray-400">No AI analysis available yet.</p>
          <p class="text-sm text-gray-500 mb-4">Run analysis to get AI-powered insights.</p>
          <UButton
            v-if="pages.length > 0"
            color="primary"
            @click="handleStartAnalysis"
          >
            Run Analysis
          </UButton>
        </div>

        <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Positioning -->
          <div class="bg-[#1e1e1e] rounded-xl p-6 border border-white/5">
            <h3 class="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2">
              <UIcon name="i-heroicons-cursor-arrow-rays" class="w-4 h-4" />
              Positioning
            </h3>
            <div v-if="analysis.valueProposition" class="mb-4">
              <p class="text-xs text-gray-500 mb-1">Value Proposition</p>
              <p class="text-sm">{{ analysis.valueProposition }}</p>
            </div>
            <div v-if="analysis.toneOfVoice" class="mb-4">
              <p class="text-xs text-gray-500 mb-1">Tone of Voice</p>
              <p class="text-sm">{{ analysis.toneOfVoice }}</p>
            </div>
            <div v-if="analysis.keyMessages?.length">
              <p class="text-xs text-gray-500 mb-2">Key Messages</p>
              <ul class="space-y-1">
                <li v-for="msg in analysis.keyMessages" :key="msg" class="text-sm flex items-start gap-2">
                  <UIcon name="i-heroicons-check" class="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  {{ msg }}
                </li>
              </ul>
            </div>
          </div>

          <!-- SWOT Matrix -->
          <div class="bg-[#1e1e1e] rounded-xl p-6 border border-white/5">
            <h3 class="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2">
              <UIcon name="i-heroicons-squares-2x2" class="w-4 h-4" />
              SWOT Analysis
            </h3>
            <div class="grid grid-cols-2 gap-3">
              <!-- Strengths -->
              <div class="bg-green-500/5 rounded-lg p-3">
                <p class="text-xs font-medium text-green-400 mb-2">Strengths</p>
                <ul class="space-y-1">
                  <li v-for="s in analysis.strengths?.slice(0, 3)" :key="s.point" class="text-xs">
                    {{ s.point }}
                  </li>
                </ul>
              </div>
              <!-- Weaknesses -->
              <div class="bg-red-500/5 rounded-lg p-3">
                <p class="text-xs font-medium text-red-400 mb-2">Weaknesses</p>
                <ul class="space-y-1">
                  <li v-for="w in analysis.weaknesses?.slice(0, 3)" :key="w.point" class="text-xs">
                    {{ w.point }}
                  </li>
                </ul>
              </div>
              <!-- Opportunities -->
              <div class="bg-blue-500/5 rounded-lg p-3">
                <p class="text-xs font-medium text-blue-400 mb-2">Opportunities</p>
                <ul class="space-y-1">
                  <li v-for="o in analysis.opportunities?.slice(0, 3)" :key="o.point" class="text-xs">
                    {{ o.point }}
                  </li>
                </ul>
              </div>
              <!-- Threats -->
              <div class="bg-yellow-500/5 rounded-lg p-3">
                <p class="text-xs font-medium text-yellow-400 mb-2">Threats</p>
                <ul class="space-y-1">
                  <li v-for="t in analysis.threats?.slice(0, 3)" :key="t.point" class="text-xs">
                    {{ t.point }}
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <!-- Recommendations -->
          <div v-if="analysis.recommendations?.length" class="lg:col-span-2 bg-[#1e1e1e] rounded-xl p-6 border border-white/5">
            <h3 class="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2">
              <UIcon name="i-heroicons-light-bulb" class="w-4 h-4" />
              Top Recommendations
            </h3>
            <div class="space-y-3">
              <div
                v-for="rec in analysis.recommendations.slice(0, 5)"
                :key="rec.title"
                class="p-4 bg-white/5 rounded-lg"
              >
                <div class="flex items-start justify-between mb-2">
                  <h4 class="font-medium">{{ rec.title }}</h4>
                  <span
                    class="px-2 py-0.5 rounded text-xs"
                    :class="{
                      'bg-red-500/10 text-red-400': rec.priority === 'critical',
                      'bg-orange-500/10 text-orange-400': rec.priority === 'high',
                      'bg-blue-500/10 text-blue-400': rec.priority === 'medium',
                      'bg-gray-500/10 text-gray-400': rec.priority === 'low',
                    }"
                  >
                    {{ rec.priority }}
                  </span>
                </div>
                <p class="text-sm text-gray-400">{{ rec.description }}</p>
                <span class="inline-block mt-2 px-2 py-0.5 bg-white/5 rounded text-xs text-gray-500">
                  {{ rec.category }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
