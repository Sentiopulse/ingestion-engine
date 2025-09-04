import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import input from "input"; // interactive input for login
import { Api } from "telegram";

// Replace these with your values
const apiId = 26767039;
const apiHash = "5c9c82971de30b5e71030c27878b8115";
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
  if (process.env.PRINT_TG_SESSION === "1") {
    console.log("Your session string:", client.session.save());
  } else {
    console.log(
      "Session created. Set PRINT_TG_SESSION=1 to print it explicitly."
    );
  }

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
