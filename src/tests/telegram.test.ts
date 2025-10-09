
import { Api, TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { fetchTelegramMessages } from '../fetchTelegramMessages';
import { TelegramAccount } from '../services/telegramAccountManager';

// Mock the TelegramClient and its methods
jest.mock('telegram', () => ({
  TelegramClient: jest.fn(() => ({
    getEntity: jest.fn(),
    invoke: jest.fn(),
  })),
  Api: {
    Channel: jest.fn(),
    ChannelForbidden: jest.fn(),
    messages: {
      GetHistory: jest.fn(),
    },
  },
}));

// Mock StringSession if needed, though for these tests it might not be directly used
jest.mock('telegram/sessions', () => ({
  StringSession: jest.fn(() => ({
    save: jest.fn(() => 'mock_session_string'),
  })),
}));

const MockTelegramClient = TelegramClient as jest.MockedClass<typeof TelegramClient>;
const MockApi = Api as any; // Cast to any to access mocked properties easily

describe('fetchTelegramMessages', () => {
  let mockClient: jest.Mocked<TelegramClient>;
  let mockAccount: TelegramAccount;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = new MockTelegramClient(new StringSession(''), 123, 'abc') as jest.Mocked<TelegramClient>;
    mockAccount = {
      accountId: 'test_telegram_account',
      credentials: {
        TELEGRAM_TG_CHANNEL: 'test_channel',
      },
      lastUsed: null,
      totalRequests: 0,
    };

    // Default mock for getEntity to return a Channel
    (mockClient.getEntity as jest.Mock).mockResolvedValue(
      Object.assign(new MockApi.Channel(), { id: 12345, accessHash: 'mock_hash' })
    );

    // Default mock for invoke to return messages
    (mockClient.invoke as jest.Mock).mockResolvedValue({
      messages: [
        { id: 1, message: 'Hello Telegram 1', date: 1678886400 },
        { id: 2, message: 'Hello Telegram 2', date: 1678886460 },
      ],
    });
  });

  it('should fetch and parse messages successfully', async () => {
    const messages = await fetchTelegramMessages(mockClient, mockAccount);

    expect(mockClient.getEntity).toHaveBeenCalledWith('test_channel');
    expect(mockClient.invoke).toHaveBeenCalledWith(
      new MockApi.messages.GetHistory({
        peer: expect.any(MockApi.Channel),
        limit: 10,
      })
    );
    expect(messages).toEqual([
      { id: '1', content: 'Hello Telegram 1', channelId: '12345' },
      { id: '2', content: 'Hello Telegram 2', channelId: '12345' },
    ]);
  });

  it('should throw an error if TELEGRAM_TG_CHANNEL is not set', async () => {
    mockAccount.credentials.TELEGRAM_TG_CHANNEL = undefined;
    await expect(fetchTelegramMessages(mockClient, mockAccount)).rejects.toThrow(
      'TELEGRAM_TG_CHANNEL is not set in account credentials.'
    );
  });

  it('should throw an error if getEntity resolves to a forbidden channel', async () => {
    (mockClient.getEntity as jest.Mock).mockResolvedValue(new MockApi.ChannelForbidden());
    await expect(fetchTelegramMessages(mockClient, mockAccount)).rejects.toThrow(
      'TG_CHANNEL "test_channel" is a private/forbidden channel; cannot fetch history.'
    );
  });

  it('should throw an error if getEntity resolves to a non-channel peer', async () => {
    (mockClient.getEntity as jest.Mock).mockResolvedValue({}); // An empty object or any other non-channel type
    await expect(fetchTelegramMessages(mockClient, mockAccount)).rejects.toThrow(
      'TG_CHANNEL "test_channel" is not a channel-type peer.'
    );
  });

  it('should throw an error if getEntity fails to resolve the channel', async () => {
    (mockClient.getEntity as jest.Mock).mockRejectedValue(new Error('Network error'));
    await expect(fetchTelegramMessages(mockClient, mockAccount)).rejects.toThrow(
      'Failed to resolve TG_CHANNEL "test_channel": Network error'
    );
  });

  it('should return an empty array if no messages property found in response', async () => {
    (mockClient.invoke as jest.Mock).mockResolvedValue({}); // No 'messages' property
    const messages = await fetchTelegramMessages(mockClient, mockAccount);
    expect(messages).toEqual([]);
  });

  it('should filter out messages with missing id or content', async () => {
    (mockClient.invoke as jest.Mock).mockResolvedValue({
      messages: [
        { id: 1, message: 'Valid message', date: 1678886400 },
        { id: null, message: 'Message with null id', date: 1678886460 },
        { id: 3, message: null, date: 1678886520 },
        { id: 4, message: undefined, date: 1678886580 },
        { id: 5, date: 1678886640 }, // Missing both id and message
      ],
    });

    const messages = await fetchTelegramMessages(mockClient, mockAccount);
    expect(messages).toEqual([
      { id: '1', content: 'Valid message', channelId: '12345' },
    ]);
  });

  it('should handle messages with string IDs', async () => {
    (mockClient.invoke as jest.Mock).mockResolvedValue({
      messages: [
        { id: 'abc', message: 'Message with string ID', date: 1678886400 },
      ],
    });

    const messages = await fetchTelegramMessages(mockClient, mockAccount);
    expect(messages).toEqual([
      { id: 'abc', content: 'Message with string ID', channelId: '12345' },
    ]);
  });
});
