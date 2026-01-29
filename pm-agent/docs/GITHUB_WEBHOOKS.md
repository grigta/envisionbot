# GitHub Webhooks Integration

This document describes how to set up and use GitHub webhooks for real-time event handling in Envisionbot.

## Overview

GitHub webhooks enable real-time synchronization between GitHub repositories and Envisionbot tasks. Instead of polling GitHub for changes, webhooks push events to Envisionbot immediately when they occur.

## Supported Events

The webhook handler supports the following GitHub events:

- **issues**: Issue opened, closed, reopened, edited, labeled, etc.
- **pull_request**: PR opened, closed, merged, reopened, etc.
- **issue_comment**: Comments added to issues or PRs
- **push**: Code pushed to repository
- **pull_request_review**: PR reviews submitted
- **status**: Commit status changes (CI/CD)
- **check_suite**: Check suite completion
- **check_run**: Individual check run updates

## Setup Instructions

### 1. Configure Webhook Secret (Recommended)

Generate a secure webhook secret:

```bash
openssl rand -hex 32
```

Add it to your `.env` file:

```env
GITHUB_WEBHOOK_SECRET=your_generated_secret_here
```

### 2. Set Up Webhook on GitHub

1. Navigate to your repository on GitHub
2. Go to **Settings** → **Webhooks** → **Add webhook**
3. Configure the webhook:

   **Payload URL**: `http://your-server:3001/api/webhooks/github`

   **Content type**: `application/json`

   **Secret**: (paste the secret from step 1)

   **Events**: Select individual events:
   - Issues
   - Pull requests
   - Pushes
   - Issue comments
   - Pull request reviews
   - Statuses
   - Check suites
   - Check runs

   Or select "Send me everything" for all events (not recommended for production)

4. Click **Add webhook**

### 3. Verify Webhook Delivery

After creating the webhook:

1. GitHub will send a `ping` event to test the connection
2. Check the "Recent Deliveries" tab on GitHub to see if the ping was successful
3. Look for a 200 OK response

## How It Works

### Issue Events

When a GitHub issue is **closed**:
- Envisionbot finds the linked task (by issue number)
- Marks the task as `completed`
- Updates the task's `githubIssueState` to `closed`
- Broadcasts a `task_updated` event via WebSocket

When a GitHub issue is **reopened**:
- Envisionbot finds the linked task
- Changes task status from `completed` to `approved`
- Updates the task's `githubIssueState` to `open`

### Pull Request Events

When a PR is **merged**:
- Envisionbot finds all tasks that reference this PR URL
- Marks those tasks as `completed`
- Broadcasts task updates

### Real-time Updates

All webhook events trigger WebSocket broadcasts:

```typescript
{
  type: "task_updated",
  timestamp: 1234567890,
  data: {
    taskId: "task-123",
    event: "issues",
    action: "closed",
    source: "github_webhook"
  }
}
```

This allows the web UI to update immediately without polling.

## Security

### Signature Verification

All webhook requests are verified using HMAC-SHA256:

1. GitHub signs the payload with your webhook secret
2. The signature is sent in the `X-Hub-Signature-256` header
3. Envisionbot recomputes the signature and compares
4. Request is rejected if signatures don't match

### Public Endpoint

The webhook endpoint (`/api/webhooks/github`) is **public** and doesn't require JWT authentication. This is necessary because GitHub needs to access it from the internet.

Security is provided by:
- Signature verification (if `GITHUB_WEBHOOK_SECRET` is set)
- Read-only database queries
- No destructive operations without matching tasks

## Development Mode

If `GITHUB_WEBHOOK_SECRET` is not set:
- A warning is logged on startup
- Signature verification is **skipped**
- Webhooks are accepted without validation

This is useful for local development but **should never be used in production**.

## Troubleshooting

### Webhook Not Receiving Events

1. Check that your server is publicly accessible
2. Verify the payload URL is correct
3. Check firewall rules allow incoming connections on port 3001
4. Review GitHub's "Recent Deliveries" for error messages

### Signature Verification Failures

1. Ensure `GITHUB_WEBHOOK_SECRET` matches the secret configured on GitHub
2. Check that the secret doesn't have extra whitespace
3. Verify the payload is being sent as JSON (not form-encoded)

### Tasks Not Updating

1. Verify the task has a linked GitHub issue (`githubIssueNumber` field)
2. Check that the repository matches (`project.repo` format: `owner/repo`)
3. Review server logs for webhook processing errors

## Example Webhook Payloads

### Issue Closed Event

```json
{
  "action": "closed",
  "issue": {
    "number": 42,
    "title": "[development] Add user authentication",
    "state": "closed",
    "html_url": "https://github.com/owner/repo/issues/42"
  },
  "repository": {
    "name": "repo",
    "full_name": "owner/repo",
    "owner": { "login": "owner" }
  },
  "sender": { "login": "username" }
}
```

### Pull Request Merged Event

```json
{
  "action": "closed",
  "pull_request": {
    "number": 15,
    "title": "Implement authentication",
    "state": "closed",
    "merged": true,
    "html_url": "https://github.com/owner/repo/pull/15"
  },
  "repository": {
    "full_name": "owner/repo"
  }
}
```

## Testing Webhooks Locally

For local development, use a tunnel service like [ngrok](https://ngrok.com/):

```bash
# Start your server
npm run dev

# In another terminal, create a tunnel
ngrok http 3001

# Use the ngrok URL as your webhook URL
# Example: https://abc123.ngrok.io/api/webhooks/github
```

## Monitoring

Webhook events are logged to the console:

```
[Webhook] Processing issues event from owner/repo
[Webhook] Issue #42 closed in owner/repo
[Webhook] Task task-123 marked as completed (issue closed)
```

Monitor these logs to verify webhooks are being processed correctly.

## API Reference

### Endpoint

**POST** `/api/webhooks/github`

### Headers

- `X-GitHub-Event` (required): Event type (e.g., "issues", "pull_request")
- `X-Hub-Signature-256` (optional): HMAC-SHA256 signature for verification
- `Content-Type`: `application/json`

### Response

**Success (200 OK)**:
```json
{
  "success": true,
  "message": "Task task-123 marked as completed (issue closed)"
}
```

**Invalid Signature (401 Unauthorized)**:
```json
{
  "error": "Invalid signature"
}
```

**Server Error (500)**:
```json
{
  "error": "Internal server error"
}
```

## Future Enhancements

Potential improvements for webhook handling:

- [ ] Webhook event retry queue for failed processing
- [ ] Rate limiting per repository
- [ ] Webhook event history/audit log
- [ ] Support for repository dispatch events
- [ ] Automatic task creation from new issues
- [ ] Comment parsing for task updates (e.g., `/priority high`)
- [ ] Integration with CI/CD status checks
