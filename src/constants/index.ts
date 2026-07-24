// ── Environment Constants ──────────────────────────────────────────
export const DEVELOPMENT = "development" as const;
export const PRODUCTION = "production" as const;

// ── Defaults ───────────────────────────────────────────────────────
export const DEFAULT_BASE_URLS = {
  development: "http://localhost:3000/api/auth",
  production: "/api/auth",
} as const;
export const DEFAULT_TIMEOUT = 10_000;
export const DEFAULT_POPUP_WIDTH = 600;
export const DEFAULT_POPUP_HEIGHT = 700;
export const TOKEN_REFRESH_MARGIN_MS = 120_000;
export const POPUP_TIMEOUT_MS = 300_000;

export const STORAGE_KEY_SESSION = "venm_auth_session";
export const STORAGE_KEY_USER = "venm_auth_user";
export const POPUP_MESSAGE_CHANNEL = "venm_auth_response";

/**
 * API endpoints relative to the base URL.
 * The server mounts these behind the auth prefix (default: /api/auth).
 * The /v1/ prefix has been removed — server routes use clean paths.
 */
export const API_ENDPOINTS = {
  AUTH_GOOGLE: "/google",
  AUTH_GOOGLE_ONE_TAP: "/google/onetap",
  AUTH_FACEBOOK: "/facebook",
  AUTH_LOGOUT: "/logout",
  AUTH_REFRESH: "/refresh",
  SESSION: "/session",
  USER: "/user",
} as const;

/**
 * OAuth authorization endpoints on the developer's Express server.
 * The popup opens these URLs to initiate the OAuth flow.
 */
export const OAUTH_ENDPOINTS = {
  GOOGLE_AUTHORIZE: "/google",
  FACEBOOK_AUTHORIZE: "/facebook",
} as const;
