<template>
  <div class="max-w-3xl">
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 text-gray-500 animate-spin" />
    </div>

    <template v-else-if="idea">
      <!-- Header -->
      <div class="mb-8">
        <NuxtLink to="/ideas" class="inline-flex items-center gap-1 text-gray-500 hover:text-white text-sm mb-4 transition-colors">
          <UIcon name="i-heroicons-arrow-left" class="w-4 h-4" />
          Back to Ideas
        </NuxtLink>

        <div class="flex items-start justify-between gap-4">
          <div class="flex-1">
            <div class="flex items-center gap-3 mb-2">
              <h1 class="text-3xl font-bold text-white">{{ idea.title }}</h1>
              <StatusBadge :status="idea.status" />
            </div>
            <p class="text-gray-500">Created {{ formatDate(idea.createdAt) }}</p>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-2">
            <button
              v-if="idea.status === 'submitted'"
              @click="startPlanning"
              :disabled="actionLoading"
              class="btn-primary"
            >
              <UIcon
                :name="actionLoading ? 'i-heroicons-arrow-path' : 'i-heroicons-sparkles'"
                :class="{ 'animate-spin': actionLoading }"
                class="w-4 h-4"
              />
              Start Planning
            </button>
            <button
              v-if="idea.status === 'plan_ready'"
              @click="approvePlan"
              :disabled="actionLoading"
              class="btn-green"
            >
              <UIcon name="i-heroicons-check" class="w-4 h-4" />
              Approve Plan
            </button>
            <button
              v-if="idea.status === 'approved'"
              @click="showLaunchModal = true"
              class="btn-primary"
            >
              <UIcon name="i-heroicons-rocket-launch" class="w-4 h-4" />
              Launch Project
            </button>
            <NuxtLink v-if="idea.projectId" :to="`/projects/${idea.projectId}`">
              <button class="btn-primary">
                <UIcon name="i-heroicons-folder" class="w-4 h-4" />
                View Project
              </button>
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- Error Alert -->
      <div v-if="idea.error" class="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
        <div class="flex items-start gap-3">
          <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 class="font-medium text-red-400 mb-1">Error</h4>
            <p class="text-sm text-red-300/80">{{ idea.error }}</p>
          </div>
        </div>
      </div>

      <!-- Progress indicator for active states -->
      <div v-if="['planning', 'creating_repo', 'generating'].includes(idea.status)" class="mb-6">
        <div class="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-xl">
          <div class="flex items-center gap-3">
            <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 text-cyan-400 animate-spin" />
            <div>
              <h4 class="font-medium text-cyan-400">{{ getProgressTitle(idea.status) }}</h4>
              <p class="text-sm text-cyan-300/60">{{ getProgressMessage(idea.status) }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Description -->
      <div class="notion-card mb-6">
        <h3 class="text-sm font-medium text-gray-500 mb-3">Description</h3>
        <p class="text-gray-300 whitespace-pre-wrap leading-relaxed">{{ idea.description }}</p>
      </div>

      <!-- Plan -->
      <div v-if="idea.plan" class="space-y-6">
        <!-- Summary -->
        <div class="notion-card">
          <h3 class="text-sm font-medium text-gray-500 mb-3">Summary</h3>
          <p class="text-gray-300">{{ idea.plan.summary }}</p>
        </div>

        <!-- Tech Stack -->
        <div class="notion-card">
          <h3 class="text-sm font-medium text-gray-500 mb-3">Tech Stack</h3>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="tech in idea.plan.techStack"
              :key="tech"
              class="px-3 py-1 bg-cyan-500/10 text-cyan-400 rounded-lg text-sm"
            >
              {{ tech }}
            </span>
          </div>
        </div>

        <!-- Features -->
        <div class="notion-card">
          <h3 class="text-sm font-medium text-gray-500 mb-4">Features</h3>
          <div class="space-y-3">
            <div
              v-for="feature in idea.plan.features"
              :key="feature.name"
              class="flex items-start gap-3 p-3 bg-[#191919] rounded-lg"
            >
              <div
                class="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                :class="getPriorityBgClass(feature.priority)"
              >
                <UIcon :name="getPriorityIcon(feature.priority)" class="w-3 h-3" :class="getPriorityIconClass(feature.priority)" />
              </div>
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-white">{{ feature.name }}</span>
                  <span
                    class="text-xs px-1.5 py-0.5 rounded"
                    :class="getPriorityClass(feature.priority)"
                  >
                    {{ feature.priority }}
                  </span>
                </div>
                <p class="text-sm text-gray-500 mt-0.5">{{ feature.description }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- File Structure -->
        <div class="notion-card">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-medium text-gray-500">Project Structure</h3>
            <span class="text-xs text-gray-600">~{{ idea.plan.estimatedFiles }} files</span>
          </div>
          <div class="bg-[#191919] rounded-lg p-4 font-mono text-sm">
            <div
              v-for="item in idea.plan.structure"
              :key="item.path"
              class="flex items-center gap-2 py-1 hover:bg-[#2d2d2d] rounded px-2 -mx-2"
            >
              <UIcon
                :name="item.type === 'directory' ? 'i-heroicons-folder' : 'i-heroicons-document'"
                class="w-4 h-4"
                :class="item.type === 'directory' ? 'text-yellow-400' : 'text-gray-500'"
              />
              <span class="text-gray-300">{{ item.path }}</span>
              <span class="text-gray-600 text-xs ml-auto">{{ item.description }}</span>
            </div>
          </div>
        </div>

        <!-- Suggested Repo Name -->
        <div v-if="idea.plan.repoNameSuggestion" class="notion-card">
          <h3 class="text-sm font-medium text-gray-500 mb-3">Suggested Repository Name</h3>
          <code class="text-cyan-400 bg-cyan-500/10 px-3 py-1.5 rounded-lg text-sm">
            {{ idea.plan.repoNameSuggestion }}
          </code>
        </div>
      </div>

      <!-- Repository Info -->
      <div v-if="idea.repoUrl" class="notion-card mt-6">
        <h3 class="text-sm font-medium text-gray-500 mb-3">Repository</h3>
        <a
          :href="idea.repoUrl"
          target="_blank"
          class="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300"
        >
          <UIcon name="i-simple-icons-github" class="w-5 h-5" />
          {{ idea.repoUrl }}
          <UIcon name="i-heroicons-arrow-top-right-on-square" class="w-4 h-4" />
        </a>
      </div>

      <!-- Delete button -->
      <div v-if="['submitted', 'plan_ready', 'failed'].includes(idea.status)" class="mt-8 pt-6 border-t border-[#2d2d2d]">
        <button @click="deleteIdea" class="text-red-400 hover:text-red-300 text-sm">
          <UIcon name="i-heroicons-trash" class="w-4 h-4 inline mr-1" />
          Delete this idea
        </button>
      </div>
    </template>

    <!-- Launch Modal -->
    <UModal v-model="showLaunchModal">
      <div class="p-6 space-y-4">
        <h3 class="text-lg font-semibold text-white">Launch Project</h3>
        <p class="text-gray-400 text-sm">
          Create a GitHub repository and generate initial code
        </p>

        <UFormGroup label="Repository Name">
          <UInput
            v-model="launchConfig.repoName"
            :placeholder="idea?.plan?.repoNameSuggestion || 'my-project'"
            class="bg-[#2d2d2d] border-[#404040]"
          />
        </UFormGroup>

        <UFormGroup>
          <UCheckbox v-model="launchConfig.isPrivate" label="Make repository private" />
        </UFormGroup>

        <div class="flex justify-end gap-2 pt-2">
          <UButton @click="showLaunchModal = false" color="gray" variant="ghost">Cancel</UButton>
          <UButton @click="launchProject" :loading="actionLoading" color="primary">
            <UIcon name="i-heroicons-rocket-launch" class="w-4 h-4 mr-1" />
            Launch
          </UButton>
        </div>
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { Idea } from "~/composables/useApi";

const route = useRoute();
const router = useRouter();
const api = useApi();
const toast = useToast();

const ideaId = route.params.id as string;

const idea = ref<Idea | null>(null);
const loading = ref(true);
const actionLoading = ref(false);
const showLaunchModal = ref(false);
const launchConfig = ref({ repoName: "", isPrivate: false });

async function fetchIdea() {
  loading.value = true;
  try {
    idea.value = await api.getIdea(ideaId);
    if (idea.value?.plan?.repoNameSuggestion) {
      launchConfig.value.repoName = idea.value.plan.repoNameSuggestion;
    }
  } catch {
    toast.add({ title: "Failed to fetch idea", color: "red" });
  } finally {
    loading.value = false;
  }
}

async function startPlanning() {
  actionLoading.value = true;
  try {
    await api.planIdea(ideaId);
    toast.add({ title: "Planning started", color: "cyan" });
    pollForUpdates();
  } catch {
    toast.add({ title: "Failed to start planning", color: "red" });
  } finally {
    actionLoading.value = false;
  }
}

async function approvePlan() {
  actionLoading.value = true;
  try {
    await api.approveIdea(ideaId);
    toast.add({ title: "Plan approved", color: "green" });
    await fetchIdea();
  } catch {
    toast.add({ title: "Failed to approve plan", color: "red" });
  } finally {
    actionLoading.value = false;
  }
}

async function launchProject() {
  actionLoading.value = true;
  try {
    await api.launchIdea(ideaId, launchConfig.value);
    toast.add({ title: "Launch started", color: "primary" });
    showLaunchModal.value = false;
    pollForUpdates();
  } catch {
    toast.add({ title: "Failed to launch project", color: "red" });
  } finally {
    actionLoading.value = false;
  }
}

async function deleteIdea() {
  if (!confirm("Are you sure you want to delete this idea?")) return;

  try {
    await api.deleteIdea(ideaId);
    toast.add({ title: "Idea deleted", color: "gray" });
    router.push("/ideas");
  } catch {
    toast.add({ title: "Failed to delete idea", color: "red" });
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getProgressTitle(status: string): string {
  const titles: Record<string, string> = {
    planning: "Planning in progress...",
    creating_repo: "Creating repository...",
    generating: "Generating code...",
  };
  return titles[status] || "Processing...";
}

function getProgressMessage(status: string): string {
  const messages: Record<string, string> = {
    planning: "The agent is analyzing your idea and creating an implementation plan",
    creating_repo: "Setting up your GitHub repository",
    generating: "Claude Code is generating the initial project code",
  };
  return messages[status] || "Please wait...";
}

function getPriorityIcon(priority: string): string {
  const icons: Record<string, string> = {
    core: "i-heroicons-star",
    important: "i-heroicons-arrow-up",
    "nice-to-have": "i-heroicons-sparkles",
  };
  return icons[priority] || "i-heroicons-minus";
}

function getPriorityBgClass(priority: string): string {
  const classes: Record<string, string> = {
    core: "bg-green-500/20",
    important: "bg-yellow-500/20",
    "nice-to-have": "bg-gray-500/20",
  };
  return classes[priority] || "bg-gray-500/20";
}

function getPriorityIconClass(priority: string): string {
  const classes: Record<string, string> = {
    core: "text-green-400",
    important: "text-yellow-400",
    "nice-to-have": "text-gray-400",
  };
  return classes[priority] || "text-gray-400";
}

function getPriorityClass(priority: string): string {
  const classes: Record<string, string> = {
    core: "bg-green-500/20 text-green-400",
    important: "bg-yellow-500/20 text-yellow-400",
    "nice-to-have": "bg-gray-500/20 text-gray-400",
  };
  return classes[priority] || "bg-gray-500/20 text-gray-400";
}

let pollTimer: ReturnType<typeof setTimeout> | null = null;

function pollForUpdates() {
  if (pollTimer) clearTimeout(pollTimer);

  pollTimer = setTimeout(async () => {
    await fetchIdea();

    if (idea.value && ["planning", "creating_repo", "generating"].includes(idea.value.status)) {
      pollForUpdates();
    }
  }, 3000);
}

onMounted(() => {
  fetchIdea();
});

onUnmounted(() => {
  if (pollTimer) clearTimeout(pollTimer);
});
</script>

<style scoped>
.notion-card {
  @apply bg-[#202020] border border-[#2d2d2d] rounded-xl p-5;
}

.btn-primary {
  @apply flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50;
}

.btn-green {
  @apply flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50;
}
</style>
