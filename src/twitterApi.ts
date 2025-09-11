
import dotenv from 'dotenv';
dotenv.config();

export async function fetchHomeTimeline(seenTweetIds: string[] = []): Promise<Array<{ id: string; content: string; authorId: string }>> {
  const queryId = "wEpbv0WrfwV6y2Wlf0fxBQ";
  const url = `https://x.com/i/api/graphql/${queryId}/HomeTimeline`;

  // Check required environment variables
  const requiredTokens = ['BEARER', 'CSRF_TOKEN', 'AUTH_TOKEN'];
  const missing = requiredTokens.filter(k => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing required tokens: ${missing.join(', ')}`);
  }

  // Setup headers with cookies
  const cookie = `auth_token=${process.env.AUTH_TOKEN};ct0=${process.env.CSRF_TOKEN}`;

  const headers = {
    "authorization": `Bearer ${process.env.BEARER}`,
    "content-type": "application/json",
    "x-csrf-token": `${process.env.CSRF_TOKEN}`,
    "cookie": cookie,
  };

  // Prepare request body
  const body = {
    variables: {
      count: 20,
      includePromotedContent: true,
      latestControlAvailable: true,
      requestContext: "launch",
      withCommunity: true,
      seenTweetIds: seenTweetIds || [],
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
      responsive_web_enhance_cards_enabled: false,
    },
    queryId,
  };

  // Make API request
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
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

  // Format and return tweets as [{ content, id }]
  const timeline = data.data || data;
  const tweets: Array<{ content: string, id: string, authorId: string }> = [];
  const seen = new Set<string>();
  const seenInput = new Set(seenTweetIds);

  try {
    // Twitter's actual GraphQL HomeTimeline response structure
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
          base?.legacy?.full_text ??
          base?.note_tweet?.note_tweet_results?.result?.text;
        const authorId: string | undefined = base?.core?.user_results?.result?.rest_id;
        if (!restId || !fullText || !authorId) continue;
        if (seenInput.has(restId) || seen.has(restId)) continue;
        tweets.push({ id: restId, content: fullText, authorId });
        seen.add(restId);
      }
    }
  } catch (e) {
    console.error("Error parsing tweets:", e);
  }

  return tweets;
}

// Test runner - when file is executed directly
async function main() {
  console.log('Starting fetchHomeTimeline...');
  try {
    const data = await fetchHomeTimeline();

    // Show JSON response (truncated for readability)
    const jsonString = JSON.stringify(data, null, 2);

    console.log(jsonString);
  } catch (err) {
    console.error('fetchHomeTimeline failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
main();

