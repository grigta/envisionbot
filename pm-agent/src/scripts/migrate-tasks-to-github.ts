/**
 * Migration Script: Create GitHub Issues for Existing Tasks
 *
 * This script creates GitHub Issues for all existing pending/approved tasks
 * that don't already have a GitHub issue associated.
 *
 * Usage:
 *   npm run migrate:github-issues
 */

import { initDatabase } from "../db/index.js";
import { TaskRepository } from "../repositories/task.repository.js";
import { ProjectRepository } from "../repositories/project.repository.js";
import { GitHubIssueService } from "../services/github-issue.service.js";

async function main() {
  console.log("🚀 Starting GitHub Issues migration...\n");

  // Initialize database
  const db = await initDatabase({
    dataDir: "./data",
  });

  const deps = {
    db: db.sqlite,
    cache: db.cache,
    pubsub: db.pubsub,
  };

  const taskRepo = new TaskRepository(deps);
  const projectRepo = new ProjectRepository(deps);
  const githubService = new GitHubIssueService(taskRepo, projectRepo);

  // Get all pending/approved tasks without GitHub issues
  const tasks = await taskRepo.getAll();
  const tasksToMigrate = tasks.filter(
    (task) =>
      (task.status === "pending" || task.status === "approved") &&
      !task.githubIssueNumber
  );

  console.log(`Found ${tasksToMigrate.length} tasks to migrate\n`);

  if (tasksToMigrate.length === 0) {
    console.log("✅ No tasks need migration");
    await db.close();
    return;
  }

  let success = 0;
  let failed = 0;
  const errors: Array<{ taskId: string; error: string }> = [];

  for (const task of tasksToMigrate) {
    console.log(`\n📝 Migrating task ${task.id}:`);
    console.log(`   Title: ${task.title}`);
    console.log(`   Status: ${task.status}`);
    console.log(`   Priority: ${task.priority}`);

    try {
      const result = await githubService.createIssueForTask(task.id);

      if (result.success) {
        console.log(`   ✅ Created issue #${result.issueNumber}`);
        console.log(`   🔗 ${result.issueUrl}`);
        success++;
      } else {
        console.error(`   ❌ Failed: ${result.error}`);
        errors.push({ taskId: task.id, error: result.error || "Unknown error" });
        failed++;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`   ❌ Error: ${errorMessage}`);
      errors.push({ taskId: task.id, error: errorMessage });
      failed++;
    }

    // Rate limiting: wait 1 second between requests
    if (tasksToMigrate.indexOf(task) < tasksToMigrate.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("\n📊 Migration Summary:");
  console.log(`   Total tasks: ${tasksToMigrate.length}`);
  console.log(`   ✅ Successful: ${success}`);
  console.log(`   ❌ Failed: ${failed}`);

  if (errors.length > 0) {
    console.log("\n⚠️  Failed tasks:");
    for (const error of errors) {
      console.log(`   - Task ${error.taskId}: ${error.error}`);
    }
  }

  console.log("\n" + "=".repeat(60));

  await db.close();

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("\n💥 Fatal error:", error);
  process.exit(1);
});
