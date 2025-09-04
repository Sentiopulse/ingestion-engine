import dotenv from 'dotenv';
dotenv.config();

// Build a Cookie header string from environment variables only.
// Define mappings of env var -> cookie key. Only present, non-empty values are included.
function buildCookieFromEnv(): string | undefined {
  const mapping: Record<string, string> = {
    COOKIE_D_PREFS: 'd_prefs',
    COOKIE_CUID: '__cuid',
    PERSONALIZATION_ID: 'personalization_id',
    COOKIE_G_STATE: 'g_state',
    KDT: 'kdt',
    LANG: 'lang',
    DNT: 'dnt',
    AUTH_MULTI: 'auth_multi',
    AUTH_TOKEN: 'auth_token',
    GUEST_ID_ADS: 'guest_id_ads',
    GUEST_ID_MARKETING: 'guest_id_marketing',
    GUEST_ID: 'guest_id',
    TWID: 'twid',
    CT0: 'ct0',
    EXTERNAL_REFERER: 'external_referer',
    CF_BM: '__cf_bm'
  };
  const parts: string[] = [];
  for (const [envName, cookieKey] of Object.entries(mapping)) {
    let val = process.env[envName];
    if (typeof val === 'string') val = val.trim();
    // Skip if empty or contains CR, LF, or semicolon
    if (!val || /[\r\n;]/.test(val)) continue;
    parts.push(`${cookieKey}=${val}`);
  }
  // If CT0 is missing, but CSRF_TOKEN is present and valid, add ct0
  if (!process.env.CT0 && process.env.CSRF_TOKEN) {
    const csrf = process.env.CSRF_TOKEN.trim();
    if (csrf && !/[\r\n;]/.test(csrf)) {
      parts.push(`ct0=${csrf}`);
    }
  }
  if (!parts.length) return undefined;
  return parts.join('; ');
}

export async function fetchHomeTimeline(seenTweetIds: string[] = []) {
  const url =
    "https://x.com/i/api/graphql/wEpbv0WrfwV6y2Wlf0fxBQ/HomeTimeline";

  const requiredTokens = ['BEARER', 'CSRF_TOKEN', 'AUTH_TOKEN'];
  const missing = requiredTokens.filter(k => {
    const val = process.env[k];
    return typeof val === 'undefined' || val === '';
  });
  if (missing.length) {
    throw new Error(`Missing required Twitter API tokens: ${missing.join(', ')}`);
  }

  const headers: Record<string, string> = {
    "authority": "x.com",
    "accept": "*/*",
    "accept-encoding": "gzip, deflate, br, zstd",
    "accept-language": "en-US,en;q=0.7",
    "authorization": `Bearer ${process.env.BEARER}`,
    "content-type": "application/json",
    "origin": "https://x.com",
    "referer": "https://x.com/home",
    "sec-ch-ua": `"Not;A=Brand";v="99", "Brave";v="139", "Chromium";v="139"`,
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": `"Linux"`,
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "sec-gpc": "1",
    "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
    "x-csrf-token": `${process.env.CSRF_TOKEN}`,
    "x-twitter-active-user": "yes",
    "x-twitter-auth-type": "OAuth2Session",
    "x-twitter-client-language": "en",
  };

  const dynamicCookie = buildCookieFromEnv();
  if (dynamicCookie) {
    headers.cookie = dynamicCookie;
  }

  // Normalize seenTweetIds to an array of non-empty strings
  const normalizedSeen = Array.isArray(seenTweetIds)
    ? seenTweetIds.filter(id => typeof id === 'string' && id.trim() !== '').map(id => id.trim())
    : [];

  const body = {
    variables: {
      count: 20,
      includePromotedContent: true,
      latestControlAvailable: true,
      requestContext: "launch",
      withCommunity: true,
      seenTweetIds: normalizedSeen,
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

  let timeoutMs = parseInt(process.env.TWITTER_REQUEST_TIMEOUT_MS ?? '', 10);
  if (isNaN(timeoutMs) || timeoutMs <= 0) timeoutMs = 10000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`Twitter request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    throw new Error(`Request failed with status ${res.status}`);
  }

  let json: any;
  try {
    json = await res.json();
  } catch (e) {
    throw new Error(`Failed to parse JSON response: ${(e as Error).message}`);
  }

  if (json && Array.isArray(json.errors) && json.errors.length) {
    const context = {
      queryId: body.queryId,
      variablesSummary: {
        count: body.variables.count,
        seenTweetIdsLength: body.variables.seenTweetIds?.length || 0
      }
    };
    throw new Error(`Twitter GraphQL errors: ${JSON.stringify(json.errors)} | context=${JSON.stringify(context)}`);
  }

  // Prefer returning the data field if present, else the whole JSON.
  return Object.prototype.hasOwnProperty.call(json, 'data') ? json.data : json;
}
