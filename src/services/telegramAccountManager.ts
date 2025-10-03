import { BaseAccountManager, BaseAccount } from './BaseAccountManager';
import { decrypt } from '../lib/encryption';
import { getApiKeyUsage, trackApiKeyUsage } from '../utils/redisUtils';

export interface TelegramAccount extends BaseAccount {
  accountId: string;
  credentials: {
    TELEGRAM_API_ID: string;
    TELEGRAM_API_HASH: string;
    TELEGRAM_TG_CHANNEL: string;
  };
  lastUsed?: string;
  totalRequests?: number;
}

export class TelegramAccountManager extends BaseAccountManager<TelegramAccount> {
  protected platform = 'telegram';
  protected accountKey = 'telegram-accounts';
  protected usageKeyPrefix = 'telegram_accounts';

  constructor(redisUrl?: string) {
    super(redisUrl);
  }

  /**
   * Fetch all Telegram accounts from Redis and decrypt their credentials
   */
  protected async fetchAllAccounts(): Promise<TelegramAccount[]> {
    await this.ensureConnected();

    const raw = await this.redisClient.get(this.accountKey);
    if (!raw) {
      throw new Error('No Telegram accounts found in Redis');
    }

    let encryptedAccounts: Record<string, string>[];
    try {
      encryptedAccounts = JSON.parse(raw);
    } catch (e) {
      throw new Error('Failed to parse Telegram accounts from Redis');
    }

    const accounts: TelegramAccount[] = [];

    for (let i = 0; i < encryptedAccounts.length; i++) {
      const encryptedAccount = encryptedAccounts[i];

      try {
        // Decrypt credentials
        const credentials = {
          TELEGRAM_API_ID: decrypt(encryptedAccount.TELEGRAM_API_ID),
          TELEGRAM_API_HASH: decrypt(encryptedAccount.TELEGRAM_API_HASH),
          TELEGRAM_TG_CHANNEL: decrypt(encryptedAccount.TELEGRAM_TG_CHANNEL)
        };

        // Generate account ID from API ID (for uniqueness)
        const accountId = `telegram_${credentials.TELEGRAM_API_ID}`;

        // Get usage statistics from Redis
        const usage = await getApiKeyUsage({ accountId, platform: 'telegram' });
      } catch (err) {
        console.error(`Failed to decrypt Telegram account at index ${i}:`, err);
        continue;

        accounts.push({
          accountId,
          credentials,
          lastUsed: usage.last_request || undefined,
          totalRequests: usage.total_requests
        });
      } catch (e) {
        console.warn(`Failed to decrypt Telegram account ${i + 1}:`, e);
        continue;
      }
    }

    if (accounts.length === 0) {
      throw new Error('No valid Telegram accounts could be decrypted');
    }

    return accounts;
  }

  /**
   * Local usage tracking for Telegram accounts
   */
  protected async trackApiKeyUsageLocal(accountId: string): Promise<void> {
    await trackApiKeyUsage({ accountId, platform: 'telegram' });
  }

  /**
   * Get usage statistics for all accounts (no credentials)
   */
  async getAllAccountsUsage(): Promise<Array<{ accountId: string; lastUsed?: string; totalRequests?: number }>> {
    const accounts = await this.fetchAllAccounts();
    return accounts.map(({ accountId, lastUsed, totalRequests }) => ({ accountId, lastUsed, totalRequests }));
  }

  /**
   * Get all accounts with credentials (full info)
   */
  async getAllAccountsWithCredentials(): Promise<TelegramAccount[]> {
    return await this.fetchAllAccounts();
  }
}

// Export singleton instance
export const telegramAccountManager = new TelegramAccountManager();
