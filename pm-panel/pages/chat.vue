<template>
  <div class="fixed inset-0 lg:left-60 flex">
    <!-- Chat Sidebar backdrop (mobile) -->
    <div
      v-if="chatSidebarOpen"
      @click="chatSidebarOpen = false"
      class="fixed inset-0 bg-black/50 z-30 lg:hidden"
    />

    <!-- Sidebar (fixed position) -->
    <div
      class="transition-transform duration-300 z-40"
      :class="{
        '-translate-x-full lg:translate-x-0': !chatSidebarOpen,
        'translate-x-0': chatSidebarOpen
      }"
    >
      <ChatSidebar
        :sessions="sessions"
        :current-session-id="currentSessionId"
        :loading="loadingSessions"
        @new-chat="createNewSession"
        @select="switchSession"
        @delete="deleteSession"
      />
    </div>

    <!-- Main Chat Area (fixed, starts after chat sidebar) -->
    <div class="flex-1 flex flex-col min-w-0 lg:ml-60 bg-[#191919]">
      <!-- Header (matches sidebar header height) -->
      <div class="h-[57px] flex items-center justify-between px-4 sm:px-6 lg:px-8 border-b border-[#2d2d2d] flex-shrink-0">
        <div class="flex items-center gap-3">
          <!-- Mobile chat sidebar toggle -->
          <button
            @click="chatSidebarOpen = !chatSidebarOpen"
            class="lg:hidden text-gray-400 hover:text-white p-1"
          >
            <UIcon name="i-heroicons-bars-3" class="w-5 h-5" />
          </button>
          <h1 class="text-base sm:text-lg font-semibold text-white">Envision CEO Chat</h1>
        </div>
        <div class="flex items-center gap-2">
          <!-- Connection status -->
          <div
            class="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg"
            :class="wsConnected ? 'bg-green-500/10' : 'bg-red-500/10'"
          >
            <div
              class="w-2 h-2 rounded-full"
              :class="wsConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'"
            />
            <span class="text-xs sm:text-sm hidden sm:inline" :class="wsConnected ? 'text-green-400' : 'text-red-400'">
              {{ wsConnected ? 'Connected' : 'Disconnected' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Messages Container -->
      <div
        ref="messagesContainer"
        class="flex-1 overflow-y-auto space-y-6 px-4 sm:px-6 lg:px-8 py-4 sm:py-6"
      >
        <!-- Empty State -->
        <div v-if="messages.length === 0 && !isProcessing" class="h-full flex flex-col items-center justify-center text-center">
          <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center mb-4">
            <UIcon name="i-heroicons-chat-bubble-left-right" class="w-8 h-8 text-cyan-400" />
          </div>
          <h2 class="text-xl font-semibold text-white mb-2">Start a conversation</h2>
          <p class="text-gray-500 max-w-md mb-6">
            Ask the agent to help with GitHub tasks, analyze projects, create issues, or anything else.
          </p>

          <!-- Example prompts -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-lg">
            <button
              v-for="example in examplePrompts"
              :key="example"
              @click="useExample(example)"
              class="text-left px-4 py-3 bg-[#2d2d2d] hover:bg-[#363636] rounded-xl text-sm text-gray-400 hover:text-white transition-colors"
            >
              {{ example }}
            </button>
          </div>
        </div>

        <!-- Messages -->
        <template v-else>
          <ChatMessage
            v-for="msg in messages"
            :key="msg.id"
            :message="msg"
          />

          <!-- Active Response -->
          <ChatActiveResponse
            v-if="isProcessing && activeSteps.length > 0"
            :steps="activeSteps"
          />

          <!-- Processing indicator (before steps arrive) -->
          <div v-else-if="isProcessing" class="flex gap-3 items-center">
            <div class="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
              <UIcon name="i-heroicons-sparkles" class="w-4 h-4 text-purple-400 animate-pulse" />
            </div>
            <div class="bg-[#2d2d2d] rounded-xl px-4 py-3">
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                <span class="text-sm text-gray-400">Envision CEO is thinking...</span>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Input -->
      <div class="px-4 sm:px-6 lg:px-8 pb-4 sm:pb-6">
        <ChatInput
          v-model="input"
          :disabled="isProcessing"
          placeholder="Type a message... Use @ to mention projects or repos"
          @send="sendMessage"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ChatSession } from "~/composables/useApi";

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

interface ChatMessageType {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  mentions?: Array<{ type: string; value: string }>;
  steps?: AgentStep[];
  success?: boolean;
  error?: string;
}

const api = useApi();
const toast = useToast();
const { connected: wsConnected, lastEvent } = useWebSocket();

const messagesContainer = ref<HTMLElement | null>(null);
const input = ref("");
const messages = ref<ChatMessageType[]>([]);
const isProcessing = ref(false);
const activeSteps = ref<AgentStep[]>([]);
const currentChatId = ref<string | null>(null);
const chatSidebarOpen = ref(false);

// Session management
const sessions = ref<ChatSession[]>([]);
const currentSessionId = ref<string | null>(null);
const loadingSessions = ref(true);

const examplePrompts = [
  "List open issues in @envisionbot",
  "Check CI status for @my-project",
  "Create an issue about fixing login bugs",
  "Analyze the codebase structure",
];

// Fetch sessions list
async function fetchSessions() {
  try {
    sessions.value = await api.getChatHistory(50);
  } catch (error) {
    console.error("Failed to fetch sessions:", error);
  }
}

// Switch to a different session
async function switchSession(sessionId: string) {
  if (sessionId === currentSessionId.value) return;
  if (isProcessing.value) {
    toast.add({
      title: "Cannot switch",
      description: "Wait for the current response to complete",
      color: "yellow",
    });
    return;
  }

  try {
    const session = await api.switchChatSession(sessionId);
    currentSessionId.value = session.id;
    messages.value = session.messages as ChatMessageType[];
    chatSidebarOpen.value = false; // Close sidebar on mobile after switching
    scrollToBottom();
  } catch (error) {
    console.error("Failed to switch session:", error);
    toast.add({
      title: "Error",
      description: "Failed to switch session",
      color: "red",
    });
  }
}

// Create a new session
async function createNewSession() {
  if (isProcessing.value) {
    toast.add({
      title: "Cannot create",
      description: "Wait for the current response to complete",
      color: "yellow",
    });
    return;
  }

  try {
    const session = await api.createChatSession();
    currentSessionId.value = session.id;
    messages.value = [];
    activeSteps.value = [];
    currentChatId.value = null;
    input.value = "";
    await fetchSessions();
  } catch (error) {
    console.error("Failed to create session:", error);
    toast.add({
      title: "Error",
      description: "Failed to create new chat",
      color: "red",
    });
  }
}

// Delete a session
async function deleteSession(sessionId: string) {
  try {
    await api.deleteChatSession(sessionId);

    // If we deleted the current session, switch to another one
    if (sessionId === currentSessionId.value) {
      const remainingSessions = sessions.value.filter(s => s.id !== sessionId);
      if (remainingSessions.length > 0) {
        await switchSession(remainingSessions[0].id);
      } else {
        await createNewSession();
      }
    }

    await fetchSessions();

    toast.add({
      title: "Deleted",
      description: "Chat session deleted",
      color: "green",
    });
  } catch (error) {
    console.error("Failed to delete session:", error);
    toast.add({
      title: "Error",
      description: "Failed to delete session",
      color: "red",
    });
  }
}

// Watch for WebSocket events
watch(lastEvent, (event) => {
  if (!event || !currentChatId.value) return;

  const data = event.data as { chatId?: string; step?: AgentStep; response?: string; success?: boolean; error?: string };

  // Only process events for our current chat
  if (data.chatId !== currentChatId.value) return;

  if (event.type === "chat_step" && data.step) {
    activeSteps.value.push(data.step);
    scrollToBottom();
  }

  if (event.type === "chat_complete") {
    // Add the final assistant message
    if (data.response) {
      messages.value.push({
        id: `msg-${Date.now()}-assistant`,
        role: "assistant",
        content: data.response,
        timestamp: Date.now(),
        steps: [...activeSteps.value],
        success: data.success,
        error: data.error,
      });
    }

    isProcessing.value = false;
    activeSteps.value = [];
    currentChatId.value = null;
    scrollToBottom();

    // Refresh sessions to update the title
    fetchSessions();
  }
});

async function sendMessage() {
  if (!input.value.trim() || isProcessing.value) return;

  const messageContent = input.value.trim();
  input.value = "";
  isProcessing.value = true;
  activeSteps.value = [];

  // Add user message immediately
  messages.value.push({
    id: `msg-${Date.now()}-user`,
    role: "user",
    content: messageContent,
    timestamp: Date.now(),
    mentions: extractMentions(messageContent),
  });

  scrollToBottom();

  try {
    const result = await api.sendChatMessage(messageContent, {
      sessionId: currentSessionId.value || undefined,
    });
    currentChatId.value = result.chatId;

    // Update session ID if this is a new session
    if (!currentSessionId.value) {
      await fetchSessions();
      // Find the new session
      const newSession = sessions.value.find(s =>
        s.messages.some(m => m.content === messageContent)
      );
      if (newSession) {
        currentSessionId.value = newSession.id;
      }
    }

    // If WebSocket is not connected, handle the response directly
    if (!wsConnected.value && result.response) {
      messages.value.push({
        id: `msg-${Date.now()}-assistant`,
        role: "assistant",
        content: result.response,
        timestamp: Date.now(),
        success: result.success,
      });
      isProcessing.value = false;
      fetchSessions();
    }
  } catch (error) {
    console.error("Failed to send message:", error);
    messages.value.push({
      id: `msg-${Date.now()}-assistant`,
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      success: false,
      error: error instanceof Error ? error.message : "Failed to send message",
    });
    isProcessing.value = false;
  }
}

function useExample(example: string) {
  input.value = example;
}

function extractMentions(text: string): Array<{ type: string; value: string }> {
  const mentionRegex = /@([\w\-\/\.]+)/g;
  const mentions: Array<{ type: string; value: string }> = [];

  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    const value = match[1];
    let type: string;

    if (value.startsWith("/")) {
      type = "path";
    } else if (value.includes("/")) {
      type = "repo";
    } else {
      type = "project";
    }

    mentions.push({ type, value });
  }

  return mentions;
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
}

// Load initial data
onMounted(async () => {
  loadingSessions.value = true;

  try {
    // Fetch sessions and current session in parallel
    const [, currentSession] = await Promise.all([
      fetchSessions(),
      api.getCurrentChatSession(),
    ]);

    if (currentSession) {
      currentSessionId.value = currentSession.id;
      if (currentSession.messages && currentSession.messages.length > 0) {
        messages.value = currentSession.messages as ChatMessageType[];
        scrollToBottom();
      }
    }
  } catch (error) {
    console.error("Failed to load chat:", error);
  } finally {
    loadingSessions.value = false;
  }
});
</script>

<style scoped>
/* Scrollbar styling */
.overflow-y-auto {
  scrollbar-width: thin;
  scrollbar-color: #404040 transparent;
}

.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: #404040;
  border-radius: 3px;
}
</style>
