<template>
  <div class="min-h-screen flex" style="background-color: var(--color-bg-primary); color: var(--color-text-primary);">
    <!-- Sidebar -->
    <aside class="w-60 border-r flex flex-col fixed h-screen" style="background-color: var(--color-bg-primary); border-color: var(--color-border);">
      <!-- Logo -->
      <div class="p-4 border-b h-[57px] flex items-center" style="border-color: var(--color-border);">
        <div class="flex items-center gap-2 w-full">
          <div class="w-6 h-6 bg-gradient-to-br from-cyan-400 to-blue-500 rounded flex items-center justify-center">
            <span class="text-xs font-bold text-white">E</span>
          </div>
          <span class="font-semibold text-white">Envision CEO</span>
          <UBadge v-if="wsConnected" color="green" variant="soft" size="xs">Live</UBadge>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 p-2 space-y-1 overflow-y-auto">
        <NuxtLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ 'nav-item-active': isActive(item.path) }"
        >
          <UIcon :name="item.icon" class="w-4 h-4 opacity-60" />
          <span>{{ item.label }}</span>
          <UBadge
            v-if="item.badge && item.badge > 0"
            :color="item.badgeColor || 'gray'"
            size="xs"
            class="ml-auto"
          >
            {{ item.badge }}
          </UBadge>
        </NuxtLink>

        <!-- Divider -->
        <div class="h-px my-3" style="background-color: var(--color-border);" />

        <!-- Quick Actions -->
        <div class="px-2 py-1">
          <span class="text-xs uppercase tracking-wider" style="color: var(--color-text-muted);">Quick Actions</span>
        </div>
        <button
          @click="showNewIdeaModal = true"
          class="nav-item w-full text-left"
        >
          <UIcon name="i-heroicons-plus" class="w-4 h-4 opacity-60" />
          <span>New Idea</span>
          <kbd class="ml-auto text-[10px] px-1.5 py-0.5 rounded" style="color: var(--color-text-muted); background-color: var(--color-bg-tertiary);">N</kbd>
        </button>
        <button
          @click="runQuickAnalysis"
          :disabled="analysisLoading"
          class="nav-item w-full text-left"
        >
          <UIcon
            :name="analysisLoading ? 'i-heroicons-arrow-path' : 'i-heroicons-sparkles'"
            class="w-4 h-4 opacity-60"
            :class="{ 'animate-spin': analysisLoading }"
          />
          <span>Run Analysis</span>
        </button>
      </nav>

      <!-- User/Status section -->
      <div class="p-3 border-t" style="border-color: var(--color-border);">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 text-sm" style="color: var(--color-text-secondary);">
            <div class="w-2 h-2 rounded-full" :class="wsConnected ? 'bg-green-500' : 'bg-red-500'" />
            <span>{{ authUser?.name || (wsConnected ? 'Connected' : 'Disconnected') }}</span>
          </div>
          <button
            v-if="isAuthenticated"
            @click="handleLogout"
            class="logout-button transition-colors p-1"
            title="Logout"
          >
            <UIcon name="i-heroicons-arrow-right-on-rectangle" class="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>

    <!-- Main content -->
    <main class="flex-1 ml-60">
      <!-- Top bar -->
      <header class="sticky top-0 z-10 backdrop-blur-sm border-b h-[57px]" style="background-color: rgba(var(--color-bg-primary-rgb, 25, 25, 25), 0.8); border-color: var(--color-border);">
        <div class="px-8 h-full flex items-center justify-between">
          <!-- Breadcrumb -->
          <div class="flex items-center gap-2 text-sm">
            <NuxtLink to="/" class="transition-colors" style="color: var(--color-text-muted);">
              Home
            </NuxtLink>
            <template v-if="currentPage">
              <UIcon name="i-heroicons-chevron-right" class="w-3 h-3" style="color: var(--color-text-muted);" />
              <span style="color: var(--color-text-primary);">{{ currentPage }}</span>
            </template>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-2">
            <!-- Theme Toggle -->
            <ThemeToggle />

            <!-- Search (placeholder) -->
            <button
              class="search-button flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors"
            >
              <UIcon name="i-heroicons-magnifying-glass" class="w-4 h-4" />
              <span>Search...</span>
              <kbd class="text-[10px] px-1.5 py-0.5 rounded" style="background-color: var(--color-bg-active);">⌘K</kbd>
            </button>
          </div>
        </div>
      </header>

      <!-- Page content -->
      <div class="p-8">
        <slot />
      </div>
    </main>

    <!-- New Idea Modal -->
    <UModal v-model="showNewIdeaModal">
      <div class="p-6 space-y-4">
        <h3 class="text-lg font-semibold" style="color: var(--color-text-primary);">New Idea</h3>
        <UFormGroup label="Title">
          <UInput
            v-model="newIdea.title"
            placeholder="What's your idea?"
            size="lg"
          />
        </UFormGroup>
        <UFormGroup label="Description">
          <UTextarea
            v-model="newIdea.description"
            placeholder="Describe your idea in detail..."
            :rows="5"
          />
        </UFormGroup>
        <div class="flex justify-end gap-2 pt-2">
          <UButton @click="showNewIdeaModal = false" color="gray" variant="ghost">
            Cancel
          </UButton>
          <UButton @click="createIdea" :loading="creatingIdea" color="primary">
            Create Idea
          </UButton>
        </div>
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
const route = useRoute();
const router = useRouter();
const { connected: wsConnected, events } = useWebSocket();
const api = useApi();
const toast = useToast();
const { user: authUser, isAuthenticated, logout } = useAuth();

