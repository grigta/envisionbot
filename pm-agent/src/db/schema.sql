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
    updated_at INTEGER NOT NULL,
    local_path TEXT,
    last_analysis_at INTEGER,
    -- Project-level health check and alert settings
    health_check_interval_hours INTEGER CHECK (health_check_interval_hours IS NULL OR health_check_interval_hours > 0),
    alert_threshold_health_score INTEGER CHECK (alert_threshold_health_score IS NULL OR (alert_threshold_health_score >= 0 AND alert_threshold_health_score <= 100)),
    alert_threshold_open_issues INTEGER CHECK (alert_threshold_open_issues IS NULL OR alert_threshold_open_issues >= 0),
    alert_on_ci_failure INTEGER DEFAULT 1 CHECK (alert_on_ci_failure IN (0, 1))
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
    kanban_status TEXT NOT NULL DEFAULT 'not_started' CHECK (kanban_status IN ('not_started', 'backlog', 'in_progress', 'review', 'done')),
    generated_at INTEGER NOT NULL,
    completed_at INTEGER,
    approved_by TEXT CHECK (approved_by IS NULL OR approved_by IN ('telegram', 'web', 'auto')),
    generated_by TEXT CHECK (generated_by IS NULL OR generated_by IN ('health_check', 'deep_analysis', 'manual', 'chat', 'plan_sync')),
    plan_section_id TEXT,
    plan_item_index INTEGER,
    -- GitHub Issue Integration
    github_issue_number INTEGER,
    github_issue_url TEXT,
    github_issue_state TEXT CHECK (github_issue_state IS NULL OR github_issue_state IN ('open', 'closed')),
    github_issue_created_at INTEGER,
    github_issue_synced_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_kanban_status ON tasks(kanban_status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_generated_at ON tasks(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_project_status ON tasks(project_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_github_issue ON tasks(github_issue_number);
CREATE INDEX IF NOT EXISTS idx_tasks_github_issue_state ON tasks(github_issue_state);

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

-- ============================================
-- PROJECT PLANS TABLE (Codebase analysis plans)
-- ============================================
CREATE TABLE IF NOT EXISTS project_plans (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL UNIQUE,
    markdown TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    generated_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    analysis_summary TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_project_plans_project ON project_plans(project_id);

-- ============================================
-- PLAN VERSIONS TABLE (History of plan versions)
-- ============================================
CREATE TABLE IF NOT EXISTS plan_versions (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL REFERENCES project_plans(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    markdown TEXT NOT NULL,
    analysis_summary TEXT,
    change_summary TEXT,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_plan_versions_plan ON plan_versions(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_versions_version ON plan_versions(plan_id, version DESC);

-- ============================================
-- ANALYSIS STATUS TABLE (Track running analyses)
-- ============================================
CREATE TABLE IF NOT EXISTS analysis_status (
    project_id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'cloning', 'analyzing', 'generating', 'syncing', 'completed', 'failed')),
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    current_step TEXT,
    error TEXT,
    started_at INTEGER,
    completed_at INTEGER,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- ============================================
-- NEWS ITEMS TABLE (AI/ML News from Hype)
-- ============================================
CREATE TABLE IF NOT EXISTS news_items (
    id TEXT PRIMARY KEY,
    rank INTEGER NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    source TEXT NOT NULL CHECK (source IN ('GitHub', 'HuggingFace', 'Replicate', 'Reddit')),
    metric TEXT NOT NULL,
    metric_value INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    -- Detailed info from source page
    full_description TEXT,
    technologies TEXT,
    use_cases TEXT,
    author TEXT,
    source_created_at TEXT,
    source_updated_at TEXT,
    license TEXT,
    topics TEXT,
    readme_preview TEXT,
    -- AI analysis (generated by Claude)
    ai_summary TEXT,
    ai_applications TEXT,
    ai_project_ideas TEXT,
    ai_target_audience TEXT,
    ai_integrations TEXT,
    ai_analyzed_at INTEGER,
    -- Meta
    crawled_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_news_rank ON news_items(rank);
CREATE INDEX IF NOT EXISTS idx_news_source ON news_items(source);
CREATE INDEX IF NOT EXISTS idx_news_crawled_at ON news_items(crawled_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_active ON news_items(is_active);
CREATE INDEX IF NOT EXISTS idx_news_metric_value ON news_items(metric_value DESC);

-- ============================================
-- NEWS CRAWL HISTORY TABLE (Track crawl runs)
-- ============================================
CREATE TABLE IF NOT EXISTS news_crawl_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at INTEGER NOT NULL,
    completed_at INTEGER,
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
    items_found INTEGER DEFAULT 0,
    items_updated INTEGER DEFAULT 0,
    items_new INTEGER DEFAULT 0,
    errors TEXT,
    duration_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_crawl_history_started ON news_crawl_history(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_crawl_history_status ON news_crawl_history(status);

-- ============================================
-- CRAWLER SOURCES TABLE (Universal AI Crawler)
-- ============================================
CREATE TABLE IF NOT EXISTS crawler_sources (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    prompt TEXT,
    schema TEXT,
    requires_browser INTEGER NOT NULL DEFAULT 0,
    crawl_interval_hours INTEGER NOT NULL DEFAULT 24,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    last_crawl_at INTEGER,
    last_crawl_status TEXT CHECK (last_crawl_status IS NULL OR last_crawl_status IN ('success', 'error')),
    last_crawl_item_count INTEGER,
    last_crawl_error TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_crawler_sources_enabled ON crawler_sources(is_enabled);
CREATE INDEX IF NOT EXISTS idx_crawler_sources_next_crawl ON crawler_sources(is_enabled, last_crawl_at);

-- ============================================
-- CRAWLED ITEMS TABLE (Items from universal crawler)
-- ============================================
CREATE TABLE IF NOT EXISTS crawled_items (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES crawler_sources(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    content TEXT,
    metadata TEXT NOT NULL DEFAULT '{}',
    extracted_at INTEGER NOT NULL,
    -- Link to project if relevant
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    relevance_score REAL,
    is_processed INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_crawled_items_source ON crawled_items(source_id);
CREATE INDEX IF NOT EXISTS idx_crawled_items_extracted ON crawled_items(extracted_at DESC);
CREATE INDEX IF NOT EXISTS idx_crawled_items_project ON crawled_items(project_id);
CREATE INDEX IF NOT EXISTS idx_crawled_items_processed ON crawled_items(is_processed);
CREATE UNIQUE INDEX IF NOT EXISTS idx_crawled_items_source_url ON crawled_items(source_id, url);

-- ============================================
-- ACCESS CODES TABLE (Authentication)
-- ============================================
CREATE TABLE IF NOT EXISTS access_codes (
    id TEXT PRIMARY KEY,
    code_hash TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user', 'readonly')),
    is_active INTEGER NOT NULL DEFAULT 1,
    last_used_at INTEGER,
    created_at INTEGER NOT NULL,
    expires_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_access_codes_hash ON access_codes(code_hash);
CREATE INDEX IF NOT EXISTS idx_access_codes_active ON access_codes(is_active);

-- ============================================
-- AUTH SESSIONS TABLE (Token tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY,
    access_code_id TEXT NOT NULL REFERENCES access_codes(id) ON DELETE CASCADE,
    token_jti TEXT NOT NULL UNIQUE,
    ip_address TEXT,
    user_agent TEXT,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    revoked_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_code ON auth_sessions(access_code_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_jti ON auth_sessions(token_jti);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions(expires_at);

-- ============================================
-- COMPETITORS TABLE (Guerrilla Marketing / Competitive Analysis)
-- ============================================
CREATE TABLE IF NOT EXISTS competitors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    domain TEXT NOT NULL UNIQUE,
    description TEXT,
    industry TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'crawling', 'analyzing', 'completed', 'failed')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_crawled_at INTEGER,
    last_analyzed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_competitors_domain ON competitors(domain);
CREATE INDEX IF NOT EXISTS idx_competitors_status ON competitors(status);
CREATE INDEX IF NOT EXISTS idx_competitors_updated_at ON competitors(updated_at DESC);

-- ============================================
-- COMPETITOR CRAWL JOBS TABLE (Track crawl sessions)
-- ============================================
CREATE TABLE IF NOT EXISTS competitor_crawl_jobs (
    id TEXT PRIMARY KEY,
    competitor_id TEXT NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    config TEXT NOT NULL DEFAULT '{}',
    pages_found INTEGER NOT NULL DEFAULT 0,
    pages_crawled INTEGER NOT NULL DEFAULT 0,
    errors TEXT,
    started_at INTEGER,
    completed_at INTEGER,
    duration_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_competitor_crawl_jobs_competitor ON competitor_crawl_jobs(competitor_id);
CREATE INDEX IF NOT EXISTS idx_competitor_crawl_jobs_status ON competitor_crawl_jobs(status);

-- ============================================
-- COMPETITOR CRAWLED PAGES TABLE (Individual page data)
-- ============================================
CREATE TABLE IF NOT EXISTS competitor_crawled_pages (
    id TEXT PRIMARY KEY,
    competitor_id TEXT NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
    crawl_job_id TEXT REFERENCES competitor_crawl_jobs(id) ON DELETE SET NULL,
    url TEXT NOT NULL,
    path TEXT NOT NULL,
    depth INTEGER NOT NULL DEFAULT 0,
    status_code INTEGER,
    content_type TEXT,
    -- SEO Tags
    title TEXT,
    meta_description TEXT,
    meta_keywords TEXT,
    canonical_url TEXT,
    og_title TEXT,
    og_description TEXT,
    og_image TEXT,
    -- Headings (JSON arrays)
    h1_tags TEXT,
    h2_tags TEXT,
    h3_tags TEXT,
    h4_h6_tags TEXT,
    -- Images
    images_count INTEGER DEFAULT 0,
    images_without_alt INTEGER DEFAULT 0,
    images_data TEXT,
    -- Links
    internal_links_count INTEGER DEFAULT 0,
    external_links_count INTEGER DEFAULT 0,
    links_data TEXT,
    -- Content
    word_count INTEGER DEFAULT 0,
    text_content TEXT,
    -- Performance
    response_time_ms INTEGER,
    crawled_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_competitor_pages_competitor ON competitor_crawled_pages(competitor_id);
CREATE INDEX IF NOT EXISTS idx_competitor_pages_url ON competitor_crawled_pages(url);
CREATE INDEX IF NOT EXISTS idx_competitor_pages_path ON competitor_crawled_pages(path);
CREATE INDEX IF NOT EXISTS idx_competitor_pages_depth ON competitor_crawled_pages(depth);
CREATE UNIQUE INDEX IF NOT EXISTS idx_competitor_pages_unique ON competitor_crawled_pages(competitor_id, url);

-- ============================================
-- COMPETITOR TECH STACK TABLE (Detected technologies)
-- ============================================
CREATE TABLE IF NOT EXISTS competitor_tech_stack (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    competitor_id TEXT NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    version TEXT,
    confidence INTEGER DEFAULT 100 CHECK (confidence >= 0 AND confidence <= 100),
    detected_by TEXT,
    evidence TEXT,
    detected_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_competitor_tech_competitor ON competitor_tech_stack(competitor_id);
CREATE INDEX IF NOT EXISTS idx_competitor_tech_category ON competitor_tech_stack(category);
CREATE UNIQUE INDEX IF NOT EXISTS idx_competitor_tech_unique ON competitor_tech_stack(competitor_id, category, name);

-- ============================================
-- COMPETITOR SITE STRUCTURE TABLE (URL tree analysis)
-- ============================================
CREATE TABLE IF NOT EXISTS competitor_site_structure (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    competitor_id TEXT NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    parent_path TEXT,
    depth INTEGER NOT NULL DEFAULT 0,
    page_count INTEGER DEFAULT 0,
    child_count INTEGER DEFAULT 0,
    node_type TEXT DEFAULT 'page' CHECK (node_type IN ('page', 'folder', 'root'))
);

CREATE INDEX IF NOT EXISTS idx_competitor_structure_competitor ON competitor_site_structure(competitor_id);
CREATE INDEX IF NOT EXISTS idx_competitor_structure_path ON competitor_site_structure(path);
CREATE UNIQUE INDEX IF NOT EXISTS idx_competitor_structure_unique ON competitor_site_structure(competitor_id, path);

-- ============================================
-- COMPETITOR ANALYSIS TABLE (AI-generated analysis)
-- ============================================
CREATE TABLE IF NOT EXISTS competitor_analysis (
    id TEXT PRIMARY KEY,
    competitor_id TEXT NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
    analysis_type TEXT NOT NULL CHECK (analysis_type IN ('positioning', 'swot', 'recommendations', 'full')),
    -- Positioning Analysis
    positioning_summary TEXT,
    value_proposition TEXT,
    target_audience TEXT,
    key_messages TEXT,
    tone_of_voice TEXT,
    -- SWOT Analysis
    strengths TEXT,
    weaknesses TEXT,
    opportunities TEXT,
    threats TEXT,
    -- Recommendations
    recommendations TEXT,
    action_items TEXT,
    quick_wins TEXT,
    -- SEO Summary
    seo_score INTEGER CHECK (seo_score IS NULL OR (seo_score >= 0 AND seo_score <= 100)),
    seo_issues TEXT,
    seo_opportunities TEXT,
    -- Metadata
    model_used TEXT DEFAULT 'claude-sonnet-4-20250514',
    tokens_used INTEGER,
    generated_at INTEGER NOT NULL,
    expires_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_competitor_analysis_competitor ON competitor_analysis(competitor_id);
CREATE INDEX IF NOT EXISTS idx_competitor_analysis_type ON competitor_analysis(analysis_type);
CREATE INDEX IF NOT EXISTS idx_competitor_analysis_generated ON competitor_analysis(generated_at DESC);

-- ============================================
-- COMPETITOR REPORTS TABLE (Generated reports)
-- ============================================
CREATE TABLE IF NOT EXISTS competitor_reports (
    id TEXT PRIMARY KEY,
    competitor_ids TEXT NOT NULL,
    report_type TEXT NOT NULL CHECK (report_type IN ('single', 'comparison', 'market_overview')),
    title TEXT NOT NULL,
    format TEXT NOT NULL CHECK (format IN ('json', 'markdown', 'html')),
    content TEXT NOT NULL,
    summary TEXT,
    created_at INTEGER NOT NULL,
    created_by TEXT DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_competitor_reports_type ON competitor_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_competitor_reports_created ON competitor_reports(created_at DESC);
