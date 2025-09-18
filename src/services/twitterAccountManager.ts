import { createClient } from 'redis';
import { decrypt } from '../lib/encryption';
import { createHash } from 'crypto';

export interface TwitterAccount {
    accountId: string;
    credentials: {
        TWITTER_AUTH_TOKEN: string;
        TWITTER_BEARER: string;
        TWITTER_CSRF_TOKEN: string;
    };
    lastUsed?: string;
    totalRequests?: number;
}

export class TwitterAccountManager {
    private redisClient: ReturnType<typeof createClient>;
    private isConnected = false;

    constructor(redisUrl?: string) {
        this.redisClient = createClient({
            url: redisUrl || process.env.REDIS_URL
        });

        this.redisClient.on('error', (err) => {
            console.error('Redis Client Error in TwitterAccountManager:', err);
        });
    }

    private async ensureConnected(): Promise<void> {
        if (!this.isConnected) {
            await this.redisClient.connect();
            this.isConnected = true;
        }
    }

    /**
     * Fetch all Twitter accounts from Redis and decrypt their credentials
     */
    private async fetchAllAccounts(): Promise<TwitterAccount[]> {
        await this.ensureConnected();

        const raw = await this.redisClient.get('twitter-accounts');
        if (!raw) {
            throw new Error('No Twitter accounts found in Redis');
        }

        let encryptedAccounts: Record<string, string>[];
        try {
            encryptedAccounts = JSON.parse(raw);
        } catch (e) {
            throw new Error('Failed to parse Twitter accounts from Redis');
        }

        const accounts: TwitterAccount[] = [];

        for (let i = 0; i < encryptedAccounts.length; i++) {
            const encryptedAccount = encryptedAccounts[i];

            try {
                // Decrypt credentials
                const credentials = {
                    TWITTER_AUTH_TOKEN: decrypt(encryptedAccount.TWITTER_AUTH_TOKEN),
                    TWITTER_BEARER: decrypt(encryptedAccount.TWITTER_BEARER),
                    TWITTER_CSRF_TOKEN: decrypt(encryptedAccount.TWITTER_CSRF_TOKEN),
                };

                // Generate stable, non-reversible account ID (SHA-256, 12 hex chars)
                const token = credentials.TWITTER_AUTH_TOKEN;
                const accountId = `twitter_${createHash('sha256').update(token).digest('hex').slice(0, 12)}`;

                // Get usage statistics from Redis (same client)
                const usage = await this.getApiKeyUsageLocal(accountId);

                accounts.push({
                    accountId,
                    credentials,
                    lastUsed: usage.last_request || undefined,
                    totalRequests: usage.total_requests
                });
            } catch (e) {
                console.warn(`Failed to decrypt account ${i + 1}:`, e);
                continue;
            }
        }

        if (accounts.length === 0) {
            throw new Error('No valid Twitter accounts could be decrypted');
        }

        return accounts;
    }

    /**
     * Get the Twitter account that was used earliest (least recently used)
     */
    async getEarliestUsedAccount(): Promise<TwitterAccount> {
        const accounts = await this.fetchAllAccounts();

        // Sort accounts by last_request timestamp (earliest first)
        // Accounts with no last_request (never used) come first
        accounts.sort((a, b) => {
            if (!a.lastUsed && !b.lastUsed) return 0;
            if (!a.lastUsed) return -1; // a comes first (never used)
            if (!b.lastUsed) return 1;  // b comes first (never used)

            // Both have lastUsed dates, compare them
            return new Date(a.lastUsed).getTime() - new Date(b.lastUsed).getTime();
        });

        for (const acc of accounts) {
            const lockKey = `lock:twitter:${acc.accountId}`;
            const ok = await this.redisClient.set(lockKey, '1', { NX: true, PX: 15000 });
            if (ok === 'OK') {
                console.debug(`[TwitterAccountManager] Selected account=${acc.accountId} lastUsed=${acc.lastUsed ?? 'Never'} totalRequests=${acc.totalRequests ?? 0}`);
                return acc;
            }
        }
        throw new Error('No available Twitter accounts to claim (all locked).');
    }

    /**
     * Mark an account as used (updates the tracking in Redis and releases the selection lock)
     */
    async markAccountAsUsed(accountId: string): Promise<void> {
        await this.trackApiKeyUsageLocal(accountId);
        // Best-effort unlock; lock has TTL as a safety net
        try { await this.redisClient.del(`lock:twitter:${accountId}`); } catch { }
    }

    /**
     * Local usage tracking for Twitter accounts
     */
    private async getApiKeyUsageLocal(accountId: string): Promise<{ total_requests: number; last_request: string | null }> {
        await this.ensureConnected();
        const key = `twitter_accounts:${accountId}`;
        const data = await this.redisClient.hGetAll(key);
        return {
            total_requests: data?.total_requests ? parseInt(data.total_requests, 10) : 0,
            last_request: data?.last_request ?? null,
        };
    }

    private async trackApiKeyUsageLocal(accountId: string): Promise<void> {
        await this.ensureConnected();
        const key = `twitter_accounts:${accountId}`;
        const now = new Date().toISOString();
        await this.redisClient
            .multi()
            .hIncrBy(key, 'total_requests', 1)
            .hSet(key, { last_request: now, account_id: accountId })
            .exec();
    }

    /**
     * Get usage statistics for all accounts
     */
    async getAllAccountsUsage(): Promise<TwitterAccount[]> {
        return await this.fetchAllAccounts();
    }

    /**
     * Close the Redis connection
     */
    async disconnect(): Promise<void> {
        if (this.isConnected) {
            await this.redisClient.quit();
            this.isConnected = false;
        }
    }
}

// Export singleton instance
export const twitterAccountManager = new TwitterAccountManager();