<template>
  <component
    :is="to ? 'NuxtLink' : 'div'"
    :to="to"
    class="stat-card group"
    :class="{ 'cursor-pointer': to }"
  >
    <div class="flex items-center justify-between mb-3">
      <div
        class="w-8 h-8 rounded-lg flex items-center justify-center"
        :class="iconBgClass"
      >
        <UIcon :name="icon" class="w-4 h-4" :class="iconClass" />
      </div>
      <UIcon
        v-if="to"
        name="i-heroicons-arrow-up-right"
        class="w-4 h-4 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
      />
    </div>
    <div class="text-2xl font-bold text-white mb-1">{{ value }}</div>
    <div class="text-sm text-gray-500">{{ title }}</div>
  </component>
</template>

<script setup lang="ts">
const props = defineProps<{
  title: string;
  value: number | string;
  icon: string;
  color?: "blue" | "cyan" | "purple" | "yellow" | "green" | "red" | "gray";
  to?: string;
}>();

const colorMap = {
  blue: { bg: "bg-blue-500/10", icon: "text-blue-400" },
  cyan: { bg: "bg-cyan-500/10", icon: "text-cyan-400" },
  purple: { bg: "bg-purple-500/10", icon: "text-purple-400" },
  yellow: { bg: "bg-yellow-500/10", icon: "text-yellow-400" },
  green: { bg: "bg-green-500/10", icon: "text-green-400" },
  red: { bg: "bg-red-500/10", icon: "text-red-400" },
  gray: { bg: "bg-gray-500/10", icon: "text-gray-400" },
};

const iconBgClass = computed(() => colorMap[props.color || "gray"].bg);
const iconClass = computed(() => colorMap[props.color || "gray"].icon);
</script>

<style scoped>
.stat-card {
  @apply bg-[#202020] border border-[#2d2d2d] rounded-xl p-4 hover:border-[#404040] transition-colors;
}
</style>
