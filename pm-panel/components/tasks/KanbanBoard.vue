<template>
  <div class="kanban-board space-y-8">
    <!-- Per-project sections -->
    <div v-for="project in projectsWithCounts" :key="project.id" class="project-section">
      <!-- Project Header -->
      <div class="project-header flex items-center gap-3 mb-4">
        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
          <UIcon name="i-heroicons-folder" class="w-4 h-4 text-cyan-400" />
        </div>
        <h2 class="text-lg font-semibold text-white">{{ project.name }}</h2>
        <span class="badge badge-gray text-xs">{{ project.taskCount }} tasks</span>
      </div>

      <!-- Columns Container -->
      <div class="columns-container flex gap-4">
        <TasksKanbanColumn
          v-for="column in columns"
          :key="column.id"
          :column="column"
          :tasks="getTasksForColumn(project.id, column.id)"
          :group-name="`kanban-${project.id}`"
          @task-moved="handleTaskMoved"
        />
      </div>
    </div>

    <!-- Empty state if no projects exist -->
    <div v-if="projects.length === 0" class="empty-state">
      <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center mb-4">
        <UIcon name="i-heroicons-view-columns" class="w-8 h-8 text-cyan-400" />
      </div>
      <h2 class="empty-state-title">No projects</h2>
      <p class="empty-state-description">Add projects to see them here with their Kanban boards.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Task, Project, KanbanStatus } from "~/composables/useApi";

const props = defineProps<{
  projects: Project[];
  tasks: Task[];
}>();

const emit = defineEmits<{
  (e: "task-moved", payload: { taskId: string; newKanbanStatus: KanbanStatus }): void;
}>();

// Column configuration
const columns: { id: KanbanStatus; title: string }[] = [
  { id: "not_started", title: "Не начато" },
  { id: "backlog", title: "Бэклог" },
];

// Compute all projects with their task counts
const projectsWithCounts = computed(() => {
  const projectTaskCounts = new Map<string, number>();

  for (const task of props.tasks) {
    const count = projectTaskCounts.get(task.projectId) || 0;
    projectTaskCounts.set(task.projectId, count + 1);
  }

  return props.projects.map((p) => ({
    ...p,
    taskCount: projectTaskCounts.get(p.id) || 0,
  }));
});

// Get tasks for a specific project and column
function getTasksForColumn(projectId: string, kanbanStatus: KanbanStatus): Task[] {
  return props.tasks.filter(
    (t) => t.projectId === projectId && t.kanbanStatus === kanbanStatus
  );
}

// Handle task moved between columns
function handleTaskMoved(payload: { taskId: string; newKanbanStatus: KanbanStatus }) {
  emit("task-moved", payload);
}
</script>
