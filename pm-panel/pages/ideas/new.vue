<template>
  <div class="max-w-2xl mx-auto">
    <!-- Page header -->
    <div class="mb-8">
      <NuxtLink to="/ideas" class="inline-flex items-center gap-1 text-gray-500 hover:text-white text-sm mb-4 transition-colors">
        <UIcon name="i-heroicons-arrow-left" class="w-4 h-4" />
        Back to Ideas
      </NuxtLink>
      <h1 class="text-3xl font-bold text-white mb-2">New Idea</h1>
      <p class="text-gray-500">Describe your project idea and let the agent plan it for you</p>
    </div>

    <!-- Form -->
    <div class="notion-card">
      <div class="space-y-6">
        <!-- Title -->
        <div>
          <input
            v-model="idea.title"
            type="text"
            placeholder="What's your idea?"
            class="w-full bg-transparent text-2xl font-semibold text-white placeholder-gray-600 border-none outline-none focus:ring-0"
          />
        </div>

        <div class="h-px bg-[#2d2d2d]" />

        <!-- Description -->
        <div>
          <textarea
            v-model="idea.description"
            placeholder="Describe your idea in detail...

What problem does it solve?
Who is the target user?
What are the main features?
Any specific technologies you want to use?"
            rows="12"
            class="w-full bg-transparent text-gray-300 placeholder-gray-600 border-none outline-none resize-none focus:ring-0 leading-relaxed"
          />
        </div>
      </div>
    </div>

    <!-- What happens next -->
    <div class="mt-6 p-4 bg-[#202020] border border-[#2d2d2d] rounded-xl">
      <h4 class="text-sm font-medium text-gray-400 mb-3">What happens next?</h4>
      <div class="space-y-3">
        <div class="flex items-start gap-3">
          <div class="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
            <span class="text-xs text-cyan-400 font-medium">1</span>
          </div>
          <p class="text-sm text-gray-400">Agent analyzes your idea and creates an implementation plan</p>
        </div>
        <div class="flex items-start gap-3">
          <div class="w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
            <span class="text-xs text-yellow-400 font-medium">2</span>
          </div>
          <p class="text-sm text-gray-400">You review the plan (tech stack, features, file structure)</p>
        </div>
        <div class="flex items-start gap-3">
          <div class="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
            <span class="text-xs text-blue-400 font-medium">3</span>
          </div>
          <p class="text-sm text-gray-400">Agent creates a GitHub repository for your project</p>
        </div>
        <div class="flex items-start gap-3">
          <div class="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
            <span class="text-xs text-green-400 font-medium">4</span>
          </div>
          <p class="text-sm text-gray-400">Claude Code generates the initial codebase</p>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="mt-6 flex items-center justify-between">
      <NuxtLink to="/ideas">
        <button class="btn-secondary">Cancel</button>
      </NuxtLink>
      <button
        @click="submitIdea"
        :disabled="!idea.title || !idea.description || submitting"
        class="btn-primary"
        :class="{ 'opacity-50 cursor-not-allowed': !idea.title || !idea.description }"
      >
        <UIcon
          :name="submitting ? 'i-heroicons-arrow-path' : 'i-heroicons-light-bulb'"
          :class="{ 'animate-spin': submitting }"
          class="w-4 h-4"
        />
        <span>{{ submitting ? 'Creating...' : 'Create Idea' }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const api = useApi();
const toast = useToast();
const router = useRouter();

const idea = ref({ title: "", description: "" });
const submitting = ref(false);

async function submitIdea() {
  if (!idea.value.title || !idea.value.description) return;

  submitting.value = true;
  try {
    const newIdea = await api.createIdea(idea.value);
    toast.add({ title: "Idea created", color: "green" });
    router.push(`/ideas/${newIdea.id}`);
  } catch {
    toast.add({ title: "Failed to create idea", color: "red" });
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.notion-card {
  @apply bg-[#202020] border border-[#2d2d2d] rounded-xl p-6;
}

.btn-primary {
  @apply flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition-colors;
}

.btn-secondary {
  @apply flex items-center gap-2 px-4 py-2 bg-[#2d2d2d] hover:bg-[#363636] text-white rounded-lg text-sm font-medium transition-colors;
}
</style>
