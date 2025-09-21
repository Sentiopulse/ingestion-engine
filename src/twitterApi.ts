import dotenv from 'dotenv';
import cron from 'node-cron';
import { twitterAccountManager, TwitterAccount } from './services/twitterAccountManager';

dotenv.config();

async function fetchViewerAccount(account: TwitterAccount): Promise<{ screenName: string; userId: string } | null> {
  const url = 'https://x.com/i/api/graphql/jMaTSZ5dqXctUg5f97R6xw/Viewer';

  const headers = {
    authorization: `Bearer ${account.credentials.TWITTER_BEARER}`,
    'x-csrf-token': account.credentials.TWITTER_CSRF_TOKEN,
    cookie: `auth_token=${account.credentials.TWITTER_AUTH_TOKEN}; ct0=${account.credentials.TWITTER_CSRF_TOKEN}`
  };

  const res = await fetch(url, { method: 'GET', headers });
  if (!res.ok) {
    console.error('Viewer API request failed:', res.status, res.statusText);
    return null;
  }

  const data = await res.json();
  const user = data?.data?.viewer?.user_results?.result;
  if (!user) return null;

  return {
    screenName: user.legacy?.screen_name,
    userId: user.rest_id
  };
}

export async function fetchHomeTimeline(
  seenTweetIds: string[] = [],
  providedAccount?: TwitterAccount
): Promise<Array<{ id: string; content: string; authorId: string }>> {
  const queryId = 'wEpbv0WrfwV6y2Wlf0fxBQ';
  const url = `https://x.com/i/api/graphql/${queryId}/HomeTimeline`;

  // Get the account to use (either provided or fetch the earliest used one)
  const account = providedAccount || (await twitterAccountManager.getEarliestUsedAccount());

  console.log(`Using Twitter account: ${account.accountId} for timeline fetch`);

  // Setup headers with the account's credentials
  const cookie = `auth_token=${account.credentials.TWITTER_AUTH_TOKEN};ct0=${account.credentials.TWITTER_CSRF_TOKEN}`;

  const headers = {
    authorization: `Bearer ${account.credentials.TWITTER_BEARER}`,
    'content-type': 'application/json',
    'x-csrf-token': account.credentials.TWITTER_CSRF_TOKEN,
    cookie: cookie
  };

  // Prepare request body
  const body = {
    variables: {
      count: 20,
      includePromotedContent: true,
      latestControlAvailable: true,
      requestContext: 'launch',
      withCommunity: true,
      seenTweetIds: seenTweetIds || []
    },
    features: {
      rweb_video_screen_enabled: false,
      payments_enabled: false,
      rweb_xchat_enabled: false,
      profile_label_improvements_pcf_label_in_post_enabled: true,
      rweb_tipjar_consumption_enabled: true,
      verified_phone_label_enabled: false,
      creator_subscriptions_tweet_preview_api_enabled: true,
      responsive_web_graphql_timeline_navigation_enabled: true,
      responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
      premium_content_api_read_enabled: false,
      communities_web_enable_tweet_community_results_fetch: true,
      c9s_tweet_anatomy_moderator_badge_enabled: true,
      responsive_web_grok_analyze_button_fetch_trends_enabled: false,
      responsive_web_grok_analyze_post_followups_enabled: true,
      responsive_web_jetfuel_frame: true,
      responsive_web_grok_share_attachment_enabled: true,
      articles_preview_enabled: true,
      responsive_web_edit_tweet_api_enabled: true,
      graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
      view_counts_everywhere_api_enabled: true,
      longform_notetweets_consumption_enabled: true,
      responsive_web_twitter_article_tweet_consumption_enabled: true,
      tweet_awards_web_tipping_enabled: false,
      responsive_web_grok_show_grok_translated_post: false,
      responsive_web_grok_analysis_button_from_backend: true,
      creator_subscriptions_quote_tweet_preview_enabled: false,
      freedom_of_speech_not_reach_fetch_enabled: true,
      standardized_nudges_misinfo: true,
      tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
      longform_notetweets_rich_text_read_enabled: true,
      longform_notetweets_inline_media_enabled: true,
      responsive_web_grok_image_annotation_enabled: true,
      responsive_web_grok_imagine_annotation_enabled: true,
      responsive_web_grok_community_note_auto_translation_is_enabled: false,
      responsive_web_enhance_cards_enabled: false
    },
    queryId
  };

  // Make API request
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  // Check response status
  if (!response.ok) {
    throw new Error(`Twitter API request failed: ${response.status} ${response.statusText}`);
  }

  // Parse JSON response
  const data = await response.json();

  // Check for GraphQL errors
  if (data.errors && data.errors.length > 0) {
    throw new Error(`Twitter API errors: ${JSON.stringify(data.errors)}`);
  }

  // Format and return tweets
  const timeline = data.data || data;
  const tweets: Array<{ content: string; id: string; authorId: string }> = [];
  const seenTweetIdsSet = new Set(seenTweetIds);

  try {
    const instructions = timeline?.home?.home_timeline_urt?.instructions || [];

    for (const instruction of instructions) {
      const entries = instruction?.entries ?? (instruction?.entry ? [instruction.entry] : []);
      for (const entry of entries) {
        const item = entry?.content?.itemContent;
        if (!item || item.promotedMetadata) continue; // exclude ads
        const result = item.tweet_results?.result;
        const base = result?.__typename === 'TweetWithVisibilityResults' ? result?.tweet : result;
        const restId: string | undefined = base?.rest_id;
        const fullText: string | undefined =
          base?.legacy?.full_text ?? base?.note_tweet?.note_tweet_results?.result?.text;
        const authorId: string | undefined = base?.core?.user_results?.result?.rest_id;
        if (!restId || !fullText || !authorId) continue;
        if (seenTweetIdsSet.has(restId)) continue;
        tweets.push({ id: restId, content: fullText, authorId });
        seenTweetIdsSet.add(restId);
      }
    }
  } catch (e) {
    console.error('Error parsing tweets:', e);
  }

  // Track API usage after successful fetch
  await twitterAccountManager.markAccountAsUsed(account.accountId);

  return tweets;
}

// Test runner - when file is executed directly
async function main() {
  console.log('Starting fetchHomeTimeline with account rotation...');
  try {
    // Get the earliest used account
    const account = await twitterAccountManager.getEarliestUsedAccount();

    // Fetch timeline data
    const data = await fetchHomeTimeline([], account);
    console.log(`Fetched ${data.length} tweets using account: ${account.accountId}`);

    // Get viewer info for the account
    const viewer = await fetchViewerAccount(account);
    console.log('Account info:', viewer);

    // Show usage statistics for all accounts
    const allAccounts = await twitterAccountManager.getAllAccountsUsage();
    console.log('All Twitter accounts usage:');
    allAccounts.forEach((acc, index) => {
      console.log(`  Account ${index + 1} (${acc.accountId}):`);
      console.log(`    Total requests: ${acc.totalRequests}`);
      console.log(`    Last used: ${acc.lastUsed || 'Never'}`);
    });
  } catch (err) {
    console.error('fetchHomeTimeline failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

// Run once at startup
main();

// Schedule to run every 5 minutes - automatically rotates to earliest used account
cron.schedule('*/5 * * * *', async () => {
  console.log('Refetching Twitter timeline with account rotation...');
  try {
    const timeline = await fetchHomeTimeline();
    console.log(`Fetched ${timeline.length} tweets`);
  } catch (err) {
    console.error('Scheduled Twitter timeline fetch failed:', err);
  }
});
