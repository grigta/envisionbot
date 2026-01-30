import schedule from "node-schedule";
import { runHealthCheck, runDeepAnalysis } from "./agent.js";
import { sendNotification } from "./approval/telegram-bot.js";
import { stateStore } from "./state/store.js";
import { broadcast } from "./server.js";
import { getAuthConfig } from "./auth.js";
import type { CrawlerServiceAuthConfig } from "./services/crawler.service.js";

// Helper to get auth config for crawler service
function getCrawlerAuthConfig(): CrawlerServiceAuthConfig {
  try {
    const config = getAuthConfig();
    if (config.type === "oauth_token") {
      return { authToken: config.token };
    }
    return { apiKey: config.token };
  } catch {
    return { apiKey: process.env.ANTHROPIC_API_KEY };
  }
}

// Parse interval string (e.g., "4h", "30m", "1d")
function parseInterval(interval: string): number {
  const match = interval.match(/^(\d+)([hmd])$/);
  if (!match) {
    console.error(`Invalid interval format: ${interval}, defaulting to 4h`);
    return 4 * 60 * 60 * 1000;
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    default:
      return 4 * 60 * 60 * 1000;
  }
}

// Parse time string (e.g., "09:00")
function parseTime(time: string): { hour: number; minute: number } {
  const [hour, minute] = time.split(":").map((n) => parseInt(n, 10));
  return { hour: hour || 9, minute: minute || 0 };
}

let healthCheckJob: schedule.Job | null = null;
let deepAnalysisJob: schedule.Job | null = null;
let newsCrawlJob: schedule.Job | null = null;
let universalCrawlerJob: schedule.Job | null = null;
let taskExecutorJob: schedule.Job | null = null;

