<template>
  <div class="max-w-4xl">
    <!-- Page header -->
    <div class="mb-8">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-white">Ideas</h1>
          <p class="text-gray-500 text-sm">Transform ideas into projects</p>
        </div>
        <NuxtLink to="/ideas/new">
          <button class="btn btn-primary">
            <UIcon name="i-heroicons-plus" class="w-4 h-4" />
            <span>New Idea</span>
          </button>
        </NuxtLink>
      </div>
    </div>

    <!-- Filter tabs -->
    <div class="flex gap-2 mb-6">
      <button
        v-for="filter in filters"
        :key="filter.value"
        @click="currentFilter = filter.value"
        class="px-3 py-1.5 rounded-lg text-sm transition-colors"
        :class="currentFilter === filter.value
          ? 'bg-[#2d2d2d] text-white'
          : 'text-gray-500 hover:text-white hover:bg-[#2d2d2d]/50'"
      >
        {{ filter.label }}
        <span v-if="filter.count" class="ml-1 text-gray-600">({{ filter.count }})</span>
      </button>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <div class="flex flex-col items-center gap-3">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-cyan-400" />
        <span class="text-gray-500 text-sm">Loading ideas...</span>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="filteredIdeas.length === 0" class="empty-state">
      <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center mb-4">
        <UIcon name="i-heroicons-light-bulb" class="w-8 h-8 text-yellow-400" />
      </div>
      <h2 class="empty-state-title">No ideas yet</h2>
      <p class="empty-state-description mb-6">Start by creating your first idea and transform it into a project.</p>
      <NuxtLink to="/ideas/new">
        <button class="btn btn-primary">
          <UIcon name="i-heroicons-plus" class="w-4 h-4" />
          <span>Create Idea</span>
        </button>
      </NuxtLink>
    </div>

    <!-- Ideas list -->
    <TransitionGroup v-else name="list" tag="div" class="space-y-3">
      <div
        v-for="idea in filteredIdeas"
        :key="idea.id"
        class="notion-card notion-card-interactive group"
      >
        <NuxtLink :to="`/ideas/${idea.id}`" class="block">
          <div class="flex items-start gap-4">
            <!-- Icon -->
            <div
              class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              :class="getStatusBgClass(idea.status)"
            >
              <UIcon :name="getStatusIcon(idea.status)" class="w-5 h-5" :class="getStatusIconClass(idea.status)" />
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <h3 class="font-medium text-white group-hover:text-cyan-400 transition-colors truncate">
                  {{ idea.title }}
                </h3>
                <span class="badge" :class="getStatusBadgeClass(idea.status)">
                  {{ formatStatus(idea.status) }}
                </span>
              </div>
              <p class="text-sm text-gray-500 line-clamp-2 mb-2">{{ idea.description }}</p>

              <!-- Meta -->
              <div class="flex items-center gap-4 text-xs text-gray-600">
                <span>{{ formatDate(idea.createdAt) }}</span>
                <span v-if="idea.plan" class="flex items-center gap-1">
                  <UIcon name="i-heroicons-code-bracket" class="w-3 h-3" />
                  {{ idea.plan.techStack.slice(0, 2).join(', ') }}
                </span>
                <span v-if="idea.plan" class="flex items-center gap-1">
                  <UIcon name="i-heroicons-document" class="w-3 h-3" />
                  ~{{ idea.plan.estimatedFiles }} files
                </span>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                v-if="idea.status === 'submitted'"
                @click.prevent="startPlanning(idea.id)"
                class="btn btn-secondary text-xs py-1.5 px-2.5"
                :disabled="planningId === idea.id"
              >
                <UIcon
                  :name="planningId === idea.id ? 'i-heroicons-arrow-path' : 'i-heroicons-sparkles'"
                  :class="{ 'animate-spin': planningId === idea.id }"
                  class="w-3.5 h-3.5"
                />
                Plan
              </button>
              <button
                v-if="idea.status === 'plan_ready'"
                @click.prevent="approveIdea(idea.id)"
                class="btn btn-success text-xs py-1.5 px-2.5"
              >
                <UIcon name="i-heroicons-check" class="w-3.5 h-3.5" />
                Approve
              </button>
              <button
                v-if="idea.status === 'approved'"
                @click.prevent="openLaunchModal(idea)"
                class="btn btn-primary text-xs py-1.5 px-2.5"
              >
                <UIcon name="i-heroicons-rocket-launch" class="w-3.5 h-3.5" />
                Launch
              </button>
              <NuxtLink
                v-if="idea.projectId"
                :to="`/projects/${idea.projectId}`"
                @click.stop
                class="btn btn-secondary text-xs py-1.5 px-2.5"
              >
                <UIcon name="i-heroicons-folder" class="w-3.5 h-3.5" />
                Project
              </NuxtLink>
            </div>
          </div>
        </NuxtLink>
      </div>
    </TransitionGroup>

    <!-- Launch Modal -->
    <UModal v-model="launchModalOpen">
      <div class="p-6 space-y-6">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold text-white">Launch Project</h3>
          <button @click="launchModalOpen = false" class="text-gray-500 hover:text-white transition-colors">
            <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
          </button>
        </div>

        <p class="text-gray-400 text-sm">
          Create a GitHub repository and generate initial code for
          <span class="text-white font-medium">{{ selectedIdea?.title }}</span>
        </p>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-400 mb-1.5">Repository Name</label>
            <input
              v-model="launchConfig.repoName"
              type="text"
              :placeholder="selectedIdea?.plan?.repoNameSuggestion || 'my-project'"
              class="input-bordered w-full"
            />
          </div>

          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              v-model="launchConfig.isPrivate"
              class="w-4 h-4 rounded border-[#404040] bg-[#2d2d2d] text-cyan-500 focus:ring-cyan-500/20"
            />
            <span class="text-sm text-gray-400">Make repository private</span>
          </label>
        </div>

        <div class="flex justify-end gap-3 pt-4 border-t border-[#2d2d2d]">
          <button @click="launchModalOpen = false" class="btn btn-secondary">Cancel</button>
          <button @click="launchIdea" :disabled="launching" class="btn btn-primary">
            <UIcon v-if="launching" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
            <UIcon v-else name="i-heroicons-rocket-launch" class="w-4 h-4" />
            Launch
          </button>
        </div>
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { Idea } from "~/composables/useApi";

