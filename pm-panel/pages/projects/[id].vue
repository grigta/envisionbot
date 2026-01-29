<template>
  <div class="max-w-4xl">
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 text-gray-500 animate-spin" />
    </div>

    <template v-else-if="project">
      <!-- Header -->
      <div class="mb-8">
        <NuxtLink to="/projects" class="inline-flex items-center gap-1 text-gray-500 hover:text-white text-sm mb-4 transition-colors">
          <UIcon name="i-heroicons-arrow-left" class="w-4 h-4" />
          Back to Projects
        </NuxtLink>

        <div class="flex items-start justify-between gap-4">
          <div class="flex-1">
            <div class="flex items-center gap-3 mb-2">
              <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                <span class="text-white font-bold">{{ project.name.charAt(0).toUpperCase() }}</span>
              </div>
              <div>
                <h1 class="text-3xl font-bold text-white">{{ project.name }}</h1>
                <a
                  :href="`https://github.com/${project.repo}`"
                  target="_blank"
                  class="text-gray-500 hover:text-cyan-400 text-sm flex items-center gap-1 transition-colors"
                >
                  <UIcon name="i-simple-icons-github" class="w-4 h-4" />
                  {{ project.repo }}
                  <UIcon name="i-heroicons-arrow-top-right-on-square" class="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          <!-- Phase Badge -->
          <UBadge :color="getPhaseColor(project.phase)" size="lg" variant="soft">
            {{ project.phase }}
          </UBadge>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div class="notion-card text-center">
          <div class="text-2xl font-bold text-white">{{ metrics?.openIssues || 0 }}</div>
          <div class="text-sm text-gray-500">Open Issues</div>
        </div>
        <div class="notion-card text-center">
          <div class="text-2xl font-bold text-white">{{ metrics?.openPRs || 0 }}</div>
          <div class="text-sm text-gray-500">Open PRs</div>
        </div>
        <div class="notion-card text-center">
          <div class="text-2xl font-bold text-white">{{ metrics?.velocity || 0 }}</div>
          <div class="text-sm text-gray-500">Weekly Velocity</div>
        </div>
        <div class="notion-card text-center">
          <div class="text-2xl font-bold text-cyan-400">{{ metrics?.healthScore || 'N/A' }}</div>
          <div class="text-sm text-gray-500">Health Score</div>
        </div>
      </div>

      <!-- Main Content Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <!-- Goals -->
        <div class="notion-card">
          <h3 class="text-sm font-medium text-gray-500 mb-4">Goals</h3>
          <div v-if="project.goals.length === 0" class="text-gray-600 text-sm">
            No goals defined
          </div>
          <ul v-else class="space-y-2">
            <li
              v-for="(goal, index) in project.goals"
              :key="index"
              class="flex items-start gap-2 text-gray-300"
            >
              <UIcon name="i-heroicons-check-circle" class="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              {{ goal }}
            </li>
          </ul>
        </div>

        <!-- Focus Areas -->
        <div class="notion-card">
          <h3 class="text-sm font-medium text-gray-500 mb-4">Monitoring Focus</h3>
          <div v-if="project.focusAreas.length === 0" class="text-gray-600 text-sm">
            No focus areas defined
          </div>
          <div v-else class="flex flex-wrap gap-2">
            <span
              v-for="area in project.focusAreas"
              :key="area"
              class="px-3 py-1.5 bg-[#2d2d2d] text-gray-300 rounded-lg text-sm flex items-center gap-2"
            >
              <UIcon :name="getFocusAreaIcon(area)" class="w-4 h-4" />
              {{ formatFocusArea(area) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Tasks Section -->
      <div class="notion-card mb-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-medium text-gray-500">Recent Tasks</h3>
          <NuxtLink
            :to="`/tasks?projectId=${project.id}`"
            class="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            View all
          </NuxtLink>
        </div>

        <div v-if="tasks.length === 0" class="text-center py-6">
          <UIcon name="i-heroicons-clipboard-document-list" class="w-8 h-8 text-gray-600 mb-2" />
          <p class="text-sm text-gray-500">No tasks generated yet</p>
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="task in tasks.slice(0, 5)"
            :key="task.id"
            class="flex items-center gap-3 p-3 bg-[#191919] rounded-lg"
          >
            <UIcon
              :name="getTaskIcon(task.type)"
              class="w-5 h-5 flex-shrink-0"
              :class="getTaskIconColor(task.priority)"
            />
            <div class="flex-1 min-w-0">
              <div class="font-medium text-white truncate">{{ task.title }}</div>
              <div class="text-xs text-gray-500">{{ task.type }} • {{ task.priority }}</div>
            </div>
            <UBadge :color="getTaskStatusColor(task.status)" size="xs">
              {{ task.status }}
            </UBadge>
          </div>
        </div>
      </div>

      <!-- Project Info -->
      <div class="notion-card">
        <h3 class="text-sm font-medium text-gray-500 mb-4">Project Info</h3>
        <div class="space-y-3 text-sm">
          <div class="flex items-center justify-between">
            <span class="text-gray-500">ID</span>
            <code class="text-gray-300 bg-[#191919] px-2 py-0.5 rounded">{{ project.id }}</code>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-gray-500">Monitoring Level</span>
            <span class="text-gray-300">{{ project.monitoringLevel }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-gray-500">Created</span>
            <span class="text-gray-300">{{ formatDate(project.createdAt) }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-gray-500">Last Updated</span>
            <span class="text-gray-300">{{ formatDate(project.updatedAt) }}</span>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="mt-8 pt-6 border-t border-[#2d2d2d] flex items-center justify-between">
        <button @click="deleteProject" class="text-red-400 hover:text-red-300 text-sm">
          <UIcon name="i-heroicons-trash" class="w-4 h-4 inline mr-1" />
          Delete Project
        </button>
        <div class="flex items-center gap-2">
          <button @click="runAnalysis" :disabled="analysisLoading" class="btn-secondary">
            <UIcon
              :name="analysisLoading ? 'i-heroicons-arrow-path' : 'i-heroicons-chart-bar'"
              :class="{ 'animate-spin': analysisLoading }"
              class="w-4 h-4"
            />
            Run Analysis
          </button>
          <a
            :href="`https://github.com/${project.repo}`"
            target="_blank"
            class="btn-primary"
          >
            <UIcon name="i-simple-icons-github" class="w-4 h-4" />
            Open on GitHub
          </a>
        </div>
      </div>
    </template>

    <!-- Not Found -->
    <template v-else>
      <EmptyState
        icon="i-heroicons-folder-open"
        title="Project not found"
        description="The project you're looking for doesn't exist"
      >
        <NuxtLink to="/projects">
          <UButton color="primary">Back to Projects</UButton>
        </NuxtLink>
      </EmptyState>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Project, Task } from "~/composables/useApi";

const route = useRoute();
const router = useRouter();
const api = useApi();
const toast = useToast();

const projectId = route.params.id as string;

const project = ref<Project | null>(null);
const tasks = ref<Task[]>([]);
const metrics = ref<{ openIssues?: number; openPRs?: number; velocity?: number; healthScore?: number } | null>(null);
const loading = ref(true);
const analysisLoading = ref(false);

async function fetchProject() {
  loading.value = true;
  try {
    const [projectData, tasksData] = await Promise.all([
      api.getProject(projectId),
      api.getTasks({ projectId }),
    ]);
    project.value = projectData;
    tasks.value = tasksData;

    // Try to get metrics (may not exist)
    try {
      const metricsResponse = await fetch(`${useRuntimeConfig().public.apiBaseUrl}/api/projects/${projectId}/metrics`);
      if (metricsResponse.ok) {
        metrics.value = await metricsResponse.json();
      }
    } catch {
      // Metrics not available
    }
  } catch {
    project.value = null;
  } finally {
    loading.value = false;
  }
}

async function runAnalysis() {
  analysisLoading.value = true;
  try {
    await api.runHealthCheck();
    toast.add({ title: "Analysis started", color: "cyan" });
    await fetchProject();
  } catch {
    toast.add({ title: "Failed to run analysis", color: "red" });
  } finally {
    analysisLoading.value = false;
  }
}

async function deleteProject() {
  if (!confirm("Are you sure you want to delete this project?")) return;

  try {
    await api.deleteProject(projectId);
    toast.add({ title: "Project deleted", color: "gray" });
    router.push("/projects");
  } catch {
    toast.add({ title: "Failed to delete project", color: "red" });
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
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

function getFocusAreaIcon(area: string): string {
  const icons: Record<string, string> = {
    "ci-cd": "i-heroicons-cog-6-tooth",
    issues: "i-heroicons-exclamation-circle",
    prs: "i-heroicons-code-bracket",
    security: "i-heroicons-shield-check",
    dependencies: "i-heroicons-cube",
    performance: "i-heroicons-bolt",
  };
  return icons[area] || "i-heroicons-tag";
}

function formatFocusArea(area: string): string {
  const labels: Record<string, string> = {
    "ci-cd": "CI/CD",
    issues: "Issues",
    prs: "Pull Requests",
    security: "Security",
    dependencies: "Dependencies",
    performance: "Performance",
  };
  return labels[area] || area;
}

function getTaskIcon(type: string): string {
  const icons: Record<string, string> = {
    bug: "i-heroicons-bug-ant",
    feature: "i-heroicons-sparkles",
    improvement: "i-heroicons-arrow-trending-up",
    security: "i-heroicons-shield-exclamation",
    documentation: "i-heroicons-document-text",
  };
  return icons[type] || "i-heroicons-clipboard-document-list";
}

function getTaskIconColor(priority: string): string {
  const colors: Record<string, string> = {
    critical: "text-red-400",
    high: "text-orange-400",
    medium: "text-yellow-400",
    low: "text-gray-400",
  };
  return colors[priority] || "text-gray-400";
}

function getTaskStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: "yellow",
    "in-progress": "blue",
    completed: "green",
    rejected: "red",
  };
  return colors[status] || "gray";
}

onMounted(() => {
  fetchProject();
});
</script>

<style scoped>
.notion-card {
  @apply bg-[#202020] border border-[#2d2d2d] rounded-xl p-5;
}

.btn-primary {
  @apply flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50;
}

.btn-secondary {
  @apply flex items-center gap-2 px-4 py-2 bg-[#2d2d2d] hover:bg-[#363636] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50;
}
</style>
