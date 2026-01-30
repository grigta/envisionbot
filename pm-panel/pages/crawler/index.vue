<template>
  <div class="max-w-5xl">
    <!-- Page header -->
    <div class="mb-8">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-white">Crawler Sources</h1>
          <p class="text-gray-500 text-sm mt-1">Manage AI-powered web crawling sources</p>
        </div>
        <UButton
          @click="showAddModal = true"
          color="primary"
          icon="i-heroicons-plus"
        >
          Add Source
        </UButton>
      </div>
    </div>

    <!-- Stats -->
    <div v-if="stats" class="grid grid-cols-4 gap-4 mb-6">
      <div class="bg-[#1e1e1e] border border-[#2d2d2d] rounded-xl p-4">
        <div class="text-2xl font-bold text-white">{{ stats.totalSources }}</div>
        <div class="text-sm text-gray-500">Total Sources</div>
      </div>
      <div class="bg-[#1e1e1e] border border-[#2d2d2d] rounded-xl p-4">
        <div class="text-2xl font-bold text-green-400">{{ stats.enabledSources }}</div>
        <div class="text-sm text-gray-500">Enabled</div>
      </div>
      <div class="bg-[#1e1e1e] border border-[#2d2d2d] rounded-xl p-4">
        <div class="text-2xl font-bold text-cyan-400">{{ stats.totalItems }}</div>
        <div class="text-sm text-gray-500">Total Items</div>
      </div>
      <div class="bg-[#1e1e1e] border border-[#2d2d2d] rounded-xl p-4">
        <div class="text-2xl font-bold text-purple-400">{{ stats.processedItems }}</div>
        <div class="text-sm text-gray-500">Processed</div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="animate-pulse bg-[#2d2d2d] rounded-xl h-24" />
    </div>

    <!-- Empty state -->
    <div v-else-if="sources.length === 0" class="text-center py-12">
      <UIcon name="i-heroicons-globe-alt" class="w-12 h-12 text-gray-600 mx-auto mb-4" />
      <p class="text-gray-500">No crawler sources yet</p>
      <UButton @click="showAddModal = true" color="primary" class="mt-4">
        Add First Source
      </UButton>
    </div>

    <!-- Sources list -->
    <div v-else class="space-y-3">
      <div
        v-for="source in sources"
        :key="source.id"
        class="bg-[#1e1e1e] border border-[#2d2d2d] rounded-xl p-4"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="flex items-center gap-3 mb-2">
              <h3 class="font-medium text-white">{{ source.name }}</h3>
              <span
                class="px-2 py-0.5 rounded text-xs"
                :class="source.isEnabled ? 'bg-green-900/50 text-green-300' : 'bg-gray-700 text-gray-400'"
              >
                {{ source.isEnabled ? 'Enabled' : 'Disabled' }}
              </span>
              <span
                v-if="source.lastCrawlStatus"
                class="px-2 py-0.5 rounded text-xs"
                :class="source.lastCrawlStatus === 'success' ? 'bg-cyan-900/50 text-cyan-300' : 'bg-red-900/50 text-red-300'"
              >
                {{ source.lastCrawlStatus === 'success' ? `${source.lastCrawlItemCount} items` : 'Error' }}
              </span>
              <span v-if="source.requiresBrowser" class="px-2 py-0.5 rounded text-xs bg-purple-900/50 text-purple-300">
                Browser
              </span>
            </div>
            <p class="text-sm text-gray-500 mb-2 truncate">{{ source.url }}</p>
            <p v-if="source.prompt" class="text-sm text-gray-600 line-clamp-1">{{ source.prompt }}</p>
            <div class="flex items-center gap-4 mt-3 text-xs text-gray-600">
              <span>Every {{ source.crawlIntervalHours }}h</span>
              <span v-if="source.lastCrawlAt">Last: {{ formatDate(source.lastCrawlAt) }}</span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <UButton
              @click="runCrawl(source)"
              :loading="crawlingId === source.id"
              color="gray"
              variant="ghost"
              icon="i-heroicons-play"
              size="sm"
            />
            <UButton
              @click="editSource(source)"
              color="gray"
              variant="ghost"
              icon="i-heroicons-pencil"
              size="sm"
            />
            <UButton
              @click="confirmDelete(source)"
              color="red"
              variant="ghost"
              icon="i-heroicons-trash"
              size="sm"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <UModal v-model="showAddModal" :ui="{ width: 'sm:max-w-xl' }">
      <div class="p-6">
        <h3 class="text-lg font-medium text-white mb-4">
          {{ editingSource ? 'Edit Source' : 'Add Crawler Source' }}
        </h3>

        <div class="space-y-4">
          <UFormGroup label="Name">
            <UInput v-model="form.name" placeholder="Product Hunt AI" />
          </UFormGroup>

          <UFormGroup label="URL">
            <UInput v-model="form.url" placeholder="https://producthunt.com/topics/ai" />
          </UFormGroup>

          <UFormGroup label="Extraction Prompt" hint="Describe what to extract">
            <UTextarea
              v-model="form.prompt"
              :rows="3"
              placeholder="Extract list of products: title, description, upvotes, URL"
            />
          </UFormGroup>

          <div class="grid grid-cols-2 gap-4">
            <UFormGroup label="Crawl Interval (hours)">
              <UInput v-model.number="form.crawlIntervalHours" type="number" min="1" />
            </UFormGroup>

            <UFormGroup label="Options">
              <div class="flex flex-col gap-2 mt-2">
                <UCheckbox v-model="form.requiresBrowser" label="Requires browser (JS rendering)" />
                <UCheckbox v-model="form.isEnabled" label="Enabled" />
              </div>
            </UFormGroup>
          </div>

          <!-- Test result -->
          <div v-if="testResult" class="p-3 rounded-lg" :class="testResult.success ? 'bg-green-900/20 border border-green-800' : 'bg-red-900/20 border border-red-800'">
            <div class="flex items-center gap-2 mb-2">
              <UIcon :name="testResult.success ? 'i-heroicons-check-circle' : 'i-heroicons-x-circle'" :class="testResult.success ? 'text-green-400' : 'text-red-400'" />
              <span :class="testResult.success ? 'text-green-300' : 'text-red-300'">
                {{ testResult.success ? `Found ${testResult.itemCount} items` : testResult.error }}
              </span>
            </div>
            <div v-if="testResult.items?.length" class="text-sm text-gray-400 space-y-1">
              <div v-for="item in testResult.items.slice(0, 3)" :key="item.id" class="truncate">
                {{ item.title }}
              </div>
            </div>
          </div>
        </div>

        <div class="flex justify-between mt-6">
          <UButton
            @click="testSource"
            :loading="testing"
            color="gray"
            variant="outline"
          >
            Test URL
          </UButton>
          <div class="flex gap-2">
            <UButton @click="closeModal" color="gray" variant="ghost">Cancel</UButton>
            <UButton @click="saveSource" :loading="saving" color="primary">
              {{ editingSource ? 'Save' : 'Create' }}
            </UButton>
          </div>
        </div>
      </div>
    </UModal>

    <!-- Delete confirmation -->
    <UModal v-model="showDeleteModal">
      <div class="p-6">
        <h3 class="text-lg font-medium text-white mb-2">Delete Source</h3>
        <p class="text-gray-400 mb-4">
          Are you sure you want to delete "{{ deletingSource?.name }}"? This will also delete all crawled items from this source.
        </p>
        <div class="flex justify-end gap-2">
          <UButton @click="showDeleteModal = false" color="gray" variant="ghost">Cancel</UButton>
          <UButton @click="deleteSource" :loading="deleting" color="red">Delete</UButton>
        </div>
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { CrawlerSource, CrawlerTestResult, CrawlerStats } from "~/composables/useApi";

