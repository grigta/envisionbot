<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-white">Settings</h1>
      <p class="text-gray-500 text-sm">Configure Envision CEO and system settings</p>
    </div>

    <!-- Notification Preferences -->
    <div class="notion-card">
      <div class="flex items-center gap-2 mb-4">
        <div class="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
          <UIcon name="i-heroicons-bell" class="w-4 h-4 text-blue-400" />
        </div>
        <h3 class="font-semibold text-white">Notification Preferences</h3>
      </div>
      <div v-if="notificationPrefs" class="space-y-4">
        <!-- Email Notifications -->
        <div class="border-b border-gray-700 pb-4">
          <div class="flex items-center justify-between mb-2">
            <label class="text-sm font-medium text-gray-300">Email Notifications</label>
            <button
              @click="toggleEmail"
              :class="notificationPrefs.emailEnabled ? 'bg-purple-600' : 'bg-gray-600'"
              class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
            >
              <span
                :class="notificationPrefs.emailEnabled ? 'translate-x-6' : 'translate-x-1'"
                class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
              />
            </button>
          </div>
          <input
            v-if="notificationPrefs.emailEnabled"
            v-model="notificationPrefs.emailAddress"
            @blur="savePreferences"
            type="email"
            placeholder="your-email@example.com"
            class="input-bordered w-full text-sm"
          />
        </div>

        <!-- Telegram Notifications -->
        <div class="border-b border-gray-700 pb-4">
          <div class="flex items-center justify-between mb-2">
            <label class="text-sm font-medium text-gray-300">Telegram Notifications</label>
            <button
              @click="toggleTelegram"
              :class="notificationPrefs.telegramEnabled ? 'bg-purple-600' : 'bg-gray-600'"
              class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
            >
              <span
                :class="notificationPrefs.telegramEnabled ? 'translate-x-6' : 'translate-x-1'"
                class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
              />
            </button>
          </div>
          <input
            v-if="notificationPrefs.telegramEnabled"
            v-model="notificationPrefs.telegramChatId"
            @blur="savePreferences"
            type="text"
            placeholder="Telegram Chat ID"
            class="input-bordered w-full text-sm"
          />
        </div>

        <!-- Quiet Hours -->
        <div class="border-b border-gray-700 pb-4">
          <div class="flex items-center justify-between mb-2">
            <label class="text-sm font-medium text-gray-300">Quiet Hours</label>
            <button
              @click="toggleQuietHours"
              :class="notificationPrefs.quietHoursEnabled ? 'bg-purple-600' : 'bg-gray-600'"
              class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
            >
              <span
                :class="notificationPrefs.quietHoursEnabled ? 'translate-x-6' : 'translate-x-1'"
                class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
              />
            </button>
          </div>
          <div v-if="notificationPrefs.quietHoursEnabled" class="space-y-2">
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-xs text-gray-400 mb-1">Start Time</label>
                <input
                  v-model="notificationPrefs.quietHoursStart"
                  @blur="savePreferences"
                  type="time"
                  class="input-bordered w-full text-sm"
                />
              </div>
              <div>
                <label class="block text-xs text-gray-400 mb-1">End Time</label>
                <input
                  v-model="notificationPrefs.quietHoursEnd"
                  @blur="savePreferences"
                  type="time"
                  class="input-bordered w-full text-sm"
                />
              </div>
            </div>
            <div>
              <label class="block text-xs text-gray-400 mb-1">Timezone</label>
              <select
                v-model="notificationPrefs.quietHoursTimezone"
                @change="savePreferences"
                class="input-bordered w-full text-sm"
              >
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern Time (US)</option>
                <option value="America/Chicago">Central Time (US)</option>
                <option value="America/Denver">Mountain Time (US)</option>
                <option value="America/Los_Angeles">Pacific Time (US)</option>
                <option value="Europe/London">London</option>
                <option value="Europe/Paris">Paris</option>
                <option value="Europe/Berlin">Berlin</option>
                <option value="Asia/Tokyo">Tokyo</option>
                <option value="Asia/Shanghai">Shanghai</option>
                <option value="Australia/Sydney">Sydney</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Minimum Priority -->
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Minimum Priority</label>
          <select
            v-model="notificationPrefs.minimumPriority"
            @change="savePreferences"
            class="input-bordered w-full text-sm"
          >
            <option value="low">Low (all notifications)</option>
            <option value="medium">Medium and above</option>
            <option value="high">High and above</option>
            <option value="critical">Critical only</option>
          </select>
        </div>

        <!-- Save Status -->
        <div v-if="saveStatus" class="text-xs text-center" :class="saveStatus === 'saved' ? 'text-green-400' : 'text-yellow-400'">
          {{ saveStatus === 'saved' ? '✓ Preferences saved' : 'Saving...' }}
        </div>
      </div>
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
import type { NotificationPreferences } from "~/composables/useApi";

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
const notificationPrefs = ref<NotificationPreferences | null>(null);
const saveStatus = ref<"saving" | "saved" | null>(null);

async function fetchStatus() {
  try {
    agentStatus.value = await api.getAgentStatus();
  } catch {
    console.error("Failed to fetch agent status");
  }
}

async function fetchNotificationPreferences() {
  try {
    notificationPrefs.value = await api.getNotificationPreferences();
  } catch (error) {
    console.error("Failed to fetch notification preferences:", error);
  }
}

async function savePreferences() {
  if (!notificationPrefs.value) return;

  saveStatus.value = "saving";
  try {
    notificationPrefs.value = await api.updateNotificationPreferences(notificationPrefs.value);
    saveStatus.value = "saved";
    setTimeout(() => {
      saveStatus.value = null;
    }, 2000);
  } catch (error) {
    toast.add({
      title: "Error",
      description: "Failed to save notification preferences",
      color: "red",
    });
    saveStatus.value = null;
  }
}

function toggleEmail() {
  if (notificationPrefs.value) {
    notificationPrefs.value.emailEnabled = !notificationPrefs.value.emailEnabled;
    savePreferences();
  }
}

function toggleTelegram() {
  if (notificationPrefs.value) {
    notificationPrefs.value.telegramEnabled = !notificationPrefs.value.telegramEnabled;
    savePreferences();
  }
}

function toggleQuietHours() {
  if (notificationPrefs.value) {
    notificationPrefs.value.quietHoursEnabled = !notificationPrefs.value.quietHoursEnabled;
    if (notificationPrefs.value.quietHoursEnabled) {
      // Set default quiet hours if not set
      if (!notificationPrefs.value.quietHoursStart) {
        notificationPrefs.value.quietHoursStart = "22:00";
      }
      if (!notificationPrefs.value.quietHoursEnd) {
        notificationPrefs.value.quietHoursEnd = "08:00";
      }
      if (!notificationPrefs.value.quietHoursTimezone) {
        notificationPrefs.value.quietHoursTimezone = "UTC";
      }
    }
    savePreferences();
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
  fetchNotificationPreferences();
});
</script>
