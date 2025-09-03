
import { runRedisOperation } from './utils/redisUtils';

async function main() {
  await runRedisOperation(async (client) => {
    await client.set('test-key', 'hello-redis');
    const value = await client.get('test-key');
    console.log('Read value from Redis:', value);
  });
}

main();
