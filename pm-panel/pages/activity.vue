<template>
  <div class="max-w-5xl">
    <!-- Header -->
    <div class="mb-8">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-white">Activity</h1>
          <p class="text-gray-500 text-sm">Real-time agent events and actions</p>
        </div>
        <div class="flex items-center gap-3">
          <!-- Connection status -->
          <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg" :class="wsConnected ? 'bg-green-500/10' : 'bg-red-500/10'">
            <div class="w-2 h-2 rounded-full" :class="wsConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'" />
            <span class="text-sm" :class="wsConnected ? 'text-green-400' : 'text-red-400'">
              {{ wsConnected ? 'Connected' : 'Disconnected' }}
            </span>
          </div>
          <!-- View toggle -->
          <div class="flex items-center bg-[#2d2d2d] rounded-lg p-0.5">
            <button
              @click="activeView = 'gateway'"
              class="px-3 py-1.5 text-sm rounded-md transition-colors"
              :class="activeView === 'gateway' ? 'bg-[#404040] text-white' : 'text-gray-500 hover:text-white'"
            >
              Gateway
            </button>
            <button
              @click="activeView = 'events'"
              class="px-3 py-1.5 text-sm rounded-md transition-colors"
              :class="activeView === 'events' ? 'bg-[#404040] text-white' : 'text-gray-500 hover:text-white'"
            >
              Events
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Gateway View - Real-time step-by-step -->
    <div v-if="activeView === 'gateway'" class="mb-8">
      <GatewayLive :max-steps="100" />
    </div>

    <!-- Events View - Traditional event log -->
    <template v-else>
      <!-- Filters -->
      <div class="flex items-center gap-2 mb-6 flex-wrap">
        <button
          v-for="filter in eventFilters"
          :key="filter.value"
          @click="activeFilter = filter.value"
          class="px-3 py-1.5 rounded-lg text-sm transition-colors"
          :class="activeFilter === filter.value
            ? 'bg-[#2d2d2d] text-white'
            : 'text-gray-500 hover:text-white hover:bg-[#2d2d2d]/50'"
        >
          <span class="flex items-center gap-1.5">
            <UIcon :name="filter.icon" class="w-3.5 h-3.5" />
            {{ filter.label }}
          </span>
        </button>
      </div>

      <!-- Empty state -->
      <div v-if="filteredEvents.length === 0" class="empty-state">
        <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center mb-4">
          <UIcon name="i-heroicons-bell-slash" class="w-8 h-8 text-cyan-400" />
        </div>
        <h2 class="empty-state-title">No events yet</h2>
        <p class="empty-state-description">Agent events will appear here in real-time as they happen.</p>
      </div>

      <!-- Events timeline -->
      <div v-else class="relative">
        <!-- Timeline line -->
        <div class="absolute left-[19px] top-0 bottom-0 w-px bg-[#2d2d2d]" />

        <!-- Events -->
        <TransitionGroup name="event-list" tag="div" class="space-y-4">
          <div
            v-for="event in filteredEvents"
            :key="`${event.type}-${event.timestamp}`"
            class="relative flex gap-4"
          >
            <!-- Icon -->
            <div
              class="relative z-10 w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              :class="getEventIconBg(event.type)"
            >
              <UIcon :name="getEventIcon(event.type)" class="w-5 h-5" :class="getEventIconColor(event.type)" />
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0 pb-4">
              <div class="notion-card">
                <!-- Header -->
                <div class="flex items-start justify-between gap-2 mb-2">
                  <div class="flex items-center gap-2">
                    <span class="font-medium text-white">{{ getEventTitle(event) }}</span>
                    <span
                      class="badge text-xs"
                      :class="getEventTypeBadge(event.type)"
                    >
                      {{ formatEventType(event.type) }}
                    </span>
                  </div>
                  <span class="text-xs text-gray-600 flex-shrink-0">{{ formatTime(event.timestamp) }}</span>
                </div>

                <!-- Details -->
                <div v-if="event.data" class="text-sm text-gray-400">
                  <template v-if="typeof event.data === 'object'">
                    <!-- Idea events -->
                    <div v-if="event.type === 'idea_updated' && (event.data as any).ideaId" class="space-y-1">
                      <p v-if="(event.data as any).status">
                        Status: <span class="text-white">{{ (event.data as any).status }}</span>
                      </p>
                      <p v-if="(event.data as any).error" class="text-red-400">
                        Error: {{ (event.data as any).error }}
                      </p>
                    </div>

                    <!-- Task events -->
                    <div v-else-if="event.type === 'task_created' && (event.data as any).task" class="space-y-1">
                      <p>{{ (event.data as any).task.title }}</p>
                      <p class="text-gray-600">Priority: {{ (event.data as any).task.priority }}</p>
                    </div>

                    <!-- Action events -->
                    <div v-else-if="event.type === 'action_pending' && (event.data as any).actionId">
                      <p>Action ID: <code class="text-cyan-400">{{ (event.data as any).actionId }}</code></p>
                    </div>

                    <!-- Analysis events -->
                    <div v-else-if="event.type.includes('analysis') && (event.data as any).reportId">
                      <p>Report: <code class="text-cyan-400">{{ (event.data as any).reportId }}</code></p>
                    </div>

                    <!-- Agent log -->
                    <div v-else-if="event.type === 'agent_log' && (event.data as any).text">
                      <p class="font-mono text-xs whitespace-pre-wrap">{{ truncateText((event.data as any).text, 500) }}</p>
                    </div>

                    <!-- Generic object display -->
                    <div v-else>
                      <details class="group">
                        <summary class="cursor-pointer text-gray-500 hover:text-gray-300 transition-colors">
                          View details
                        </summary>
                        <pre class="mt-2 p-2 bg-[#191919] rounded text-xs overflow-x-auto">{{ JSON.stringify(event.data, null, 2) }}</pre>
                      </details>
                    </div>
                  </template>
                  <template v-else>
                    <p>{{ event.data }}</p>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </TransitionGroup>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { WSEvent } from "~/composables/useWebSocket";

