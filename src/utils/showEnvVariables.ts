import { createClient } from 'redis';
import { mask } from '../lib/utils/string';
import { decrypt } from '../lib/encryption';

async function showEnvVariables() {
  const redisClient = createClient({ url: process.env.REDIS_URL });
  const decryptFlag = process.argv.includes('--decrypt');
  let decryptFn: ((v: string) => string) | null = null;
  if (decryptFlag) {
    decryptFn = decrypt;
  }
  await redisClient.connect();
  await showAccounts(redisClient, decryptFlag, decryptFn);
  await redisClient.quit();
}

// Unified function to show both Twitter and Telegram accounts
type AccountRecord = Record<string, string> | { error: string };

async function showAccounts(
  redisClient: ReturnType<typeof createClient>,
  decryptFlag: boolean,
  decryptFn: ((v: string) => string) | null
) {
  const services: { name: string; key: string }[] = [
    { name: 'Twitter', key: 'twitter-accounts' },
    { name: 'Telegram', key: 'telegram-accounts' }
  ];
  for (const service of services) {
    const raw = await redisClient.get(service.key);
    console.log(`\n${service.name} Accounts:`);
    if (raw) {
      let accounts: AccountRecord[];
      try {
        accounts = JSON.parse(raw) as AccountRecord[];
      } catch (e) {
        accounts = [{ error: 'Failed to parse' }];
      }
      accounts.forEach((acc, idx) => {
        console.log(`Account ${idx + 1}:`);
        Object.entries(acc).forEach(([k, v]) => {
          const shown = decryptFlag && decryptFn ? decryptFn(v as string) : mask(v as string);
          console.log(`  ${k}: ${shown}`);
        });
      });
    } else {
      console.log('  (none)');
    }
  }
}

showEnvVariables();
