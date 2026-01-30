<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-white">Competitive Analysis</h1>
        <p class="text-gray-500 text-sm mt-1">
          AI-powered competitor research and guerrilla marketing insights
        </p>
      </div>
      <UButton
        @click="showAddModal = true"
        color="primary"
        icon="i-heroicons-plus"
      >
        Add Competitor
      </UButton>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="notion-card">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
            <UIcon name="i-heroicons-building-office-2" class="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <div class="text-2xl font-bold text-white">{{ stats.total }}</div>
            <div class="text-xs text-gray-500">Total Competitors</div>
          </div>
        </div>
      </div>
      <div class="notion-card">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
            <UIcon name="i-heroicons-check-circle" class="w-5 h-5 text-green-400" />
          </div>
          <div>
            <div class="text-2xl font-bold text-white">{{ stats.analyzed }}</div>
            <div class="text-xs text-gray-500">Analyzed</div>
          </div>
        </div>
      </div>
      <div class="notion-card">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
            <UIcon name="i-heroicons-clock" class="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <div class="text-2xl font-bold text-white">{{ stats.pending }}</div>
            <div class="text-xs text-gray-500">Pending</div>
          </div>
        </div>
      </div>
      <div class="notion-card">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <UIcon name="i-heroicons-document-chart-bar" class="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <div class="text-2xl font-bold text-white">{{ stats.reports }}</div>
            <div class="text-xs text-gray-500">Reports</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Competitors List -->
    <div class="notion-card">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-white">Competitors</h2>
        <div class="flex items-center gap-2">
          <UInput
            v-model="searchQuery"
            placeholder="Search..."
            icon="i-heroicons-magnifying-glass"
            size="sm"
            class="w-48"
          />
          <USelect
            v-model="statusFilter"
            :options="statusOptions"
            size="sm"
            class="w-32"
          />
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center py-16">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 text-gray-500 animate-spin" />
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredCompetitors.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
        <div class="w-16 h-16 rounded-full bg-[#2d2d2d] flex items-center justify-center mb-4">
          <UIcon name="i-heroicons-building-office-2" class="w-8 h-8 text-gray-500" />
        </div>
        <h3 class="text-lg font-medium text-white mb-2">No competitors yet</h3>
        <p class="text-gray-500 text-sm mb-4 max-w-sm">
          Add your first competitor to start analyzing their websites and gaining competitive insights.
        </p>
        <UButton @click="showAddModal = true" color="primary">
          <UIcon name="i-heroicons-plus" class="w-4 h-4 mr-1" />
          Add Competitor
        </UButton>
      </div>

      <!-- Competitors Table -->
      <div v-else class="space-y-3">
        <div
          v-for="competitor in filteredCompetitors"
          :key="competitor.id"
          class="flex items-center justify-between p-4 bg-[#2d2d2d] rounded-lg hover:bg-[#363636] transition-colors cursor-pointer"
          @click="navigateTo(`/competitors/${competitor.id}`)"
        >
          <div class="flex items-center gap-4">
            <!-- Favicon/Icon -->
            <div class="w-10 h-10 rounded-lg bg-[#404040] flex items-center justify-center overflow-hidden">
              <img
                v-if="competitor.favicon"
                :src="competitor.favicon"
                class="w-6 h-6"
                @error="(e: Event) => (e.target as HTMLImageElement).style.display = 'none'"
              />
              <UIcon v-else name="i-heroicons-globe-alt" class="w-5 h-5 text-gray-400" />
            </div>

            <div>
              <div class="flex items-center gap-2">
                <span class="font-medium text-white">{{ competitor.name }}</span>
                <StatusBadge :status="competitor.status" />
              </div>
              <div class="flex items-center gap-3 mt-1">
                <span class="text-sm text-gray-500">{{ competitor.domain }}</span>
                <span v-if="competitor.industry" class="text-xs text-gray-600">{{ competitor.industry }}</span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-4">
            <!-- SEO Score if available -->
            <div v-if="competitor.seoScore !== undefined" class="text-center">
              <div
                class="text-lg font-bold"
                :class="getScoreColor(competitor.seoScore)"
              >
                {{ competitor.seoScore }}
              </div>
              <div class="text-xs text-gray-500">SEO</div>
            </div>

            <!-- Last crawled -->
            <div v-if="competitor.lastCrawledAt" class="text-right">
              <div class="text-sm text-gray-400">{{ formatDate(competitor.lastCrawledAt) }}</div>
              <div class="text-xs text-gray-500">Last crawled</div>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-2">
              <UButton
                v-if="competitor.status !== 'crawling'"
                @click.stop="startCrawl(competitor.id)"
                color="gray"
                variant="ghost"
                size="sm"
                icon="i-heroicons-arrow-path"
                :loading="crawlingId === competitor.id"
              />
              <UButton
                v-if="competitor.status === 'completed'"
                @click.stop="startAnalysis(competitor.id)"
                color="gray"
                variant="ghost"
                size="sm"
                icon="i-heroicons-sparkles"
                :loading="analyzingId === competitor.id"
              />
              <UDropdown :items="getCompetitorActions(competitor)">
                <UButton
                  @click.stop
                  color="gray"
                  variant="ghost"
                  size="sm"
                  icon="i-heroicons-ellipsis-vertical"
                />
              </UDropdown>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Competitor Modal -->
    <UModal v-model="showAddModal">
      <div class="p-6 space-y-4">
        <h3 class="text-lg font-semibold text-white">Add Competitor</h3>

        <UFormGroup label="Domain" required>
          <UInput
            v-model="newCompetitor.domain"
            placeholder="example.com"
            size="lg"
            icon="i-heroicons-globe-alt"
          />
        </UFormGroup>

        <UFormGroup label="Name">
          <UInput
            v-model="newCompetitor.name"
            placeholder="Competitor Name (optional)"
          />
        </UFormGroup>

        <UFormGroup label="Industry">
          <UInput
            v-model="newCompetitor.industry"
            placeholder="e.g., SaaS, E-commerce, Finance"
          />
        </UFormGroup>

        <UFormGroup label="Description">
          <UTextarea
            v-model="newCompetitor.description"
            placeholder="Brief description of this competitor..."
            :rows="3"
          />
        </UFormGroup>

        <UCheckbox
          v-model="startCrawlAfterAdd"
          label="Start crawling immediately after adding"
        />

        <div class="flex justify-end gap-2 pt-2">
          <UButton @click="showAddModal = false" color="gray" variant="ghost">
            Cancel
          </UButton>
          <UButton
            @click="addCompetitor"
            color="primary"
            :loading="addingCompetitor"
            :disabled="!newCompetitor.domain"
          >
            Add Competitor
          </UButton>
        </div>
      </div>
    </UModal>

    <!-- Crawl Config Modal -->
    <UModal v-model="showCrawlConfigModal">
      <div class="p-6 space-y-4">
        <h3 class="text-lg font-semibold text-white">Crawl Configuration</h3>

        <UFormGroup label="Crawl Depth">
          <USelect
            v-model="crawlConfig.depth"
            :options="[
              { label: '1 level (homepage only)', value: 1 },
              { label: '2 levels (recommended)', value: 2 },
              { label: '3 levels (deep)', value: 3 },
            ]"
          />
        </UFormGroup>

        <UFormGroup label="Max Pages">
          <UInput
            v-model.number="crawlConfig.maxPages"
            type="number"
            :min="10"
            :max="500"
          />
        </UFormGroup>

        <div class="space-y-2">
          <UCheckbox
            v-model="crawlConfig.useSitemap"
            label="Parse sitemap.xml"
          />
          <UCheckbox
            v-model="crawlConfig.respectRobotsTxt"
            label="Respect robots.txt"
          />
          <UCheckbox
            v-model="crawlConfig.proxyRotation"
            label="Use proxy rotation"
          />
          <UCheckbox
            v-model="crawlConfig.userAgentRotation"
            label="Rotate User-Agent"
          />
        </div>

        <UFormGroup label="Request Delay (ms)">
          <div class="flex items-center gap-4">
            <UInput
              v-model.number="crawlConfig.minDelay"
              type="number"
              placeholder="Min"
              class="w-24"
            />
            <span class="text-gray-500">to</span>
            <UInput
              v-model.number="crawlConfig.maxDelay"
              type="number"
              placeholder="Max"
              class="w-24"
            />
          </div>
        </UFormGroup>

        <div class="flex justify-end gap-2 pt-2">
          <UButton @click="showCrawlConfigModal = false" color="gray" variant="ghost">
            Cancel
          </UButton>
          <UButton
            @click="executeCrawl"
            color="primary"
            :loading="crawlingId !== null"
          >
            Start Crawl
          </UButton>
        </div>
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import StatusBadge from "~/components/StatusBadge.vue";

