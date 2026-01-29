<template>
  <div class="kanban-column flex-1 min-w-[280px] max-w-[400px]">
    <!-- Column Header -->
    <div class="column-header flex items-center justify-between mb-3 pb-2 border-b border-[#2d2d2d]">
      <h3 class="text-sm font-medium text-gray-400">{{ column.title }}</h3>
      <span class="badge badge-gray text-xs">{{ tasks.length }}</span>
    </div>

    <!-- Draggable Task List -->
    <VueDraggableNext
      v-if="isClient"
      :list="localTasks"
      :group="groupName"
      :animation="200"
      ghost-class="ghost-card"
      chosen-class="chosen-card"
      class="task-list min-h-[120px] space-y-2 pb-2"
      @change="onDragChange"
    >
      <div v-for="task in localTasks" :key="task.id">
        <TasksKanbanTaskCard :task="task" />
      </div>
    </VueDraggableNext>

    <!-- Fallback for SSR -->
    <div v-else class="task-list min-h-[120px] space-y-2 pb-2">
      <TasksKanbanTaskCard v-for="task in tasks" :key="task.id" :task="task" />
    </div>

    <!-- Empty State -->
    <div v-if="tasks.length === 0" class="text-center py-8 text-gray-600 text-sm">
      <UIcon name="i-heroicons-inbox" class="w-8 h-8 mx-auto mb-2 opacity-50" />
      <p>No tasks</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { VueDraggableNext } from "vue-draggable-next";
import type { Task, KanbanStatus } from "~/composables/useApi";

const props = defineProps<{
  column: { id: KanbanStatus; title: string };
  tasks: Task[];
  groupName: string;
}>();

const emit = defineEmits<{
  (e: "task-moved", payload: { taskId: string; newKanbanStatus: KanbanStatus }): void;
}>();

// Client-side only flag
const isClient = ref(false);
onMounted(() => {
  isClient.value = true;
});

// Local reactive copy for draggable
const localTasks = ref<Task[]>([]);

// Sync with props
watch(
  () => props.tasks,
  (newTasks) => {
    localTasks.value = [...newTasks];
  },
  { immediate: true }
);

function onDragChange(event: { added?: { element: Task } }) {
  if (event.added) {
    emit("task-moved", {
      taskId: event.added.element.id,
      newKanbanStatus: props.column.id,
    });
  }
}
</script>
