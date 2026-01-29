<template>
  <div class="gateway-container">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-3">
        <div
          class="w-3 h-3 rounded-full"
          :class="activeSession ? 'bg-green-500 animate-pulse' : 'bg-gray-600'"
        />
        <h3 class="text-lg font-semibold text-white">
          {{ activeSession ? activeSession.title : 'Agent Gateway' }}
        </h3>
      </div>
      <div class="flex items-center gap-2">
        <span v-if="activeSession" class="text-xs text-cyan-400">
          {{ formatDuration(Date.now() - activeSession.startedAt) }}
        </span>
        <button
          v-if="steps.length > 0"
          @click="clearSteps"
          class="text-xs text-gray-500 hover:text-gray-300 px-2 py-1 rounded hover:bg-[#2d2d2d]"
        >
          Clear
        </button>
      </div>
    </div>

    <!-- Active Session Info -->
    <div v-if="activeSession" class="mb-4 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
      <div class="flex items-center gap-2 text-sm">
        <UIcon name="i-heroicons-play-circle" class="w-4 h-4 text-cyan-400" />
        <span class="text-cyan-300">{{ activeSession.description }}</span>
      </div>
    </div>

    <!-- Steps Timeline -->
    <div class="steps-container" ref="stepsContainer">
      <div v-if="steps.length === 0" class="text-center py-8 text-gray-500">
        <UIcon name="i-heroicons-signal" class="w-8 h-8 mb-2 opacity-50 mx-auto" />
        <p class="text-sm">Waiting for agent activity...</p>
        <p class="text-xs text-gray-600 mt-1">Start an analysis or task to see live progress</p>
      </div>

      <TransitionGroup v-else name="step" tag="div" class="space-y-2">
        <div
          v-for="step in visibleSteps"
          :key="step.id"
          class="step-item"
          :class="getStepClass(step)"
        >
          <!-- Step Icon -->
          <div class="step-icon" :class="getStepIconClass(step)">
            <UIcon :name="getStepIcon(step)" class="w-4 h-4" />
          </div>

          <!-- Step Content -->
          <div class="step-content">
            <!-- Header -->
            <div class="flex items-center gap-2 mb-1">
              <span class="step-type" :class="getStepTypeClass(step)">
                {{ getStepLabel(step) }}
              </span>
              <span v-if="step.toolName" class="text-xs text-purple-400 font-mono">
                {{ step.toolName }}
              </span>
              <span class="text-xs text-gray-600 ml-auto">
                {{ formatTime(step.timestamp) }}
              </span>
            </div>

            <!-- Content -->
            <div class="step-text" :class="{ 'font-mono text-xs': step.type === 'tool_use' || step.type === 'tool_result' }">
              <template v-if="step.type === 'tool_use' && step.toolInput">
                <details class="group">
                  <summary class="cursor-pointer text-gray-400 hover:text-gray-200">
                    {{ truncate(step.content, 100) }}
                  </summary>
                  <pre class="mt-2 p-2 bg-[#191919] rounded text-xs overflow-x-auto text-gray-300">{{ formatJSON(step.toolInput) }}</pre>
                </details>
              </template>
              <template v-else-if="step.type === 'tool_result' && step.toolOutput">
                <details class="group">
                  <summary class="cursor-pointer text-gray-400 hover:text-gray-200">
                    Tool completed
                  </summary>
                  <pre class="mt-2 p-2 bg-[#191919] rounded text-xs overflow-x-auto text-gray-300 max-h-40">{{ formatOutput(step.toolOutput) }}</pre>
                </details>
              </template>
              <template v-else-if="step.type === 'thinking'">
                <span class="text-gray-500 italic">{{ truncate(step.content, 200) }}</span>
              </template>
              <template v-else-if="step.type === 'error'">
                <span class="text-red-400">{{ step.content }}</span>
              </template>
              <template v-else>
                {{ truncate(step.content, 300) }}
              </template>
            </div>

            <!-- Status indicator -->
            <div v-if="step.status === 'running'" class="mt-1">
              <div class="h-1 bg-[#2d2d2d] rounded-full overflow-hidden">
                <div class="h-full bg-cyan-500 rounded-full animate-progress" />
              </div>
            </div>
          </div>
        </div>
      </TransitionGroup>
    </div>

    <!-- Completion Status -->
    <div v-if="lastCompletion" class="mt-4 pt-3 border-t border-[#2d2d2d]">
      <div class="flex items-center gap-2 text-sm">
        <UIcon
          :name="lastCompletion.success ? 'i-heroicons-check-circle' : 'i-heroicons-x-circle'"
          :class="lastCompletion.success ? 'text-green-400' : 'text-red-400'"
          class="w-4 h-4"
        />
        <span :class="lastCompletion.success ? 'text-green-400' : 'text-red-400'">
          {{ lastCompletion.success ? 'Task completed successfully' : 'Task failed' }}
        </span>
        <span class="text-gray-600 text-xs ml-auto">
          {{ formatTime(lastCompletion.timestamp) }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface AgentStep {
  id: string;
  type: "thinking" | "tool_use" | "tool_result" | "text" | "error" | "complete";
  timestamp: number;
  content: string;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  status?: "running" | "completed" | "failed";
}

interface AgentSession {
  sessionId: string;
  reportId?: string;
  taskType: string;
  title: string;
  description: string;
  startedAt: number;
}

const props = defineProps<{
  maxSteps?: number;
}>();

const { events, lastEvent } = useWebSocket();

const steps = ref<AgentStep[]>([]);
const activeSession = ref<AgentSession | null>(null);
const lastCompletion = ref<{ success: boolean; timestamp: number } | null>(null);
const stepsContainer = ref<HTMLElement | null>(null);

const visibleSteps = computed(() => {
  const max = props.maxSteps || 50;
  return steps.value.slice(-max);
});

// Watch for agent events
watch(lastEvent, (event) => {
  if (!event) return;

  if (event.type === "agent_session_start") {
    const data = event.data as AgentSession;
    activeSession.value = {
      ...data,
      startedAt: event.timestamp,
    };
    steps.value = []; // Clear previous steps
    lastCompletion.value = null;
  }

  if (event.type === "agent_step") {
    const data = event.data as { sessionId: string; step: AgentStep };
    steps.value.push({
      ...data.step,
      timestamp: event.timestamp,
    });
    scrollToBottom();
  }

  if (event.type === "agent_session_end") {
    const data = event.data as { sessionId: string; success: boolean };
    lastCompletion.value = {
      success: data.success,
      timestamp: event.timestamp,
    };
    activeSession.value = null;
  }
});

function scrollToBottom() {
  nextTick(() => {
    if (stepsContainer.value) {
      stepsContainer.value.scrollTop = stepsContainer.value.scrollHeight;
    }
  });
}

function clearSteps() {
  steps.value = [];
  lastCompletion.value = null;
}

function getStepIcon(step: AgentStep): string {
  switch (step.type) {
    case "thinking":
      return "i-heroicons-light-bulb";
    case "tool_use":
      return "i-heroicons-wrench-screwdriver";
    case "tool_result":
      return "i-heroicons-check-badge";
    case "text":
      return "i-heroicons-chat-bubble-left-right";
    case "error":
      return "i-heroicons-exclamation-triangle";
    case "complete":
      return "i-heroicons-flag";
    default:
      return "i-heroicons-sparkles";
  }
}

function getStepIconClass(step: AgentStep): string {
  switch (step.type) {
    case "thinking":
      return "bg-yellow-500/20 text-yellow-400";
    case "tool_use":
      return "bg-purple-500/20 text-purple-400";
    case "tool_result":
      return "bg-green-500/20 text-green-400";
    case "text":
      return "bg-blue-500/20 text-blue-400";
    case "error":
      return "bg-red-500/20 text-red-400";
    case "complete":
      return "bg-cyan-500/20 text-cyan-400";
    default:
      return "bg-gray-500/20 text-gray-400";
  }
}

function getStepClass(step: AgentStep): string {
  if (step.status === "running") return "step-running";
  if (step.status === "failed") return "step-failed";
  return "";
}

function getStepTypeClass(step: AgentStep): string {
  switch (step.type) {
    case "thinking":
      return "text-yellow-400";
    case "tool_use":
      return "text-purple-400";
    case "tool_result":
      return "text-green-400";
    case "text":
      return "text-blue-400";
    case "error":
      return "text-red-400";
    case "complete":
      return "text-cyan-400";
    default:
      return "text-gray-400";
  }
}

function getStepLabel(step: AgentStep): string {
  switch (step.type) {
    case "thinking":
      return "Thinking";
    case "tool_use":
      return "Tool";
    case "tool_result":
      return "Result";
    case "text":
      return "Response";
    case "error":
      return "Error";
    case "complete":
      return "Done";
    default:
      return step.type;
  }
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

function formatJSON(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

function formatOutput(output: unknown): string {
  if (typeof output === "string") {
    return output.length > 500 ? output.slice(0, 500) + "..." : output;
  }
  return formatJSON(output);
}
</script>

<style scoped>
.gateway-container {
  @apply bg-[#202020] border border-[#2d2d2d] rounded-xl p-5;
}

.steps-container {
  @apply max-h-[400px] overflow-y-auto pr-2;
  scrollbar-width: thin;
  scrollbar-color: #404040 transparent;
}

.step-item {
  @apply flex gap-3 p-3 rounded-lg bg-[#191919] transition-all duration-200;
}

.step-item.step-running {
  @apply border-l-2 border-cyan-500 bg-cyan-500/5;
}

.step-item.step-failed {
  @apply border-l-2 border-red-500 bg-red-500/5;
}

.step-icon {
  @apply w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0;
}

.step-content {
  @apply flex-1 min-w-0;
}

.step-type {
  @apply text-xs font-medium uppercase tracking-wide;
}

.step-text {
  @apply text-sm text-gray-300 break-words;
}

/* Transitions */
.step-enter-active,
.step-leave-active {
  transition: all 0.3s ease;
}

.step-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.step-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

/* Progress animation */
@keyframes progress {
  0% {
    width: 0%;
    margin-left: 0%;
  }
  50% {
    width: 30%;
    margin-left: 35%;
  }
  100% {
    width: 0%;
    margin-left: 100%;
  }
}

.animate-progress {
  animation: progress 1.5s ease-in-out infinite;
}
</style>
