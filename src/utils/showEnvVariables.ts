import { createClient } from 'redis';
import { mask } from '../lib/utils/string';
// Decrypt is dynamically imported only when --decrypt is used.

async function showEnvVariables() {
    const redisClient = createClient({ url: process.env.REDIS_URL });
    const decryptFlag = process.argv.includes('--decrypt');
    let decryptFn: ((v: string) => string) | null = null;
    if (decryptFlag) {
        const mod = await import('../lib/encryption');
        decryptFn = mod.decrypt;
    }
    await redisClient.connect();
    await showAccounts(redisClient, decryptFlag, decryptFn);
    // Unified function to show both Twitter and Telegram accounts
    async function showAccounts(redisClient: any, decryptFlag: boolean, decryptFn: ((v: string) => string) | null) {
        const services = [
            { name: 'Twitter', key: 'twitter-accounts' },
            { name: 'Telegram', key: 'telegram-accounts' }
        ];
        for (const service of services) {
            const raw = await redisClient.get(service.key);
            console.log(`\n${service.name} Accounts:`);
            if (raw) {
                let accounts: any[];
                try {
                    accounts = JSON.parse(raw);
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
    await redisClient.quit();
}

showEnvVariables();


