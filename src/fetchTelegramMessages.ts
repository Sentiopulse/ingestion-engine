import { Api, TelegramClient } from "telegram";

export type TelegramMessage = { id: string; content: string; channelId: string };

export async function fetchTelegramMessages(
  client: TelegramClient,
  channel: string
): Promise<TelegramMessage[]> {
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
    throw new Error(`Failed to resolve TG_CHANNEL "${channel}": ${e instanceof Error ? e.message : e}`);
  }

  const channelId = String(entity.id);

  // Fetch the latest 10 messages
  const messages = await client.invoke(
    new Api.messages.GetHistory({
      peer: entity,
      limit: 10,
    })
  );

  const out: TelegramMessage[] = [];

  if ("messages" in messages) {
    for (const msg of messages.messages as any[]) {
      const id = typeof msg?.id === 'number' || typeof msg?.id === 'string' ? String(msg.id) : null;
      const content = typeof msg?.message === 'string' ? msg.message : '';
      if (!id || !content) continue; // skip service/media-only messages
      const formatted = { id, content, channelId };
      out.push(formatted);
      console.log(formatted);
    }
  } else {
    console.log("No messages property found in response:", messages);
  }

  // Track API usage after successful fetch
  if (process.env.API_ID) {
    let accountHandle: string;

    try {
      // Automatically get the logged-in Telegram account
      const me = await client.getMe();
      if (me) {
        if (me.username && me.username.length > 0) {
          accountHandle = `@${me.username}`; // use username if available
        } else {
          accountHandle = String(me.id); // fallback to numeric Telegram ID
        }
      } else {
        accountHandle = String(channelId); // fallback if getMe returns nothing
      }
    } catch (e) {
      accountHandle = String(channelId); // fallback on error
    }

    const { trackApiKeyUsage } = await import('./utils/redisUtils');
    await trackApiKeyUsage(process.env.API_ID as string, accountHandle);
  }

  return out;
}
