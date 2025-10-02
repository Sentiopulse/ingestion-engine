import crypto from 'crypto';
import { createClient } from 'redis';

// Singleton Redis client
const redisClient = createClient({ url: 'redis://localhost:6379' });
let redisConnected = false;

redisClient.on('error', (err) => {
  console.error('Redis Client Error', err);
});

async function ensureRedisConnected() {
  if (!redisConnected) {
    await redisClient.connect();
    redisConnected = true;
  }
}
export async function trackApiKeyUsage({
  accountId,
  platform
}: {
  accountId: string;
  platform: 'telegram' | 'twitter';
}): Promise<void> {
  if (!accountId?.trim()) {
    console.warn('trackApiKeyUsage: empty accountId; skipping');
    return;
  }

  try {
    await ensureRedisConnected();
    let key: string;
    if (platform === 'twitter') {
      key = `twitter_accounts:${accountId}`;
    } else if (platform === 'telegram') {
      key = `telegram_accounts:${accountId}`;
    } else {
      throw new Error('trackApiKeyUsage: platform must be "twitter" or "telegram"');
    }
    const now = new Date().toISOString();
    await redisClient
      .multi()
      .hIncrBy(key, 'total_requests', 1)
      .hSet(key, {
        last_request: now,
        account_id: accountId
      })
      .exec();
  } catch (err) {
    console.warn('trackApiKeyUsage: non-fatal Redis error; proceeding without usage update', err);
  }
}

/**
 * Get API usage stats from Redis.
 * @param accountId The account ID to query
 * @param platform The platform ('telegram' or 'twitter')
 * @returns Object with total_requests and last_request
 */

interface dataType {
  accountId: string;
  platform: 'telegram' | 'twitter';
}

export async function getApiKeyUsage(
  data: dataType
): Promise<{ total_requests: number; last_request: string | null; account_id?: string }> {
  const { accountId, platform } = data;
  let result: { total_requests: number; last_request: string | null; account_id?: string } = {
    total_requests: 0,
    last_request: null
  };
  if (!accountId?.trim()) {
    return result;
  }
  if (platform !== 'twitter' && platform !== 'telegram') {
    throw new Error('getApiKeyUsage: platform must be "twitter" or "telegram"');
  }
  try {
    await ensureRedisConnected();
    let key: string;
    if (platform === 'twitter') {
      key = `twitter_accounts:${accountId}`;
    } else {
      key = `telegram_accounts:${accountId}`;
    }

    const data = await redisClient.hGetAll(key);
    result.total_requests = data.total_requests ? parseInt(data.total_requests) : 0;
    result.last_request = data.last_request ? data.last_request : null;
    if (data.account_id) {
      result.account_id = data.account_id;
    }
  } catch (err) {
    console.error('Redis operation failed:', err);
  }
  return result;
}

/**
 * Get API usage stats for multiple accounts in batch
 * @param accountIds Array of account IDs to query
 * @param platform The platform ('telegram' or 'twitter')
 * @returns Array of usage objects with account IDs
 */
export async function getBatchApiKeyUsage(
  accountIds: string[],
  platform: 'telegram' | 'twitter'
): Promise<Array<{ accountId: string; total_requests: number; last_request: string | null }>> {
  if (platform !== 'twitter' && platform !== 'telegram') {
    throw new Error('getBatchApiKeyUsage: platform must be "twitter" or "telegram"');
  }

  const results: Array<{ accountId: string; total_requests: number; last_request: string | null }> = [];

  try {
    await ensureRedisConnected();

    for (const accountId of accountIds) {
      if (!accountId?.trim()) continue;

      let key: string;
      if (platform === 'twitter') {
        key = `twitter_accounts:${accountId}`;
      } else {
        key = `telegram_accounts:${accountId}`;
      }

      const data = await redisClient.hGetAll(key);
      results.push({
        accountId,
        total_requests: data.total_requests ? parseInt(data.total_requests) : 0,
        last_request: data.last_request ? data.last_request : null
      });
    }
  } catch (err) {
    console.error('getBatchApiKeyUsage: Redis operation failed:', err);
  }

  return results;
}
