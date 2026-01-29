<template>
  <div class="flex flex-col gap-2">
    <UButton
      :loading="isAnalyzing"
      :disabled="isAnalyzing"
      color="primary"
      size="lg"
      @click="startAnalysis"
    >
      <UIcon name="i-heroicons-magnifying-glass-circle" class="w-5 h-5 mr-2" />
      {{ isAnalyzing ? 'Analyzing...' : 'Analyze Project' }}
    </UButton>

    <!-- Progress indicator -->
    <div v-if="isAnalyzing" class="space-y-2">
      <div class="flex items-center justify-between text-sm">
        <span class="text-gray-400">{{ currentStep || 'Starting...' }}</span>
        <span class="text-gray-500">{{ progress }}%</span>
      </div>
      <UProgress :value="progress" color="primary" size="sm" />
    </div>

    <!-- Error display -->
    <UAlert
      v-if="error"
      color="red"
      variant="soft"
      :title="error"
      icon="i-heroicons-exclamation-triangle"
    />

    <!-- Success message -->
    <UAlert
      v-if="successMessage"
      color="green"
      variant="soft"
      :title="successMessage"
      icon="i-heroicons-check-circle"
    />
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  projectId: string;
}>();

const emit = defineEmits<{
  (e: 'analysis-complete', data: { tasksCreated: number }): void;
  (e: 'plan-updated'): void;
}>();

const { startProjectAnalysis, getAnalysisStatus } = useApi();
const { onEvent } = useWebSocket();

const isAnalyzing = ref(false);
const progress = ref(0);
const currentStep = ref('');
const error = ref('');
const successMessage = ref('');

// Listen to WebSocket events
onEvent('analysis_progress', (event) => {
  const data = event.data as { projectId: string; status: string; progress: number; currentStep?: string; error?: string };
  if (data.projectId !== props.projectId) return;

  progress.value = data.progress;
  currentStep.value = data.currentStep || '';
  error.value = data.error || '';

  if (data.status === 'completed') {
    isAnalyzing.value = false;
    successMessage.value = 'Analysis complete!';
    setTimeout(() => {
      successMessage.value = '';
    }, 5000);
  } else if (data.status === 'failed') {
    isAnalyzing.value = false;
  }
});

onEvent('analysis_completed', (event) => {
  const data = event.data as { projectId: string; tasksCreated: number };
  if (data.projectId !== props.projectId) return;
  emit('analysis-complete', { tasksCreated: data.tasksCreated });
  emit('plan-updated');
});

async function startAnalysis() {
  try {
    isAnalyzing.value = true;
    progress.value = 0;
    currentStep.value = 'Starting analysis...';
    error.value = '';
    successMessage.value = '';

    await startProjectAnalysis(props.projectId);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to start analysis';
    isAnalyzing.value = false;
  }
}

// Check initial status on mount
onMounted(async () => {
  try {
    const status = await getAnalysisStatus(props.projectId);
    if (status && !['idle', 'completed', 'failed'].includes(status.status)) {
      isAnalyzing.value = true;
      progress.value = status.progress;
      currentStep.value = status.currentStep || '';
    }
  } catch {
    // Ignore - status endpoint might not exist for this project
  }
});
</script>
