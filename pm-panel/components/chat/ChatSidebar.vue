<template>
  <div
    class="w-60 bg-[#191919] border-r border-[#2d2d2d] flex flex-col fixed top-0 h-screen z-30 transition-transform duration-300"
    :class="[
      isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      'left-0 lg:left-60'
    ]"
  >
    <!-- Header (matches main nav header height) -->
    <div class="p-4 border-b border-[#2d2d2d] h-[57px] flex items-center">
      <button @click="$emit('new-chat')" class="btn btn-primary w-full text-sm">
        <UIcon name="i-heroicons-plus" class="w-4 h-4" />
        New Chat
      </button>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 text-gray-500 animate-spin" />
    </div>

    <!-- Empty state -->
    <div v-else-if="sessions.length === 0" class="flex-1 flex flex-col items-center justify-center px-4 text-center">
      <UIcon name="i-heroicons-chat-bubble-left-right" class="w-8 h-8 text-gray-600 mb-2" />
      <p class="text-sm text-gray-500">No chat history yet</p>
    </div>

    <!-- Sessions List -->
    <div v-else class="flex-1 overflow-y-auto">
      <div v-for="group in groupedSessions" :key="group.label" class="py-2">
        <div class="px-3 py-1.5 text-xs text-gray-500 uppercase tracking-wider">
          {{ group.label }}
        </div>
        <button
          v-for="session in group.sessions"
          :key="session.id"
          @click="$emit('select', session.id)"
          class="w-full px-3 py-2 text-left text-sm hover:bg-[#2d2d2d] group flex items-center gap-2 transition-colors"
          :class="{ 'bg-[#2d2d2d]': session.id === currentSessionId }"
        >
          <UIcon name="i-heroicons-chat-bubble-left" class="w-4 h-4 text-gray-500 flex-shrink-0" />
          <span class="flex-1 truncate text-gray-300">{{ session.title || 'New Chat' }}</span>
          <button
            @click.stop="confirmDelete(session)"
            class="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all p-1 -mr-1"
          >
            <UIcon name="i-heroicons-trash" class="w-3.5 h-3.5" />
          </button>
        </button>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <UModal v-model="showDeleteModal">
      <div class="p-5 space-y-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
            <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 class="font-semibold text-white">Delete Chat</h3>
            <p class="text-sm text-gray-400">This action cannot be undone.</p>
          </div>
        </div>

        <p class="text-sm text-gray-300">
          Are you sure you want to delete "{{ sessionToDelete?.title || 'New Chat' }}"?
        </p>

        <div class="flex justify-end gap-3">
          <button @click="showDeleteModal = false" class="btn btn-secondary">
            Cancel
          </button>
          <button @click="handleDelete" class="btn bg-red-500 hover:bg-red-600 text-white">
            <UIcon name="i-heroicons-trash" class="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { ChatSession } from "~/composables/useApi";

const props = defineProps<{
  sessions: ChatSession[];
  currentSessionId: string | null;
  loading?: boolean;
  isOpen?: boolean;
}>();

const emit = defineEmits<{
  (e: "new-chat"): void;
  (e: "select", id: string): void;
  (e: "delete", id: string): void;
}>();

const showDeleteModal = ref(false);
const sessionToDelete = ref<ChatSession | null>(null);

// Group sessions by date
const groupedSessions = computed(() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const groups: { label: string; sessions: ChatSession[] }[] = [
    { label: "Today", sessions: [] },
    { label: "Yesterday", sessions: [] },
    { label: "This Week", sessions: [] },
    { label: "Older", sessions: [] },
  ];

  // Sort sessions by updatedAt descending
  const sorted = [...props.sessions].sort((a, b) => b.updatedAt - a.updatedAt);

  for (const session of sorted) {
    const date = new Date(session.updatedAt);
    date.setHours(0, 0, 0, 0);

    if (date.getTime() === today.getTime()) {
      groups[0].sessions.push(session);
    } else if (date.getTime() === yesterday.getTime()) {
      groups[1].sessions.push(session);
    } else if (date >= weekAgo) {
      groups[2].sessions.push(session);
    } else {
      groups[3].sessions.push(session);
    }
  }

  // Filter out empty groups
  return groups.filter((g) => g.sessions.length > 0);
});

function confirmDelete(session: ChatSession) {
  sessionToDelete.value = session;
  showDeleteModal.value = true;
}

function handleDelete() {
  if (sessionToDelete.value) {
    emit("delete", sessionToDelete.value.id);
    showDeleteModal.value = false;
    sessionToDelete.value = null;
  }
}
</script>

<style scoped>
/* Scrollbar styling */
.overflow-y-auto {
  scrollbar-width: thin;
  scrollbar-color: #404040 transparent;
}

.overflow-y-auto::-webkit-scrollbar {
  width: 4px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: #404040;
  border-radius: 2px;
}
</style>