const api = useApi();
const toast = useToast();

const ideas = ref<Idea[]>([]);
const loading = ref(true);
const planningId = ref<string | null>(null);
const currentFilter = ref("all");
const launchModalOpen = ref(false);
const launching = ref(false);
const selectedIdea = ref<Idea | null>(null);
const launchConfig = ref({ repoName: "", isPrivate: false });

const filters = computed(() => [
  { label: "All", value: "all", count: ideas.value.length },
  { label: "Active", value: "active", count: ideas.value.filter((i) => !["completed", "failed"].includes(i.status)).length },
  { label: "Completed", value: "completed", count: ideas.value.filter((i) => i.status === "completed").length },
]);

const filteredIdeas = computed(() => {
  if (currentFilter.value === "all") return ideas.value;
  if (currentFilter.value === "active") return ideas.value.filter((i) => !["completed", "failed"].includes(i.status));
  if (currentFilter.value === "completed") return ideas.value.filter((i) => i.status === "completed");
  return ideas.value;
});

async function fetchIdeas() {
  loading.value = true;
  try {
    ideas.value = await api.getIdeas();
  } catch {
    toast.add({ title: "Failed to fetch ideas", color: "red" });
  } finally {
    loading.value = false;
  }
}

async function startPlanning(ideaId: string) {
  planningId.value = ideaId;
  try {
    await api.planIdea(ideaId);
    toast.add({ title: "Planning started", color: "cyan" });
    setTimeout(fetchIdeas, 2000);
  } catch {
    toast.add({ title: "Failed to start planning", color: "red" });
  } finally {
    planningId.value = null;
  }
}

async function approveIdea(ideaId: string) {
  try {
    await api.approveIdea(ideaId);
    toast.add({ title: "Plan approved", color: "green" });
    await fetchIdeas();
  } catch {
    toast.add({ title: "Failed to approve", color: "red" });
  }
}

function openLaunchModal(idea: Idea) {
  selectedIdea.value = idea;
  launchConfig.value = {
    repoName: idea.plan?.repoNameSuggestion || "",
    isPrivate: false,
  };
  launchModalOpen.value = true;
}

async function launchIdea() {
  if (!selectedIdea.value) return;
  launching.value = true;
  try {
    await api.launchIdea(selectedIdea.value.id, launchConfig.value);
    toast.add({ title: "Launch started", color: "primary" });
    launchModalOpen.value = false;
    setTimeout(fetchIdeas, 3000);
  } catch {
    toast.add({ title: "Failed to launch", color: "red" });
  } finally {
    launching.value = false;
  }
}

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ');
}

function getStatusIcon(status: string): string {
  const icons: Record<string, string> = {
    submitted: "i-heroicons-document-text",
    planning: "i-heroicons-arrow-path",
    plan_ready: "i-heroicons-clipboard-document-check",
    approved: "i-heroicons-check-circle",
    creating_repo: "i-heroicons-cloud-arrow-up",
    generating: "i-heroicons-code-bracket",
    completed: "i-heroicons-rocket-launch",
    failed: "i-heroicons-exclamation-triangle",
  };
  return icons[status] || "i-heroicons-document";
}

function getStatusBgClass(status: string): string {
  const classes: Record<string, string> = {
    submitted: "bg-gray-500/10",
    planning: "bg-cyan-500/10",
    plan_ready: "bg-yellow-500/10",
    approved: "bg-blue-500/10",
    creating_repo: "bg-purple-500/10",
    generating: "bg-purple-500/10",
    completed: "bg-green-500/10",
    failed: "bg-red-500/10",
  };
  return classes[status] || "bg-gray-500/10";
}

function getStatusIconClass(status: string): string {
  const classes: Record<string, string> = {
    submitted: "text-gray-400",
    planning: "text-cyan-400 animate-spin",
    plan_ready: "text-yellow-400",
    approved: "text-blue-400",
    creating_repo: "text-purple-400 animate-pulse",
    generating: "text-purple-400 animate-pulse",
    completed: "text-green-400",
    failed: "text-red-400",
  };
  return classes[status] || "text-gray-400";
}

function getStatusBadgeClass(status: string): string {
  const classes: Record<string, string> = {
    submitted: "badge-gray",
    planning: "badge-cyan",
    plan_ready: "badge-yellow",
    approved: "badge-purple",
    creating_repo: "badge-purple",
    generating: "badge-purple",
    completed: "badge-green",
    failed: "badge-red",
  };
  return classes[status] || "badge-gray";
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// Poll for updates
let pollInterval: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  fetchIdeas();
  pollInterval = setInterval(() => {
    const hasActive = ideas.value.some((i) => ["planning", "creating_repo", "generating"].includes(i.status));
    if (hasActive) fetchIdeas();
  }, 5000);
});

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval);
});
</script>

<style scoped>
/* List transitions */
.list-move,
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

.list-leave-active {
  position: absolute;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
