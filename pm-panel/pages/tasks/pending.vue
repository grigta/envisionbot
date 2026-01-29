<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-2xl font-bold text-white">Pending Actions</h2>
      <UButton @click="fetchPendingActions" :loading="loading" color="gray" size="sm">
        Refresh
      </UButton>
    </div>

    <div v-if="loading" class="text-center py-8">
      <UIcon name="i-heroicons-arrow-path" class="animate-spin text-2xl text-gray-400" />
    </div>

    <div v-else-if="pendingActions.length === 0" class="text-center py-8">
      <UIcon name="i-heroicons-check-circle" class="text-4xl text-green-500 mb-2" />
      <p class="text-gray-400">No pending actions</p>
    </div>

    <div v-else class="space-y-4">
      <UCard v-for="action in pendingActions" :key="action.id">
        <div class="space-y-4">
          <div class="flex items-start justify-between">
            <div>
              <UBadge :color="getActionTypeColor(action.action.type)" class="mb-2">
                {{ action.action.type }}
              </UBadge>
              <h3 class="font-semibold text-white">{{ action.action.description }}</h3>
            </div>
            <div class="text-sm text-gray-400">
              Expires: {{ formatDate(action.expiresAt) }}
            </div>
          </div>

          <div class="bg-gray-800 rounded p-3">
            <div class="text-xs text-gray-400 mb-1">Payload:</div>
            <pre class="text-sm text-gray-300 overflow-x-auto">{{ JSON.stringify(action.action.payload, null, 2) }}</pre>
          </div>

          <div class="flex gap-2">
            <UButton
              @click="approveAction(action.id)"
              :loading="processingId === action.id"
              color="green"
              size="sm"
            >
              <UIcon name="i-heroicons-check" class="mr-1" />
              Approve
            </UButton>
            <UButton
              @click="showRejectModal(action.id)"
              :loading="processingId === action.id"
              color="red"
              variant="outline"
              size="sm"
            >
              <UIcon name="i-heroicons-x-mark" class="mr-1" />
              Reject
            </UButton>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Reject Modal -->
    <UModal v-model="rejectModalOpen">
      <UCard>
        <template #header>
          <h3 class="font-semibold text-white">Reject Action</h3>
        </template>
        <div class="space-y-4">
          <UFormGroup label="Reason (optional)">
            <UTextarea v-model="rejectReason" placeholder="Enter rejection reason..." />
          </UFormGroup>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton @click="rejectModalOpen = false" color="gray">Cancel</UButton>
            <UButton @click="confirmReject" color="red" :loading="processingId !== null">
              Reject
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { PendingAction } from "~/composables/useApi";

const api = useApi();
const toast = useToast();

const pendingActions = ref<PendingAction[]>([]);
const loading = ref(true);
const processingId = ref<string | null>(null);
const rejectModalOpen = ref(false);
const rejectReason = ref("");
const rejectActionId = ref<string | null>(null);

async function fetchPendingActions() {
  loading.value = true;
  try {
    pendingActions.value = await api.getPendingActions();
  } catch (error) {
    toast.add({
      title: "Error",
      description: "Failed to fetch pending actions",
      color: "red",
    });
  } finally {
    loading.value = false;
  }
}

async function approveAction(id: string) {
  processingId.value = id;
  try {
    const result = await api.approveAction(id);
    if (result.success) {
      toast.add({
        title: "Approved",
        description: "Action has been approved and executed",
        color: "green",
      });
      await fetchPendingActions();
    }
  } catch (error) {
    toast.add({
      title: "Error",
      description: "Failed to approve action",
      color: "red",
    });
  } finally {
    processingId.value = null;
  }
}

function showRejectModal(id: string) {
  rejectActionId.value = id;
  rejectReason.value = "";
  rejectModalOpen.value = true;
}

async function confirmReject() {
  if (!rejectActionId.value) return;

  processingId.value = rejectActionId.value;
  try {
    const result = await api.rejectAction(rejectActionId.value, rejectReason.value);
    if (result.success) {
      toast.add({
        title: "Rejected",
        description: "Action has been rejected",
        color: "yellow",
      });
      rejectModalOpen.value = false;
      await fetchPendingActions();
    }
  } catch (error) {
    toast.add({
      title: "Error",
      description: "Failed to reject action",
      color: "red",
    });
  } finally {
    processingId.value = null;
    rejectActionId.value = null;
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function getActionTypeColor(type: string): string {
  const colors: Record<string, string> = {
    create_issue: "blue",
    comment_issue: "cyan",
    create_pr: "purple",
    merge_pr: "green",
    close_issue: "orange",
    notify: "yellow",
  };
  return colors[type] || "gray";
}

onMounted(() => {
  fetchPendingActions();
});

// Listen for WebSocket events
const { onEvent } = useWebSocket();
onEvent("action_pending", () => fetchPendingActions());
onEvent("action_approved", () => fetchPendingActions());
onEvent("action_rejected", () => fetchPendingActions());
</script>
