<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-white">Settings</h1>
      <p class="text-gray-500 text-sm">Configure Envision CEO and system settings</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Agent Status -->
      <div class="notion-card">
        <div class="flex items-center gap-2 mb-4">
          <div class="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
            <UIcon name="i-heroicons-server-stack" class="w-4 h-4 text-cyan-400" />
          </div>
          <h3 class="font-semibold text-white">Envision CEO Status</h3>
        </div>
        <div class="space-y-3">
          <div class="flex justify-between items-center">
            <span class="text-gray-400">Status</span>
            <span class="badge" :class="agentStatus?.running ? 'badge-green' : 'badge-red'">
              {{ agentStatus?.running ? 'Running' : 'Stopped' }}
            </span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-gray-400">Pending Actions</span>
            <span class="text-white font-medium">{{ agentStatus?.pendingActionsCount || 0 }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-gray-400">Last Health Check</span>
            <span class="text-white text-sm">
              {{ agentStatus?.lastHealthCheck ? formatDate(agentStatus.lastHealthCheck) : 'Never' }}
            </span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-gray-400">Last Deep Analysis</span>
            <span class="text-white text-sm">
              {{ agentStatus?.lastDeepAnalysis ? formatDate(agentStatus.lastDeepAnalysis) : 'Never' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Manual Agent Run -->
      <div class="notion-card">
        <div class="flex items-center gap-2 mb-4">
          <div class="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <UIcon name="i-heroicons-command-line" class="w-4 h-4 text-purple-400" />
          </div>
          <h3 class="font-semibold text-white">Run Envision CEO Manually</h3>
        </div>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-400 mb-1.5">Prompt</label>
            <textarea
              v-model="manualPrompt"
              placeholder="Enter a prompt for the agent..."
              rows="4"
              class="input-bordered w-full resize-none"
            />
          </div>
          <button
            @click="runManualAgent"
            :disabled="runningAgent || !manualPrompt.trim()"
            class="btn btn-primary w-full"
          >
            <UIcon v-if="runningAgent" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
            <UIcon v-else name="i-heroicons-play" class="w-4 h-4" />
            Run Envision CEO
          </button>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="notion-card">
        <div class="flex items-center gap-2 mb-4">
          <div class="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center">
            <UIcon name="i-heroicons-bolt" class="w-4 h-4 text-yellow-400" />
          </div>
          <h3 class="font-semibold text-white">Quick Actions</h3>
        </div>
        <div class="space-y-2">
          <button
            @click="runHealthCheck"
            :disabled="healthCheckLoading"
            class="btn btn-secondary w-full justify-start"
          >
            <UIcon :name="healthCheckLoading ? 'i-heroicons-arrow-path' : 'i-heroicons-heart'" :class="{'animate-spin': healthCheckLoading}" class="w-4 h-4" />
            Run Health Check
          </button>
          <button
            @click="runDeepAnalysis"
            :disabled="deepAnalysisLoading"
            class="btn btn-secondary w-full justify-start"
          >
            <UIcon :name="deepAnalysisLoading ? 'i-heroicons-arrow-path' : 'i-heroicons-chart-bar'" :class="{'animate-spin': deepAnalysisLoading}" class="w-4 h-4" />
            Run Deep Analysis
          </button>
        </div>
      </div>

      <!-- Connection Info -->
      <div class="notion-card">
        <div class="flex items-center gap-2 mb-4">
          <div class="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
            <UIcon name="i-heroicons-signal" class="w-4 h-4 text-green-400" />
          </div>
          <h3 class="font-semibold text-white">Connection</h3>
        </div>
        <div class="space-y-3">
          <div class="flex justify-between items-center">
            <span class="text-gray-400">API URL</span>
            <code class="text-sm text-cyan-400 bg-[#2d2d2d] px-2 py-0.5 rounded">{{ apiBaseUrl }}</code>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-gray-400">WebSocket</span>
            <span class="badge" :class="wsConnected ? 'badge-green' : 'badge-red'">
              {{ wsConnected ? 'Connected' : 'Disconnected' }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Agent Response -->
    <div v-if="agentResponse" class="notion-card">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <UIcon name="i-heroicons-sparkles" class="w-4 h-4 text-purple-400" />
          </div>
          <h3 class="font-semibold text-white">Envision CEO Response</h3>
        </div>
        <button @click="agentResponse = null" class="btn btn-ghost text-xs py-1 px-2">
          <UIcon name="i-heroicons-x-mark" class="w-4 h-4" />
          Clear
        </button>
      </div>
      <pre class="whitespace-pre-wrap text-sm text-gray-300 bg-[#191919] rounded-lg p-4 max-h-96 overflow-y-auto">{{ agentResponse }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
const api = useApi();
const toast = useToast();
const config = useRuntimeConfig();
const { connected: wsConnected } = useWebSocket();

const apiBaseUrl = config.public.apiBaseUrl;
const agentStatus = ref<Awaited<ReturnType<typeof api.getAgentStatus>> | null>(null);
const manualPrompt = ref("");
const agentResponse = ref<string | null>(null);
const runningAgent = ref(false);
const healthCheckLoading = ref(false);
const deepAnalysisLoading = ref(false);

async function fetchStatus() {
  try {
    agentStatus.value = await api.getAgentStatus();
  } catch {
    console.error("Failed to fetch agent status");
  }
}

async function runManualAgent() {
  if (!manualPrompt.value.trim()) return;

  runningAgent.value = true;
  agentResponse.value = null;

  try {
    const result = await api.runAgent(manualPrompt.value);
    agentResponse.value = result.response;
    toast.add({
      title: "Agent Run Complete",
      description: `Generated ${result.tasksCount} tasks`,
      color: "green",
    });
    await fetchStatus();
  } catch {
    toast.add({
      title: "Error",
      description: "Failed to run agent",
      color: "red",
    });
  } finally {
    runningAgent.value = false;
  }
}

async function runHealthCheck() {
  healthCheckLoading.value = true;
  try {
    await api.runHealthCheck();
    toast.add({
      title: "Health Check",
      description: "Health check completed",
      color: "green",
    });
    await fetchStatus();
  } catch {
    toast.add({
      title: "Error",
      description: "Health check failed",
      color: "red",
    });
  } finally {
    healthCheckLoading.value = false;
  }
}

async function runDeepAnalysis() {
  deepAnalysisLoading.value = true;
  try {
    await api.runDeepAnalysis();
    toast.add({
      title: "Deep Analysis",
      description: "Deep analysis completed",
      color: "green",
    });
    await fetchStatus();
  } catch {
    toast.add({
      title: "Error",
      description: "Deep analysis failed",
      color: "red",
    });
  } finally {
    deepAnalysisLoading.value = false;
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

onMounted(() => {
  fetchStatus();
});
</script>
