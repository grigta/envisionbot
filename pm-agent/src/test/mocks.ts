import { vi } from 'vitest';
import type { Project, Task, PendingAction, AnalysisReport, Idea } from '../types';

// Mock Store
export const createMockStore = () => ({
  getProjects: vi.fn(() => []),
  getProject: vi.fn(),
  addProject: vi.fn(),
  removeProject: vi.fn(),
  updateProject: vi.fn(),

  getTasks: vi.fn(() => []),
  getTask: vi.fn(),
  addTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),

  getPendingActions: vi.fn(() => []),
  getPendingAction: vi.fn(),
  addPendingAction: vi.fn(),
  removePendingAction: vi.fn(),

  getReports: vi.fn(() => []),
  getReport: vi.fn(),
  addReport: vi.fn(),
  deleteReport: vi.fn(),

  getIdeas: vi.fn(() => []),
  getIdea: vi.fn(),
  addIdea: vi.fn(),
  updateIdea: vi.fn(),

  getStats: vi.fn(() => ({
    totalProjects: 0,
    totalTasks: 0,
    completedTasks: 0,
    pendingActions: 0,
  })),

  getAgentState: vi.fn(),
  updateAgentState: vi.fn(),
});

// Mock Anthropic SDK
export const createMockAnthropicClient = () => ({
  messages: {
    create: vi.fn(),
    stream: vi.fn(),
  },
});

// Mock execa
export const createMockExeca = () => {
  const execaMock = vi.fn();
  execaMock.mockResolvedValue({
    stdout: '',
    stderr: '',
    exitCode: 0,
    command: '',
    escapedCommand: '',
    failed: false,
    timedOut: false,
    isCanceled: false,
    killed: false,
  });
  return execaMock;
};

// Mock broadcast
export const createMockBroadcast = () => vi.fn();

// Test data factories
export const createTestProject = (overrides?: Partial<Project>): Project => ({
  id: 'test-project-1',
  name: 'Test Project',
  localPath: '/test/path',
  repoUrl: 'https://github.com/test/repo',
  owner: 'test',
  repo: 'repo',
  autoApprove: false,
  monitoringLevel: 'standard',
  projectGoal: 'Test goal',
  lastHealthCheck: new Date().toISOString(),
  lastDeepAnalysis: null,
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const createTestTask = (overrides?: Partial<Task>): Task => ({
  id: 'test-task-1',
  projectId: 'test-project-1',
  title: 'Test Task',
  description: 'Test task description',
  type: 'feature',
  priority: 'medium',
  status: 'pending',
  kanbanStatus: 'backlog',
  generatedBy: 'agent',
  githubIssueNumber: null,
  githubIssueUrl: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  completedAt: null,
  ...overrides,
});

export const createTestPendingAction = (overrides?: Partial<PendingAction>): PendingAction => ({
  id: 'test-action-1',
  projectId: 'test-project-1',
  type: 'github_create_issue',
  description: 'Test action',
  params: {},
  taskId: null,
  status: 'pending',
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
  ...overrides,
});

export const createTestReport = (overrides?: Partial<AnalysisReport>): AnalysisReport => ({
  id: 'test-report-1',
  projectId: 'test-project-1',
  type: 'health',
  summary: 'Test report',
  recommendations: [],
  findings: [],
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const createTestIdea = (overrides?: Partial<Idea>): Idea => ({
  id: 'test-idea-1',
  title: 'Test Idea',
  description: 'Test idea description',
  status: 'new',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

// Mock WebSocket broadcast
export const mockBroadcast = vi.fn();

// Mock Redis client
export const createMockRedis = () => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  keys: vi.fn(() => []),
  publish: vi.fn(),
  subscribe: vi.fn(),
  on: vi.fn(),
  quit: vi.fn(),
  disconnect: vi.fn(),
});

// Mock SQLite database
export const createMockDatabase = () => ({
  prepare: vi.fn(() => ({
    run: vi.fn(),
    get: vi.fn(),
    all: vi.fn(() => []),
  })),
  exec: vi.fn(),
  close: vi.fn(),
  transaction: vi.fn((fn) => fn),
});
