<template>
  <span
    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
    :class="statusClass"
  >
    {{ label }}
  </span>
</template>

<script setup lang="ts">
const props = defineProps<{
  status: string;
}>();

const statusConfig: Record<string, { label: string; class: string }> = {
  submitted: { label: "Submitted", class: "bg-gray-500/20 text-gray-400" },
  planning: { label: "Planning", class: "bg-cyan-500/20 text-cyan-400" },
  plan_ready: { label: "Plan Ready", class: "bg-yellow-500/20 text-yellow-400" },
  approved: { label: "Approved", class: "bg-blue-500/20 text-blue-400" },
  creating_repo: { label: "Creating Repo", class: "bg-purple-500/20 text-purple-400" },
  generating: { label: "Generating", class: "bg-purple-500/20 text-purple-400" },
  completed: { label: "Completed", class: "bg-green-500/20 text-green-400" },
  failed: { label: "Failed", class: "bg-red-500/20 text-red-400" },
  pending: { label: "Pending", class: "bg-gray-500/20 text-gray-400" },
  in_progress: { label: "In Progress", class: "bg-cyan-500/20 text-cyan-400" },
  // Project phases
  idea: { label: "Idea", class: "bg-gray-500/20 text-gray-400" },
  mvp: { label: "MVP", class: "bg-cyan-500/20 text-cyan-400" },
  beta: { label: "Beta", class: "bg-yellow-500/20 text-yellow-400" },
  launch: { label: "Launch", class: "bg-green-500/20 text-green-400" },
  growth: { label: "Growth", class: "bg-purple-500/20 text-purple-400" },
  maintenance: { label: "Maintenance", class: "bg-orange-500/20 text-orange-400" },
};

const label = computed(() => statusConfig[props.status]?.label || props.status);
const statusClass = computed(() => statusConfig[props.status]?.class || "bg-gray-500/20 text-gray-400");
</script>