const api = useApi();
const toast = useToast();

const sources = ref<CrawlerSource[]>([]);
const stats = ref<CrawlerStats | null>(null);
const loading = ref(true);
const crawlingId = ref<string | null>(null);

// Modal state
const showAddModal = ref(false);
const showDeleteModal = ref(false);
const editingSource = ref<CrawlerSource | null>(null);
const deletingSource = ref<CrawlerSource | null>(null);
const testing = ref(false);
const saving = ref(false);
const deleting = ref(false);
const testResult = ref<CrawlerTestResult | null>(null);

// Form
const form = ref({
  name: "",
  url: "",
  prompt: "",
  crawlIntervalHours: 24,
  requiresBrowser: false,
  isEnabled: true,
});

function resetForm() {
  form.value = {
    name: "",
    url: "",
    prompt: "",
    crawlIntervalHours: 24,
    requiresBrowser: false,
    isEnabled: true,
  };
  testResult.value = null;
  editingSource.value = null;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

async function fetchData() {
  loading.value = true;
  try {
    const [sourcesData, statsData] = await Promise.all([
      api.getCrawlerSources(),
      api.getCrawlerStats(),
    ]);
    sources.value = sourcesData;
    stats.value = statsData;
  } catch (error) {
    console.error("Failed to fetch data:", error);
    toast.add({ title: "Failed to fetch data", color: "red" });
  } finally {
    loading.value = false;
  }
}

async function testSource() {
  if (!form.value.url) {
    toast.add({ title: "URL is required", color: "red" });
    return;
  }

  testing.value = true;
  testResult.value = null;

  try {
    testResult.value = await api.testCrawlerSource({
      url: form.value.url,
      prompt: form.value.prompt || undefined,
      requiresBrowser: form.value.requiresBrowser,
    });
  } catch (error) {
    testResult.value = { success: false, error: error instanceof Error ? error.message : "Test failed" };
  } finally {
    testing.value = false;
  }
}

async function saveSource() {
  if (!form.value.name || !form.value.url) {
    toast.add({ title: "Name and URL are required", color: "red" });
    return;
  }

  saving.value = true;

  try {
    if (editingSource.value) {
      await api.updateCrawlerSource(editingSource.value.id, {
        name: form.value.name,
        url: form.value.url,
        prompt: form.value.prompt || undefined,
        crawlIntervalHours: form.value.crawlIntervalHours,
        requiresBrowser: form.value.requiresBrowser,
        isEnabled: form.value.isEnabled,
      });
      toast.add({ title: "Source updated", color: "green" });
    } else {
      await api.createCrawlerSource({
        name: form.value.name,
        url: form.value.url,
        prompt: form.value.prompt || undefined,
        crawlIntervalHours: form.value.crawlIntervalHours,
        requiresBrowser: form.value.requiresBrowser,
      });
      toast.add({ title: "Source created", color: "green" });
    }

    closeModal();
    fetchData();
  } catch (error) {
    toast.add({ title: "Failed to save source", color: "red" });
  } finally {
    saving.value = false;
  }
}

function editSource(source: CrawlerSource) {
  editingSource.value = source;
  form.value = {
    name: source.name,
    url: source.url,
    prompt: source.prompt || "",
    crawlIntervalHours: source.crawlIntervalHours,
    requiresBrowser: source.requiresBrowser,
    isEnabled: source.isEnabled,
  };
  testResult.value = null;
  showAddModal.value = true;
}

function confirmDelete(source: CrawlerSource) {
  deletingSource.value = source;
  showDeleteModal.value = true;
}

async function deleteSource() {
  if (!deletingSource.value) return;

  deleting.value = true;

  try {
    await api.deleteCrawlerSource(deletingSource.value.id);
    toast.add({ title: "Source deleted", color: "green" });
    showDeleteModal.value = false;
    fetchData();
  } catch (error) {
    toast.add({ title: "Failed to delete source", color: "red" });
  } finally {
    deleting.value = false;
  }
}

async function runCrawl(source: CrawlerSource) {
  crawlingId.value = source.id;

  try {
    const result = await api.runCrawlerSource(source.id);
    toast.add({ title: `Crawl complete: ${result.itemCount} items`, color: "green" });
    fetchData();
  } catch (error) {
    toast.add({ title: "Crawl failed", color: "red" });
  } finally {
    crawlingId.value = null;
  }
}

function closeModal() {
  showAddModal.value = false;
  resetForm();
}

onMounted(fetchData);
</script>
