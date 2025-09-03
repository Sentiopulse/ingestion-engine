// src/twitterApi.ts
import dotenv from 'dotenv';
dotenv.config();

export async function fetchHomeTimeline() {
  const url =
    "https://x.com/i/api/graphql/wEpbv0WrfwV6y2Wlf0fxBQ/HomeTimeline";

  if (!process.env.BEARER || !process.env.CSRF_TOKEN || !process.env.AUTH_TOKEN) {
    throw new Error('Missing required Twitter API tokens.');
  }

  const headers: Record<string, string> = {
    "authority": "x.com",
    "accept": "*/*",
    "accept-encoding": "gzip, deflate, br, zstd",
    "accept-language": "en-US,en;q=0.7",
    "authorization": `Bearer ${process.env.BEARER}`,
    "content-type": "application/json",
    "cookie":
      `d_prefs=MjoxLGNvbnNlbnRfdmVyc2lvbjoyLHRleHRfdmVyc2lvbjoxMDAw; __cuid=c83a98bbbcc44d70b8ef8eb2c01985a5; personalization_id="v1_gGUlmPGLWEUBph5GFMAPtg=="; g_state={"i_l":0}; kdt=sckDK0NlgccWT3qd88hPomFPEEsaIgz9VDCmRxsp; lang=en; dnt=1; auth_multi="4847657575:910d912e26d3cc71419b47f8cdb61dbf28daa662"; auth_token=${process.env.AUTH_TOKEN}; guest_id_ads=v1%3A175688409511656837; guest_id_marketing=v1%3A175688409511656837; guest_id=v1%3A175688409511656837; twid=u%3D1946615847713447936; ct0=${process.env.CSRF_TOKEN}; external_referer=padhuUp37zjgzgv1mFWxJ12Ozwit7owX|0|8e8t2xd8A2w%3D; __cf_bm=WKVrtWCBvGgZBSeVVeW6PYHjqm0zC3xzGV_57KbJbZw-1756913980-1.0.1.1-4lq3DM.brVhYh11c4fjYjgWYi6GIxI8QVlzzXA.3iSsqYNZOOjZEqqGkkmklw5Thwrj5298mGr6.mIlWYzfQGFMv4abC_F7PigGMkqWwJ.I`,
    "origin": "https://x.com",
    "referer": "https://x.com/home",
    "sec-ch-ua":
      `"Not;A=Brand";v="99", "Brave";v="139", "Chromium";v="139"`,
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": `"Linux"`,
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "sec-gpc": "1",
    "user-agent":
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
    "x-client-transaction-id":
      "P8GWBZGM4Kef5cgpMWTtIf/CNWsl6pOUss42/MbziQsBKa30tYZlAl5P1vVMgQtXHSTBVzsRsWk+9zGyBiffgh4nOo32PA",
    "x-csrf-token": `${process.env.CSRF_TOKEN}`,
    "x-twitter-active-user": "yes",
    "x-twitter-auth-type": "OAuth2Session",
    "x-twitter-client-language": "en",
  };

  const body = {
    variables: {
      count: 20,
      includePromotedContent: true,
      latestControlAvailable: true,
      requestContext: "launch",
      withCommunity: true,
      seenTweetIds: [
        "1963059240672928159",
        "1963081007193628913",
        "1963092350101815329",
        "1963033035567243480",
      ],
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
      tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled:
        true,
      longform_notetweets_rich_text_read_enabled: true,
      longform_notetweets_inline_media_enabled: true,
      responsive_web_grok_image_annotation_enabled: true,
      responsive_web_grok_imagine_annotation_enabled: true,
      responsive_web_grok_community_note_auto_translation_is_enabled: false,
      responsive_web_enhance_cards_enabled: false,
    },
    queryId: "wEpbv0WrfwV6y2Wlf0fxBQ",
  };

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Request failed with status ${res.status}`);
  }

  return res.json();
}
