import 'dotenv/config';
import input from "input"; // interactive input for login
import cron from 'node-cron';
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { fetchTelegramMessages } from './fetchTelegramMessages';
import { telegramAccountManager, TelegramAccount } from './services/telegramAccountManager';

// Create a map to store clients for each account
const clientMap = new Map<string, TelegramClient>();

async function createTelegramClient(account: TelegramAccount): Promise<TelegramClient> {
  // Check if we already have a client for this account
  if (clientMap.has(account.accountId)) {
    return clientMap.get(account.accountId)!;
  }

  console.log(`Creating Telegram client for account: ${account.accountId}`);

  const apiId = Number(account.credentials.TELEGRAM_API_ID);
  const apiHash = account.credentials.TELEGRAM_API_HASH;

  if (!Number.isFinite(apiId)) {
    throw new Error(`Invalid API_ID for account ${account.accountId}`);
  }
  if (!apiHash) {
    throw new Error(`API_HASH not set for account ${account.accountId}`);
  }

  // Fetch per-account session string from Redis (not env)
  const redisClient = (telegramAccountManager as any).redisClient;
  await redisClient.connect?.();
  const sessionKey = `telegram_session:${account.accountId}`;
  let sessionStr = await redisClient.get(sessionKey);
  const isInteractive = Boolean(process.stdin.isTTY);
  if (!sessionStr && !isInteractive) {
    throw new Error(`Missing session in Redis for ${account.accountId} (key: ${sessionKey}). Generate and store a session string before running cron.`);
  }
  sessionStr = sessionStr || "";
  const stringSession = new StringSession(sessionStr);
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await input.text("Enter your phone number: "),
    password: async () => await input.text("Enter 2FA password (if enabled): "),
    phoneCode: async () => await input.text("Enter code you received: "),
    onError: (err) => console.log(err),
  });

  console.log(`Logged in successfully for account: ${account.accountId}`);
  const saved = client.session.save();
  if (process.env.PRINT_TG_SESSION === "1" && isInteractive) {
    // Emit an export-ready line deliberately, instead of dumping secrets in logs
    console.log(`export ${sessionKey}="${saved}"`);
  }

  // Store the client for reuse
  clientMap.set(account.accountId, client);

  return client;
}

async function startTelegramCron() {
  console.log("Starting Telegram account rotation system...");

  // Run once at startup
  try {
    const account = await telegramAccountManager.getEarliestUsedAccount();
    const client = await createTelegramClient(account);

    await fetchTelegramMessages(client, account);

    // Show usage statistics for all accounts
    const allAccounts = await telegramAccountManager.getAllAccountsUsage();
    console.log('All Telegram accounts usage:');
    allAccounts.forEach((acc, index) => {
      console.log(`  Account ${index + 1} (${acc.accountId}):`);
      console.log(`    Total requests: ${acc.totalRequests}`);
      console.log(`    Last used: ${acc.lastUsed || 'Never'}`);
    });
  } catch (err) {
    console.error("Startup Telegram fetch failed:", err);
  }

  // Schedule to run every 5 minutes with account rotation
  cron.schedule('*/5 * * * *', async () => {
    console.log('Refetching Telegram messages with account rotation...');
    try {
      const account = await telegramAccountManager.getEarliestUsedAccount();
      const client = await createTelegramClient(account);

      await fetchTelegramMessages(client, account);
      console.log(`Fetched messages using account: ${account.accountId}`);
    } catch (err) {
      console.error('Scheduled Telegram fetch failed:', err);
    }
  });

  // Keep process alive
}

startTelegramCron().catch((err) => {
  console.error("Failed to start Telegram cron:", err);
});




