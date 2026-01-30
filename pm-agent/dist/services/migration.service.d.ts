/**
 * Migration Service
 * Migrates data from JSON files to SQLite database
 */
import type Database from "better-sqlite3";
export interface MigrationResult {
    success: boolean;
    alreadyMigrated: boolean;
    migratedCounts: {
        projects: number;
        tasks: number;
        pendingActions: number;
        metrics: number;
        reports: number;
        ideas: number;
        chatSessions: number;
        chatMessages: number;
    };
    errors: string[];
}
export declare class MigrationService {
    private readonly db;
    private readonly dataDir;
    constructor(db: Database.Database, dataDir: string);
    migrate(): Promise<MigrationResult>;
    private migrateStateFile;
    private migrateProjectsFile;
    private migrateChatHistory;
    private insertProject;
    private insertTask;
    private insertPendingAction;
    private insertMetric;
    private insertReport;
    private insertIdea;
    private backupOriginalFiles;
}
//# sourceMappingURL=migration.service.d.ts.map