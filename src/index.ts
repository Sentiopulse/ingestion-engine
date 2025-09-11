import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import input from "input"; // interactive input for login
import { Api } from "telegram";
import cron from 'node-cron';
import { runRedisOperation } from './utils/redisUtils';
import 'dotenv/config';

// Replace these with your values
const apiId = Number(process.env.API_ID);
const apiHash = process.env.API_HASH as string;
const stringSession = new StringSession(process.env.TG_SESSION ?? ""); // use existing session if available

async function fetchTelegramMessages(
  client: TelegramClient
): Promise<Array<{ id: string; content: string; channelId: string }>> {
  const channel = process.env.TG_CHANNEL; // configurable channel
  if (!channel) {
    throw new Error("TG_CHANNEL environment variable is not set.");
  }
  // Fetch channel entity to get the actual channel ID
  let entity: Api.Channel | Api.ChannelForbidden;
  try {
    const resolved = await client.getEntity(channel);
    if (resolved instanceof Api.Channel || resolved instanceof Api.ChannelForbidden) {
      entity = resolved;
    } else {
      throw new Error(`TG_CHANNEL \"${channel}\" is not a channel-type peer.`);
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
  await fetchTelegramMessages(client);

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

startTelegramCron();


async function main() {
  await runRedisOperation(async (client) => {
    await client.set('test-key', 'hello-redis');
    const value = await client.get('test-key');
    console.log('Read value from Redis:', value);
  });
}

main();

// Schedule to run every 5 minutes (guard against overlap + handle errors)
let twitterJobRunning = false;
cron.schedule('*/5 * * * *', async () => {
  if (twitterJobRunning) {
    console.warn('Refetch skipped: previous Twitter job still running.');
    return;
  }
  twitterJobRunning = true;
  console.log('Refetching Twitter messages...');
  try {
    await main();
  } catch (err) {
    console.error('Scheduled Twitter fetch failed:', err);
  } finally {
    twitterJobRunning = false;
  }
});

