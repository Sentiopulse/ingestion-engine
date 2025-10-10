/**
 * @file fetchTelegramMessages.ts
 * @description Fetches messages from a specified Telegram channel.
 *
 * @example
 * // To run this function, you would typically have a TelegramClient instance
 * // and an ITelegramAccount object.
 * //
 * // Example usage (assuming client and account are already initialized):
 * // import { TelegramClient } from 'telegram';
 * // import { ITelegramAccount } from './types/input.d';
 * // import { fetchTelegramMessages } from './fetchTelegramMessages';
 * //
 * // async function main() {
 * //   const client = new TelegramClient(...); // Initialize your TelegramClient
 * //   const account: ITelegramAccount = {
 * //     accountId: 'test_account',
 * //     credentials: {
 * //       TELEGRAM_APP_ID: 'YOUR_APP_ID',
 * //       TELEGRAM_API_HASH: 'YOUR_API_HASH',
 * //       TELEGRAM_SESSION: 'YOUR_SESSION_STRING',
 * //       TELEGRAM_TG_CHANNEL: 'YOUR_CHANNEL_NAME_OR_ID',
 * //     },
 * //     platform: 'telegram',
 * //     isEnabled: true,
 * //     rotation: {
 * //       lastRotated: 0,
 * //       rotationInterval: 0,
 * //       rotationCounter: 0,
 * //     },
 * //   };
 * //
 * //   try {
 * //     const messages = await fetchTelegramMessages(client, account);
 * //     console.log('Fetched Telegram messages:', messages);
 * //   } catch (error) {
 * //     console.error('Error fetching Telegram messages:', error);
 * //   } finally {
 * //     await client.disconnect();
 * //   }
 * // }
 * //
 * // main().catch(console.error);
 */

import { Api, TelegramClient } from 'telegram';
import { trackApiKeyUsage } from './utils/redisUtils';
import { ITelegramAccount } from './types/input.d';

export type TelegramMessages = { id: string; content: string; channelId: string };

export async function fetchTelegramMessages(
  client: TelegramClient,
  account: ITelegramAccount
): Promise<TelegramMessages[]> {
  const channel = account.credentials.TELEGRAM_TG_CHANNEL;
  if (!channel) {
    throw new Error('TELEGRAM_TG_CHANNEL is not set in account credentials.');
  }

  if (process.env.DEBUG_TELEGRAM === '1') {
    console.log(`Using Telegram account: ${account.accountId} for channel: ${channel}`);
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
      limit: 10
    })
  );

  const out: TelegramMessages[] = [];

  if ('messages' in messages) {
    for (const msg of messages.messages as any[]) {
      const id = typeof msg?.id === 'number' || typeof msg?.id === 'string' ? String(msg.id) : null;
      const content = typeof msg?.message === 'string' ? msg.message : '';
      if (!id || !content) continue; // skip service/media-only messages
      const formatted = { id, content, channelId };
      out.push(formatted);
      console.log(formatted);
    }
  } else {
    console.log('No messages property found in response:', messages);
  }

  return out;
}
