export interface OAuthConfig {
  google?: { clientId: string };
  facebook?: { appId: string };
}

export interface SDKConfig {
  /**
   * Base URL for the auth API endpoints on your Express server.
   * Defaults to "http://localhost:3000/api/auth" in development,
   * or "/api/auth" in production (same-origin).
   */
  apiUrl?: string;

  /** Runtime environment. Default: "production". */
  environment: "production" | "development";

  /** Enable automatic token refresh before expiry. Default: true. */
  autoRefresh?: boolean;

  /** Persist session to storage. Default: true. */
  persistSession?: boolean;

  /** Storage mechanism for session persistence. Default: "localStorage". */
  storage?: "localStorage" | "sessionStorage";

  /** HTTP request timeout in ms. Default: 10000. */
  timeout?: number;

  /** Custom OAuth redirect URI. Default: "{origin}/__venm/auth/callback". */
  redirectUri?: string;

  /** OAuth provider credentials (Google client ID, Facebook app ID). */
  oauth?: OAuthConfig;
}
