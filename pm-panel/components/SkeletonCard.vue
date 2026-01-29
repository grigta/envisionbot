<template>
  <div class="notion-card">
    <div v-if="type === 'stat'" class="space-y-3">
      <div class="flex items-center justify-between">
        <div class="skeleton w-8 h-8 rounded-lg" />
      </div>
      <div class="skeleton h-8 w-16" />
      <div class="skeleton h-4 w-24" />
    </div>

    <div v-else-if="type === 'idea'" class="space-y-3">
      <div class="flex items-start gap-3">
        <div class="skeleton w-10 h-10 rounded-lg flex-shrink-0" />
        <div class="flex-1 space-y-2">
          <div class="skeleton h-5 w-3/4" />
          <div class="skeleton h-4 w-full" />
          <div class="skeleton h-4 w-2/3" />
        </div>
      </div>
      <div class="flex gap-2 pt-2">
        <div class="skeleton h-6 w-16 rounded-lg" />
        <div class="skeleton h-6 w-16 rounded-lg" />
        <div class="skeleton h-6 w-16 rounded-lg" />
      </div>
    </div>

    <div v-else-if="type === 'project'" class="space-y-3">
      <div class="flex items-center gap-3">
        <div class="skeleton w-10 h-10 rounded-xl" />
        <div class="flex-1 space-y-2">
          <div class="skeleton h-5 w-1/2" />
          <div class="skeleton h-4 w-1/3" />
        </div>
        <div class="skeleton h-6 w-20 rounded" />
      </div>
    </div>

    <div v-else-if="type === 'task'" class="flex items-center gap-3">
      <div class="skeleton w-5 h-5 rounded" />
      <div class="flex-1 space-y-2">
        <div class="skeleton h-4 w-3/4" />
        <div class="skeleton h-3 w-1/2" />
      </div>
      <div class="skeleton h-6 w-16 rounded" />
    </div>

    <div v-else class="space-y-3">
      <div class="skeleton skeleton-title" />
      <div class="skeleton skeleton-text" />
      <div class="skeleton skeleton-text w-4/5" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  type?: "stat" | "idea" | "project" | "task" | "default";
}>();
</script>
