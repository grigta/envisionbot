<template>
  <div class="relative">
    <!-- Mention Autocomplete Dropdown -->
    <Transition name="dropdown">
      <div
        v-if="showMentions && filteredMentions.length > 0"
        class="absolute bottom-full left-0 w-full bg-[#2d2d2d] rounded-lg shadow-lg mb-2 max-h-64 overflow-y-auto border border-[#404040] z-50"
      >
        <div class="p-2 text-xs text-gray-500 border-b border-[#404040]">
          Select a project or repository
        </div>
        <div class="py-1">
          <button
            v-for="(item, index) in filteredMentions"
            :key="item.id"
            @click="selectMention(item)"
            @mouseenter="selectedIndex = index"
            class="w-full px-3 py-2 text-left flex items-center gap-3 transition-colors"
            :class="index === selectedIndex ? 'bg-[#404040]' : 'hover:bg-[#363636]'"
          >
            <div
              class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              :class="item.type === 'project' ? 'bg-cyan-500/20' : 'bg-purple-500/20'"
            >
              <UIcon
                :name="item.icon"
                class="w-4 h-4"
                :class="item.type === 'project' ? 'text-cyan-400' : 'text-purple-400'"
              />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-white font-medium truncate">{{ item.label }}</div>
              <div class="text-xs text-gray-500 truncate">{{ item.description }}</div>
            </div>
            <span
              class="text-xs px-2 py-0.5 rounded"
              :class="item.type === 'project' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-purple-500/20 text-purple-400'"
            >
              {{ item.type === 'project' ? 'Project' : 'Repo' }}
            </span>
          </button>
        </div>
        <div class="p-2 text-xs text-gray-600 border-t border-[#404040]">
          <span class="text-gray-500">↑↓</span> navigate
          <span class="mx-2">•</span>
          <span class="text-gray-500">↵</span> select
          <span class="mx-2">•</span>
          <span class="text-gray-500">esc</span> close
        </div>
      </div>
    </Transition>

    <!-- Input Container -->
    <div class="flex items-center gap-3 bg-[#202020] rounded-xl border border-[#2d2d2d] px-4 py-3 focus-within:border-cyan-500/50 transition-colors min-h-[52px]">
      <textarea
        ref="textareaRef"
        v-model="localInput"
        @input="handleInput"
        @keydown="handleKeydown"
        @blur="handleBlur"
        :disabled="disabled"
        :placeholder="placeholder"
        rows="1"
        class="flex-1 bg-transparent text-white placeholder-gray-500 resize-none outline-none border-none ring-0 focus:ring-0 focus:outline-none text-sm leading-6 max-h-32 overflow-y-auto"
        :class="{ 'opacity-50 cursor-not-allowed': disabled }"
      />
      <button
        @click="submit"
        :disabled="disabled || !localInput.trim()"
        class="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-all"
        :class="
          disabled || !localInput.trim()
            ? 'bg-[#2d2d2d] text-gray-600 cursor-not-allowed'
            : 'bg-cyan-600 hover:bg-cyan-500 text-white'
        "
      >
        <UIcon v-if="disabled" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
        <UIcon v-else name="i-heroicons-paper-airplane" class="w-4 h-4" />
      </button>
    </div>

    <!-- Hint -->
    <div class="mt-2 text-xs text-gray-600 flex items-center gap-2">
      <span>Type <code class="px-1 py-0.5 bg-[#2d2d2d] rounded">@</code> to mention projects or repos</span>
      <span class="text-gray-700">•</span>
      <span><code class="px-1 py-0.5 bg-[#2d2d2d] rounded">Shift+Enter</code> for new line</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Mentionable } from "~/composables/useMentions";

const props = defineProps<{
  modelValue: string;
  disabled?: boolean;
  placeholder?: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
  (e: "send"): void;
}>();

const {
  mentionables,
  loadMentionables,
  filterMentions,
  findMentionTrigger,
  insertMention,
} = useMentions();

const textareaRef = ref<HTMLTextAreaElement | null>(null);
const localInput = ref(props.modelValue);
const showMentions = ref(false);
const mentionQuery = ref("");
const selectedIndex = ref(0);

const filteredMentions = computed(() => {
  return filterMentions(mentionQuery.value).slice(0, 8);
});

// Sync with modelValue
watch(
  () => props.modelValue,
  (val) => {
    localInput.value = val;
  }
);

watch(localInput, (val) => {
  emit("update:modelValue", val);
  autoResize();
});

function handleInput() {
  if (!textareaRef.value) return;

  const cursorPos = textareaRef.value.selectionStart;
  const trigger = findMentionTrigger(localInput.value, cursorPos);

  if (trigger) {
    showMentions.value = true;
    mentionQuery.value = trigger.query;
    selectedIndex.value = 0;
  } else {
    showMentions.value = false;
    mentionQuery.value = "";
  }
}

function handleKeydown(e: KeyboardEvent) {
  // Handle mention navigation
  if (showMentions.value && filteredMentions.value.length > 0) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIndex.value = (selectedIndex.value + 1) % filteredMentions.value.length;
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIndex.value =
        selectedIndex.value === 0
          ? filteredMentions.value.length - 1
          : selectedIndex.value - 1;
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      selectMention(filteredMentions.value[selectedIndex.value]);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      showMentions.value = false;
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      selectMention(filteredMentions.value[selectedIndex.value]);
      return;
    }
  }

  // Submit on Enter (without Shift)
  if (e.key === "Enter" && !e.shiftKey && !showMentions.value) {
    e.preventDefault();
    submit();
  }
}

function handleBlur() {
  // Delay hiding to allow click on mention item
  setTimeout(() => {
    showMentions.value = false;
  }, 200);
}

function selectMention(mention: Mentionable) {
  if (!textareaRef.value) return;

  const cursorPos = textareaRef.value.selectionStart;
  const { newText, newCursorPosition } = insertMention(
    localInput.value,
    cursorPos,
    mention
  );

  localInput.value = newText;
  showMentions.value = false;
  mentionQuery.value = "";

  // Set cursor position after Vue updates the DOM
  nextTick(() => {
    if (textareaRef.value) {
      textareaRef.value.focus();
      textareaRef.value.setSelectionRange(newCursorPosition, newCursorPosition);
    }
  });
}

function submit() {
  if (props.disabled || !localInput.value.trim()) return;
  emit("send");
}

function autoResize() {
  if (!textareaRef.value) return;
  textareaRef.value.style.height = "auto";
  textareaRef.value.style.height = `${Math.min(textareaRef.value.scrollHeight, 128)}px`;
}

// Load mentionables on mount
onMounted(() => {
  loadMentionables();
});
</script>

<style scoped>
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

textarea {
  scrollbar-width: thin;
  scrollbar-color: #404040 transparent;
}
</style>
