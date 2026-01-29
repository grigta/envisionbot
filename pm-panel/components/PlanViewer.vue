<template>
  <div class="plan-viewer">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-white flex items-center gap-2">
        <UIcon name="i-heroicons-document-text" class="w-5 h-5 text-blue-400" />
        Project Plan
      </h3>
      <div class="flex items-center gap-2">
        <!-- Version selector -->
        <PlanVersionSelector
          v-if="plan"
          ref="versionSelectorRef"
          :project-id="projectId"
          :current-version="plan.version"
          :selected-version="selectedVersion"
          @select="selectVersion"
        />
        <!-- Viewing old version indicator -->
        <UBadge
          v-if="isViewingOldVersion"
          color="amber"
          variant="soft"
          class="cursor-pointer"
          @click="selectVersion(plan!.version)"
        >
          <UIcon name="i-heroicons-arrow-uturn-left" class="w-3 h-3 mr-1" />
          Back to current
        </UBadge>
        <UButton
          v-if="!isEditing && plan && !isViewingOldVersion"
          size="xs"
          color="gray"
          variant="ghost"
          icon="i-heroicons-pencil-square"
          @click="startEditing"
        >
          Edit
        </UButton>
        <UButton
          v-if="isEditing"
          size="xs"
          color="primary"
          icon="i-heroicons-check"
          :loading="isSaving"
          @click="savePlan"
        >
          Save
        </UButton>
        <UButton
          v-if="isEditing"
          size="xs"
          color="gray"
          variant="ghost"
          icon="i-heroicons-x-mark"
          @click="cancelEditing"
        >
          Cancel
        </UButton>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 text-gray-400 animate-spin" />
    </div>

    <!-- No plan state -->
    <div
      v-else-if="!plan"
      class="bg-[#202020] border border-[#2d2d2d] rounded-xl p-8 text-center"
    >
      <UIcon name="i-heroicons-document-magnifying-glass" class="w-12 h-12 text-gray-500 mx-auto mb-4" />
      <p class="text-gray-400 mb-4">No plan generated yet</p>
      <p class="text-sm text-gray-500">Click "Analyze Project" to generate a development plan</p>
    </div>

    <!-- Plan content -->
    <div v-else class="space-y-4">
      <!-- Old version warning -->
      <UAlert
        v-if="isViewingOldVersion"
        color="amber"
        variant="soft"
        icon="i-heroicons-clock"
        class="mb-4"
      >
        <template #title>
          Viewing version {{ selectedVersion }} of {{ plan.version }}
        </template>
        <template #description>
          This is a historical version. Click "Back to current" to view the latest plan.
        </template>
      </UAlert>

      <!-- Metadata -->
      <div class="flex flex-wrap gap-4 text-sm text-gray-400 mb-4">
        <span class="flex items-center gap-1">
          <UIcon name="i-heroicons-calendar" class="w-4 h-4" />
          Generated: {{ formatDate(plan.generatedAt) }}
        </span>
        <span v-if="plan.updatedAt !== plan.generatedAt" class="flex items-center gap-1">
          <UIcon name="i-heroicons-arrow-path" class="w-4 h-4" />
          Updated: {{ formatDate(plan.updatedAt) }}
        </span>
        <span v-if="plan.analysisSummary" class="flex items-center gap-1">
          <UIcon name="i-heroicons-chart-bar" class="w-4 h-4" />
          {{ plan.analysisSummary }}
        </span>
      </div>

      <!-- Edit mode -->
      <UTextarea
        v-if="isEditing"
        v-model="editableMarkdown"
        :rows="30"
        class="font-mono text-sm"
        placeholder="Plan markdown content..."
      />

      <!-- View mode - Markdown render -->
      <div v-else class="prose prose-invert prose-sm max-w-none plan-content">
        <div v-html="renderedMarkdown" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { marked } from 'marked';
import type { PlanVersion } from '~/composables/useApi';

interface ProjectPlan {
  id: string;
  projectId: string;
  markdown: string;
  version: number;
  generatedAt: number;
  updatedAt: number;
  analysisSummary?: string;
}

const props = defineProps<{
  projectId: string;
}>();

const emit = defineEmits<{
  (e: 'plan-changed'): void;
}>();

const { getProjectPlan, updateProjectPlan, getPlanVersion } = useApi();
const { onEvent } = useWebSocket();

const plan = ref<ProjectPlan | null>(null);
const loading = ref(true);
const isEditing = ref(false);
const isSaving = ref(false);
const editableMarkdown = ref('');

// Version selection state
const selectedVersion = ref(0);
const viewedVersionMarkdown = ref<string | null>(null);
const versionSelectorRef = ref<{ refresh: () => void } | null>(null);

