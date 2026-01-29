# WebSocket Toast Notifications

This feature provides automatic toast notifications for WebSocket events in the Envision CEO panel.

## Usage

The toast notifications are automatically enabled in the default layout. No additional setup is required.

### Configuration

The `useWebSocketToast` composable accepts the following configuration options:

```typescript
useWebSocketToast({
  enabled: true,              // Enable/disable toast notifications
  showAllEvents: false,       // Show toast for all WebSocket events
  importantEventsOnly: true,  // Show toast only for important events (recommended)
})
```

### Important Events

The following event types are considered important and will trigger toast notifications:

- `idea_launched` - New project created from an idea
- `idea_updated` - Idea status changed
- `task_created` - New task generated
- `analysis_completed` - Analysis finished
- `action_pending` - Action requires approval
- `project_created` - New project created
- `error` - Error occurred
- `failed` - Operation failed

### Toast Colors

Toast notifications use different colors based on event type:

- **Red**: Errors and failures
- **Green**: Completed actions and success
- **Yellow**: Idea-related events
- **Blue**: Task-related events
- **Purple**: Analysis events
- **Orange**: Actions requiring approval

## Customization

To customize the behavior in a specific page or component:

```typescript
const { settings, enable, disable } = useWebSocketToast({
  enabled: true,
  importantEventsOnly: true,
});

// Temporarily disable notifications
disable();

// Re-enable notifications
enable();

// Change settings dynamically
settings.showAllEvents = true;
```

## Implementation Details

The composable:
1. Automatically subscribes to WebSocket events on mount
2. Filters events based on configuration
3. Displays appropriate toast messages with titles and descriptions
4. Automatically unsubscribes on unmount
5. Handles dynamic enable/disable

The implementation is integrated into `layouts/default.vue` and works across all pages in the application.