interface Competitor {
  id: string;
  name: string;
  domain: string;
  description?: string;
  industry?: string;
  status: "pending" | "crawling" | "analyzing" | "completed" | "failed";
  favicon?: string;
  seoScore?: number;
  lastCrawledAt?: number;
  lastAnalyzedAt?: number;
  createdAt: number;
  updatedAt: number;
}

interface CrawlConfig {
  depth: number;
  maxPages: number;
  useSitemap: boolean;
  respectRobotsTxt: boolean;
  proxyRotation: boolean;
  userAgentRotation: boolean;
  minDelay: number;
  maxDelay: number;
}

const api = useApi();
const toast = useToast();
const { lastEvent } = useWebSocket();

// State
const loading = ref(true);
const competitors = ref<Competitor[]>([]);
const searchQuery = ref("");
const statusFilter = ref("all");
const showAddModal = ref(false);
const showCrawlConfigModal = ref(false);
const addingCompetitor = ref(false);
const startCrawlAfterAdd = ref(true);
const crawlingId = ref<string | null>(null);
const analyzingId = ref<string | null>(null);
const selectedCompetitorId = ref<string | null>(null);

const stats = ref({
  total: 0,
  analyzed: 0,
  pending: 0,
  reports: 0,
});

const newCompetitor = ref({
  domain: "",
  name: "",
  industry: "",
  description: "",
});

