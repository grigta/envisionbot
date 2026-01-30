<template>
  <div class="w-full max-w-md p-4">
      <!-- Logo -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center gap-3 mb-4">
          <div
            class="w-12 h-12 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center"
          >
            <span class="text-xl font-bold text-white">E</span>
          </div>
          <span class="text-2xl font-bold text-white">Envision CEO</span>
        </div>
        <p class="text-gray-500">Enter your access code to continue</p>
      </div>

      <!-- Login Card -->
      <div class="bg-[#202020] border border-[#2d2d2d] rounded-xl p-8">
        <form @submit.prevent="handleSubmit">
          <!-- Access Code Inputs -->
          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-400 mb-3"
              >Access Code</label
            >
            <div class="flex items-center gap-3 justify-center">
              <input
                ref="input1"
                v-model="code1"
                type="text"
                maxlength="4"
                :disabled="isLoading"
                @input="handleInput(1)"
                @paste="handlePaste"
                @keydown="handleKeydown(1, $event)"
                class="code-input"
                placeholder="XXXX"
                autocomplete="off"
                autocapitalize="characters"
                spellcheck="false"
              />
              <span class="text-gray-600 text-2xl font-light">-</span>
              <input
                ref="input2"
                v-model="code2"
                type="text"
                maxlength="4"
                :disabled="isLoading"
                @input="handleInput(2)"
                @paste="handlePaste"
                @keydown="handleKeydown(2, $event)"
                class="code-input"
                placeholder="XXXX"
                autocomplete="off"
                autocapitalize="characters"
                spellcheck="false"
              />
              <span class="text-gray-600 text-2xl font-light">-</span>
              <input
                ref="input3"
                v-model="code3"
                type="text"
                maxlength="4"
                :disabled="isLoading"
                @input="handleInput(3)"
                @paste="handlePaste"
                @keydown="handleKeydown(3, $event)"
                class="code-input"
                placeholder="XXXX"
                autocomplete="off"
                autocapitalize="characters"
                spellcheck="false"
              />
            </div>
          </div>

          <!-- Error Message -->
          <div
            v-if="authError"
            class="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
          >
            <p class="text-red-400 text-sm text-center">{{ authError }}</p>
          </div>

          <!-- Submit Button -->
          <UButton
            type="submit"
            :loading="isLoading"
            :disabled="!isCodeComplete || isLoading"
            color="primary"
            size="lg"
            block
          >
            {{ isLoading ? "Verifying..." : "Access Panel" }}
          </UButton>
        </form>
      </div>

    <!-- Footer -->
    <p class="text-center text-gray-600 text-sm mt-6">
      Contact your administrator if you need an access code.
    </p>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: "auth",
});

const router = useRouter();
const { login, isLoading, error: authError } = useAuth();

const input1 = ref<HTMLInputElement | null>(null);
const input2 = ref<HTMLInputElement | null>(null);
const input3 = ref<HTMLInputElement | null>(null);

const code1 = ref("");
const code2 = ref("");
const code3 = ref("");

const isCodeComplete = computed(
  () =>
    code1.value.length === 4 &&
    code2.value.length === 4 &&
    code3.value.length === 4
);

const fullCode = computed(
  () => `${code1.value}-${code2.value}-${code3.value}`.toUpperCase()
);

function getInputRef(index: number) {
  return index === 1 ? input1 : index === 2 ? input2 : input3;
}

function handleInput(index: number) {
  const inputs = [code1, code2, code3];
  const current = inputs[index - 1];

  // Filter non-alphanumeric and uppercase
  current.value = current.value.replace(/[^A-Z0-9]/gi, "").toUpperCase();

  // Auto-advance to next input
  if (current.value.length === 4 && index < 3) {
    const nextInput = getInputRef(index + 1);
    nextInput.value?.focus();
  }
}

function handleKeydown(index: number, event: KeyboardEvent) {
  const inputs = [code1, code2, code3];
  const current = inputs[index - 1];

  // Handle backspace at start of input
  if (event.key === "Backspace" && current.value.length === 0 && index > 1) {
    event.preventDefault();
    const prevInput = getInputRef(index - 1);
    prevInput.value?.focus();
  }

  // Handle arrow keys
  if (event.key === "ArrowLeft" && index > 1) {
    const inputEl = getInputRef(index);
    if (inputEl.value?.selectionStart === 0) {
      event.preventDefault();
      const prevInput = getInputRef(index - 1);
      prevInput.value?.focus();
    }
  }
  if (event.key === "ArrowRight" && index < 3) {
    const inputEl = getInputRef(index);
    if (inputEl.value?.selectionEnd === current.value.length) {
      event.preventDefault();
      const nextInput = getInputRef(index + 1);
      nextInput.value?.focus();
    }
  }
}

function handlePaste(event: ClipboardEvent) {
  event.preventDefault();
  const text = event.clipboardData?.getData("text") || "";

  // Clean and normalize pasted text
  const clean = text.replace(/[^A-Z0-9]/gi, "").toUpperCase();

  if (clean.length >= 12) {
    code1.value = clean.slice(0, 4);
    code2.value = clean.slice(4, 8);
    code3.value = clean.slice(8, 12);
    input3.value?.focus();
  } else if (clean.length >= 8) {
    code1.value = clean.slice(0, 4);
    code2.value = clean.slice(4, 8);
    code3.value = clean.slice(8);
    input3.value?.focus();
  } else if (clean.length >= 4) {
    code1.value = clean.slice(0, 4);
    code2.value = clean.slice(4);
    input2.value?.focus();
  } else {
    code1.value = clean;
  }
}

async function handleSubmit() {
  if (!isCodeComplete.value) return;

  const success = await login(fullCode.value);
  if (success) {
    router.push("/");
  }
}

// Auto-focus first input on mount
onMounted(() => {
  input1.value?.focus();
});
</script>

<style scoped>
.code-input {
  @apply w-20 h-14 text-center text-xl font-mono font-bold tracking-widest
         bg-[#2d2d2d] border border-[#404040] rounded-lg text-white
         focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500
         focus:outline-none
         disabled:opacity-50 transition-all
         uppercase;
}

.code-input::placeholder {
  @apply text-gray-600 font-normal;
}
</style>
