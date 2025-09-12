import { Api, TelegramClient } from "telegram";
import { trackApiKeyUsage } from './utils/redisUtils';

export type TelegramMessages = { id: string; content: string; channelId: string };

export async function fetchTelegramMessages(
  client: TelegramClient,
  channel: string
): Promise<TelegramMessages[]> {
  if (!channel) {
    throw new Error("TG_CHANNEL environment variable is not set.");
  }
  const apiId = process.env.API_ID;

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

  const out: TelegramMessages[] = [];

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
  if (apiId) {
    let accountId: string;
    try {
      const me = await client.getMe();
      if (me && me.id) {
        accountId = String(me.id);
      } else {
        throw new Error('Unable to determine Telegram account ID');
      }
    } catch (e) {
      throw new Error('Unable to determine Telegram account ID');
    }
    await trackApiKeyUsage({ accountId, platform: 'telegram' });
  }

  return out;
}
