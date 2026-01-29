import type { WSEvent } from "./useWebSocket";

interface ToastConfig {
  enabled: boolean;
  showAllEvents: boolean;
  importantEventsOnly: boolean;
}

/**
 * Composable for showing toast notifications on WebSocket events
 * Automatically subscribes to WebSocket events and displays toasts
 */
export function useWebSocketToast(config?: Partial<ToastConfig>) {
  const toast = useToast();
  const { subscribe, unsubscribe } = useWebSocket();

  const defaultConfig: ToastConfig = {
    enabled: true,
    showAllEvents: false,
    importantEventsOnly: true,
  };

  const settings = reactive({ ...defaultConfig, ...config });

  // Important event types that should always trigger a toast
  const importantEventTypes = [
    "idea_launched",
    "idea_updated",
    "task_created",
    "analysis_completed",
    "action_pending",
    "project_created",
    "error",
    "failed",
  ];

  function shouldShowToast(event: WSEvent): boolean {
    if (!settings.enabled) return false;
    if (settings.showAllEvents) return true;
    if (settings.importantEventsOnly) {
      return importantEventTypes.some((type) => event.type.includes(type));
    }
    return false;
  }

  function getToastColor(event: WSEvent): string {
    if (event.type.includes("error") || event.type.includes("failed")) {
      return "red";
    }
    if (event.type.includes("completed") || event.type.includes("success")) {
      return "green";
    }
    if (event.type.includes("idea")) {
      return "yellow";
    }
    if (event.type.includes("task")) {
      return "blue";
    }
    if (event.type.includes("analysis")) {
      return "purple";
    }
    if (event.type.includes("action_pending")) {
      return "orange";
    }
    return "primary";
  }

  function getToastTitle(event: WSEvent): string {
    const data = event.data as Record<string, unknown> | undefined;

    switch (event.type) {
      case "idea_updated":
        if (data?.status === "planning") return "Planning Started";
        if (data?.status === "plan_ready") return "Plan Ready";
        if (data?.status === "completed") return "Idea Launched";
        if (data?.status === "failed") return "Planning Failed";
        return "Idea Updated";
      case "idea_launched":
        return "New Project Created";
      case "task_created":
        return "Task Generated";
      case "analysis_started":
        return "Analysis Started";
      case "analysis_completed":
        return "Analysis Completed";
      case "action_pending":
        return "Approval Required";
      case "agent_log":
        return "Agent Update";
      case "project_created":
        return "Project Created";
      default:
        return event.type
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }

  function getToastDescription(event: WSEvent): string | undefined {
    const data = event.data as Record<string, unknown> | undefined;

    switch (event.type) {
      case "idea_updated":
        if (data?.status === "plan_ready") {
          return "Review and approve the plan";
        }
        if (data?.status === "completed") {
          return "Successfully launched as a project";
        }
        return undefined;
      case "task_created":
        return data?.title ? String(data.title) : "A new task has been created";
      case "analysis_completed":
        return "Review the analysis results";
      case "action_pending":
        return data?.action ? String(data.action) : "Action requires approval";
      case "agent_log":
        return data?.message ? String(data.message) : undefined;
      default:
        return undefined;
    }
  }

  function handleWebSocketEvent(event: WSEvent) {
    if (!shouldShowToast(event)) return;

    const title = getToastTitle(event);
    const description = getToastDescription(event);
    const color = getToastColor(event);

    toast.add({
      title,
      description,
      color: color as any,
      timeout: 5000,
    });
  }

  // Auto-subscribe on mount
  onMounted(() => {
    if (settings.enabled) {
      subscribe(handleWebSocketEvent);
    }
  });

  // Auto-unsubscribe on unmount
  onUnmounted(() => {
    unsubscribe(handleWebSocketEvent);
  });

  // Allow dynamic enable/disable
  watch(
    () => settings.enabled,
    (enabled) => {
      if (enabled) {
        subscribe(handleWebSocketEvent);
      } else {
        unsubscribe(handleWebSocketEvent);
      }
    }
  );

  return {
    settings,
    enable: () => {
      settings.enabled = true;
    },
    disable: () => {
      settings.enabled = false;
    },
  };
}
