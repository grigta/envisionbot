import { Telegraf, Markup } from "telegraf";
import type { Context } from "telegraf";
import { approvalQueue } from "./queue.js";
import { stateStore } from "../state/store.js";
import { runHealthCheck, runDeepAnalysis } from "../agent.js";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;

let bot: Telegraf | null = null;

export async function startTelegramBot(): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.log("TELEGRAM_BOT_TOKEN not set, skipping Telegram bot");
    return;
  }

  bot = new Telegraf(TELEGRAM_BOT_TOKEN);

  // Start command
  bot.start((ctx) => {
    ctx.reply(
      `👋 Welcome to Envision CEO Bot!\n\nI'll notify you about pending actions and let you approve/reject them.\n\nCommands:\n/status - Agent status\n/pending - View pending actions\n/health - Run health check\n/analysis - Run deep analysis`,
      { parse_mode: "Markdown" }
    );
  });

  // Status command
  bot.command("status", async (ctx) => {
    const stats = stateStore.getStats();
    const lastHealthCheck = stats.lastHealthCheck
      ? new Date(stats.lastHealthCheck).toLocaleString()
      : "Never";
    const lastDeepAnalysis = stats.lastDeepAnalysis
      ? new Date(stats.lastDeepAnalysis).toLocaleString()
      : "Never";

    await ctx.reply(
      `📊 *Envision CEO Status*\n\n` +
        `📁 Projects: ${stats.projectCount}\n` +
        `📝 Tasks: ${stats.taskCount}\n` +
        `⏳ Pending actions: ${stats.pendingActionsCount}\n\n` +
        `🏥 Last health check: ${lastHealthCheck}\n` +
        `📈 Last deep analysis: ${lastDeepAnalysis}`,
      { parse_mode: "Markdown" }
    );
  });

  // Pending actions command
  bot.command("pending", async (ctx) => {
    const pending = approvalQueue.getPending();

    if (pending.length === 0) {
      await ctx.reply("✅ No pending actions");
      return;
    }

    for (const action of pending.slice(0, 5)) {
      await sendActionApprovalMessage(ctx, action.id);
    }

    if (pending.length > 5) {
      await ctx.reply(`... and ${pending.length - 5} more pending actions`);
    }
  });

  // Health check command
  bot.command("health", async (ctx) => {
    await ctx.reply("🏥 Running health check...");
    try {
      const report = await runHealthCheck();
      if (report) {
        await ctx.reply(
          `✅ Health check complete!\n\nSummary: ${report.summary.slice(0, 500)}${
            report.summary.length > 500 ? "..." : ""
          }\n\nFindings: ${report.findings.length}\nTasks generated: ${report.generatedTasks.length}`
        );
      }
    } catch (error) {
      await ctx.reply(`❌ Health check failed: ${error}`);
    }
  });

  // Deep analysis command
  bot.command("analysis", async (ctx) => {
    await ctx.reply("📈 Running deep analysis...");
    try {
      const report = await runDeepAnalysis();
      if (report) {
        await ctx.reply(
          `✅ Deep analysis complete!\n\nSummary: ${report.summary.slice(0, 500)}${
            report.summary.length > 500 ? "..." : ""
          }\n\nFindings: ${report.findings.length}\nTasks generated: ${report.generatedTasks.length}`
        );
      }
    } catch (error) {
      await ctx.reply(`❌ Deep analysis failed: ${error}`);
    }
  });

  // Projects command
  bot.command("projects", async (ctx) => {
    const projects = stateStore.getProjects();

    if (projects.length === 0) {
      await ctx.reply("📁 No projects configured");
      return;
    }

    const projectList = projects
      .map((p) => `• *${p.name}* (${p.repo})\n  Phase: ${p.phase}`)
      .join("\n\n");

    await ctx.reply(`📁 *Projects*\n\n${projectList}`, { parse_mode: "Markdown" });
  });

  // Handle callback queries (approve/reject buttons)
  bot.on("callback_query", async (ctx) => {
    const data = (ctx.callbackQuery as { data?: string }).data;
    if (!data) return;

    const [action, actionId] = data.split(":");

    if (action === "approve") {
      const result = await approvalQueue.approve(actionId);
      if (result.success) {
        await ctx.answerCbQuery("✅ Approved!");
        await ctx.editMessageReplyMarkup(undefined);
        await ctx.reply(`✅ Action ${actionId} approved and executed`);
      } else {
        await ctx.answerCbQuery(`❌ Failed: ${result.error}`);
      }
    } else if (action === "reject") {
      const result = approvalQueue.reject(actionId, "Rejected via Telegram");
      if (result.success) {
        await ctx.answerCbQuery("❌ Rejected");
        await ctx.editMessageReplyMarkup(undefined);
        await ctx.reply(`❌ Action ${actionId} rejected`);
      } else {
        await ctx.answerCbQuery(`Failed: ${result.error}`);
      }
    } else if (action === "details") {
      const pendingAction = approvalQueue.getAction(actionId);
      if (pendingAction) {
        await ctx.answerCbQuery();
        await ctx.reply(
          `📋 *Action Details*\n\n` +
            `Type: ${pendingAction.action.type}\n` +
            `Description: ${pendingAction.action.description}\n\n` +
            `Payload:\n\`\`\`json\n${JSON.stringify(pendingAction.action.payload, null, 2)}\n\`\`\``,
          { parse_mode: "Markdown" }
        );
      }
    }
  });

  // Error handling
  bot.catch((err) => {
    console.error("Telegram bot error:", err);
  });

  // Start bot
  await bot.launch();
  console.log("Telegram bot started");

  // Enable graceful stop
  process.once("SIGINT", () => bot?.stop("SIGINT"));
  process.once("SIGTERM", () => bot?.stop("SIGTERM"));
}

