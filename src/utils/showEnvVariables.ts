import { createClient } from 'redis';
// Decrypt is dynamically imported only when --decrypt is used.

async function showEnvVariables() {
    const redisClient = createClient({ url: process.env.REDIS_URL});
    const decryptFlag = process.argv.includes('--decrypt');
    let decryptFn: ((v: string) => string) | null = null;
    if (decryptFlag) {
        const mod = await import('../lib/encryption');
        decryptFn = mod.decrypt;
    }
    await redisClient.connect();
    // Show Twitter accounts
    const twitterRaw = await redisClient.get('twitter-accounts');
    console.log('Twitter Accounts:');
    if (twitterRaw) {
        let twitterAccounts: any[];
        try {
            twitterAccounts = JSON.parse(twitterRaw);
        } catch (e) {
            twitterAccounts = [{ error: 'Failed to parse' }];
        }
        twitterAccounts.forEach((acc, idx) => {
            console.log(`Account ${idx + 1}:`);
            Object.entries(acc).forEach(([k, v]) => {
                const shown = decryptFlag && decryptFn ? decryptFn(v as string) : mask(v as string);
                console.log(`  ${k}: ${shown}`);
            });
        });
    } else {
        console.log('  (none)');
    }

    // Show Telegram accounts
    const telegramRaw = await redisClient.get('telegram-accounts');
    console.log('\nTelegram Accounts:');
    if (telegramRaw) {
        let telegramAccounts: any[];
        try {
            telegramAccounts = JSON.parse(telegramRaw);
        } catch (e) {
            telegramAccounts = [{ error: 'Failed to parse' }];
        }
        telegramAccounts.forEach((acc, idx) => {
            console.log(`Account ${idx + 1}:`);
            Object.entries(acc).forEach(([k, v]) => {
                const shown = decryptFlag && decryptFn ? decryptFn(v as string) : mask(v as string);
                console.log(`  ${k}: ${shown}`);
            });
        });
    } else {
        console.log('  (none)');
    }
    await redisClient.quit();
}

showEnvVariables();

function mask(v: string): string {
    if (!v) return '';
    return v.length <= 8 ? '********' : `${v.slice(0, 4)}…${v.slice(-4)}`;
}
