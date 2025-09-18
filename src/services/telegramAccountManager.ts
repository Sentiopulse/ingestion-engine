import { createClient } from 'redis';
import { decrypt } from '../lib/encryption';
import { getApiKeyUsage, trackApiKeyUsage } from '../utils/redisUtils';

export interface TelegramAccount {
    accountId: string;
    credentials: {
        TELEGRAM_API_ID: string;
        TELEGRAM_API_HASH: string;
        TELEGRAM_TG_CHANNEL: string;
    };
    lastUsed?: string;
    totalRequests?: number;
}

export class TelegramAccountManager {
    private redisClient: ReturnType<typeof createClient>;
    private isConnected = false;

    constructor(redisUrl?: string) {
        this.redisClient = createClient({
            url: redisUrl || process.env.REDIS_URL || 'redis://localhost:6379'
        });

        this.redisClient.on('error', (err) => {
            console.error('Redis Client Error in TelegramAccountManager:', err);
        });
    }

    private async ensureConnected(): Promise<void> {
        if (!this.isConnected) {
            await this.redisClient.connect();
            this.isConnected = true;
        }
    }

    /**
     * Fetch all Telegram accounts from Redis and decrypt their credentials
     */
    private async fetchAllAccounts(): Promise<TelegramAccount[]> {
        await this.ensureConnected();

        const raw = await this.redisClient.get('telegram-accounts');
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
                    TELEGRAM_TG_CHANNEL: decrypt(encryptedAccount.TELEGRAM_TG_CHANNEL),
                };

                // Generate account ID from API ID (for uniqueness)
                const accountId = `telegram_${credentials.TELEGRAM_API_ID}`;

                // Get usage statistics from Redis
                const usage = await getApiKeyUsage({ accountId, platform: 'telegram' });

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
     * Get the Telegram account that was used earliest (least recently used)
     */
    async getEarliestUsedAccount(): Promise<TelegramAccount> {
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

        console.log(`Selected Telegram account: ${selectedAccount.accountId}`);
        console.log(`Last used: ${selectedAccount.lastUsed || 'Never'}`);
        console.log(`Total requests: ${selectedAccount.totalRequests || 0}`);

        return selectedAccount;
    }

    /**
     * Mark an account as used (updates the tracking in Redis)
     */
    async markAccountAsUsed(accountId: string): Promise<void> {
        await trackApiKeyUsage({ accountId, platform: 'telegram' });
    }

    /**
     * Get usage statistics for all accounts
     */
    async getAllAccountsUsage(): Promise<TelegramAccount[]> {
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
export const telegramAccountManager = new TelegramAccountManager();