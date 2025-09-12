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
export async function trackApiKeyUsage(apiKey: string, accountId?: string): Promise<void> {
  if (!apiKey?.trim()) {
    console.warn('trackApiKeyUsage: empty apiKey; skipping');
    return;
  }

  try {
    await ensureRedisConnected();
    let key: string;
    if (process.env.TWITTER_ACCOUNT_ID && apiKey === process.env.TWITTER_ACCOUNT_ID) {
      key = `twitter_accounts:${apiKey}`;
    } else if (process.env.TELEGRAM_ACCOUNT_ID && apiKey === process.env.TELEGRAM_ACCOUNT_ID) {
      key = `telegram_accounts:${apiKey}`;
    } else {
      key = `api_usage:${apiKey}`;
    }
    const now = new Date().toISOString();
    await redisClient
      .multi()
      .hIncrBy(key, 'total_requests', 1)
      .hSet(key, {
        last_request: now,
        ...(accountId ? { account_id: accountId } : {}),
      })
      .exec();
  } catch (err) {
    console.warn('trackApiKeyUsage: non-fatal Redis error; proceeding without usage update', err);
  }
}

/**
 * Get API key usage stats from Redis.
 * @param apiKey The API key to query
 * @returns Object with total_requests and last_request
 */
export async function getApiKeyUsage(apiKey: string): Promise<{ total_requests: number; last_request: string | null; account_id?: string }> {
  let result: { total_requests: number; last_request: string | null; account_id?: string } = { total_requests: 0, last_request: null };
  if (!apiKey?.trim()) {
    return result;
  }

  try {
    await ensureRedisConnected();
    let key: string;
    if (process.env.TWITTER_ACCOUNT_ID && apiKey === process.env.TWITTER_ACCOUNT_ID) {
      key = `twitter_accounts:${apiKey}`;
    } else if (process.env.TELEGRAM_ACCOUNT_ID && apiKey === process.env.TELEGRAM_ACCOUNT_ID) {
      key = `telegram_accounts:${apiKey}`;
    } else {
      key = `api_usage:${apiKey}`;
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



// Example: Use environment variables for API keys
async function main() {
  const telegramAccountId = process.env.TELEGRAM_ACCOUNT_ID;
  if (telegramAccountId?.trim()) {
    const telegramUsage = await getApiKeyUsage(telegramAccountId);
    console.log('Telegram API usage:', {
      total_requests: telegramUsage.total_requests,
      last_request: telegramUsage.last_request || 'No last Telegram request recorded.',
      account_id: telegramUsage.account_id || 'No account id recorded.'
    });
  } else {
    console.log('Telegram API usage: TELEGRAM_ACCOUNT_ID not set.');
  }

  const twitterAccountId = process.env.TWITTER_ACCOUNT_ID;
  if (twitterAccountId?.trim()) {
    const twitterUsage = await getApiKeyUsage(twitterAccountId);
    console.log('Twitter API usage:', {
      total_requests: twitterUsage.total_requests,
      last_request: twitterUsage.last_request || 'No last Twitter request recorded.',
      account_id: twitterUsage.account_id || 'No account id recorded.'
    });
  } else {
    console.log('Twitter API usage: TWITTER_ACCOUNT_ID not set.');
  }
}

// Only run main if this file is executed directly (not imported)
if (require.main === module) {
  main();
}


