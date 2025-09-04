import { createClient, RedisClientType } from 'redis';

const client: RedisClientType = createClient({
  url: 'redis://localhost:6379'
});

client.on('error', (err) => {
  console.error('Redis Client Error', err);
});

async function main() {
  await client.connect();
  await client.set('test-key', 'hello-redis');
  const value = await client.get('test-key');
  console.log('Read value from Redis:', value);
  await client.disconnect();
}

main();
