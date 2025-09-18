import { createClient } from 'redis';
import { decrypt } from '../lib/encryption';
import { getApiKeyUsage, trackApiKeyUsage } from '../utils/redisUtils';

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

                // Generate account ID from auth token (first 8 chars for uniqueness)
                const accountId = `twitter_${credentials.TWITTER_AUTH_TOKEN.substring(0, 8)}`;

                // Get usage statistics from Redis
                const usage = await getApiKeyUsage({ accountId, platform: 'twitter' });

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

        const selectedAccount = accounts[0];

        console.log(`Selected Twitter account: ${selectedAccount.accountId}`);
        console.log(`Last used: ${selectedAccount.lastUsed || 'Never'}`);
        console.log(`Total requests: ${selectedAccount.totalRequests || 0}`);

        return selectedAccount;
    }

    /**
     * Mark an account as used (updates the tracking in Redis)
     */
    async markAccountAsUsed(accountId: string): Promise<void> {
        await trackApiKeyUsage({ accountId, platform: 'twitter' });
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