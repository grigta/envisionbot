<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-white">Reports</h1>
        <p class="text-gray-500 text-sm">Analysis reports and findings</p>
      </div>
      <button @click="fetchReports" :disabled="loading" class="btn btn-secondary">
        <UIcon :name="loading ? 'i-heroicons-arrow-path' : 'i-heroicons-arrow-path'" :class="{'animate-spin': loading}" class="w-4 h-4" />
        Refresh
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <div class="flex flex-col items-center gap-3">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-cyan-400" />
        <span class="text-gray-500 text-sm">Loading reports...</span>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="reports.length === 0" class="empty-state">
      <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mb-4">
        <UIcon name="i-heroicons-document-chart-bar" class="w-8 h-8 text-purple-400" />
      </div>
      <h2 class="empty-state-title">No reports yet</h2>
      <p class="empty-state-description">Reports will appear here after running health checks or deep analysis.</p>
    </div>

    <!-- Reports List -->
    <div v-else class="space-y-4">
      <div
        v-for="report in reports"
        :key="report.id"
        class="notion-card notion-card-interactive cursor-pointer"
        @click="toggleReport(report.id)"
      >
        <div class="space-y-3">
          <!-- Header -->
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" :class="getTypeBgClass(report.type)">
                <UIcon :name="getTypeIcon(report.type)" class="w-5 h-5" :class="getTypeIconClass(report.type)" />
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <span class="badge" :class="getTypeBadgeClass(report.type)">
                    {{ formatType(report.type) }}
                  </span>
                  <span class="text-sm text-gray-500">
                    {{ formatDate(report.startedAt) }}
                  </span>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span v-if="report.findings.length > 0" class="badge badge-yellow">
                {{ report.findings.length }} findings
              </span>
              <span v-if="report.generatedTasks.length > 0" class="badge badge-cyan">
                {{ report.generatedTasks.length }} tasks
              </span>
              <button
                @click.stop="handleDelete(report.id)"
                class="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors"
                title="Delete report"
              >
                <UIcon name="i-heroicons-trash" class="w-4 h-4" />
              </button>
              <UIcon
                :name="expandedReport === report.id ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
                class="w-5 h-5 text-gray-500"
              />
            </div>
          </div>

          <!-- Summary Preview -->
          <p class="text-gray-400 text-sm">{{ report.summary.slice(0, 200) }}{{ report.summary.length > 200 ? '...' : '' }}</p>

          <!-- Expanded Content -->
          <Transition name="slide-up">
            <div v-if="expandedReport === report.id" class="pt-4 border-t border-[#2d2d2d] space-y-4">
              <!-- Full Summary -->
              <div>
                <h4 class="font-semibold text-white mb-2 text-sm uppercase tracking-wider">Full Summary</h4>
                <p class="text-gray-300 whitespace-pre-wrap text-sm">{{ report.summary }}</p>
              </div>

              <!-- Project Reports -->
              <div v-if="report.projectReports && report.projectReports.length > 0">
                <h4 class="font-semibold text-white mb-3 text-sm uppercase tracking-wider">Project Status</h4>
                <div class="grid gap-3">
                  <div
                    v-for="proj in report.projectReports"
                    :key="proj.projectId"
                    class="p-4 rounded-lg bg-[#191919]"
                  >
                    <div class="flex items-center justify-between mb-3">
                      <span class="font-medium text-white">{{ proj.projectName }}</span>
                      <div class="flex items-center gap-2">
                        <span class="badge" :class="getHealthScoreBadgeClass(proj.healthScore)">
                          {{ proj.healthScore }}/100
                        </span>
                        <span class="badge" :class="getCiStatusBadgeClass(proj.ciStatus)">
                          <UIcon :name="getCiStatusIcon(proj.ciStatus)" class="w-3 h-3 mr-1" />
                          {{ proj.ciStatus }}
                        </span>
                      </div>
                    </div>
                    <div class="flex items-center gap-4 text-sm text-gray-400">
                      <div class="flex items-center gap-1">
                        <UIcon name="i-heroicons-exclamation-circle" class="w-4 h-4" />
                        {{ proj.openIssues }} issues
                      </div>
                      <div class="flex items-center gap-1">
                        <UIcon name="i-heroicons-arrow-path-rounded-square" class="w-4 h-4" />
                        {{ proj.openPRs }} PRs
                      </div>
                    </div>
                    <div v-if="proj.risks && proj.risks.length > 0" class="mt-3 pt-3 border-t border-[#2d2d2d]">
                      <div class="text-xs text-gray-500 uppercase tracking-wider mb-2">Risks</div>
                      <ul class="space-y-1">
                        <li v-for="(risk, i) in proj.risks" :key="i" class="text-sm text-yellow-400 flex items-start gap-2">
                          <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4 flex-shrink-0 mt-0.5" />
                          {{ risk }}
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Findings -->
              <div v-if="report.findings.length > 0">
                <h4 class="font-semibold text-white mb-2 text-sm uppercase tracking-wider">Findings</h4>
                <div class="space-y-2">
                  <div
                    v-for="(finding, index) in report.findings"
                    :key="index"
                    class="p-3 rounded-lg bg-[#191919]"
                  >
                    <div class="flex items-center gap-2 mb-1">
                      <span class="badge" :class="getSeverityBadgeClass(finding.severity)">
                        {{ finding.severity }}
                      </span>
                      <span class="text-sm text-gray-500">{{ finding.category }}</span>
                    </div>
                    <div class="font-medium text-white text-sm">{{ finding.title }}</div>
                    <div class="text-sm text-gray-400 mt-1">{{ finding.description }}</div>
                  </div>
                </div>
              </div>

              <!-- Metadata -->
              <div class="text-xs text-gray-500 space-y-1 pt-2 border-t border-[#2d2d2d]">
                <div class="flex items-center gap-2">
                  <UIcon name="i-heroicons-folder" class="w-3.5 h-3.5" />
                  Projects: {{ report.projectIds.join(', ') || 'None' }}
                </div>
                <div class="flex items-center gap-2">
                  <UIcon name="i-heroicons-clock" class="w-3.5 h-3.5" />
                  Started: {{ formatDate(report.startedAt) }}
                </div>
                <div v-if="report.completedAt" class="flex items-center gap-2">
                  <UIcon name="i-heroicons-check-circle" class="w-3.5 h-3.5 text-green-500" />
                  Completed: {{ formatDate(report.completedAt) }}
                </div>
                <div class="flex items-center gap-2">
                  <UIcon name="i-heroicons-clipboard-document-list" class="w-3.5 h-3.5" />
                  Tasks generated: {{ report.generatedTasks.length }}
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AnalysisReport } from "~/composables/useApi";

