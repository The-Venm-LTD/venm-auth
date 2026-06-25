import axios from "axios";

// ── Types ───────────────────────────────────────────────────────────

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
}

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
  id_token?: string;
}

export interface GoogleProfile {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  locale: string;
}

export interface GoogleCallbackResult {
  tokens: GoogleTokens;
  profile: GoogleProfile;
}

// ── Token Exchange ──────────────────────────────────────────────────

/**
 * Exchange an authorization code for Google OAuth tokens.
 * Uses the OAuth 2.0 Authorization Code flow with PKCE.
 */
export async function exchangeGoogleCode(
  code: string,
  redirectUri: string,
  config: GoogleOAuthConfig,
  codeVerifier?: string
): Promise<GoogleTokens> {
  const params = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  if (codeVerifier) {
    params.set("code_verifier", codeVerifier);
  }

  console.log(`[venm-auth] Google API: exchanging code (codeVerifier=${codeVerifier ? "present" : "not set"})`);

  try {
    const response = await axios.post<GoogleTokens>(
      "https://oauth2.googleapis.com/token",
      params.toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    console.log(`[venm-auth] Google API: token exchange response status=${response.status}`);
  
    return response.data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      console.error("Status:", err.response?.status);
      console.error("Google:", err.response?.data);
    }
    throw err;
  }
}

// ── Profile Fetch ───────────────────────────────────────────────────

/**
 * Fetch the user's Google profile using an access token.
 */
export async function fetchGoogleProfile(
  accessToken: string
): Promise<GoogleProfile> {
  console.log(`[venm-auth] Google API: fetching profile`);

  const response = await axios.get<GoogleProfile>(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  console.log(`[venm-auth] Google API: profile fetched, id=${response.data.id}, email=${response.data.email}`);

  return response.data;
}

// ── Combined ────────────────────────────────────────────────────────

/**
 * Exchange an authorization code and fetch the user profile in one call.
 */
export async function handleGoogleCallback(
  code: string,
  redirectUri: string,
  config: GoogleOAuthConfig,
  codeVerifier?: string
): Promise<GoogleCallbackResult> {
  const tokens = await exchangeGoogleCode(code, redirectUri, config, codeVerifier);
  const profile = await fetchGoogleProfile(tokens.access_token);
  return { tokens, profile };
}
