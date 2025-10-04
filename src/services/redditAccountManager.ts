import { BaseAccountManager, BaseAccount } from './BaseAccountManager';
import { decrypt } from '../lib/encryption';

export interface RedditAccount extends BaseAccount {
  accountId: string;
  credentials: {
    REDDIT_CLIENT_ID: string;
    REDDIT_CLIENT_SECRET: string;
    REDDIT_REFRESH_TOKEN: string;
    REDDIT_USERNAME: string;
  };
  lastUsed?: string;
  totalRequests?: number;
}

/**
 * Manages Reddit accounts stored in Redis, including decryption and usage tracking.
 */
export class RedditAccountManager extends BaseAccountManager<RedditAccount> {
  protected platform = 'reddit';
  protected accountKey = 'reddit-accounts';
  protected usageKeyPrefix = 'reddit_accounts';

  constructor(redisUrl?: string) {
    super(redisUrl);
  }

  /**
   * Fetch all Reddit accounts from Redis and decrypt their credentials
   */
  protected async fetchAllAccounts(): Promise<RedditAccount[]> {
    await this.ensureConnected();

    const raw = await this.redisClient.get(this.accountKey);
    if (!raw) {
      throw new Error('No Reddit accounts found in Redis');
    }

    let encryptedAccounts: Record<string, string>[];
    try {
      encryptedAccounts = JSON.parse(raw);
    } catch (e) {
      throw new Error('Failed to parse Reddit accounts from Redis');
    }

    const accounts: RedditAccount[] = [];

    for (let i = 0; i < encryptedAccounts.length; i++) {
      const encryptedAccount = encryptedAccounts[i];

      try {
        // Decrypt credentials
        const credentials = {
          REDDIT_CLIENT_ID: decrypt(encryptedAccount.REDDIT_CLIENT_ID),
          REDDIT_CLIENT_SECRET: decrypt(encryptedAccount.REDDIT_CLIENT_SECRET),
          REDDIT_REFRESH_TOKEN: decrypt(encryptedAccount.REDDIT_REFRESH_TOKEN),
          REDDIT_USERNAME: decrypt(encryptedAccount.REDDIT_USERNAME)
        };

        // Generate account ID from username (for uniqueness)
        const accountId = `reddit_${credentials.REDDIT_USERNAME}`;

        // Get usage statistics from Redis
        const usage = await this.getApiKeyUsageLocal(accountId);

        accounts.push({
          accountId,
          credentials,
          lastUsed: usage.last_request || undefined,
          totalRequests: usage.total_requests
        });
      } catch (e) {
        console.warn(`Failed to decrypt Reddit account ${i + 1}:`, e);
        continue;
      }
    }

    if (accounts.length === 0) {
      throw new Error('No valid Reddit accounts could be decrypted');
    }

    return accounts;
  }

  /**
   * Local usage read for Reddit accounts (using the same Redis client)
   */
  private async getApiKeyUsageLocal(
    accountId: string
  ): Promise<{ total_requests: number; last_request: string | null }> {
    await this.ensureConnected();
    const key = `reddit_accounts:${accountId}`;
    const data = await this.redisClient.hGetAll(key);
    return {
      total_requests: data?.total_requests ? parseInt(data.total_requests, 10) : 0,
      last_request: data?.last_request ?? null
    };
  }

  protected async trackApiKeyUsageLocal(accountId: string): Promise<void> {
    await this.ensureConnected();
    const key = `reddit_accounts:${accountId}`;
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
  async getAllAccountsUsage(): Promise<RedditAccount[]> {
    return await this.fetchAllAccounts();
  }
}

// Export singleton instance
export const redditAccountManager = new RedditAccountManager();
