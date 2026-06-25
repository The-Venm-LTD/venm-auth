import axios from "axios";

// ── Types ───────────────────────────────────────────────────────────

export interface FacebookOAuthConfig {
  appId: string;
  appSecret: string;
}

export interface FacebookTokens {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface FacebookProfile {
  id: string;
  email: string;
  name: string;
  picture: {
    data: {
      url: string;
      width: number;
      height: number;
      is_silhouette: boolean;
    };
  };
}

export interface FacebookCallbackResult {
  tokens: FacebookTokens;
  profile: FacebookProfile;
}

// ── Token Exchange ──────────────────────────────────────────────────

/**
 * Exchange an authorization code for Facebook access tokens.
 * Facebook uses the OAuth 2.0 Authorization Code flow (no PKCE).
 */
export async function exchangeFacebookCode(
  code: string,
  redirectUri: string,
  config: FacebookOAuthConfig
): Promise<FacebookTokens> {
  const params = new URLSearchParams({
    code,
    client_id: config.appId,
    client_secret: config.appSecret,
    redirect_uri: redirectUri,
  });

  console.log(`[venm-auth] Facebook API: exchanging code`);

  const response = await axios.get<FacebookTokens>(
    "https://graph.facebook.com/v21.0/oauth/access_token",
    { params }
  );

  console.log(`[venm-auth] Facebook API: token exchange response status=${response.status}`);

  return response.data;
}

// ── Profile Fetch ───────────────────────────────────────────────────

/**
 * Fetch the user's Facebook profile using an access token.
 */
export async function fetchFacebookProfile(
  accessToken: string
): Promise<FacebookProfile> {
  console.log(`[venm-auth] Facebook API: fetching profile`);

  const response = await axios.get<FacebookProfile>(
    "https://graph.facebook.com/v21.0/me",
    {
      params: {
        fields: "id,name,email,picture",
        access_token: accessToken,
      },
    }
  );

  console.log(`[venm-auth] Facebook API: profile fetched, id=${response.data.id}, email=${response.data.email}`);

  return response.data;
}

// ── Combined ────────────────────────────────────────────────────────

/**
 * Exchange an authorization code and fetch the user profile in one call.
 */
export async function handleFacebookCallback(
  code: string,
  redirectUri: string,
  config: FacebookOAuthConfig
): Promise<FacebookCallbackResult> {
  const tokens = await exchangeFacebookCode(code, redirectUri, config);
  const profile = await fetchFacebookProfile(tokens.access_token);
  return { tokens, profile };
}
