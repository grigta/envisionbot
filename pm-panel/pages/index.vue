<template>
  <div class="max-w-5xl">
    <!-- Page header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-white mb-2">Dashboard</h1>
      <p class="text-gray-500">Overview of your projects and agent activity</p>
    </div>

    <!-- Stats Grid -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <StatCard
        title="Projects"
        :value="stats?.projectCount || 0"
        icon="i-heroicons-folder"
        color="blue"
      />
      <StatCard
        title="Active Ideas"
        :value="stats?.activeIdeasCount || 0"
        icon="i-heroicons-light-bulb"
        color="cyan"
        to="/ideas"
      />
      <StatCard
        title="Tasks"
        :value="stats?.taskCount || 0"
        icon="i-heroicons-clipboard-document-list"
        color="purple"
      />
      <StatCard
        title="Pending"
        :value="stats?.pendingActionsCount || 0"
        icon="i-heroicons-clock"
        color="yellow"
        to="/tasks/pending"
      />
    </div>

    <!-- Two column layout -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <!-- Live Activity Feed -->
      <LiveFeed :max-events="8" />

      <!-- Quick Stats -->
      <div class="notion-card">
        <h2 class="text-lg font-semibold text-white mb-4">Envision CEO Status</h2>

        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <span class="text-gray-400">Status</span>
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full bg-green-500" />
              <span class="text-white">Running</span>
            </div>
          </div>

          <div class="flex items-center justify-between">
            <span class="text-gray-400">Last Health Check</span>
            <span class="text-white">
              {{ stats?.lastHealthCheck ? formatRelativeTime(stats.lastHealthCheck) : 'Never' }}
            </span>
          </div>

          <div class="flex items-center justify-between">
            <span class="text-gray-400">Last Deep Analysis</span>
            <span class="text-white">
              {{ stats?.lastDeepAnalysis ? formatRelativeTime(stats.lastDeepAnalysis) : 'Never' }}
            </span>
          </div>

          <div class="h-px bg-[#2d2d2d] my-2" />

          <div class="flex gap-2">
            <button
              @click="runHealthCheck"
              :disabled="healthCheckLoading"
              class="flex-1 btn-secondary"
            >
              <UIcon
                :name="healthCheckLoading ? 'i-heroicons-arrow-path' : 'i-heroicons-heart'"
                :class="{ 'animate-spin': healthCheckLoading }"
                class="w-4 h-4"
              />
              <span>Health Check</span>
            </button>
            <button
              @click="runDeepAnalysis"
              :disabled="deepAnalysisLoading"
              class="flex-1 btn-primary"
            >
              <UIcon
                :name="deepAnalysisLoading ? 'i-heroicons-arrow-path' : 'i-heroicons-sparkles'"
                :class="{ 'animate-spin': deepAnalysisLoading }"
                class="w-4 h-4"
              />
              <span>Deep Analysis</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Projects List -->
    <div class="notion-card">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-white">Projects</h2>
        <NuxtLink to="/projects" class="text-sm text-gray-500 hover:text-white transition-colors">
          View all →
        </NuxtLink>
      </div>

      <div v-if="projects.length === 0" class="text-center py-8 text-gray-500">
        <UIcon name="i-heroicons-folder-open" class="w-8 h-8 mb-2 opacity-50" />
        <p>No projects yet</p>
        <NuxtLink to="/ideas" class="text-cyan-400 hover:text-cyan-300 text-sm mt-2 inline-block">
          Start with an idea →
        </NuxtLink>
      </div>

      <div v-else class="space-y-2">
        <NuxtLink
          v-for="project in projects.slice(0, 5)"
          :key="project.id"
          :to="`/projects/${project.id}`"
          class="flex items-center gap-4 p-3 rounded-lg hover:bg-[#2d2d2d] transition-colors group"
        >
          <div class="w-8 h-8 rounded bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
            <span class="text-white text-xs font-bold">{{ project.name.charAt(0).toUpperCase() }}</span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-medium text-white group-hover:text-cyan-400 transition-colors">
              {{ project.name }}
            </div>
            <div class="text-sm text-gray-500 truncate">{{ project.repo }}</div>
          </div>
          <UBadge :color="getPhaseColor(project.phase)" variant="soft">
            {{ project.phase }}
          </UBadge>
          <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 text-gray-600 group-hover:text-gray-400" />
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const api = useApi();

const stats = ref<Awaited<ReturnType<typeof api.getStats>> | null>(null);
const projects = ref<Awaited<ReturnType<typeof api.getProjects>>>([]);

const healthCheckLoading = ref(false);
const deepAnalysisLoading = ref(false);

async function fetchData() {
  try {
    [stats.value, projects.value] = await Promise.all([
      api.getStats(),
      api.getProjects(),
    ]);
  } catch (error) {
    console.error("Failed to fetch data:", error);
  }
}

async function runHealthCheck() {
  healthCheckLoading.value = true;
  try {
    await api.runHealthCheck();
    await fetchData();
  } finally {
    healthCheckLoading.value = false;
  }
}

async function runDeepAnalysis() {
  deepAnalysisLoading.value = true;
  try {
    await api.runDeepAnalysis();
    await fetchData();
  } finally {
    deepAnalysisLoading.value = false;
  }
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}

function getPhaseColor(phase: string): string {
  const colors: Record<string, string> = {
    idea: "gray",
    planning: "blue",
    mvp: "cyan",
    beta: "yellow",
    launch: "green",
    growth: "purple",
    maintenance: "orange",
  };
  return colors[phase] || "gray";
}

onMounted(() => {
  fetchData();
  const interval = setInterval(fetchData, 60000);
  onUnmounted(() => clearInterval(interval));
});
</script>

<style scoped>
.notion-card {
  @apply bg-[#202020] border border-[#2d2d2d] rounded-xl p-5;
}

.btn-primary {
  @apply flex items-center justify-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50;
}

.btn-secondary {
  @apply flex items-center justify-center gap-2 px-4 py-2 bg-[#2d2d2d] hover:bg-[#363636] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50;
}
</style>
