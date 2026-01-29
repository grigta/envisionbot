import schedule from "node-schedule";
import { runHealthCheck, runDeepAnalysis } from "./agent.js";
import { sendNotification } from "./approval/telegram-bot.js";

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
  console.log("Scheduler stopped");
}

// Get next scheduled runs
export function getScheduleInfo(): {
  nextHealthCheck?: Date;
  nextDeepAnalysis?: Date;
} {
  return {
    nextHealthCheck: healthCheckJob?.nextInvocation() ?? undefined,
    nextDeepAnalysis: deepAnalysisJob?.nextInvocation() ?? undefined,
  };
}
