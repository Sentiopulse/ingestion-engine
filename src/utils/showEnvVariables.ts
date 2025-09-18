import { createClient } from 'redis';
import { decrypt } from '../lib/encryption';

async function showEnvVariables() {
    const redisClient = createClient({ url: process.env.REDIS_URL});
    const decryptFlag = process.argv.includes('--decrypt');
    await redisClient.connect();
    // Show Twitter variables
    const twitterVars = await redisClient.hGetAll('twitter-variables');
    console.log('Twitter Credentials:');
    let i = 1;
    for (const [key, value] of Object.entries(twitterVars)) {
        const shown = decryptFlag ? decrypt(value) : mask(value);
        console.log(`${i}. ${key} - ${shown}`);
        i++;
    }

    // Show Telegram variables
    const telegramVars = await redisClient.hGetAll('telegram-variables');
    console.log('\nTelegram Credentials:');
    i = 1;
    for (const [key, value] of Object.entries(telegramVars)) {
        const shown = decryptFlag ? decrypt(value) : mask(value);
        console.log(`${i}. ${key} - ${shown}`);
        i++;
    }
    await redisClient.quit();
}

showEnvVariables();

function mask(v: string): string {
    if (!v) return '';
    return v.length <= 8 ? '********' : `${v.slice(0, 4)}…${v.slice(-4)}`;
}