// Computed: are we viewing an old version?
const isViewingOldVersion = computed(() => {
  return plan.value && selectedVersion.value !== plan.value.version;
});

// Select a version to view
async function selectVersion(version: number) {
  if (!plan.value) return;

  selectedVersion.value = version;

  // If selecting current version, clear viewed markdown
  if (version === plan.value.version) {
    viewedVersionMarkdown.value = null;
    return;
  }

  // Load the selected version
  try {
    const versionData = await getPlanVersion(props.projectId, version);
    viewedVersionMarkdown.value = versionData.markdown;
  } catch (err) {
    console.error('Failed to load version:', err);
    viewedVersionMarkdown.value = null;
  }
}

// Render markdown to HTML - use viewed version if available
const renderedMarkdown = computed(() => {
  const markdown = viewedVersionMarkdown.value || plan.value?.markdown;
  if (!markdown) return '';
  return marked(markdown, {
    gfm: true,
    breaks: true,
  });
});

// Format date helper
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Load plan
async function loadPlan() {
  try {
    loading.value = true;
    plan.value = await getProjectPlan(props.projectId);
    // Set selected version to current
    if (plan.value) {
      selectedVersion.value = plan.value.version;
      viewedVersionMarkdown.value = null;
    }
    // Refresh version selector
    versionSelectorRef.value?.refresh();
  } catch {
    plan.value = null;
  } finally {
    loading.value = false;
  }
}

// Start editing
function startEditing() {
  if (!plan.value) return;
  editableMarkdown.value = plan.value.markdown;
  isEditing.value = true;
}

// Cancel editing
function cancelEditing() {
  isEditing.value = false;
  editableMarkdown.value = '';
}

// Save plan
async function savePlan() {
  if (!plan.value) return;

  try {
    isSaving.value = true;
    const updated = await updateProjectPlan(props.projectId, editableMarkdown.value);
    plan.value = updated;
    isEditing.value = false;
    emit('plan-changed');
  } catch (err) {
    console.error('Failed to save plan:', err);
  } finally {
    isSaving.value = false;
  }
}

// Listen for plan updates
onEvent('plan_updated', (event) => {
  const data = event.data as ProjectPlan;
  if (data.projectId !== props.projectId) return;
  plan.value = data;
  // Update selected version to current
  selectedVersion.value = data.version;
  viewedVersionMarkdown.value = null;
  // Refresh version selector to show new version
  versionSelectorRef.value?.refresh();
});

// Initial load
onMounted(loadPlan);

// Reload when projectId changes
watch(() => props.projectId, loadPlan);

// Expose refresh method
defineExpose({
  refresh: loadPlan,
});
</script>

<style scoped>
.plan-viewer {
  @apply bg-[#202020] border border-[#2d2d2d] rounded-xl p-6;
}

.plan-content :deep(h1) {
  @apply text-xl font-bold text-white mt-6 mb-4 first:mt-0;
}

.plan-content :deep(h2) {
  @apply text-lg font-semibold text-white mt-5 mb-3;
}

.plan-content :deep(h3) {
  @apply text-base font-semibold text-gray-200 mt-4 mb-2;
}

.plan-content :deep(p) {
  @apply text-gray-300 mb-3;
}

.plan-content :deep(ul) {
  @apply list-none pl-0 space-y-1 mb-4;
}

.plan-content :deep(li) {
  @apply text-gray-300;
}

/* Checkbox-style list items */
.plan-content :deep(li:has(input[type="checkbox"])) {
  @apply flex items-start gap-2;
}

.plan-content :deep(input[type="checkbox"]) {
  @apply mt-1;
}

/* Completed items */
.plan-content :deep(li:has(input[type="checkbox"]:checked)) {
  @apply text-gray-500 line-through;
}

.plan-content :deep(code) {
  @apply bg-[#2d2d2d] px-1.5 py-0.5 rounded text-sm text-cyan-400;
}

.plan-content :deep(pre) {
  @apply bg-[#2d2d2d] p-4 rounded-lg overflow-x-auto mb-4;
}

.plan-content :deep(pre code) {
  @apply bg-transparent p-0;
}

.plan-content :deep(hr) {
  @apply border-[#2d2d2d] my-6;
}

.plan-content :deep(a) {
  @apply text-blue-400 hover:text-blue-300 underline;
}

/* Task list checkboxes */
.plan-content :deep(input[type="checkbox"]) {
  @apply w-4 h-4 rounded border-gray-600 bg-transparent text-blue-500 focus:ring-blue-500 focus:ring-offset-0;
}
</style>
