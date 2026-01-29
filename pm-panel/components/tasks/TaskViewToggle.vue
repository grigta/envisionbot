<template>
  <div class="flex items-center bg-[#2d2d2d] rounded-lg p-1">
    <button
      @click="$emit('update:modelValue', 'list')"
      class="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors"
      :class="modelValue === 'list' ? 'bg-[#404040] text-white' : 'text-gray-400 hover:text-white'"
    >
      <UIcon name="i-heroicons-list-bullet" class="w-4 h-4" />
      List
    </button>
    <button
      @click="$emit('update:modelValue', 'kanban')"
      class="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors"
      :class="modelValue === 'kanban' ? 'bg-[#404040] text-white' : 'text-gray-400 hover:text-white'"
    >
      <UIcon name="i-heroicons-view-columns" class="w-4 h-4" />
      Kanban
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: "list" | "kanban";
}>();

defineEmits<{
  (e: "update:modelValue", value: "list" | "kanban"): void;
}>();
</script>
