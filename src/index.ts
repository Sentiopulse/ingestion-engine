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
const stringSession = new StringSession(""); // empty = new login

async function fetchTelegramMessages(client: TelegramClient) {
  const channel = process.env.TG_CHANNEL; // configurable channel
  if (!channel) {
    throw new Error("TG_CHANNEL environment variable is not set.");
  }
  // Fetch channel entity to get the actual channel ID
  const channelEntity = await client.getEntity(channel) as Api.Channel;
  const channelId = String(channelEntity.id);
  const messages = await client.invoke(
    new Api.messages.GetHistory({
      peer: channel,
      limit: 10,
    })
  );
  if ("messages" in messages) {
    messages.messages.forEach((msg: any) => {
      const formatted = {
        id: String(msg.id),
        content: msg.message,
        channelId: channelId
      };
      console.log(formatted);
    });
  } else {
    console.log("No messages property found in response:", messages);
  }
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

  // Schedule to run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    console.log('Refetching Telegram messages...');
    await fetchTelegramMessages(client);
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

