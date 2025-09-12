import { createClient, RedisClientType } from 'redis';

/**
 * Increment API key usage stats in Redis.
 * @param apiKey The API key to track
 */
export async function trackApiKeyUsage(apiKey: string, accountHandle?: string): Promise<void> {
  await runRedisOperation(async (client) => {
    const key = `api_usage:${apiKey}`;
    await client.hIncrBy(key, 'total_requests', 1);
    const now = new Date().toISOString();
    await client.hSet(key, 'last_request', now);
    if (accountHandle) {
      await client.hSet(key, 'account_handle', accountHandle);
    }
  });
}

/**
 * Get API key usage stats from Redis.
 * @param apiKey The API key to query
 * @returns Object with total_requests and last_request
 */
export async function getApiKeyUsage(apiKey: string): Promise<{ total_requests: number; last_request: string | null; account_handle?: string }> {
  let result: { total_requests: number; last_request: string | null; account_handle?: string } = { total_requests: 0, last_request: null };
  await runRedisOperation(async (client) => {
    const key = `api_usage:${apiKey}`;
    const data = await client.hGetAll(key);
    result.total_requests = data.total_requests ? parseInt(data.total_requests) : 0;
    result.last_request = data.last_request ? data.last_request : null;
    if (data.account_handle) {
      result.account_handle = data.account_handle;
    }
  });
  return result;
}



// Example: Use environment variables for API keys
async function main() {
  const telegramUsage = await getApiKeyUsage(process.env.API_ID as string);
  console.log('Telegram API usage:', {
    total_requests: telegramUsage.total_requests,
    last_request: telegramUsage.last_request || 'No last Telegram request recorded.',
    account_id: telegramUsage.account_handle || 'No account handle recorded.'
  });

  const twitterUsage = await getApiKeyUsage(process.env.AUTH_TOKEN as string);
  console.log('Twitter API usage:', {
    total_requests: twitterUsage.total_requests,
    last_request: twitterUsage.last_request || 'No last Twitter request recorded.',
    account_id: twitterUsage.account_handle || 'No account id recorded.'
  });
}

// Only run main if this file is executed directly (not imported)
if (require.main === module) {
  main();
}


export async function runRedisOperation(operation: (client: RedisClientType) => Promise<void>): Promise<void> {
  const client: RedisClientType = createClient({
    url: 'redis://localhost:6379'
  });

  client.on('error', (err) => {
    console.error('Redis Client Error', err);
  });

  try {
    await client.connect();
    await operation(client);
  } catch (err) {
    console.error('Redis operation failed:', err);
    throw err;
  } finally {
    try {
      await client.quit();
    } catch (quitErr) {
      console.error('Error during Redis client quit:', quitErr);
    }
  }
}