export function startScheduler(): void {
  const healthCheckInterval = process.env.HEALTH_CHECK_INTERVAL || "4h";
  const deepAnalysisTime = process.env.DEEP_ANALYSIS_TIME || "09:00";
  const timezone = process.env.TIMEZONE || "Europe/Moscow";

  console.log(`Starting scheduler with:`);
  console.log(`  Health check interval: ${healthCheckInterval}`);
  console.log(`  Deep analysis time: ${deepAnalysisTime}`);
  console.log(`  Timezone: ${timezone}`);

  // Schedule health checks
  const intervalMs = parseInterval(healthCheckInterval);
  const intervalHours = intervalMs / (60 * 60 * 1000);

  // Use cron-style schedule for health checks (e.g., every 4 hours)
  const healthCheckCron = `0 */${Math.round(intervalHours)} * * *`;

  healthCheckJob = schedule.scheduleJob(healthCheckCron, async () => {
    console.log("🔍 Running scheduled health check...");
    try {
      const report = await runHealthCheck();
      if (report && report.findings.some((f) => f.severity === "critical" || f.severity === "error")) {
        await sendNotification(
          `🚨 *Health Check Alert*\n\n` +
            `Found ${report.findings.filter((f) => f.severity === "critical").length} critical and ` +
            `${report.findings.filter((f) => f.severity === "error").length} error findings.\n\n` +
            `Summary: ${report.summary.slice(0, 200)}...`
        );
      }
      console.log("✅ Health check completed");
    } catch (error) {
      console.error("❌ Health check failed:", error);
      await sendNotification(`❌ *Health Check Failed*\n\n${error}`);
    }
  });

  console.log(`📅 Health check scheduled: ${healthCheckCron}`);

  // Schedule deep analysis
  const { hour, minute } = parseTime(deepAnalysisTime);
  const deepAnalysisCron = `${minute} ${hour} * * 1-5`; // Weekdays only

  deepAnalysisJob = schedule.scheduleJob(
    { rule: deepAnalysisCron, tz: timezone },
    async () => {
      console.log("📊 Running scheduled deep analysis...");
      try {
        const report = await runDeepAnalysis();
        if (report) {
          await sendNotification(
            `📊 *Daily Analysis Complete*\n\n` +
              `Projects analyzed: ${report.projectIds.length}\n` +
              `Findings: ${report.findings.length}\n` +
              `Tasks generated: ${report.generatedTasks.length}\n\n` +
              `Summary: ${report.summary.slice(0, 300)}...`
          );
        }
        console.log("✅ Deep analysis completed");
      } catch (error) {
        console.error("❌ Deep analysis failed:", error);
        await sendNotification(`❌ *Deep Analysis Failed*\n\n${error}`);
      }
    }
  );

  console.log(`📅 Deep analysis scheduled: ${deepAnalysisCron} (${timezone})`);

  // Schedule news crawl
  const newsCrawlEnabled = process.env.NEWS_CRAWL_ENABLED !== "false";
  const newsCrawlTime = process.env.NEWS_CRAWL_TIME || "06:00";

  if (newsCrawlEnabled) {
    const { hour: newsHour, minute: newsMinute } = parseTime(newsCrawlTime);
    const newsCrawlCron = `${newsMinute} ${newsHour} * * *`; // Every day

    newsCrawlJob = schedule.scheduleJob(
      { rule: newsCrawlCron, tz: timezone },
      async () => {
        console.log("📰 Running scheduled news crawl...");
        try {
          const deps = stateStore.getRepositoryDeps();
          if (!deps) {
            console.error("Database not initialized for news crawl");
            return;
          }

          const { NewsService } = await import("./services/news.service.js");
          const newsService = new NewsService(deps);

          const result = await newsService.runCrawl({
            fetchDetails: false,
            limit: 25,
            onProgress: (progress) => {
              broadcast({
                type: "news_crawl_progress",
                timestamp: Date.now(),
                data: progress,
              });
            },
          });

          if (result.success) {
            await sendNotification(
              `📰 *News Crawl Complete*\n\n` +
                `Found: ${result.items.length} items\n` +
                `New: ${result.newCount}\n` +
                `Updated: ${result.updatedCount}`
            );

            broadcast({
              type: "news_updated",
              timestamp: Date.now(),
              data: {
                success: true,
                newCount: result.newCount,
                updatedCount: result.updatedCount,
              },
            });
          }
          console.log("✅ News crawl completed");
        } catch (error) {
          console.error("❌ News crawl failed:", error);
          await sendNotification(`❌ *News Crawl Failed*\n\n${error}`);
        }
      }
    );

    console.log(`📅 News crawl scheduled: ${newsCrawlCron} (${timezone})`);
  } else {
    console.log("📰 News crawl disabled");
  }

  // Schedule task executor (every 5 minutes)
  const taskExecutorEnabled = process.env.TASK_EXECUTOR_ENABLED === "true";

  if (taskExecutorEnabled) {
    const taskExecutorInterval = process.env.TASK_EXECUTOR_INTERVAL || "*/5 * * * *";

    taskExecutorJob = schedule.scheduleJob(taskExecutorInterval, async () => {
      console.log("[TaskExecutor] Checking for executable tasks...");
      try {
        const deps = stateStore.getRepositoryDeps();
        if (!deps) {
          console.error("Database not initialized for task executor");
          return;
        }

        const { TaskExecutorService } = await import("./services/task-executor.service.js");
        const { PlanTrackerService } = await import("./services/plan-tracker.service.js");
        const { TaskRepository } = await import("./repositories/task.repository.js");

        const taskRepo = new TaskRepository(deps);
        const planTracker = new PlanTrackerService();
        const taskExecutor = new TaskExecutorService(taskRepo, planTracker);

        const executed = await taskExecutor.executeNextTask();

        if (executed) {
          console.log("[TaskExecutor] ✅ Task executed successfully");

          // Broadcast WebSocket update
          broadcast({
            type: "task_updated",
            timestamp: Date.now(),
            data: { action: "task_completed" },
          });
        }
      } catch (error) {
        console.error("[TaskExecutor] ❌ Task execution failed:", error);
      }
    });

    console.log(`📅 Task executor scheduled: ${taskExecutorInterval}`);
  } else {
    console.log("🤖 Task executor disabled");
  }

  // Schedule universal crawler check (every hour)
  const crawlerEnabled = process.env.UNIVERSAL_CRAWLER_ENABLED !== "false";

  if (crawlerEnabled) {
    const crawlerCron = "0 * * * *"; // Every hour

    universalCrawlerJob = schedule.scheduleJob(crawlerCron, async () => {
      console.log("🕷️ Checking for crawler sources due for crawl...");
      try {
        const deps = stateStore.getRepositoryDeps();
        if (!deps) {
          console.error("Database not initialized for crawler");
          return;
        }

        const { CrawlerService } = await import("./services/crawler.service.js");
        const { CrawlerRepository } = await import("./repositories/crawler.repository.js");

        const repo = new CrawlerRepository(deps);
        const service = new CrawlerService(repo, getCrawlerAuthConfig());

        const results = await service.crawlAllDue();

        if (results.length > 0) {
          const successful = results.filter((r) => r.success).length;
          const failed = results.filter((r) => !r.success).length;

          console.log(`✅ Crawler check completed: ${successful} successful, ${failed} failed`);

          if (failed > 0) {
            await sendNotification(
              `🕷️ *Crawler Check*\n\n` +
                `Sources crawled: ${results.length}\n` +
                `Successful: ${successful}\n` +
                `Failed: ${failed}`
            );
          }

          broadcast({
            type: "news_updated",
            timestamp: Date.now(),
            data: { action: "crawler_check_complete", results },
          });
        }
      } catch (error) {
        console.error("❌ Crawler check failed:", error);
      }
    });

    console.log(`📅 Universal crawler scheduled: every hour`);
  } else {
    console.log("🕷️ Universal crawler disabled");
  }
}

export function stopScheduler(): void {
  if (healthCheckJob) {
    healthCheckJob.cancel();
    healthCheckJob = null;
  }
  if (deepAnalysisJob) {
    deepAnalysisJob.cancel();
    deepAnalysisJob = null;
  }
  if (newsCrawlJob) {
    newsCrawlJob.cancel();
    newsCrawlJob = null;
  }
  if (universalCrawlerJob) {
    universalCrawlerJob.cancel();
    universalCrawlerJob = null;
  }
  if (taskExecutorJob) {
    taskExecutorJob.cancel();
    taskExecutorJob = null;
  }
  console.log("Scheduler stopped");
}

// Get next scheduled runs
export function getScheduleInfo(): {
  nextHealthCheck?: Date;
  nextDeepAnalysis?: Date;
  nextNewsCrawl?: Date;
  nextCrawlerCheck?: Date;
  nextTaskExecution?: Date;
} {
  return {
    nextHealthCheck: healthCheckJob?.nextInvocation() ?? undefined,
    nextDeepAnalysis: deepAnalysisJob?.nextInvocation() ?? undefined,
    nextNewsCrawl: newsCrawlJob?.nextInvocation() ?? undefined,
    nextCrawlerCheck: universalCrawlerJob?.nextInvocation() ?? undefined,
    nextTaskExecution: taskExecutorJob?.nextInvocation() ?? undefined,
  };
}
