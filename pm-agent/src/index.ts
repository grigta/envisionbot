import "dotenv/config";
import { startServer } from "./server.js";
import { startTelegramBot, sendNotification } from "./approval/telegram-bot.js";
import { startScheduler, stopScheduler } from "./scheduler.js";
import { stateStore } from "./state/store.js";
import { getAuthMethod, getAnthropicApiKey } from "./auth.js";

async function main(): Promise<void> {
  console.log("🚀 Starting Envision CEO...\n");

  // Check authentication
  const authMethod = getAuthMethod();
  if (authMethod === "none") {
    console.error("❌ No authentication found!");
    console.error("   Options:");
    console.error("   1. Set ANTHROPIC_API_KEY environment variable");
    console.error("   2. Set CLAUDE_CODE_OAUTH_TOKEN environment variable");
    console.error("   3. Login to Claude Code (token will be read from keychain)");
    process.exit(1);
  }

  // Validate token can be retrieved
  try {
    getAnthropicApiKey();
  } catch (error) {
    console.error("❌ Failed to get API key:", error);
    process.exit(1);
  }

  const authLabels = {
    api_key: "ANTHROPIC_API_KEY (pay-as-you-go)",
    oauth_token: "CLAUDE_CODE_OAUTH_TOKEN",
    keychain: "Claude Code subscription (keychain)",
  };
  console.log(`🔑 Auth: ${authLabels[authMethod]}\n`);

  // Load initial state
  const stats = stateStore.getStats();
  console.log(`📊 Loaded state:`);
  console.log(`   Projects: ${stats.projectCount}`);
  console.log(`   Tasks: ${stats.taskCount}`);
  console.log(`   Pending actions: ${stats.pendingActionsCount}\n`);

  // Start components
  try {
    // Start HTTP/WebSocket server
    await startServer();
    console.log("");

    // Start Telegram bot
    await startTelegramBot();
    console.log("");

    // Start scheduler
    startScheduler();
    console.log("");

    console.log("✅ Envision CEO is running!");
    console.log("");

    // Send startup notification
    await sendNotification(
      `🚀 *Envision CEO Started*\n\n` +
        `Projects: ${stats.projectCount}\n` +
        `Tasks: ${stats.taskCount}\n` +
        `Pending actions: ${stats.pendingActionsCount}`
    );
  } catch (error) {
    console.error("❌ Failed to start Envision CEO:", error);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    console.log("\n🛑 Shutting down Envision CEO...");

    // Stop scheduler
    stopScheduler();

    // Save state
    stateStore.save();

    console.log("👋 Goodbye!");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();
