import type { ProviderType } from "../types/auth";
import { OAUTH_ENDPOINTS } from "../constants";

/**
 * Build the authorization URL that the popup opens to start the OAuth flow.
 * Points to the developer's Express server which handles the OAuth redirect.
 *
 * The server's route (e.g., GET /google) takes query params:
 *   - state: Anti-CSRF state token
 *   - code_challenge: PKCE code challenge (S256)
 *   - redirect_uri: Where Google/Facebook should redirect after consent
 *
 * @example
 * buildAuthorizationUrl({
 *   apiUrl: "http://localhost:3000/api/auth",
 *   provider: "google",
 *   state: "random-state",
 *   codeChallenge: "base64url-encoded-challenge",
 *   scopes: ["openid", "email", "profile"],
 * })
 * // => "http://localhost:3000/api/auth/google?state=...&code_challenge=..."
 */
export function buildAuthorizationUrl(config: {
  apiUrl: string;
  provider: ProviderType;
  state: string;
  codeChallenge?: string;
  scopes?: string[];
  redirectUri?: string;
  authSessionId?: string;
}): string {
  const endpoint =
    config.provider === "google"
      ? OAUTH_ENDPOINTS.GOOGLE_AUTHORIZE
      : OAUTH_ENDPOINTS.FACEBOOK_AUTHORIZE;

  // Build the full URL by appending the endpoint to the apiUrl
  const baseUrl = config.apiUrl.replace(/\/+$/, "");
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = new URL(`${baseUrl}${path}`);

  if (config.state) {
    url.searchParams.set("state", config.state);
  }

  if (config.codeChallenge) {
    url.searchParams.set("code_challenge", config.codeChallenge);
  }

  if (config.redirectUri) {
    url.searchParams.set("redirect_uri", config.redirectUri);
  }

  if (config.authSessionId) {
    url.searchParams.set("auth_session_id", config.authSessionId);
  }

  return url.toString();
}

/**
 * Parse auth response parameters from a URL (used for redirect-based flows).
 */
export function parseAuthResponseFromUrl(
  urlString: string
): { code?: string; state?: string; error?: string } {
  try {
    const url = new URL(urlString);
    const code = url.searchParams.get("code") ?? undefined;
    const state = url.searchParams.get("state") ?? undefined;
    const error = url.searchParams.get("error") ?? undefined;
    return { code, state, error };
  } catch {
    return {};
  }
}
