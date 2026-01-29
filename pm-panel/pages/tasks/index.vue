<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-white">Tasks</h1>
        <p class="text-gray-500 text-sm">Track and manage agent-generated tasks</p>
      </div>
      <div class="flex gap-2 items-center">
        <!-- View Toggle -->
        <TasksTaskViewToggle v-model="viewMode" />

        <!-- Status Filter (only for list view) -->
        <div v-if="viewMode === 'list'" class="relative">
          <select
            v-model="statusFilter"
            class="input-bordered text-sm pr-8 appearance-none cursor-pointer"
          >
            <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
          <UIcon name="i-heroicons-chevron-down" class="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>

        <button @click="fetchData" :disabled="loading" class="btn btn-secondary">
          <UIcon :name="loading ? 'i-heroicons-arrow-path' : 'i-heroicons-arrow-path'" :class="{'animate-spin': loading}" class="w-4 h-4" />
          Refresh
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <div class="flex flex-col items-center gap-3">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-cyan-400" />
        <span class="text-gray-500 text-sm">Loading tasks...</span>
      </div>
    </div>

    <!-- Kanban View -->
    <TasksKanbanBoard
      v-else-if="viewMode === 'kanban'"
      :projects="projects"
      :tasks="tasks"
      @task-moved="handleTaskMoved"
    />

    <!-- List View -->
    <template v-else>
      <!-- Empty State -->
      <div v-if="tasks.length === 0" class="empty-state">
        <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center mb-4">
          <UIcon name="i-heroicons-clipboard-document-list" class="w-8 h-8 text-cyan-400" />
        </div>
        <h2 class="empty-state-title">No tasks found</h2>
        <p class="empty-state-description">Tasks will appear here when the agent generates them during analysis.</p>
      </div>

      <!-- Tasks List -->
      <div v-else class="space-y-3">
        <div
          v-for="task in tasks"
          :key="task.id"
          class="notion-card"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="space-y-3 flex-1 min-w-0">
              <!-- Badges Row -->
              <div class="flex items-center flex-wrap gap-2">
                <span class="badge" :class="getPriorityBadgeClass(task.priority)">
                  {{ task.priority }}
                </span>
                <span class="badge" :class="getStatusBadgeClass(task.status)">
                  {{ task.status.replace('_', ' ') }}
                </span>
                <span class="badge badge-gray">
                  {{ task.type }}
                </span>
                <span v-if="task.generatedBy" class="badge badge-purple text-xs">
                  {{ formatGeneratedBy(task.generatedBy) }}
                </span>
              </div>

              <!-- Title & Description -->
              <div>
                <h3 class="font-semibold text-white">{{ task.title }}</h3>
                <p class="text-sm text-gray-400 mt-1">{{ task.description }}</p>
              </div>

              <!-- Metadata -->
              <div class="flex items-center gap-4 text-xs text-gray-500">
                <span class="flex items-center gap-1">
                  <UIcon name="i-heroicons-clock" class="w-3.5 h-3.5" />
                  Generated: {{ formatDate(task.generatedAt) }}
                </span>
                <span v-if="task.completedAt" class="flex items-center gap-1">
                  <UIcon name="i-heroicons-check-circle" class="w-3.5 h-3.5 text-green-500" />
                  Completed: {{ formatDate(task.completedAt) }}
                </span>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex gap-2 flex-shrink-0">
              <button
                v-if="task.status === 'pending'"
                @click="markCompleted(task.id)"
                class="btn btn-success text-xs py-1.5 px-3"
              >
                <UIcon name="i-heroicons-check" class="w-4 h-4" />
                Complete
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Task, Project, KanbanStatus } from "~/composables/useApi";

const api = useApi();
const toast = useToast();

const tasks = ref<Task[]>([]);
const projects = ref<Project[]>([]);
const loading = ref(true);
const statusFilter = ref("all");
const viewMode = ref<"list" | "kanban">("kanban");

// Persist view mode in localStorage
if (import.meta.client) {
  const savedViewMode = localStorage.getItem("tasks-view-mode");
  if (savedViewMode === "list" || savedViewMode === "kanban") {
    viewMode.value = savedViewMode;
  }
}

watch(viewMode, (newValue) => {
  if (import.meta.client) {
    localStorage.setItem("tasks-view-mode", newValue);
  }
});

const statusOptions = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Completed", value: "completed" },
  { label: "Rejected", value: "rejected" },
];

async function fetchData() {
  loading.value = true;
  try {
    const filter = statusFilter.value !== "all" ? { status: statusFilter.value } : undefined;
    const [tasksData, projectsData] = await Promise.all([
      api.getTasks(filter),
      api.getProjects(),
    ]);
    tasks.value = tasksData;
    projects.value = projectsData;
  } catch {
    toast.add({
      title: "Error",
      description: "Failed to fetch data",
      color: "red",
    });
  } finally {
    loading.value = false;
  }
}

async function markCompleted(id: string) {
  try {
    await api.updateTaskStatus(id, "completed");
    toast.add({
      title: "Success",
      description: "Task marked as completed",
      color: "green",
    });
    await fetchData();
  } catch {
    toast.add({
      title: "Error",
      description: "Failed to update task",
      color: "red",
    });
  }
}

async function handleTaskMoved(payload: { taskId: string; newKanbanStatus: KanbanStatus }) {
  try {
    await api.updateTaskKanbanStatus(payload.taskId, payload.newKanbanStatus);
    // Update local state
    const task = tasks.value.find((t) => t.id === payload.taskId);
    if (task) {
      task.kanbanStatus = payload.newKanbanStatus;
    }
    toast.add({
      title: "Task moved",
      description: `Task moved to ${payload.newKanbanStatus === "backlog" ? "Backlog" : "Not Started"}`,
      color: "cyan",
    });
  } catch {
    toast.add({
      title: "Error",
      description: "Failed to move task",
      color: "red",
    });
    // Refresh to restore correct state
    await fetchData();
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function formatGeneratedBy(generatedBy: string): string {
  const labels: Record<string, string> = {
    health_check: "Health Check",
    deep_analysis: "Deep Analysis",
    manual: "Manual",
    chat: "Chat",
  };
  return labels[generatedBy] || generatedBy;
}

function getPriorityBadgeClass(priority: string): string {
  const classes: Record<string, string> = {
    critical: "badge-red",
    high: "badge-yellow",
    medium: "badge-cyan",
    low: "badge-gray",
  };
  return classes[priority] || "badge-gray";
}

function getStatusBadgeClass(status: string): string {
  const classes: Record<string, string> = {
    pending: "badge-yellow",
    approved: "badge-purple",
    rejected: "badge-red",
    in_progress: "badge-cyan",
    completed: "badge-green",
    failed: "badge-red",
  };
  return classes[status] || "badge-gray";
}

watch(statusFilter, () => fetchData());

onMounted(() => {
  fetchData();
});
</script>
