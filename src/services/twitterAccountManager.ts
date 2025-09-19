import { BaseAccountManager, BaseAccount } from './BaseAccountManager';
import { decrypt } from '../lib/encryption';
import { createHash } from 'crypto';

export interface TwitterAccount extends BaseAccount {
    accountId: string;
    credentials: {
        TWITTER_AUTH_TOKEN: string;
        TWITTER_BEARER: string;
        TWITTER_CSRF_TOKEN: string;
    };
    lastUsed?: string;
    totalRequests?: number;
}

export class TwitterAccountManager extends BaseAccountManager<TwitterAccount> {
    protected platform = 'twitter';
    protected accountKey = 'twitter-accounts';
    protected usageKeyPrefix = 'twitter_accounts';

    constructor(redisUrl?: string) {
        super(redisUrl);
    }

    /**
     * Fetch all Twitter accounts from Redis and decrypt their credentials
     */
    protected async fetchAllAccounts(): Promise<TwitterAccount[]> {
        await this.ensureConnected();

        const raw = await this.redisClient.get(this.accountKey);
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
     * Local usage read for Twitter accounts (using the same Redis client)
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

    protected async trackApiKeyUsageLocal(accountId: string): Promise<void> {
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
}

// Export singleton instance
export const twitterAccountManager = new TwitterAccountManager();