import { createClient } from 'redis';

async function showEnvVariables() {
    const redisClient = createClient({ url: 'redis://localhost:6379' });
    await redisClient.connect();
    // Show Twitter variables
    const twitterVars = await redisClient.hGetAll('twitter-variables');
    console.log('Twitter Credentials:');
    let i = 1;
    for (const [key, value] of Object.entries(twitterVars)) {
        console.log(`${i}. ${key} - ${value}`);
        i++;
    }

    // Show Telegram variables
    const telegramVars = await redisClient.hGetAll('telegram-variables');
    console.log('\nTelegram Credentials:');
    i = 1;
    for (const [key, value] of Object.entries(telegramVars)) {
        console.log(`${i}. ${key} - ${value}`);
        i++;
    }
    await redisClient.disconnect();
}

showEnvVariables();