const { connected: wsConnected, events } = useWebSocket();

const activeView = ref<"gateway" | "events">("gateway");
const activeFilter = ref("all");

const eventFilters = [
  { value: "all", label: "All", icon: "i-heroicons-queue-list" },
  { value: "idea", label: "Ideas", icon: "i-heroicons-light-bulb" },
  { value: "task", label: "Tasks", icon: "i-heroicons-clipboard-document-list" },
  { value: "analysis", label: "Analysis", icon: "i-heroicons-chart-bar" },
  { value: "action", label: "Actions", icon: "i-heroicons-bolt" },
  { value: "agent", label: "Agent Logs", icon: "i-heroicons-command-line" },
];

const filteredEvents = computed(() => {
  if (activeFilter.value === "all") return events.value;
  return events.value.filter((e) => e.type.includes(activeFilter.value));
});

function getEventIcon(type: string): string {
  if (type.includes("idea")) return "i-heroicons-light-bulb";
  if (type.includes("task")) return "i-heroicons-clipboard-document-check";
  if (type.includes("analysis")) return "i-heroicons-chart-bar";
  if (type.includes("action")) return "i-heroicons-bolt";
  if (type.includes("agent")) return "i-heroicons-command-line";
  if (type.includes("project")) return "i-heroicons-folder";
  if (type.includes("error") || type.includes("failed")) return "i-heroicons-exclamation-triangle";
  return "i-heroicons-bell";
}

function getEventIconBg(type: string): string {
  if (type.includes("error") || type.includes("failed")) return "bg-red-500/10";
  if (type.includes("completed") || type.includes("success")) return "bg-green-500/10";
  if (type.includes("idea")) return "bg-yellow-500/10";
  if (type.includes("task")) return "bg-blue-500/10";
  if (type.includes("analysis")) return "bg-purple-500/10";
  if (type.includes("action")) return "bg-cyan-500/10";
  if (type.includes("agent")) return "bg-gray-500/10";
  return "bg-gray-500/10";
}

function getEventIconColor(type: string): string {
  if (type.includes("error") || type.includes("failed")) return "text-red-400";
  if (type.includes("completed") || type.includes("success")) return "text-green-400";
  if (type.includes("idea")) return "text-yellow-400";
  if (type.includes("task")) return "text-blue-400";
  if (type.includes("analysis")) return "text-purple-400";
  if (type.includes("action")) return "text-cyan-400";
  if (type.includes("agent")) return "text-gray-400";
  return "text-gray-400";
}

function getEventTypeBadge(type: string): string {
  if (type.includes("error") || type.includes("failed")) return "badge-red";
  if (type.includes("completed") || type.includes("success")) return "badge-green";
  if (type.includes("started") || type.includes("pending")) return "badge-cyan";
  return "badge-gray";
}

function getEventTitle(event: WSEvent): string {
  const data = event.data as Record<string, unknown> | undefined;

  switch (event.type) {
    case "idea_updated":
      return data?.status === "planning" ? "Planning started"
        : data?.status === "plan_ready" ? "Plan ready"
        : data?.status === "completed" ? "Idea launched"
        : data?.status === "failed" ? "Planning failed"
        : "Idea updated";
    case "idea_launched":
      return "Project created";
    case "task_created":
      return "New task generated";
    case "analysis_started":
      return "Analysis started";
    case "analysis_completed":
      return "Analysis completed";
    case "action_pending":
      return "Action awaiting approval";
    case "agent_log":
      return "Agent output";
    default:
      return formatEventType(event.type);
  }
}

function formatEventType(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;

  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}
</script>

<style scoped>
/* Event list transitions */
.event-list-move,
.event-list-enter-active,
.event-list-leave-active {
  transition: all 0.3s ease;
}

.event-list-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.event-list-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.event-list-leave-active {
  position: absolute;
}
</style>