const api = useApi();
const toast = useToast();

const reports = ref<AnalysisReport[]>([]);
const loading = ref(true);
const expandedReport = ref<string | null>(null);

async function fetchReports() {
  loading.value = true;
  try {
    reports.value = await api.getReports();
  } catch {
    toast.add({
      title: "Error",
      description: "Failed to fetch reports",
      color: "red",
    });
  } finally {
    loading.value = false;
  }
}

function toggleReport(id: string) {
  expandedReport.value = expandedReport.value === id ? null : id;
}

async function handleDelete(id: string) {
  try {
    await api.deleteReport(id);
    reports.value = reports.value.filter((r) => r.id !== id);
    if (expandedReport.value === id) {
      expandedReport.value = null;
    }
    toast.add({
      title: "Deleted",
      description: "Report deleted successfully",
      color: "green",
    });
  } catch (error) {
    console.error("Delete error:", error);
    toast.add({
      title: "Error",
      description: error instanceof Error ? error.message : "Failed to delete report",
      color: "red",
    });
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function formatType(type: string): string {
  const types: Record<string, string> = {
    health_check: "Health Check",
    deep_analysis: "Deep Analysis",
    manual: "Manual",
  };
  return types[type] || type;
}

function getTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    health_check: "i-heroicons-heart",
    deep_analysis: "i-heroicons-chart-bar",
    manual: "i-heroicons-hand-raised",
  };
  return icons[type] || "i-heroicons-document";
}

function getTypeBgClass(type: string): string {
  const classes: Record<string, string> = {
    health_check: "bg-cyan-500/10",
    deep_analysis: "bg-purple-500/10",
    manual: "bg-gray-500/10",
  };
  return classes[type] || "bg-gray-500/10";
}

function getTypeIconClass(type: string): string {
  const classes: Record<string, string> = {
    health_check: "text-cyan-400",
    deep_analysis: "text-purple-400",
    manual: "text-gray-400",
  };
  return classes[type] || "text-gray-400";
}

function getTypeBadgeClass(type: string): string {
  const classes: Record<string, string> = {
    health_check: "badge-cyan",
    deep_analysis: "badge-purple",
    manual: "badge-gray",
  };
  return classes[type] || "badge-gray";
}

function getSeverityBadgeClass(severity: string): string {
  const classes: Record<string, string> = {
    info: "badge-cyan",
    warning: "badge-yellow",
    error: "badge-yellow",
    critical: "badge-red",
  };
  return classes[severity] || "badge-gray";
}

function getHealthScoreBadgeClass(score: number): string {
  if (score >= 80) return "badge-green";
  if (score >= 60) return "badge-yellow";
  if (score >= 40) return "badge-yellow";
  return "badge-red";
}

function getCiStatusBadgeClass(status: string): string {
  const classes: Record<string, string> = {
    passing: "badge-green",
    failing: "badge-red",
    unknown: "badge-gray",
  };
  return classes[status] || "badge-gray";
}

function getCiStatusIcon(status: string): string {
  const icons: Record<string, string> = {
    passing: "i-heroicons-check-circle",
    failing: "i-heroicons-x-circle",
    unknown: "i-heroicons-question-mark-circle",
  };
  return icons[status] || "i-heroicons-question-mark-circle";
}

onMounted(() => {
  fetchReports();
});
</script>
