# Envision CEO - Autonomous Project Manager

Автономный агент для управления проектами на базе Claude API с веб-панелью и Telegram интеграцией.

## Возможности

- **Мониторинг проектов** - отслеживание CI/CD, issues, PRs, security alerts
- **Генерация задач** - автоматическое создание задач на основе анализа
- **Система подтверждений** - approve/reject действий через Telegram или веб-панель
- **Циклический анализ** - автоматические health checks и deep analysis по расписанию
- **Веб-панель** - Dashboard, управление проектами, история задач

## Архитектура

```
pm-agent/          # Backend (Node.js + Agent SDK)
├── src/
│   ├── agent.ts           # Основной агент с Claude API
│   ├── server.ts          # Fastify HTTP/WS сервер
│   ├── scheduler.ts       # Планировщик задач
│   ├── tools/github.ts    # GitHub tools (gh CLI)
│   └── approval/          # Система подтверждений
└── data/                  # Состояние и конфигурация

pm-panel/          # Frontend (Nuxt 3 + Vue)
├── pages/                 # Страницы
│   ├── index.vue         # Dashboard
│   ├── projects/         # Проекты
│   ├── tasks/            # Задачи
│   └── reports/          # Отчёты
└── composables/          # API и WebSocket
```

## Установка

### 1. Настройка агента

```bash
cd pm-agent

# Установить зависимости
npm install

# Создать .env файл
cp .env.example .env
```

Заполните `.env`:
```env
# Claude API (получить в Claude Code)
ANTHROPIC_API_KEY=sk-ant-...

# Telegram Bot (создать в @BotFather)
TELEGRAM_BOT_TOKEN=123456789:ABC...
TELEGRAM_ADMIN_CHAT_ID=123456789

# Сервер
PORT=3001

# Аутентификация (ОБЯЗАТЕЛЬНО)
# Сгенерируйте секрет: openssl rand -base64 32
JWT_SECRET=your-secure-random-secret-here

# Расписание
HEALTH_CHECK_INTERVAL=4h
DEEP_ANALYSIS_TIME=09:00
TIMEZONE=Europe/Moscow
```

**🔒 Важно:** Настройте аутентификацию перед первым запуском:

```bash
# 1. Сгенерируйте JWT secret
openssl rand -base64 32

# 2. Добавьте в .env
echo "JWT_SECRET=<ваш-secret>" >> .env

# 3. Создайте код доступа для входа
npx tsx src/scripts/manage-codes.ts create "Admin" admin
```

Подробная инструкция: [SETUP_AUTH.md](SETUP_AUTH.md)

### 2. Настройка веб-панели

```bash
cd pm-panel

# Установить зависимости
npm install

# Создать .env (опционально)
echo "API_BASE_URL=http://localhost:3001" > .env
```

### 3. Настройка GitHub

Убедитесь, что `gh` CLI авторизован:
```bash
gh auth status
```

## Запуск

### Development

```bash
# Терминал 1: Агент
cd pm-agent
npm run dev

# Терминал 2: Веб-панель
cd pm-panel
npm run dev
```

Откройте http://localhost:3000 для веб-панели.

### Production

```bash
# Собрать агент
cd pm-agent
npm run build
npm start

# Собрать панель
cd pm-panel
npm run build
npm run preview
```

## Конфигурация проектов

Редактируйте `pm-agent/data/projects.json`:

```json
{
  "projects": [
    {
      "id": "my-project",
      "name": "My Project",
      "repo": "username/repo",
      "phase": "mvp",
      "monitoringLevel": "standard",
      "goals": ["Launch MVP by Q2"],
      "focusAreas": ["ci-cd", "issues", "prs"]
    }
  ]
}
```

Или добавьте проект через веб-панель в разделе Projects.

## Telegram команды

- `/start` - Приветствие
- `/status` - Статус агента
- `/pending` - Pending actions
- `/health` - Запустить health check
- `/analysis` - Запустить deep analysis
- `/projects` - Список проектов

## API Endpoints

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/projects` | Список проектов |
| POST | `/api/projects` | Добавить проект |
| GET | `/api/tasks` | Список задач |
| GET | `/api/actions/pending` | Pending actions |
| POST | `/api/actions/:id/approve` | Approve action |
| POST | `/api/actions/:id/reject` | Reject action |
| GET | `/api/reports` | Список отчётов |
| POST | `/api/agent/health-check` | Запустить health check |
| POST | `/api/agent/deep-analysis` | Запустить deep analysis |
| WS | `/ws/live` | Real-time события |

## Деплой на VPS

### Systemd сервисы

```bash
# /etc/systemd/system/pm-agent.service
[Unit]
Description=Envision CEO
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/home/youruser/pm-agent
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
EnvironmentFile=/home/youruser/pm-agent/.env

[Install]
WantedBy=multi-user.target
```

### Nginx

```nginx
server {
    listen 80;
    server_name pm.yourdomain.com;

    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /ws/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location / {
        proxy_pass http://localhost:3000;
    }
}
```

## Лицензия

MIT
