export interface WSEvent {
  type: string;
  timestamp: number;
  data: unknown;
}

type WSEventHandler = (event: WSEvent) => void;

// Global state for subscribers (shared across all composable instances)
const subscribers = new Set<WSEventHandler>();

export function useWebSocket() {
  const config = useRuntimeConfig();
  const baseUrl = config.public.apiBaseUrl;
  const { token } = useAuth();

  const connected = ref(false);
  const events = ref<WSEvent[]>([]);
  const lastEvent = ref<WSEvent | null>(null);

  let ws: WebSocket | null = null;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempts = 0;
  const maxEvents = 100;
  const maxReconnectAttempts = 10;

  function connect() {
    if (ws?.readyState === WebSocket.OPEN) return;

    // Get authentication token
    const authToken = token.value;
    if (!authToken) {
      console.warn("Cannot connect to WebSocket: No authentication token");
      return;
    }

    // Build WebSocket URL with token as query parameter
    const wsBaseUrl = baseUrl.replace(/^http/, "ws") + "/ws/live";
    const wsUrl = `${wsBaseUrl}?token=${encodeURIComponent(authToken)}`;

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        connected.value = true;
        reconnectAttempts = 0; // Reset reconnect attempts on successful connection
        console.log("WebSocket connected");
      };

      ws.onclose = () => {
        connected.value = false;
        console.log("WebSocket disconnected");
        scheduleReconnect();
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WSEvent;
          lastEvent.value = data;
          events.value = [data, ...events.value.slice(0, maxEvents - 1)];

          // Notify all subscribers
          subscribers.forEach((handler) => {
            try {
              handler(data);
            } catch (err) {
              console.error("WebSocket subscriber error:", err);
            }
          });
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
      scheduleReconnect();
    }
  }

  function disconnect() {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    if (ws) {
      ws.close();
      ws = null;
    }
    connected.value = false;
  }

  function scheduleReconnect() {
    if (reconnectTimeout) return;

    // Stop reconnecting after max attempts
    if (reconnectAttempts >= maxReconnectAttempts) {
      console.error("Max WebSocket reconnection attempts reached");
      return;
    }

    reconnectAttempts++;

    // Exponential backoff: 3s, 6s, 12s, ... up to 60s
    const delay = Math.min(3000 * Math.pow(2, reconnectAttempts - 1), 60000);

    reconnectTimeout = setTimeout(() => {
      reconnectTimeout = null;
      console.log(`WebSocket reconnection attempt ${reconnectAttempts}/${maxReconnectAttempts}`);
      connect();
    }, delay);
  }

  // Filter events by type
  function getEventsByType(type: string): WSEvent[] {
    return events.value.filter((e) => e.type === type);
  }

  // Watch for specific event type
  function onEvent(type: string, callback: (event: WSEvent) => void) {
    watch(lastEvent, (event) => {
      if (event && event.type === type) {
        callback(event);
      }
    });
  }

  // Subscribe to all WebSocket events
  function subscribe(handler: WSEventHandler) {
    subscribers.add(handler);
  }

  // Unsubscribe from WebSocket events
  function unsubscribe(handler: WSEventHandler) {
    subscribers.delete(handler);
  }

  // Clear events
  function clearEvents() {
    events.value = [];
  }

  // Auto-connect on mount, disconnect on unmount
  onMounted(() => {
    connect();
  });

  onUnmounted(() => {
    disconnect();
  });

  return {
    connected,
    events,
    lastEvent,
    connect,
    disconnect,
    getEventsByType,
    onEvent,
    subscribe,
    unsubscribe,
    clearEvents,
  };
}
