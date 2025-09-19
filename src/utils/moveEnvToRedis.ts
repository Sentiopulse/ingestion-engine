import { encrypt } from '../lib/encryption';
import { createClient } from 'redis';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const redisClient = createClient({ url: process.env.REDIS_URL });

async function ensureRedisConnected() {
    if (!redisClient.isOpen) {
        await redisClient.connect();
    }
}

async function moveEnvToRedis() {
    const envVars: Record<string, string> = {};
    const EXCLUDE = new Set(['ENCRYPTION_KEY']);
    for (const [key, value] of Object.entries(process.env)) {
        if (!value || EXCLUDE.has(key)) continue;
        envVars[key] = value;
    }
    await ensureRedisConnected();
    // Define which keys belong to which service
    const twitterKeys = ['TWITTER_AUTH_TOKEN', 'TWITTER_BEARER', 'TWITTER_CSRF_TOKEN', 'TWITTER_COOKIE'];
    const telegramKeys = ['TELEGRAM_API_ID', 'TELEGRAM_API_HASH', 'TELEGRAM_TG_CHANNEL'];

    // Encrypt each value individually and store as an object
    const twitterAccount: Record<string, string> = {};
    const telegramAccount: Record<string, string> = {};
    const otherVars: Record<string, string> = {};

    for (const [key, value] of Object.entries(envVars)) {
        if (twitterKeys.includes(key)) {
            twitterAccount[key] = encrypt(value);
        } else if (telegramKeys.includes(key)) {
            telegramAccount[key] = encrypt(value);
        } else {
            otherVars[key] = encrypt(value);
        }
    }

    if (Object.keys(twitterAccount).length) {
        let twitterArr: any[] = [];
        const existing = await redisClient.get('twitter-accounts');
        if (existing) {
            try {
                twitterArr = JSON.parse(existing);
            } catch { }
        }
        twitterArr.push(twitterAccount);
        await redisClient.set('twitter-accounts', JSON.stringify(twitterArr));
    }
    if (Object.keys(telegramAccount).length) {
        let telegramArr: any[] = [];
        const existing = await redisClient.get('telegram-accounts');
        if (existing) {
            try {
                telegramArr = JSON.parse(existing);
            } catch { }
        }
        telegramArr.push(telegramAccount);
        await redisClient.set('telegram-accounts', JSON.stringify(telegramArr));
    }
    if (Object.keys(otherVars).length) {
        await redisClient.set('env-variables', JSON.stringify(otherVars));
    }
    console.log('Moved and individually encrypted env variables to Redis (twitter-accounts, telegram-accounts, env-variables as objects).');
}

moveEnvToRedis().then(() => process.exit(0));
