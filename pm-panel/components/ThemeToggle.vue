<template>
  <button
    @click="toggleTheme"
    class="p-1.5 rounded-lg transition-colors"
    :class="isDark ? 'text-gray-400 hover:text-white hover:bg-[#2d2d2d]' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'"
    :title="isDark ? 'Switch to light theme' : 'Switch to dark theme'"
  >
    <UIcon
      :name="isDark ? 'i-heroicons-sun' : 'i-heroicons-moon'"
      class="w-5 h-5"
    />
  </button>
</template>

<script setup lang="ts">
const colorMode = useColorMode();

const isDark = computed(() => colorMode.value === 'dark');

function toggleTheme() {
  colorMode.preference = isDark.value ? 'light' : 'dark';
}
</script>
