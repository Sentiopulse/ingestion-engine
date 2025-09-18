import { encrypt } from '../lib/encryption';
import { createClient } from 'redis';
import fs from 'fs';
import path from 'path';

const redisClient = createClient({ url: 'redis://localhost:6379' });

async function ensureRedisConnected() {
    if (!redisClient.isOpen) {
        await redisClient.connect();
    }
}

async function moveEnvToRedis() {
    const envPath = path.resolve(__dirname, '../../.env');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const lines = envContent.split(/\r?\n/);
    const envVars: Record<string, string> = {};
    const EXCLUDE = new Set(['ENCRYPTION_KEY']);
    for (const raw of lines) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        const idx = line.indexOf('=');
        if (idx <= 0) continue;
        const key = line.slice(0, idx).trim();
        const value = line.slice(idx + 1);
        if (EXCLUDE.has(key)) continue;
        envVars[key] = value;
    }
    await ensureRedisConnected();
    // Define which keys belong to which service
    const twitterKeys = ['AUTH_TOKEN', 'BEARER', 'CSRF_TOKEN'];
    const telegramKeys = ['API_ID', 'API_HASH', 'TG_CHANNEL'];

    for (const [key, value] of Object.entries(envVars)) {
        const encrypted = encrypt(value);
        if (twitterKeys.includes(key)) {
            await redisClient.hSet('twitter-variables', key, encrypted);
        } else if (telegramKeys.includes(key)) {
            await redisClient.hSet('telegram-variables', key, encrypted);
        } else {
            await redisClient.hSet('env-variables', key, encrypted);
        }
    }
    console.log('Moved and encrypted env variables to Redis (twitter-variables, telegram-variables, env-variables).');
}

moveEnvToRedis().then(() => process.exit(0));
