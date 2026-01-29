<template>
  <div class="notion-card">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-sm font-medium text-gray-500">Live Activity</h3>
      <NuxtLink to="/activity" class="text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
        View all
      </NuxtLink>
    </div>

    <!-- Empty state -->
    <div v-if="recentEvents.length === 0" class="flex flex-col items-center justify-center py-8 text-center">
      <UIcon name="i-heroicons-signal" class="w-8 h-8 text-gray-600 mb-2" />
      <p class="text-sm text-gray-500">No recent activity</p>
      <p class="text-xs text-gray-600">Events will appear here in real-time</p>
    </div>

    <!-- Events list -->
    <div v-else class="space-y-3">
      <TransitionGroup name="feed">
        <div
          v-for="event in recentEvents"
          :key="`${event.type}-${event.timestamp}`"
          class="flex items-start gap-3 p-2 -mx-2 rounded-lg hover:bg-[#191919] transition-colors"
        >
          <!-- Icon -->
          <div
            class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            :class="getEventBg(event.type)"
          >
            <UIcon :name="getEventIcon(event.type)" class="w-4 h-4" :class="getEventColor(event.type)" />
          </div>

          <!-- Content -->
          <div class="flex-1 min-w-0">
            <p class="text-sm text-white truncate">{{ getEventTitle(event) }}</p>
            <p class="text-xs text-gray-600">{{ formatTime(event.timestamp) }}</p>
          </div>

          <!-- Status indicator -->
          <div v-if="isActiveEvent(event)" class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
        </div>
      </TransitionGroup>
    </div>

    <!-- Connection status -->
    <div class="mt-4 pt-3 border-t border-[#2d2d2d] flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div
          class="w-2 h-2 rounded-full"
          :class="connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'"
        />
        <span class="text-xs text-gray-500">{{ connected ? 'Live' : 'Disconnected' }}</span>
      </div>
      <span class="text-xs text-gray-600">{{ recentEvents.length }} events</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { WSEvent } from "~/composables/useWebSocket";

const props = defineProps<{
  maxEvents?: number;
}>();

const { connected, events } = useWebSocket();

const recentEvents = computed(() => {
  return events.value.slice(0, props.maxEvents || 5);
});

function getEventIcon(type: string): string {
  if (type.includes("idea")) return "i-heroicons-light-bulb";
  if (type.includes("task")) return "i-heroicons-clipboard-document-check";
  if (type.includes("analysis")) return "i-heroicons-chart-bar";
  if (type.includes("action")) return "i-heroicons-bolt";
  if (type.includes("agent")) return "i-heroicons-command-line";
  if (type.includes("project")) return "i-heroicons-folder";
  return "i-heroicons-bell";
}

function getEventBg(type: string): string {
  if (type.includes("error") || type.includes("failed")) return "bg-red-500/10";
  if (type.includes("completed") || type.includes("success")) return "bg-green-500/10";
  if (type.includes("idea")) return "bg-yellow-500/10";
  if (type.includes("task")) return "bg-blue-500/10";
  if (type.includes("analysis")) return "bg-purple-500/10";
  return "bg-gray-500/10";
}

function getEventColor(type: string): string {
  if (type.includes("error") || type.includes("failed")) return "text-red-400";
  if (type.includes("completed") || type.includes("success")) return "text-green-400";
  if (type.includes("idea")) return "text-yellow-400";
  if (type.includes("task")) return "text-blue-400";
  if (type.includes("analysis")) return "text-purple-400";
  return "text-gray-400";
}

function getEventTitle(event: WSEvent): string {
  const data = event.data as Record<string, unknown> | undefined;

  switch (event.type) {
    case "idea_updated":
      return data?.status === "planning" ? "Planning started"
        : data?.status === "plan_ready" ? "Plan ready for review"
        : data?.status === "completed" ? "Idea launched"
        : data?.status === "failed" ? "Planning failed"
        : "Idea updated";
    case "idea_launched":
      return "New project created";
    case "task_created":
      return "Task generated";
    case "analysis_started":
      return "Analysis started";
    case "analysis_completed":
      return "Analysis completed";
    case "action_pending":
      return "Awaiting approval";
    case "agent_log":
      return "Agent output";
    default:
      return event.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

function isActiveEvent(event: WSEvent): boolean {
  const activeTypes = ["planning", "analysis_started", "generating", "creating_repo"];
  return activeTypes.some((t) => event.type.includes(t)) ||
    (event.data as Record<string, unknown>)?.status === "planning";
}
</script>

<style scoped>
.notion-card {
  @apply bg-[#202020] border border-[#2d2d2d] rounded-xl p-4;
}

.feed-move,
.feed-enter-active,
.feed-leave-active {
  transition: all 0.3s ease;
}

.feed-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.feed-leave-to {
  opacity: 0;
  transform: translateX(10px);
}
</style>
