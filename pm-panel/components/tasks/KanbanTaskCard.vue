<template>
  <div
    class="task-card notion-card cursor-grab p-3 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
    :class="getPriorityBorderClass(task.priority)"
  >
    <!-- Priority & Type badges -->
    <div class="flex items-center flex-wrap gap-1.5 mb-2">
      <span class="badge text-xs" :class="getPriorityBadgeClass(task.priority)">
        {{ task.priority }}
      </span>
      <span class="badge badge-gray text-xs">{{ task.type }}</span>
    </div>

    <!-- Title -->
    <h4 class="font-medium text-white text-sm mb-1 line-clamp-2">{{ task.title }}</h4>

    <!-- Description (truncated) -->
    <p class="text-xs text-gray-500 line-clamp-2 mb-3">{{ task.description }}</p>

    <!-- Footer: Agent info + timestamp -->
    <div class="flex items-center justify-between text-xs text-gray-600">
      <span v-if="task.generatedBy" class="flex items-center gap-1">
        <UIcon name="i-heroicons-cpu-chip" class="w-3 h-3" />
        {{ formatGeneratedBy(task.generatedBy) }}
      </span>
      <span class="flex items-center gap-1">
        <UIcon name="i-heroicons-clock" class="w-3 h-3" />
        {{ formatRelativeTime(task.generatedAt) }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Task } from "~/composables/useApi";

defineProps<{
  task: Task;
}>();

function getPriorityBorderClass(priority: string): string {
  const classes: Record<string, string> = {
    critical: "border-l-2 border-l-red-500",
    high: "border-l-2 border-l-yellow-500",
    medium: "border-l-2 border-l-cyan-500",
    low: "border-l-2 border-l-gray-500",
  };
  return classes[priority] || "";
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

function formatGeneratedBy(generatedBy: string): string {
  const labels: Record<string, string> = {
    health_check: "Health Check",
    deep_analysis: "Deep Analysis",
    manual: "Manual",
    chat: "Chat",
  };
  return labels[generatedBy] || generatedBy;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}
</script>
