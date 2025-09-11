import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import input from "input"; // interactive input for login
import { Api } from "telegram";
import cron from 'node-cron';
import { runRedisOperation } from './utils/redisUtils';
import 'dotenv/config';

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

async function fetchTelegramMessages(
  client: TelegramClient
): Promise<Array<{ id: string; content: string; channelId: string }>> {
  const channel = process.env.TG_CHANNEL; // configurable channel
  if (!channel) {
    throw new Error("TG_CHANNEL environment variable is not set.");
  }
  // Fetch channel entity to get the actual channel ID
  let entity: Api.Channel;
  try {
    const resolved = await client.getEntity(channel);
    if (resolved instanceof Api.Channel) {
      entity = resolved;
    } else if (resolved instanceof Api.ChannelForbidden) {
      throw new Error(`TG_CHANNEL "${channel}" is a private/forbidden channel; cannot fetch history.`);
    } else {
      throw new Error(`TG_CHANNEL "${channel}" is not a channel-type peer.`);
    }
  } catch (e) {
    throw new Error(`Failed to resolve TG_CHANNEL \"${channel}\": ${e instanceof Error ? e.message : e}`);
  }
  const channelId = String(entity.id);
  const messages = await client.invoke(
    new Api.messages.GetHistory({
      peer: entity,
      limit: 10,
    })
  );
  const out: Array<{ id: string; content: string; channelId: string }> = [];
  if ("messages" in messages) {
    for (const msg of messages.messages as any[]) {
      const id = typeof msg?.id === 'number' || typeof msg?.id === 'string' ? String(msg.id) : null;
      const content = typeof msg?.message === 'string' ? msg.message : '';
      if (!id || !content) continue; // skip service/media-only
      const formatted = { id, content, channelId };
      out.push(formatted);
      console.log(formatted);
    }
  } else {
    console.log("No messages property found in response:", messages);
  }
  return out;
}

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
    await fetchTelegramMessages(client);
  } catch (err) {
    console.error("Startup Telegram fetch failed:", err);
  }

  // Schedule to run every 5 minutes (guarded)
  let telegramJobRunning = false;
  cron.schedule('*/5 * * * *', async () => {
    if (telegramJobRunning) {
      console.warn('Refetch skipped: previous Telegram job still running.');
      return;
    }
    telegramJobRunning = true;
    console.log('Refetching Telegram messages...');
    try {
      await fetchTelegramMessages(client);
    } catch (err) {
      console.error('Scheduled Telegram fetch failed:', err);
    } finally {
      telegramJobRunning = false;
    }
  });

  // Keep process alive
}

startTelegramCron().catch((err) => {
  console.error("Failed to start Telegram cron:", err);
});


async function main() {
  await runRedisOperation(async (client) => {
    await client.set('test-key', 'hello-redis');
    const value = await client.get('test-key');
    console.log('Read value from Redis:', value);
  });
}

main();


