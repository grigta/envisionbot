import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "../../data");
const STATE_FILE = join(DATA_DIR, "state.json");
const PROJECTS_FILE = join(DATA_DIR, "projects.json");
// Default state
const defaultState = {
    version: 1,
    projects: [],
    tasks: [],
    pendingActions: [],
    metrics: [],
    reports: [],
    ideas: [],
};
class Store {
    state;
    saveTimeout = null;
    constructor() {
        this.state = this.load();
    }
    load() {
        // Ensure data directory exists
        if (!existsSync(DATA_DIR)) {
            mkdirSync(DATA_DIR, { recursive: true });
        }
        let state = { ...defaultState };
        // Load state
        if (existsSync(STATE_FILE)) {
            try {
                const data = readFileSync(STATE_FILE, "utf-8");
                state = JSON.parse(data);
            }
            catch (error) {
                console.error("Failed to load state, using defaults:", error);
            }
        }
        else if (existsSync(PROJECTS_FILE)) {
            // Load projects from separate file if exists
            try {
                const data = readFileSync(PROJECTS_FILE, "utf-8");
                const projectsConfig = JSON.parse(data);
                if (projectsConfig.projects) {
                    state = { ...defaultState, projects: projectsConfig.projects };
                }
            }
            catch (error) {
                console.error("Failed to load projects config:", error);
            }
        }
        // Migration: add kanbanStatus to existing tasks
        if (state.tasks) {
            state.tasks = state.tasks.map((task) => ({
                ...task,
                kanbanStatus: task.kanbanStatus || "not_started",
            }));
        }
        return state;
    }
    scheduleSave() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        this.saveTimeout = setTimeout(() => this.save(), 1000);
    }
    save() {
        try {
            writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2));
        }
        catch (error) {
            console.error("Failed to save state:", error);
        }
    }
    // Projects
    getProjects() {
        return this.state.projects;
    }
    getProject(id) {
        return this.state.projects.find((p) => p.id === id);
    }
    getProjectByName(name) {
        return this.state.projects.find((p) => p.name.toLowerCase() === name.toLowerCase());
    }
    getProjectByRepo(repo) {
        return this.state.projects.find((p) => p.repo.toLowerCase() === repo.toLowerCase());
    }
    addProject(project) {
        const existing = this.state.projects.findIndex((p) => p.id === project.id);
        if (existing >= 0) {
            this.state.projects[existing] = project;
        }
        else {
            this.state.projects.push(project);
        }
        this.scheduleSave();
    }
    removeProject(id) {
        this.state.projects = this.state.projects.filter((p) => p.id !== id);
        this.scheduleSave();
    }
    // Tasks
    getTasks(filter) {
        let tasks = this.state.tasks;
        if (filter?.projectId) {
            tasks = tasks.filter((t) => t.projectId === filter.projectId);
        }
        if (filter?.status) {
            tasks = tasks.filter((t) => t.status === filter.status);
        }
        return tasks.sort((a, b) => b.generatedAt - a.generatedAt);
    }
    getTask(id) {
        return this.state.tasks.find((t) => t.id === id);
    }
    addTask(task) {
        const existing = this.state.tasks.findIndex((t) => t.id === task.id);
        if (existing >= 0) {
            this.state.tasks[existing] = task;
        }
        else {
            this.state.tasks.push(task);
        }
        this.scheduleSave();
    }
    updateTask(id, updates) {
        const task = this.state.tasks.find((t) => t.id === id);
        if (task) {
            Object.assign(task, updates);
            this.scheduleSave();
        }
        return task;
    }
    // Pending Actions
    getPendingActions() {
        return this.state.pendingActions.filter((a) => a.status === "pending");
    }
    getPendingAction(id) {
        return this.state.pendingActions.find((a) => a.id === id);
    }
    addPendingAction(action) {
        this.state.pendingActions.push(action);
        this.scheduleSave();
    }
    updatePendingAction(id, updates) {
        const action = this.state.pendingActions.find((a) => a.id === id);
        if (action) {
            Object.assign(action, updates);
            this.scheduleSave();
        }
        return action;
    }
    // Metrics
    addMetrics(metrics) {
        this.state.metrics.push(metrics);
        // Keep only last 100 metrics per project
        const projectMetrics = this.state.metrics.filter((m) => m.projectId === metrics.projectId);
        if (projectMetrics.length > 100) {
            const toRemove = projectMetrics.slice(0, projectMetrics.length - 100);
            this.state.metrics = this.state.metrics.filter((m) => !toRemove.includes(m));
        }
        this.scheduleSave();
    }
    getMetrics(projectId, limit = 10) {
        return this.state.metrics
            .filter((m) => m.projectId === projectId)
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }
    // Reports
    getReports(limit = 20) {
        return this.state.reports.sort((a, b) => b.startedAt - a.startedAt).slice(0, limit);
    }
    getReport(id) {
        return this.state.reports.find((r) => r.id === id);
    }
    addReport(report) {
        this.state.reports.push(report);
        // Keep only last 50 reports
        if (this.state.reports.length > 50) {
            this.state.reports = this.state.reports
                .sort((a, b) => b.startedAt - a.startedAt)
                .slice(0, 50);
        }
        this.scheduleSave();
    }
    deleteReport(id) {
        const index = this.state.reports.findIndex((r) => r.id === id);
        if (index === -1)
            return false;
        this.state.reports.splice(index, 1);
        this.scheduleSave();
        return true;
    }
    // Ideas
    getIdeas(filter) {
        let ideas = this.state.ideas || [];
        if (filter?.status) {
            ideas = ideas.filter((i) => i.status === filter.status);
        }
        return ideas.sort((a, b) => b.createdAt - a.createdAt);
    }
    getIdea(id) {
        return this.state.ideas?.find((i) => i.id === id);
    }
    addIdea(idea) {
        if (!this.state.ideas) {
            this.state.ideas = [];
        }
        const existing = this.state.ideas.findIndex((i) => i.id === idea.id);
        if (existing >= 0) {
            this.state.ideas[existing] = idea;
        }
        else {
            this.state.ideas.push(idea);
        }
        this.scheduleSave();
    }
    updateIdea(id, updates) {
        if (!this.state.ideas)
            return undefined;
        const idea = this.state.ideas.find((i) => i.id === id);
        if (idea) {
            Object.assign(idea, updates, { updatedAt: Date.now() });
            this.scheduleSave();
        }
        return idea;
    }
    removeIdea(id) {
        if (!this.state.ideas)
            return;
        this.state.ideas = this.state.ideas.filter((i) => i.id !== id);
        this.scheduleSave();
    }
    // Timestamps
    getLastHealthCheck() {
        return this.state.lastHealthCheck;
    }
    setLastHealthCheck(timestamp) {
        this.state.lastHealthCheck = timestamp;
        this.scheduleSave();
    }
    getLastDeepAnalysis() {
        return this.state.lastDeepAnalysis;
    }
    setLastDeepAnalysis(timestamp) {
        this.state.lastDeepAnalysis = timestamp;
        this.scheduleSave();
    }
    // Stats
    getStats() {
        const ideas = this.state.ideas || [];
        return {
            projectCount: this.state.projects.length,
            taskCount: this.state.tasks.length,
            pendingActionsCount: this.state.pendingActions.filter((a) => a.status === "pending").length,
            ideaCount: ideas.length,
            activeIdeasCount: ideas.filter((i) => !["completed", "failed"].includes(i.status)).length,
            lastHealthCheck: this.state.lastHealthCheck,
            lastDeepAnalysis: this.state.lastDeepAnalysis,
        };
    }
}
export const stateStore = new Store();
export const store = stateStore; // Alias for convenience
//# sourceMappingURL=store.js.map