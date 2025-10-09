
import { fetchHomeTimeline } from '../twitterApi';
import { followUser, getLatestTwitterCredentialsFromRedis } from '../twitterApiFollow';
import { TwitterAccount, twitterAccountManager } from '../services/twitterAccountManager';
import { createClient } from 'redis';
import { decrypt } from '../lib/encryption';

// Mocking global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mocking redis client
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    get: jest.fn(),
    quit: jest.fn(),
  })),
}));

// Mocking encryption
jest.mock('../lib/encryption', () => ({
  decrypt: jest.fn((x) => `decrypted_${x}`),
}));

// Mocking twitterAccountManager
jest.mock('../services/twitterAccountManager', () => ({
  twitterAccountManager: {
    getEarliestUsedAccount: jest.fn(),
    markAccountAsUsed: jest.fn(),
  },
  TwitterAccount: jest.fn(),
}));

const mockTwitterAccount: TwitterAccount = {
  accountId: 'test_account_id',
  credentials: {
    TWITTER_BEARER: 'encrypted_bearer',
    TWITTER_CSRF_TOKEN: 'encrypted_csrf',
    TWITTER_AUTH_TOKEN: 'encrypted_auth',
  },
  lastUsed: null,
  totalRequests: 0,
};

describe('twitterApi.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (twitterAccountManager.getEarliestUsedAccount as jest.Mock).mockResolvedValue(mockTwitterAccount);
  });

  describe('fetchHomeTimeline', () => {
    it('should fetch home timeline successfully', async () => {
      const mockResponse = {
        data: {
          home: {
            home_timeline_urt: {
              instructions: [
                {
                  entries: [
                    {
                      content: {
                        itemContent: {
                          tweet_results: {
                            result: {
                              __typename: 'Tweet',
                              rest_id: '123',
                              legacy: { full_text: 'Test tweet 1' },
                              core: { user_results: { result: { rest_id: 'author1' } } },
                            },
                          },
                        },
                      },
                    },
                    {
                      content: {
                        itemContent: {
                          tweet_results: {
                            result: {
                              __typename: 'Tweet',
                              rest_id: '456',
                              legacy: { full_text: 'Test tweet 2' },
                              core: { user_results: { result: { rest_id: 'author2' } } },
                            },
                          },
                        },
                      },
                    },
                  ],
                },
              ],
            },
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const tweets = await fetchHomeTimeline();

      expect(tweets).toEqual([
        { id: '123', content: 'Test tweet 1', authorId: 'author1' },
        { id: '456', content: 'Test tweet 2', authorId: 'author2' },
      ]);
      expect(twitterAccountManager.markAccountAsUsed).toHaveBeenCalledWith(mockTwitterAccount.accountId);
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      await expect(fetchHomeTimeline()).rejects.toThrow('Twitter API request failed: 400 Bad Request');
    });

    it('should handle GraphQL errors', async () => {
      const mockErrorResponse = {
        errors: [{ message: 'GraphQL error' }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockErrorResponse),
      });

      await expect(fetchHomeTimeline()).rejects.toThrow('Twitter API errors: [{"message":"GraphQL error"}]');
    });

    it('should filter out seen tweet IDs', async () => {
      const mockResponse = {
        data: {
          home: {
            home_timeline_urt: {
              instructions: [
                {
                  entries: [
                    {
                      content: {
                        itemContent: {
                          tweet_results: {
                            result: {
                              __typename: 'Tweet',
                              rest_id: '123',
                              legacy: { full_text: 'Test tweet 1' },
                              core: { user_results: { result: { rest_id: 'author1' } } },
                            },
                          },
                        },
                      },
                    },
                    {
                      content: {
                        itemContent: {
                          tweet_results: {
                            result: {
                              __typename: 'Tweet',
                              rest_id: '456',
                              legacy: { full_text: 'Test tweet 2' },
                              core: { user_results: { result: { rest_id: 'author2' } } },
                            },
                          },
                        },
                      },
                    },
                  ],
                },
              ],
            },
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const tweets = await fetchHomeTimeline(['123']);

      expect(tweets).toEqual([
        { id: '456', content: 'Test tweet 2', authorId: 'author2' },
      ]);
    });
  });
});

describe('twitterApiFollow.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getLatestTwitterCredentialsFromRedis', () => {
    it('should fetch and decrypt credentials from Redis successfully', async () => {
      const mockRedisData = JSON.stringify([
        {
          TWITTER_BEARER: 'encrypted_bearer_1',
          TWITTER_COOKIE: 'encrypted_cookie_1',
          TWITTER_CSRF_TOKEN: 'encrypted_csrf_1',
        },
        {
          TWITTER_BEARER: 'encrypted_bearer_2',
          TWITTER_COOKIE: 'encrypted_cookie_2',
          TWITTER_CSRF_TOKEN: 'encrypted_csrf_2',
        },
      ]);

      (createClient as jest.Mock).mockReturnValue({
        connect: jest.fn().mockResolvedValue(undefined),
        get: jest.fn().mockResolvedValue(mockRedisData),
        quit: jest.fn().mockResolvedValue(undefined),
      });

      const credentials = await getLatestTwitterCredentialsFromRedis();

      expect(credentials).toEqual({
        bearerToken: 'decrypted_encrypted_bearer_2',
        cookie: 'decrypted_encrypted_cookie_2',
        csrfToken: 'decrypted_encrypted_csrf_2',
      });
      expect(decrypt).toHaveBeenCalledWith('encrypted_bearer_2');
      expect(decrypt).toHaveBeenCalledWith('encrypted_cookie_2');
      expect(decrypt).toHaveBeenCalledWith('encrypted_csrf_2');
    });

    it('should throw error if no twitter-accounts found in Redis', async () => {
      (createClient as jest.Mock).mockReturnValue({
        connect: jest.fn().mockResolvedValue(undefined),
        get: jest.fn().mockResolvedValue(null),
        quit: jest.fn().mockResolvedValue(undefined),
      });

      await expect(getLatestTwitterCredentialsFromRedis()).rejects.toThrow('No twitter-accounts found in Redis');
    });

    it('should throw error if failed to parse twitter-accounts from Redis', async () => {
      (createClient as jest.Mock).mockReturnValue({
        connect: jest.fn().mockResolvedValue(undefined),
        get: jest.fn().mockResolvedValue('invalid json'),
        quit: jest.fn().mockResolvedValue(undefined),
      });

      await expect(getLatestTwitterCredentialsFromRedis()).rejects.toThrow('Failed to parse twitter-accounts from Redis');
    });

    it('should throw error if no twitter accounts stored in Redis', async () => {
      (createClient as jest.Mock).mockReturnValue({
        connect: jest.fn().mockResolvedValue(undefined),
        get: jest.fn().mockResolvedValue('[]'),
        quit: jest.fn().mockResolvedValue(undefined),
      });

      await expect(getLatestTwitterCredentialsFromRedis()).rejects.toThrow('No twitter accounts stored in Redis');
    });
  });

  describe('followUser', () => {
    const mockAuthOptions = {
      bearerToken: 'test_bearer',
      cookie: 'test_cookie',
      csrfToken: 'test_csrf',
    };

    it('should follow user successfully with provided options', async () => {
      const mockResponse = { success: true };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await followUser('12345', mockAuthOptions);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://x.com/i/api/1.1/friendships/create.json',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'authorization': `Bearer ${mockAuthOptions.bearerToken}`,
            'cookie': mockAuthOptions.cookie,
            'x-csrf-token': mockAuthOptions.csrfToken,
          }),
          body: expect.any(URLSearchParams),
        })
      );
    });

    it('should follow user successfully fetching credentials from Redis', async () => {
      const mockResponse = { success: true };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const mockRedisData = JSON.stringify([
        {
          TWITTER_BEARER: 'encrypted_bearer_1',
          TWITTER_COOKIE: 'encrypted_cookie_1',
          TWITTER_CSRF_TOKEN: 'encrypted_csrf_1',
        },
      ]);

      (createClient as jest.Mock).mockReturnValue({
        connect: jest.fn().mockResolvedValue(undefined),
        get: jest.fn().mockResolvedValue(mockRedisData),
        quit: jest.fn().mockResolvedValue(undefined),
      });

      const result = await followUser('12345');

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://x.com/i/api/1.1/friendships/create.json',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'authorization': `Bearer decrypted_encrypted_bearer_1`,
            'cookie': `decrypted_encrypted_cookie_1`,
            'x-csrf-token': `decrypted_encrypted_csrf_1`,
          }),
          body: expect.any(URLSearchParams),
        })
      );
    });

    it('should handle API errors when following user', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('User not found'),
      });

      await expect(followUser('12345', mockAuthOptions)).rejects.toThrow('Twitter follow failed: 400 User not found');
    });
  });
});
