import { createClient, RedisClientType } from 'redis';

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
