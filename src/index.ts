import 'dotenv/config';
import input from "input"; // interactive input for login
import cron from 'node-cron';
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { fetchTelegramMessages } from './fetchTelegramMessages';

// Replace these with your values
const apiId = Number(process.env.API_ID);
const apiHash = process.env.API_HASH ?? "";
if (!Number.isFinite(apiId)) {
  throw new Error("API_ID environment variable is missing or not a valid number.");
}
if (!apiHash) {
  throw new Error("API_HASH environment variable is not set.");
}
const stringSession = new StringSession(process.env.TG_SESSION ?? ""); // use existing session if available

async function startTelegramCron() {
  console.log("Starting Telegram client...");
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await input.text("Enter your phone number: "),
    password: async () => await input.text("Enter 2FA password (if enabled): "),
    phoneCode: async () => await input.text("Enter code you received: "),
    onError: (err) => console.log(err),
  });

  console.log("Logged in successfully!");
  if (process.env.PRINT_TG_SESSION === "1") {
    console.log("Your session string:", client.session.save());
  } else {
    console.log(
      "Session created. Set PRINT_TG_SESSION=1 to print it explicitly."
    );
  }

  // Run once at startup
  try {
    await fetchTelegramMessages(client, process.env.TG_CHANNEL!);
    // Print Telegram API usage stats once
    const { getApiKeyUsage } = await import('./utils/redisUtils');
    const usage = await getApiKeyUsage(process.env.API_ID as string);
    console.log('Telegram API usage:', usage);
  } catch (err) {
    console.error("Startup Telegram fetch failed:", err);
  }

  // Schedule to run every 5 minutes (no overlap guard)
  cron.schedule('*/5 * * * *', async () => {
    console.log('Refetching Telegram messages...');
    try {
      await fetchTelegramMessages(client, process.env.TG_CHANNEL!);
      // No duplicate print of Telegram API usage
    } catch (err) {
      console.error('Scheduled Telegram fetch failed:', err);
    }
  });

  // Keep process alive
}

startTelegramCron().catch((err) => {
  console.error("Failed to start Telegram cron:", err);
});




