<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <UNotifications position="bottom-right" :ui="{ container: 'space-y-2' }" />
</template>

<style>
/* Override Nuxt UI notification styles */
.dark .notification {
  background-color: #2d2d2d;
  border-color: #404040;
}

.light .notification {
  background-color: #ffffff;
  border-color: #e5e7eb;
}
</style>