const crawlConfig = ref<CrawlConfig>({
  depth: 2,
  maxPages: 100,
  useSitemap: true,
  respectRobotsTxt: true,
  proxyRotation: false,
  userAgentRotation: true,
  minDelay: 2000,
  maxDelay: 5000,
});

const statusOptions = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Crawling", value: "crawling" },
  { label: "Analyzing", value: "analyzing" },
  { label: "Completed", value: "completed" },
  { label: "Failed", value: "failed" },
];

// Computed
const filteredCompetitors = computed(() => {
  let result = competitors.value;

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.domain.toLowerCase().includes(query) ||
        c.industry?.toLowerCase().includes(query)
    );
  }

  if (statusFilter.value !== "all") {
    result = result.filter((c) => c.status === statusFilter.value);
  }

  return result;
});

// Methods
async function fetchCompetitors() {
  try {
    const data = await api.getCompetitors();
    competitors.value = data;
    updateStats();
  } catch (error) {
    console.error("Failed to fetch competitors:", error);
  } finally {
    loading.value = false;
  }
}

function updateStats() {
  stats.value = {
    total: competitors.value.length,
    analyzed: competitors.value.filter((c) => c.status === "completed").length,
    pending: competitors.value.filter((c) => c.status === "pending").length,
    reports: 0, // TODO: Fetch from API
  };
}