// Send action approval message with buttons
async function sendActionApprovalMessage(ctx: Context, actionId: string): Promise<void> {
  const action = approvalQueue.getAction(actionId);
  if (!action) return;

  const message = await ctx.reply(
    `🤖 *Envision CEO Action Request*\n\n` +
      `Type: ${action.action.type}\n` +
      `Description: ${action.action.description}\n\n` +
      `Expires: ${new Date(action.expiresAt).toLocaleString()}`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback("✅ Approve", `approve:${actionId}`),
          Markup.button.callback("❌ Reject", `reject:${actionId}`),
        ],
        [Markup.button.callback("📋 Details", `details:${actionId}`)],
      ]),
    }
  );

  // Store message ID for later updates
  approvalQueue.setTelegramMessageId(actionId, message.message_id);
}

// Notify admin about new pending action
export async function notifyPendingAction(actionId: string): Promise<void> {
  if (!bot || !ADMIN_CHAT_ID) return;

  const action = approvalQueue.getAction(actionId);
  if (!action) return;

  try {
    const message = await bot.telegram.sendMessage(
      ADMIN_CHAT_ID,
      `🤖 *New Action Pending*\n\n` +
        `Type: ${action.action.type}\n` +
        `Description: ${action.action.description}\n\n` +
        `Expires: ${new Date(action.expiresAt).toLocaleString()}`,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback("✅ Approve", `approve:${actionId}`),
            Markup.button.callback("❌ Reject", `reject:${actionId}`),
          ],
          [Markup.button.callback("📋 Details", `details:${actionId}`)],
        ]),
      }
    );

    approvalQueue.setTelegramMessageId(actionId, message.message_id);
  } catch (error) {
    console.error("Failed to send Telegram notification:", error);
  }
}

// Send notification to admin
export async function sendNotification(message: string): Promise<void> {
  if (!bot || !ADMIN_CHAT_ID) return;

  try {
    await bot.telegram.sendMessage(ADMIN_CHAT_ID, message, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Failed to send Telegram notification:", error);
  }
}
