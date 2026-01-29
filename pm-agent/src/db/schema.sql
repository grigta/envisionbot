-- Envision CEO Database Schema
-- SQLite with Node.js built-in sqlite module (Node 22+)

-- ============================================
-- SCHEMA VERSION TRACKING
-- ============================================
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    description TEXT
);

-- ============================================
-- PROJECTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    repo TEXT NOT NULL,
    phase TEXT NOT NULL CHECK (phase IN ('idea', 'planning', 'mvp', 'beta', 'launch', 'growth', 'maintenance')),
    monitoring_level TEXT NOT NULL DEFAULT 'standard' CHECK (monitoring_level IN ('minimal', 'standard', 'intensive')),
    goals TEXT NOT NULL DEFAULT '[]',
    focus_areas TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_repo ON projects(repo);
CREATE INDEX IF NOT EXISTS idx_projects_phase ON projects(phase);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);

-- ============================================
-- TASKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('development', 'review', 'planning', 'maintenance', 'investigation', 'notification', 'documentation', 'security', 'improvement')),
    priority TEXT NOT NULL CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    context TEXT NOT NULL,
    suggested_actions TEXT NOT NULL DEFAULT '[]',
    related_issues TEXT NOT NULL DEFAULT '[]',
    related_prs TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'in_progress', 'completed', 'failed')),
    kanban_status TEXT NOT NULL DEFAULT 'not_started' CHECK (kanban_status IN ('not_started', 'backlog')),
    generated_at INTEGER NOT NULL,
    completed_at INTEGER,
    approved_by TEXT CHECK (approved_by IS NULL OR approved_by IN ('telegram', 'web', 'auto')),
    generated_by TEXT CHECK (generated_by IS NULL OR generated_by IN ('health_check', 'deep_analysis', 'manual', 'chat'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_kanban_status ON tasks(kanban_status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_generated_at ON tasks(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_project_status ON tasks(project_id, status);

-- ============================================
-- PENDING ACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS pending_actions (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    action_type TEXT NOT NULL CHECK (action_type IN ('create_issue', 'comment_issue', 'create_pr', 'merge_pr', 'close_issue', 'notify', 'custom')),
    action_description TEXT NOT NULL,
    action_payload TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
    telegram_message_id INTEGER
);

CREATE INDEX IF NOT EXISTS idx_pending_actions_status ON pending_actions(status);
CREATE INDEX IF NOT EXISTS idx_pending_actions_task_id ON pending_actions(task_id);
CREATE INDEX IF NOT EXISTS idx_pending_actions_expires_at ON pending_actions(expires_at);

-- ============================================
-- PROJECT METRICS TABLE (Time-series data)
-- ============================================
CREATE TABLE IF NOT EXISTS project_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    timestamp INTEGER NOT NULL,
    open_issues INTEGER NOT NULL DEFAULT 0,
    open_prs INTEGER NOT NULL DEFAULT 0,
    last_commit_at INTEGER,
    ci_status TEXT NOT NULL DEFAULT 'unknown' CHECK (ci_status IN ('passing', 'failing', 'unknown')),
    velocity REAL NOT NULL DEFAULT 0,
    health_score INTEGER NOT NULL DEFAULT 0 CHECK (health_score >= 0 AND health_score <= 100),
    security_alerts INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_metrics_project_id ON project_metrics(project_id);
CREATE INDEX IF NOT EXISTS idx_metrics_project_timestamp ON project_metrics(project_id, timestamp DESC);

-- ============================================
-- ANALYSIS REPORTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS analysis_reports (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('health_check', 'deep_analysis', 'manual')),
    project_ids TEXT NOT NULL DEFAULT '[]',
    started_at INTEGER NOT NULL,
    completed_at INTEGER,
    summary TEXT NOT NULL DEFAULT '',
    generated_tasks TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_reports_type ON analysis_reports(type);
CREATE INDEX IF NOT EXISTS idx_reports_started_at ON analysis_reports(started_at DESC);

-- ============================================
-- FINDINGS TABLE (Normalized from reports)
-- ============================================
CREATE TABLE IF NOT EXISTS report_findings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id TEXT NOT NULL REFERENCES analysis_reports(id) ON DELETE CASCADE,
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_findings_report_id ON report_findings(report_id);
CREATE INDEX IF NOT EXISTS idx_findings_severity ON report_findings(severity);
CREATE INDEX IF NOT EXISTS idx_findings_project_id ON report_findings(project_id);

-- ============================================
-- PROJECT REPORTS TABLE (Snapshot data within analysis)
-- ============================================
CREATE TABLE IF NOT EXISTS project_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id TEXT NOT NULL REFERENCES analysis_reports(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL,
    project_name TEXT NOT NULL,
    health_score INTEGER NOT NULL CHECK (health_score >= 0 AND health_score <= 100),
    open_issues INTEGER NOT NULL DEFAULT 0,
    open_prs INTEGER NOT NULL DEFAULT 0,
    ci_status TEXT NOT NULL DEFAULT 'unknown' CHECK (ci_status IN ('passing', 'failing', 'unknown')),
    risks TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_project_reports_report_id ON project_reports(report_id);

-- ============================================
-- IDEAS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS ideas (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'planning', 'plan_ready', 'approved', 'creating_repo', 'generating', 'completed', 'failed')),
    plan TEXT,
    project_id TEXT,
    repo_name TEXT,
    repo_url TEXT,
    error TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ideas_status ON ideas(status);
CREATE INDEX IF NOT EXISTS idx_ideas_created_at ON ideas(created_at DESC);

-- ============================================
-- CHAT SESSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    title TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON chat_sessions(updated_at DESC);

-- ============================================
-- CHAT MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    project_ids TEXT,
    mentions TEXT,
    steps TEXT,
    success INTEGER,
    error TEXT
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_timestamp ON chat_messages(session_id, timestamp);

-- ============================================
-- AGENT STATE TABLE (Global state/settings)
-- ============================================
CREATE TABLE IF NOT EXISTS agent_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);
