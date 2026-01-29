<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-white">Projects</h1>
        <p class="text-gray-500 text-sm">Manage your monitored projects</p>
      </div>
      <button @click="showAddModal = true" class="btn btn-primary">
        <UIcon name="i-heroicons-plus" class="w-4 h-4" />
        Add Project
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <div class="flex flex-col items-center gap-3">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-cyan-400" />
        <span class="text-gray-500 text-sm">Loading projects...</span>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="projects.length === 0" class="empty-state">
      <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center mb-4">
        <UIcon name="i-heroicons-folder-open" class="w-8 h-8 text-cyan-400" />
      </div>
      <h2 class="empty-state-title">No projects yet</h2>
      <p class="empty-state-description mb-6">Add your first project to start monitoring its GitHub activity, issues, and pull requests.</p>
      <button @click="showAddModal = true" class="btn btn-primary">
        <UIcon name="i-heroicons-plus" class="w-4 h-4" />
        Add Your First Project
      </button>
    </div>

    <!-- Projects Grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <NuxtLink
        v-for="project in projects"
        :key="project.id"
        :to="`/projects/${project.id}`"
        class="notion-card notion-card-interactive hover-lift"
      >
        <div class="space-y-3">
          <!-- Header -->
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center flex-shrink-0">
                <UIcon name="i-heroicons-folder" class="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h3 class="font-semibold text-white">{{ project.name }}</h3>
                <p class="text-sm text-gray-500">{{ project.repo }}</p>
              </div>
            </div>
            <span class="badge" :class="getPhaseBadgeClass(project.phase)">
              {{ project.phase }}
            </span>
          </div>

          <!-- Goals -->
          <div v-if="project.goals.length > 0" class="space-y-1">
            <div class="text-xs text-gray-500 uppercase tracking-wider">Goals</div>
            <ul class="text-sm text-gray-400 space-y-1">
              <li v-for="goal in project.goals.slice(0, 2)" :key="goal" class="truncate flex items-center gap-2">
                <span class="w-1 h-1 rounded-full bg-cyan-500 flex-shrink-0" />
                {{ goal }}
              </li>
            </ul>
          </div>

          <!-- Focus Areas -->
          <div class="flex flex-wrap gap-1.5 pt-2 border-t border-[#2d2d2d]">
            <span
              v-for="area in project.focusAreas"
              :key="area"
              class="badge badge-gray text-xs"
            >
              {{ area }}
            </span>
          </div>
        </div>
      </NuxtLink>
    </div>

    <!-- Add Project Modal -->
    <UModal v-model="showAddModal">
      <div class="p-6 space-y-6">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold text-white">Add Project</h3>
          <button @click="showAddModal = false" class="text-gray-500 hover:text-white transition-colors">
            <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
          </button>
        </div>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-400 mb-1.5">Repository <span class="text-red-400">*</span></label>
            <USelectMenu
              v-model="newProject.repo"
              :options="repoOptions"
              value-attribute="value"
              option-attribute="label"
              placeholder="Select a repository"
              searchable
              :loading="loadingRepos"
              :search-attributes="['label', 'description']"
              :ui="{
                base: 'relative block w-full disabled:cursor-not-allowed disabled:opacity-75 focus:outline-none',
                input: 'block w-full rounded-lg bg-[#2d2d2d] border border-[#404040] text-white placeholder-gray-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 text-sm px-3 py-2',
                option: {
                  container: 'bg-[#2d2d2d]',
                  base: 'cursor-pointer select-none relative py-2 px-3 text-sm text-gray-300 hover:bg-[#404040]',
                  active: 'bg-[#404040] text-white',
                  selected: 'text-cyan-400'
                }
              }"
            >
              <template #option="{ option }">
                <div class="flex flex-col">
                  <span>{{ option.label }}</span>
                  <span v-if="option.description" class="text-xs text-gray-500 truncate">{{ option.description }}</span>
                </div>
              </template>
              <template #empty>
                <div class="text-center py-2 text-gray-400">
                  {{ loadingRepos ? 'Loading repositories...' : 'No repositories found' }}
                </div>
              </template>
            </USelectMenu>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-400 mb-1.5">Phase</label>
            <select v-model="newProject.phase" class="input-bordered w-full">
              <option v-for="phase in phaseOptions" :key="phase.value" :value="phase.value">
                {{ phase.label }}
              </option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-400 mb-1.5">Goals (one per line)</label>
            <textarea
              v-model="goalsText"
              rows="3"
              placeholder="Launch MVP by Q2&#10;Get 100 users"
              class="input-bordered w-full resize-none"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-400 mb-2">Focus Areas</label>
            <div class="flex flex-wrap gap-2">
              <label
                v-for="area in focusAreaOptions"
                :key="area.value"
                class="flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
                :class="newProject.focusAreas.includes(area.value) ? 'bg-cyan-500/20 text-cyan-400' : 'bg-[#2d2d2d] text-gray-400 hover:bg-[#363636]'"
              >
                <input
                  type="checkbox"
                  :value="area.value"
                  v-model="newProject.focusAreas"
                  class="sr-only"
                />
                <span class="text-sm">{{ area.label }}</span>
              </label>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-4 border-t border-[#2d2d2d]">
          <button @click="showAddModal = false" class="btn btn-secondary">Cancel</button>
          <button @click="addProject" :disabled="adding" class="btn btn-primary">
            <UIcon v-if="adding" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
            <template v-else>Add Project</template>
          </button>
        </div>
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { Project, GitHubRepo } from "~/composables/useApi";

const api = useApi();
const toast = useToast();

const projects = ref<Project[]>([]);
const loading = ref(true);
const showAddModal = ref(false);
const adding = ref(false);
const goalsText = ref("");
const githubRepos = ref<GitHubRepo[]>([]);
const loadingRepos = ref(false);

const newProject = ref({
  id: "",
  name: "",
  repo: "",
  phase: "planning",
  focusAreas: [] as string[],
});

const phaseOptions = [
  { label: "Idea", value: "idea" },
  { label: "Planning", value: "planning" },
  { label: "MVP", value: "mvp" },
  { label: "Beta", value: "beta" },
  { label: "Launch", value: "launch" },
  { label: "Growth", value: "growth" },
  { label: "Maintenance", value: "maintenance" },
];

const focusAreaOptions = [
  { label: "CI/CD", value: "ci-cd" },
  { label: "Issues", value: "issues" },
  { label: "Pull Requests", value: "prs" },
  { label: "Security", value: "security" },
  { label: "Dependencies", value: "dependencies" },
  { label: "Performance", value: "performance" },
];

const repoOptions = computed(() =>
  githubRepos.value.map((repo) => ({
    label: repo.fullName + (repo.isPrivate ? " (private)" : ""),
    value: repo.fullName,
    description: repo.description || "",
  }))
);

function getPhaseBadgeClass(phase: string): string {
  const classes: Record<string, string> = {
    idea: "badge-gray",
    planning: "badge-purple",
    mvp: "badge-cyan",
    beta: "badge-yellow",
    launch: "badge-green",
    growth: "badge-purple",
    maintenance: "badge-gray",
  };
  return classes[phase] || "badge-gray";
}

async function fetchGitHubRepos() {
  loadingRepos.value = true;
  try {
    githubRepos.value = await api.getGitHubRepos();
  } catch {
    toast.add({
      title: "Error",
      description: "Failed to fetch GitHub repositories",
      color: "red",
    });
  } finally {
    loadingRepos.value = false;
  }
}

watch(showAddModal, (isOpen) => {
  if (isOpen && githubRepos.value.length === 0) {
    fetchGitHubRepos();
  }
});

// Auto-fill name when repo is selected
watch(() => newProject.value.repo, (repo) => {
  if (repo) {
    // Extract repo name after the slash (e.g., "owner/my-repo" → "my-repo")
    const repoName = repo.split("/")[1] || repo;
    // Convert to readable name (e.g., "my-repo" → "My Repo")
    const readableName = repoName
      .split(/[-_]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
    newProject.value.name = readableName;
    // Generate ID from repo name
    newProject.value.id = repoName.toLowerCase();
  }
});

async function fetchProjects() {
  loading.value = true;
  try {
    projects.value = await api.getProjects();
  } catch {
    toast.add({
      title: "Error",
      description: "Failed to fetch projects",
      color: "red",
    });
  } finally {
    loading.value = false;
  }
}

async function addProject() {
  if (!newProject.value.repo) {
    toast.add({
      title: "Error",
      description: "Please select a repository",
      color: "red",
    });
    return;
  }

  adding.value = true;
  try {
    const goals = goalsText.value
      .split("\n")
      .map((g) => g.trim())
      .filter((g) => g.length > 0);

    await api.createProject({
      ...newProject.value,
      goals,
    });

    toast.add({
      title: "Success",
      description: "Project added successfully",
      color: "green",
    });

    showAddModal.value = false;
    newProject.value = {
      id: "",
      name: "",
      repo: "",
      phase: "planning",
      focusAreas: [],
    };
    goalsText.value = "";

    await fetchProjects();
  } catch {
    toast.add({
      title: "Error",
      description: "Failed to add project",
      color: "red",
    });
  } finally {
    adding.value = false;
  }
}

onMounted(() => {
  fetchProjects();
});
</script>
