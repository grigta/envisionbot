# Docker Deployment Guide

This guide explains how to deploy Envision CEO using Docker Compose for easy setup and deployment.

## Prerequisites

- Docker (20.10+)
- Docker Compose (2.0+)
- GitHub CLI configured (for agent to interact with GitHub)

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/grigta/envisionbot.git
cd envisionbot
```

### 2. Configure Environment Variables

```bash
# Copy the example environment file
cp .env.docker.example .env

# Generate a secure JWT secret
openssl rand -base64 32

# Edit .env and fill in required values
nano .env
```

**Required variables:**
- `JWT_SECRET` - Secure random string (generate with openssl above)
- `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` - Claude API authentication
- `TELEGRAM_BOT_TOKEN` - Get from [@BotFather](https://t.me/BotFather)
- `TELEGRAM_ADMIN_CHAT_ID` - Your Telegram chat ID

### 3. Set Up GitHub CLI

The agent needs GitHub CLI to interact with repositories. You have two options:

**Option A: Mount your existing GitHub CLI config (Recommended)**

```bash
# Ensure gh CLI is authenticated on your host
gh auth status

# The docker-compose.yml already mounts ~/.config/gh
```

**Option B: Configure GitHub CLI inside the container**

```bash
# Start the container
docker-compose up -d pm-agent

# Execute gh auth in the container
docker-compose exec pm-agent gh auth login

# Follow the prompts to authenticate
```

### 4. Create Access Code

Before starting, create an access code for web panel authentication:

```bash
# Start only the agent service temporarily
docker-compose up -d pm-agent

# Create an access code
docker-compose exec pm-agent npm run codes:create "Admin" admin

# Save the generated code - you'll need it to log into the web panel
```

### 5. Start Services

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

### 6. Access the Application

- **Web Panel**: http://localhost:3000
- **API**: http://localhost:3001
- **API Health Check**: http://localhost:3001/api/health

Login to the web panel using the access code created in step 4.

## Service Architecture

The Docker Compose setup includes:

- **pm-agent** (port 3001): Backend service with Claude API agent, Telegram bot, and REST/WebSocket API
- **pm-panel** (port 3000): Frontend Nuxt 3 application for dashboard and project management

### Network

Services communicate via an internal `envision-network` bridge network.

### Data Persistence

- `./pm-agent/data:/app/data` - Persists tasks, projects, reports, and agent state

## Configuration

### Environment Variables

All configuration is done via the `.env` file. See `.env.docker.example` for all available options.

#### Claude API Authentication

Choose one option:

```env
# Option 1: Direct API key (pay-as-you-go)
ANTHROPIC_API_KEY=sk-ant-...

# Option 2: Claude Code OAuth token
CLAUDE_CODE_OAUTH_TOKEN=...
```

#### Telegram Bot

Create a bot with [@BotFather](https://t.me/BotFather):

```env
TELEGRAM_BOT_TOKEN=123456789:ABC...
TELEGRAM_ADMIN_CHAT_ID=123456789  # Your chat ID
```

To get your chat ID, message [@userinfobot](https://t.me/userinfobot).

#### Scheduling

```env
HEALTH_CHECK_INTERVAL=4h          # Interval between health checks
DEEP_ANALYSIS_TIME=09:00          # Daily deep analysis time
TIMEZONE=Europe/Moscow            # Your timezone
```

#### Task Executor

```env
TASK_EXECUTOR_ENABLED=true                    # Enable automatic task execution
TASK_EXECUTOR_INTERVAL=*/5 * * * *            # Cron expression (every 5 minutes)
TASK_EXECUTOR_REQUIRE_APPROVAL=false          # Skip approval for commits
```

#### GitHub Integration

```env
GITHUB_AUTO_CREATE_ISSUE=true     # Auto-create GitHub issues for tasks
GITHUB_SYNC_ENABLED=true          # Enable GitHub sync
GITHUB_SYNC_INTERVAL=15           # Sync interval in minutes
```

## Management

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f pm-agent
docker-compose logs -f pm-panel
```

### Restart Services

```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart pm-agent
```

