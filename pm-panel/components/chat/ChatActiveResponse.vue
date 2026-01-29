<template>
  <div class="flex gap-3">
    <!-- Avatar -->
    <div class="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
      <UIcon name="i-heroicons-sparkles" class="w-4 h-4 text-purple-400 animate-pulse" />
    </div>

    <!-- Response Content -->
    <div class="flex-1 min-w-0">
      <!-- Header -->
      <div class="flex items-center gap-2 mb-2">
        <span class="text-xs font-medium text-purple-400">Agent</span>
        <span class="text-xs text-cyan-400 animate-pulse">Processing...</span>
      </div>

      <!-- Steps Container -->
      <div class="bg-[#2d2d2d] rounded-xl p-4 space-y-3">
        <!-- Current Status -->
        <div class="flex items-center gap-2 text-sm text-gray-400">
          <div class="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
          <span>{{ currentStatus }}</span>
        </div>

        <!-- Progress Bar -->
        <div class="h-1 bg-[#191919] rounded-full overflow-hidden">
          <div class="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full animate-progress" />
        </div>

        <!-- Steps List -->
        <div ref="stepsContainer" class="max-h-64 overflow-y-auto space-y-2 pr-2">
          <TransitionGroup name="step">
            <div
              v-for="step in visibleSteps"
              :key="step.id"
              class="flex items-start gap-2 p-2 rounded-lg text-sm"
              :class="getStepBgClass(step)"
            >
              <!-- Step Icon -->
              <div
                class="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                :class="getStepIconClass(step)"
              >
                <UIcon :name="getStepIcon(step)" class="w-3.5 h-3.5" />
              </div>

              <!-- Step Content -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-medium" :class="getStepTextClass(step)">
                    {{ getStepLabel(step) }}
                  </span>
                  <span v-if="step.toolName" class="text-xs text-purple-400 font-mono">
                    {{ step.toolName }}
                  </span>
                </div>

                <!-- Content -->
                <div class="text-xs text-gray-500 mt-0.5">
                  <template v-if="step.type === 'tool_use' && step.toolInput">
                    <details class="group">
                      <summary class="cursor-pointer hover:text-gray-300">
                        {{ truncate(step.content, 60) }}
                      </summary>
                      <pre class="mt-1 p-2 bg-[#191919] rounded text-xs overflow-x-auto">{{ formatJSON(step.toolInput) }}</pre>
                    </details>
                  </template>
                  <template v-else-if="step.type === 'tool_result' && step.toolOutput">
                    <details class="group">
                      <summary class="cursor-pointer hover:text-gray-300">
                        Result received
                      </summary>
                      <pre class="mt-1 p-2 bg-[#191919] rounded text-xs overflow-x-auto max-h-24">{{ formatOutput(step.toolOutput) }}</pre>
                    </details>
                  </template>
                  <template v-else-if="step.type === 'thinking'">
                    <span class="italic text-gray-600">{{ truncate(step.content, 100) }}</span>
                  </template>
                  <template v-else-if="step.type === 'error'">
                    <span class="text-red-400">{{ step.content }}</span>
                  </template>
                  <template v-else>
                    {{ truncate(step.content, 150) }}
                  </template>
                </div>
              </div>
            </div>
          </TransitionGroup>
        </div>

        <!-- Final Text (streaming) -->
        <div v-if="textContent" class="pt-2 border-t border-[#404040]">
          <div class="text-sm text-gray-300 whitespace-pre-wrap">
            {{ textContent }}
            <span class="inline-block w-2 h-4 bg-cyan-400 animate-blink ml-0.5" />
          </div>
        </div>
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

const props = defineProps<{
  steps: AgentStep[];
}>();

const stepsContainer = ref<HTMLElement | null>(null);

// Show last 10 steps
const visibleSteps = computed(() => {
  return props.steps.filter((s) => s.type !== "text").slice(-10);
});

// Accumulate text content, filtering out system messages
const textContent = computed(() => {
  return props.steps
    .filter((s) => s.type === "text")
    .map((s) => s.content)
    .filter((content) => !content.includes("Agent initialized with"))
    .join("");
});

// Current status based on last step
const currentStatus = computed(() => {
  const lastStep = props.steps[props.steps.length - 1];
  if (!lastStep) return "Initializing...";

  switch (lastStep.type) {
    case "thinking":
      return "Thinking...";
    case "tool_use":
      return `Using ${lastStep.toolName || "tool"}...`;
    case "tool_result":
      return "Processing result...";
    case "text":
      return "Generating response...";
    case "error":
      return "Error occurred";
    case "complete":
      return "Completed";
    default:
      return "Processing...";
  }
});

// Auto-scroll to bottom
watch(
  () => props.steps.length,
  () => {
    nextTick(() => {
      if (stepsContainer.value) {
        stepsContainer.value.scrollTop = stepsContainer.value.scrollHeight;
      }
    });
  }
);

function getStepIcon(step: AgentStep): string {
  const icons: Record<string, string> = {
    thinking: "i-heroicons-light-bulb",
    tool_use: "i-heroicons-wrench-screwdriver",
    tool_result: "i-heroicons-check-badge",
    text: "i-heroicons-chat-bubble-left-right",
    error: "i-heroicons-exclamation-triangle",
    complete: "i-heroicons-flag",
  };
  return icons[step.type] || "i-heroicons-sparkles";
}

function getStepIconClass(step: AgentStep): string {
  const classes: Record<string, string> = {
    thinking: "bg-yellow-500/20 text-yellow-400",
    tool_use: "bg-purple-500/20 text-purple-400",
    tool_result: "bg-green-500/20 text-green-400",
    text: "bg-blue-500/20 text-blue-400",
    error: "bg-red-500/20 text-red-400",
    complete: "bg-cyan-500/20 text-cyan-400",
  };
  return classes[step.type] || "bg-gray-500/20 text-gray-400";
}

function getStepBgClass(step: AgentStep): string {
  if (step.status === "running") return "bg-cyan-500/5 border-l-2 border-cyan-500";
  if (step.type === "error") return "bg-red-500/5";
  return "bg-[#191919]";
}

function getStepTextClass(step: AgentStep): string {
  const classes: Record<string, string> = {
    thinking: "text-yellow-400",
    tool_use: "text-purple-400",
    tool_result: "text-green-400",
    text: "text-blue-400",
    error: "text-red-400",
    complete: "text-cyan-400",
  };
  return classes[step.type] || "text-gray-400";
}

function getStepLabel(step: AgentStep): string {
  const labels: Record<string, string> = {
    thinking: "Thinking",
    tool_use: "Tool",
    tool_result: "Result",
    text: "Response",
    error: "Error",
    complete: "Done",
  };
  return labels[step.type] || step.type;
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
    return output.length > 300 ? output.slice(0, 300) + "..." : output;
  }
  return formatJSON(output);
}
</script>

<style scoped>
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

/* Blink animation for cursor */
@keyframes blink {
  0%, 50% {
    opacity: 1;
  }
  51%, 100% {
    opacity: 0;
  }
}

.animate-blink {
  animation: blink 1s step-end infinite;
}

/* Step transitions */
.step-enter-active,
.step-leave-active {
  transition: all 0.2s ease;
}

.step-enter-from {
  opacity: 0;
  transform: translateX(-10px);
}

.step-leave-to {
  opacity: 0;
  transform: translateX(10px);
}

/* Scrollbar */
.max-h-64 {
  scrollbar-width: thin;
  scrollbar-color: #404040 transparent;
}
</style>
