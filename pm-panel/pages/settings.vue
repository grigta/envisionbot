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

    <!-- Notification Preferences -->
    <div class="notion-card">
      <div class="flex items-center gap-2 mb-6">
        <div class="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
          <UIcon name="i-heroicons-bell" class="w-4 h-4 text-blue-400" />
        </div>
        <h3 class="font-semibold text-white">Notification Preferences</h3>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Email Notifications -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm font-medium text-white">Email Notifications</label>
              <p class="text-xs text-gray-500 mt-0.5">Receive notifications via email</p>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" v-model="preferences.emailEnabled" @change="savePreferences">
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div v-if="preferences.emailEnabled" class="pl-4 border-l-2 border-gray-700">
            <label class="block text-sm font-medium text-gray-400 mb-1.5">Email Address</label>
            <input
              v-model="preferences.emailAddress"
              type="email"
              placeholder="admin@example.com"
              class="input-bordered w-full"
              @blur="savePreferences"
            />
          </div>
        </div>

        <!-- Telegram Notifications -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm font-medium text-white">Telegram Notifications</label>
              <p class="text-xs text-gray-500 mt-0.5">Receive notifications via Telegram</p>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" v-model="preferences.telegramEnabled" @change="savePreferences">
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div v-if="preferences.telegramEnabled" class="pl-4 border-l-2 border-gray-700">
            <label class="block text-sm font-medium text-gray-400 mb-1.5">Chat ID</label>
            <input
              v-model="preferences.telegramChatId"
              type="text"
              placeholder="123456789"
              class="input-bordered w-full"
              @blur="savePreferences"
            />
            <p class="text-xs text-gray-500 mt-1">Get your chat ID from @userinfobot</p>
          </div>
        </div>

        <!-- Quiet Hours -->
        <div class="space-y-4 md:col-span-2">
          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm font-medium text-white">Quiet Hours</label>
              <p class="text-xs text-gray-500 mt-0.5">Do not disturb during specified hours</p>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" v-model="preferences.quietHoursEnabled" @change="savePreferences">
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div v-if="preferences.quietHoursEnabled" class="pl-4 border-l-2 border-gray-700 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-400 mb-1.5">Start Time</label>
              <input
                v-model="preferences.quietHoursStart"
                type="time"
                class="input-bordered w-full"
                @change="savePreferences"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-400 mb-1.5">End Time</label>
              <input
                v-model="preferences.quietHoursEnd"
                type="time"
                class="input-bordered w-full"
                @change="savePreferences"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-400 mb-1.5">Timezone</label>
              <select
                v-model="preferences.quietHoursTimezone"
                class="input-bordered w-full"
                @change="savePreferences"
              >
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Chicago">Central Time</option>
                <option value="America/Denver">Mountain Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
                <option value="Europe/London">London</option>
                <option value="Europe/Paris">Paris</option>
                <option value="Europe/Moscow">Moscow</option>
                <option value="Asia/Tokyo">Tokyo</option>
                <option value="Asia/Shanghai">Shanghai</option>
                <option value="Australia/Sydney">Sydney</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Notification Filters -->
        <div class="space-y-4 md:col-span-2">
          <div>
            <label class="block text-sm font-medium text-white mb-2">Minimum Priority</label>
            <p class="text-xs text-gray-500 mb-3">Only receive notifications at or above this priority level</p>
            <div class="flex gap-2">
              <button
                v-for="priority in ['low', 'medium', 'high', 'critical']"
                :key="priority"
                @click="preferences.minPriority = priority; savePreferences()"
                class="btn btn-secondary flex-1"
                :class="{ 'bg-blue-600 text-white': preferences.minPriority === priority }"
              >
                {{ priority.charAt(0).toUpperCase() + priority.slice(1) }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Save Status -->
      <div v-if="saveStatus" class="mt-4 p-3 rounded-lg" :class="saveStatus.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'">
        <div class="flex items-center gap-2 text-sm">
          <UIcon :name="saveStatus.success ? 'i-heroicons-check-circle' : 'i-heroicons-x-circle'" class="w-4 h-4" />
          {{ saveStatus.message }}
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

// Notification preferences
const preferences = ref({
  emailEnabled: false,
  emailAddress: "",
  telegramEnabled: true,
  telegramChatId: "",
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
  quietHoursTimezone: "UTC",
  minPriority: "low" as "low" | "medium" | "high" | "critical",
});

const saveStatus = ref<{ success: boolean; message: string } | null>(null);

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

async function fetchPreferences() {
  try {
    const data = await api.getNotificationPreferences();
    if (data) {
      preferences.value = { ...preferences.value, ...data };
    }
  } catch (error) {
    console.error("Failed to fetch notification preferences:", error);
  }
}

async function savePreferences() {
  saveStatus.value = null;
  try {
    await api.updateNotificationPreferences(preferences.value);
    saveStatus.value = { success: true, message: "Preferences saved successfully" };
    setTimeout(() => {
      saveStatus.value = null;
    }, 3000);
  } catch (error) {
    saveStatus.value = {
      success: false,
      message: "Failed to save preferences. Please try again.",
    };
    console.error("Failed to save notification preferences:", error);
  }
}

onMounted(() => {
  fetchStatus();
  fetchPreferences();
});
</script>