async function addCompetitor() {
  if (!newCompetitor.value.domain) return;

  addingCompetitor.value = true;
  try {
    // Clean domain
    let domain = newCompetitor.value.domain.trim();
    domain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");

    const competitor = await api.createCompetitor({
      domain,
      name: newCompetitor.value.name || domain,
      industry: newCompetitor.value.industry || undefined,
      description: newCompetitor.value.description || undefined,
    });

    competitors.value.unshift(competitor);
    updateStats();
    showAddModal.value = false;
    toast.add({ title: "Competitor added", color: "green" });

    // Reset form
    newCompetitor.value = { domain: "", name: "", industry: "", description: "" };

    // Start crawl if option selected
    if (startCrawlAfterAdd.value) {
      await startCrawl(competitor.id);
    }
  } catch (error) {
    toast.add({ title: "Failed to add competitor", color: "red" });
  } finally {
    addingCompetitor.value = false;
  }
}

async function startCrawl(competitorId: string) {
  selectedCompetitorId.value = competitorId;
  showCrawlConfigModal.value = true;
}

async function executeCrawl() {
  if (!selectedCompetitorId.value) return;

  crawlingId.value = selectedCompetitorId.value;
  showCrawlConfigModal.value = false;

  try {
    await api.startCompetitorCrawl(selectedCompetitorId.value, crawlConfig.value);
    toast.add({ title: "Crawl started", color: "green" });

    // Update local status
    const competitor = competitors.value.find((c) => c.id === selectedCompetitorId.value);
    if (competitor) {
      competitor.status = "crawling";
    }
  } catch (error) {
    toast.add({ title: "Failed to start crawl", color: "red" });
  } finally {
    crawlingId.value = null;
    selectedCompetitorId.value = null;
  }
}

async function startAnalysis(competitorId: string) {
  analyzingId.value = competitorId;
  try {
    await api.analyzeCompetitor(competitorId, "full");
    toast.add({ title: "Analysis started", color: "green" });

    // Update local status
    const competitor = competitors.value.find((c) => c.id === competitorId);
    if (competitor) {
      competitor.status = "analyzing";
    }
  } catch (error) {
    toast.add({ title: "Failed to start analysis", color: "red" });
  } finally {
    analyzingId.value = null;
  }
}

async function deleteCompetitor(competitorId: string) {
  if (!confirm("Are you sure you want to delete this competitor?")) return;

  try {
    await api.deleteCompetitor(competitorId);
    competitors.value = competitors.value.filter((c) => c.id !== competitorId);
    updateStats();
    toast.add({ title: "Competitor deleted", color: "green" });
  } catch (error) {
    toast.add({ title: "Failed to delete competitor", color: "red" });
  }
}

function getCompetitorActions(competitor: Competitor) {
  return [
    [
      {
        label: "View Details",
        icon: "i-heroicons-eye",
        click: () => navigateTo(`/competitors/${competitor.id}`),
      },
      {
        label: "Generate Report",
        icon: "i-heroicons-document-text",
        click: () => generateReport(competitor.id),
      },
    ],
    [
      {
        label: "Delete",
        icon: "i-heroicons-trash",
        click: () => deleteCompetitor(competitor.id),
      },
    ],
  ];
}

async function generateReport(competitorId: string) {
  try {
    const report = await api.generateCompetitorReport([competitorId], "single", "markdown");
    toast.add({ title: "Report generated", color: "green" });
    navigateTo(`/competitors/reports/${report.id}`);
  } catch (error) {
    toast.add({ title: "Failed to generate report", color: "red" });
  }
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-yellow-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

// WebSocket event handling
watch(lastEvent, (event) => {
  if (!event) return;

  if (event.type === "competitor_crawl_completed" || event.type === "competitor_analyzed") {
    fetchCompetitors();
  }

  if (event.type === "competitor_crawl_progress") {
    const data = event.data as { competitorId: string; progress: number };
    // Could update progress indicator if needed
  }
});

// Lifecycle
onMounted(() => {
  fetchCompetitors();
});
</script>

<style scoped>
.notion-card {
  @apply bg-[#202020] border border-[#2d2d2d] rounded-xl p-5;
}
</style>