async function handleLogout() {
  await logout();
  navigateTo("/login");
}

const activeIdeasCount = ref(0);
const recentEventsCount = computed(() => {
  // Count events from last 5 minutes
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  return events.value.filter((e) => e.timestamp > fiveMinutesAgo).length;
});
const analysisLoading = ref(false);
const showNewIdeaModal = ref(false);
const creatingIdea = ref(false);
const newIdea = ref({ title: "", description: "" });

const navItems = computed(() => [
  { path: "/", label: "Dashboard", icon: "i-heroicons-home" },
  { path: "/chat", label: "Chat", icon: "i-heroicons-chat-bubble-left-right" },
  { path: "/news", label: "News", icon: "i-heroicons-newspaper" },
  { path: "/crawler", label: "Crawler", icon: "i-heroicons-globe-alt" },
  { path: "/competitors", label: "Competitors", icon: "i-heroicons-chart-bar-square" },
  { path: "/activity", label: "Activity", icon: "i-heroicons-bolt", badge: recentEventsCount.value, badgeColor: "cyan" },
  { path: "/ideas", label: "Ideas", icon: "i-heroicons-light-bulb", badge: activeIdeasCount.value, badgeColor: "yellow" },
  { path: "/projects", label: "Projects", icon: "i-heroicons-folder" },
  { path: "/tasks", label: "Tasks", icon: "i-heroicons-clipboard-document-list" },
  { path: "/reports", label: "Reports", icon: "i-heroicons-chart-bar" },
  { path: "/settings", label: "Settings", icon: "i-heroicons-cog-6-tooth" },
]);

const currentPage = computed(() => {
  const item = navItems.value.find((i) => isActive(i.path));
  return item?.label;
});

function isActive(path: string): boolean {
  if (path === "/") return route.path === "/";
  return route.path.startsWith(path);
}

async function fetchCounts() {
  try {
    const stats = await api.getStats();
    activeIdeasCount.value = stats.activeIdeasCount || 0;
  } catch {
    // Ignore errors
  }
}

async function runQuickAnalysis() {
  analysisLoading.value = true;
  try {
    await api.runHealthCheck();
    toast.add({ title: "Analysis started", color: "green" });
  } catch {
    toast.add({ title: "Failed to start analysis", color: "red" });
  } finally {
    analysisLoading.value = false;
  }
}

async function createIdea() {
  if (!newIdea.value.title) return;
  creatingIdea.value = true;
  try {
    const idea = await api.createIdea(newIdea.value);
    toast.add({ title: "Idea created", color: "green" });
    showNewIdeaModal.value = false;
    newIdea.value = { title: "", description: "" };
    router.push(`/ideas/${idea.id}`);
  } catch {
    toast.add({ title: "Failed to create idea", color: "red" });
  } finally {
    creatingIdea.value = false;
  }
}

// Keyboard shortcut for new idea
onMounted(() => {
  fetchCounts();
  const interval = setInterval(fetchCounts, 30000);

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === "n" && !e.metaKey && !e.ctrlKey && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
      e.preventDefault();
      showNewIdeaModal.value = true;
    }
  };
  window.addEventListener("keydown", handleKeydown);

  onUnmounted(() => {
    clearInterval(interval);
    window.removeEventListener("keydown", handleKeydown);
  });
});
</script>

<style>
.nav-item {
  @apply flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-all duration-150 cursor-pointer;
  color: var(--color-text-secondary);
}

.nav-item:hover {
  color: var(--color-text-primary);
  background-color: var(--color-bg-tertiary);
}

.nav-item-active {
  color: var(--color-text-primary);
  background-color: var(--color-bg-tertiary);
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--color-bg-active);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #505050;
}

.logout-button {
  color: var(--color-text-muted);
}

.logout-button:hover {
  color: var(--color-text-primary);
}

.search-button {
  background-color: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
}

.search-button:hover {
  background-color: var(--color-bg-hover);
}
</style>
