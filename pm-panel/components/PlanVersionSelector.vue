<template>
  <UDropdown
    :items="dropdownItems"
    :ui="{ item: { disabled: 'cursor-default opacity-100' } }"
    :popper="{ placement: 'bottom-start' }"
  >
    <UBadge
      color="gray"
      variant="soft"
      class="cursor-pointer hover:bg-gray-700 transition-colors"
    >
      v{{ selectedVersion }}
      <UIcon name="i-heroicons-chevron-down" class="w-3 h-3 ml-1" />
    </UBadge>

    <template #item="{ item }">
      <div class="flex items-center justify-between w-full">
        <div class="flex items-center gap-2">
          <span :class="{ 'font-semibold text-white': item.version === selectedVersion }">
            v{{ item.version }}
          </span>
          <span v-if="item.version === currentVersion" class="text-xs text-blue-400">
            (current)
          </span>
        </div>
        <span class="text-xs text-gray-500">
          {{ formatDate(item.createdAt) }}
        </span>
      </div>
    </template>
  </UDropdown>
</template>

<script setup lang="ts">
import type { PlanVersion } from '~/composables/useApi';

const props = defineProps<{
  projectId: string;
  currentVersion: number;
  selectedVersion: number;
}>();

const emit = defineEmits<{
  (e: 'select', version: number): void;
}>();

const { getPlanVersions } = useApi();

const versions = ref<PlanVersion[]>([]);
const loading = ref(false);

// Format date helper
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  });
}

// Load versions
async function loadVersions() {
  if (loading.value) return;

  try {
    loading.value = true;
    versions.value = await getPlanVersions(props.projectId);
  } catch (err) {
    console.error('Failed to load plan versions:', err);
    versions.value = [];
  } finally {
    loading.value = false;
  }
}

// Build dropdown items
const dropdownItems = computed(() => {
  if (versions.value.length === 0) {
    return [[{
      label: 'No versions available',
      disabled: true,
    }]];
  }

  return [versions.value.map((v) => ({
    label: `v${v.version}`,
    version: v.version,
    createdAt: v.createdAt,
    click: () => emit('select', v.version),
  }))];
});

// Load on mount
onMounted(loadVersions);

// Reload when projectId changes
watch(() => props.projectId, loadVersions);

// Expose refresh method
defineExpose({
  refresh: loadVersions,
});
</script>
