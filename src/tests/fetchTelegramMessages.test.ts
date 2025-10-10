import { fetchTelegramMessages } from '../fetchTelegramMessages';
import { TelegramClient, Api } from 'telegram';
import { TelegramAccount } from '../services/telegramAccountManager';

// Mock the redisUtils module to prevent actual Redis calls during tests
jest.mock('../utils/redisUtils', () => ({
  trackApiKeyUsage: jest.fn(),
}));

describe('fetchTelegramMessages', () => {
  let mockClient: jest.Mocked<TelegramClient>;
  let mockAccount: TelegramAccount;

  beforeEach(() => {
    mockClient = {
      getEntity: jest.fn(),
      invoke: jest.fn(),
    } as any; // Cast to any to allow partial mock

    mockAccount = {
      accountId: 'test_account_id',
      credentials: {
        TELEGRAM_TG_CHANNEL: 'test_channel',
      },
    };
  });

  it('should fetch and format messages successfully for a valid channel', async () => {
    // Mock getEntity to return a Channel object
    mockClient.getEntity.mockResolvedValue(
      new Api.Channel({
        id: 12345,
        accessHash: BigInt(67890),
        title: 'Test Channel',
        username: 'testchannel',
        date: new Date(),
        version: 1,
      })
    );

    // Mock invoke to return a messages.TypeMessages object with some messages
    mockClient.invoke.mockResolvedValue({
      className: 'messages.ChannelMessages',
      messages: [
        new Api.Message({
          id: 1,
          peerId: new Api.PeerChannel({ channelId: 12345 }),
          date: new Date(),
          message: 'Hello from Telegram!',
          out: false,
          mentioned: false,
          mediaUnread: false,
          silent: false,
          post: false,
          fromScheduled: false,
          legacy: false,
          editHide: false,
          pinned: false,
          noforwards: false,
          replies: undefined,
        }),
        new Api.Message({
          id: 2,
          peerId: new Api.PeerChannel({ channelId: 12345 }),
          date: new Date(),
          message: 'Another message.',
          out: false,
          mentioned: false,
          mediaUnread: false,
          silent: false,
          post: false,
          fromScheduled: false,
          legacy: false,
          editHide: false,
          pinned: false,
          noforwards: false,
          replies: undefined,
        }),
      ],
      chats: [],
      users: [],
    } as Api.messages.TypeMessages);

    const result = await fetchTelegramMessages(mockClient, mockAccount);

    expect(mockClient.getEntity).toHaveBeenCalledWith('test_channel');
    expect(mockClient.invoke).toHaveBeenCalledWith(
      new Api.messages.GetHistory({
        peer: expect.any(Api.Channel),
        limit: 10,
      })
    );
    expect(result).toEqual([
      { id: '1', content: 'Hello from Telegram!', channelId: '12345' },
      { id: '2', content: 'Another message.', channelId: '12345' },
    ]);
  });

  it('should throw an error if TELEGRAM_TG_CHANNEL is not set', async () => {
    mockAccount.credentials.TELEGRAM_TG_CHANNEL = undefined;
    await expect(fetchTelegramMessages(mockClient, mockAccount)).rejects.toThrow(
      'TELEGRAM_TG_CHANNEL is not set in account credentials.'
    );
  });

  it('should throw an error if getEntity returns a forbidden channel', async () => {
    mockClient.getEntity.mockResolvedValue(
      new Api.ChannelForbidden({
        id: 123,
        accessHash: BigInt(456),
        title: 'Forbidden Channel',
        date: new Date(),
      })
    );

    await expect(fetchTelegramMessages(mockClient, mockAccount)).rejects.toThrow(
      'TG_CHANNEL "test_channel" is a private/forbidden channel; cannot fetch history.'
    );
  });

  it('should throw an error if getEntity returns a non-channel peer', async () => {
    mockClient.getEntity.mockResolvedValue(
      new Api.User({
        id: 123,
        accessHash: BigInt(456),
        firstName: 'Test',
        lastName: 'User',
        phone: '1234567890',
      })
    );

    await expect(fetchTelegramMessages(mockClient, mockAccount)).rejects.toThrow(
      'TG_CHANNEL "test_channel" is not a channel-type peer.'
    );
  });

  it('should handle no messages gracefully', async () => {
    mockClient.getEntity.mockResolvedValue(
      new Api.Channel({
        id: 12345,
        accessHash: BigInt(67890),
        title: 'Test Channel',
        username: 'testchannel',
        date: new Date(),
        version: 1,
      })
    );

    mockClient.invoke.mockResolvedValue({
      className: 'messages.ChannelMessages',
      messages: [],
      chats: [],
      users: [],
    } as Api.messages.TypeMessages);

    const result = await fetchTelegramMessages(mockClient, mockAccount);
    expect(result).toEqual([]);
  });
});
