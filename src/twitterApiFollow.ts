// Use global fetch and URLSearchParams (Node 18+)
import { createClient } from 'redis';
import { decrypt } from './lib/encryption';

export interface TwitterAuthOptions {
    bearerToken: string;
    cookie: string;
    csrfToken: string;
}

/**
 * Fetches and decrypts the latest Twitter credentials from Redis.
 */
export async function getLatestTwitterCredentialsFromRedis(redisUrl?: string): Promise<TwitterAuthOptions> {
    const client = createClient({ url: redisUrl || process.env.REDIS_URL });
    let raw: string | null = null;
    try {
        await client.connect();
        raw = await client.get('twitter-accounts');
    } finally {
        // Best-effort close
        try { await client.quit(); } catch { /* ignore */ }
    }
    if (!raw) throw new Error('No twitter-accounts found in Redis');
    let arr: any[];
    try {
        arr = JSON.parse(raw);
    } catch {
        throw new Error('Failed to parse twitter-accounts from Redis');
    }
    if (!arr.length) throw new Error('No twitter accounts stored in Redis');
    const latest = arr[arr.length - 1];
    // Decrypt all fields
    return {
        bearerToken: decrypt(latest.TWITTER_BEARER),
        cookie: decrypt(latest.TWITTER_COOKIE),
        csrfToken: decrypt(latest.TWITTER_CSRF_TOKEN),
    };
}

/**
 * Follows a Twitter user by user_id using the web client API.
 * @param userId - The Twitter user ID to follow.
 * @param options - Auth and session info. If not provided, fetches from Redis.
 * @returns The response from Twitter API.
 */
export async function followUser(
    userId: string,
    options?: TwitterAuthOptions
): Promise<any> {
    let creds: TwitterAuthOptions;
    if (options) {
        creds = options;
    } else {
        creds = await getLatestTwitterCredentialsFromRedis();
    }
    const url = 'https://x.com/i/api/1.1/friendships/create.json';
    const params = new URLSearchParams({
        include_profile_interstitial_type: '1',
        include_blocking: '1',
        include_blocked_by: '1',
        include_followed_by: '1',
        include_want_retweets: '1',
        include_mute_edge: '1',
        include_can_dm: '1',
        include_can_media_tag: '1',
        include_ext_is_blue_verified: '1',
        include_ext_verified_type: '1',
        include_ext_profile_image_shape: '1',
        skip_status: '1',
        user_id: userId
    });

    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 10_000);
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'authorization': `Bearer ${creds.bearerToken}`,
            'cookie': creds.cookie,
            'x-csrf-token': creds.csrfToken,
            'content-type': 'application/x-www-form-urlencoded',
            'origin': 'https://x.com',
            'referer': 'https://x.com/',
            'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36'
        },
        body: params,
        signal: ac.signal
    });
    clearTimeout(t);

    if (!res.ok) {
        const error = await res.text();
        throw new Error(`Twitter follow failed: ${res.status} ${error}`);
    }
    return res.json();
}