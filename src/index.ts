import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import input from "input"; // interactive input for login
import { Api } from "telegram";
import "dotenv/config"; // simplest way


// Replace these with your values
const apiId = Number(process.env.API_ID);
const apiHash = process.env.API_HASH as string;
const stringSession = new StringSession(""); // empty = new login

(async () => {
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
  console.log("Your session string:", client.session.save()); // save for next time

  // Example: fetch last 10 messages from a public channel
  const channel = "@garden_btc"; // replace with any public channel username
  const messages = await client.invoke(
    new Api.messages.GetHistory({
      peer: channel,
      limit: 10,
    })
  );

  if ("messages" in messages) {
    messages.messages.forEach((msg: any) => {
      console.log(msg.id, msg.message, msg.date);
    });
  } else {
    console.log("No messages property found in response:", messages);
  }

  await client.disconnect();
})();
