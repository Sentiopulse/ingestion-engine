import { createClient, RedisClientType } from 'redis';

export interface BaseAccount {
  accountId: string;
  credentials: Record<string, string>;
  lastUsed?: string;
  totalRequests?: number;
}

export abstract class BaseAccountManager<T extends BaseAccount> {
  protected redisClient: RedisClientType;
  protected isConnected = false;
  protected abstract platform: string;
  protected abstract accountKey: string;
  protected abstract usageKeyPrefix: string;

  constructor(redisUrl?: string) {
    this.redisClient = createClient({
      url: redisUrl || process.env.REDIS_URL
    });
    this.redisClient.on('error', (err) => {
      console.error(`Redis Client Error in ${this.platform}AccountManager:`, err);
    });
  }

  protected async ensureConnected(): Promise<void> {
    if (!this.isConnected) {
      await this.redisClient.connect();
      this.isConnected = true;
    }
  }

  protected abstract fetchAllAccounts(): Promise<T[]>;

  async getEarliestUsedAccount(): Promise<T> {
    await this.ensureConnected();
    const accounts = await this.fetchAllAccounts();
    accounts.sort((a, b) => {
      if (!a.lastUsed && !b.lastUsed) return 0;
      if (!a.lastUsed) return -1;
      if (!b.lastUsed) return 1;
      return new Date(a.lastUsed).getTime() - new Date(b.lastUsed).getTime();
    });
    for (const acc of accounts) {
      const lockKey = `lock:${this.platform}:${acc.accountId}`;
      const ok = await this.redisClient.set(lockKey, '1', { NX: true, PX: 15000 });
      if (ok === 'OK') {
        console.debug(
          `[${this.platform}AccountManager] Selected account=${acc.accountId} lastUsed=${acc.lastUsed ?? 'Never'} totalRequests=${acc.totalRequests ?? 0}`
        );
        return acc;
      }
    }
    throw new Error(`No available ${this.platform} accounts to claim (all locked).`);
  }

  async markAccountAsUsed(accountId: string): Promise<void> {
    await this.ensureConnected();
    await this.trackApiKeyUsageLocal(accountId);
    try {
      await this.redisClient.del(`lock:${this.platform}:${accountId}`);
    } catch {}
  }

  protected abstract trackApiKeyUsageLocal(accountId: string): Promise<void>;

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.redisClient.quit();
      this.isConnected = false;
    }
  }
}
