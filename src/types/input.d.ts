declare module 'input' {
  export function text(prompt: string): Promise<string>;
}

export interface IBaseAccount {
  accountId: string;
  credentials: Record<string, string>;
  lastUsed?: string;
  totalRequests?: number;
}

export interface ITelegramCredentials {
  TELEGRAM_API_ID: string;
  TELEGRAM_API_HASH: string;
  TELEGRAM_TG_CHANNEL: string;
}

export interface ITelegramAccount extends IBaseAccount {
  accountId: string;
  credentials: ITelegramCredentials;
  lastUsed?: string;
  totalRequests?: number;
}