### Stop Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### Update Application

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose up -d --build
```

### Access Container Shell

```bash
# Agent container
docker-compose exec pm-agent sh

# Panel container
docker-compose exec pm-panel sh
```

## Access Code Management

Create and manage access codes for web panel authentication:

```bash
# Create a new code
docker-compose exec pm-agent npm run codes:create "Username" role

# List all codes
docker-compose exec pm-agent npm run codes:list

# Revoke a code
docker-compose exec pm-agent npm run codes:revoke <code>
```

Roles: `admin`, `user`, `readonly`

## Monitoring

### Health Checks

Both services include health checks:

```bash
# Check service health
docker-compose ps

# Manual health check
curl http://localhost:3001/api/health
curl http://localhost:3000
```

### Resource Usage

```bash
# View resource usage
docker stats

# View for specific services
docker stats envision-ceo-agent envision-ceo-panel
```

## Production Deployment

### Using a Reverse Proxy (Nginx)

Example Nginx configuration:

```nginx
server {
    listen 80;
    server_name envision.yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name envision.yourdomain.com;

    ssl_certificate /etc/ssl/certs/envision.crt;
    ssl_certificate_key /etc/ssl/private/envision.key;

    # Agent API
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /ws/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Environment-Specific Configuration

For production, consider:

1. **Use secrets management**: Store sensitive values in Docker secrets or a secrets manager
2. **Enable HTTPS**: Use SSL/TLS certificates
3. **Set resource limits**: Add resource constraints to docker-compose.yml
4. **Regular backups**: Backup the `./pm-agent/data` directory
5. **Monitoring**: Use tools like Prometheus + Grafana

### Example with Resource Limits

Add to docker-compose.yml services:

```yaml
pm-agent:
  # ... existing config
  deploy:
    resources:
      limits:
        cpus: '1.0'
        memory: 1G
      reservations:
        cpus: '0.5'
        memory: 512M
```

## Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs pm-agent

# Common issues:
# - Missing required environment variables
# - Invalid JWT_SECRET
# - GitHub CLI not authenticated
```

### Cannot authenticate with Claude API

```bash
# Verify environment variables
docker-compose exec pm-agent env | grep ANTHROPIC

# Test API key
docker-compose exec pm-agent node -e "console.log(process.env.ANTHROPIC_API_KEY)"
```

### GitHub CLI not working

```bash
# Check gh auth status in container
docker-compose exec pm-agent gh auth status

# Re-authenticate
docker-compose exec pm-agent gh auth login
```

### Database/state issues

```bash
# Backup current data
cp -r pm-agent/data pm-agent/data.backup

# Reset state (CAUTION: deletes all data)
rm -rf pm-agent/data/*
docker-compose restart pm-agent
```

### Panel cannot connect to agent

Check `API_BASE_URL` in `.env`:
- Should be `http://pm-agent:3001` for internal Docker network
- Should be `http://localhost:3001` if running panel outside Docker

### Port conflicts

If ports 3000 or 3001 are already in use:

```yaml
# Edit docker-compose.yml
services:
  pm-agent:
    ports:
      - "3002:3001"  # Change host port
```

Update `API_BASE_URL` accordingly if needed.

## Backup and Restore

### Backup

```bash
# Create backup directory
mkdir -p backups

# Backup data directory
tar -czf backups/envision-data-$(date +%Y%m%d-%H%M%S).tar.gz pm-agent/data

# Backup environment
cp .env backups/.env.backup
```

### Restore

```bash
# Stop services
docker-compose down

# Restore data
tar -xzf backups/envision-data-YYYYMMDD-HHMMSS.tar.gz

# Restore environment
cp backups/.env.backup .env

# Start services
docker-compose up -d
```

## Additional Resources

- [Main README](./pm-agent/README.md) - Full documentation
- [Authentication Setup](./pm-agent/SETUP_AUTH.md) - Detailed auth configuration
- [Testing Guide](./pm-agent/TESTING.md) - Testing instructions

## Support

For issues and questions:
- Open an issue on GitHub
- Check existing issues for solutions
- Review logs with `docker-compose logs -f`
