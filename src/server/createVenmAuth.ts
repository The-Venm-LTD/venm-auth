import { Router, json, type Request, type Response, type NextFunction } from "express";
import cookieParser from "cookie-parser";
import type { DatabaseAdapter } from "./database/adapter";
import type { SessionConfig } from "./session/index";
import type { GoogleOAuthConfig } from "./oauth/google";
import type { FacebookOAuthConfig } from "./oauth/facebook";
import { createGoogleRoutes } from "./routes/google";
import { createFacebookRoutes } from "./routes/facebook";
import { createResultRoutes } from "./routes/result";
import { createSessionRoutes } from "./routes/session";
import { createRefreshRoutes } from "./routes/refresh";
import { createUserRoutes } from "./routes/user";
import { createLogoutRoutes } from "./routes/logout";
import { createHealthRoutes } from "./routes/health";
import { OauthResultStore } from "./store/oauth-result-store";
import { errorHandler } from "./middleware/error-handler";
import { oauthRateLimiter, resultRateLimiter, sessionRateLimiter } from "./middleware/rate-limit";
import { csrfProtection } from "./middleware/csrf";

// ── Config Types ────────────────────────────────────────────────────

export interface VenmAuthConfig {
  /** Google OAuth credentials (optional — omit if not using Google login). */
  google?: GoogleOAuthConfig;
  /** Facebook OAuth credentials (optional — omit if not using Facebook login). */
  facebook?: FacebookOAuthConfig;
  /** Secret key used to sign and verify JWT tokens (min 32 characters for HS256). */
  jwtSecret: string;
  /** Database adapter for persisting users and sessions. */
  database: DatabaseAdapter;
  /** Session configuration (optional). */
  session?: SessionConfig;
  /**
   * Route prefix used to construct callback URLs (e.g., "/api/auth/google/callback").
   * This should match the path where the router is mounted.
   * Default: "/api/auth".
   */
  prefix?: string;
  /** Allowed origins for CSRF protection on POST token exchange endpoints. Defaults to the Origin/Referer header of incoming requests. */
  allowedOrigins?: string[];
}

// ── createVenmAuth ──────────────────────────────────────────────────

/**
 * Create an Express Router that handles all authentication endpoints.
 *
 * Usage:
 * ```typescript
 * import express from "express";
 * import { createVenmAuth } from "venm-auth/server";
 * import { createMongoDBAdapter } from "venm-auth/server";
 *
 * const app = express();
 *
 * app.use("/api/auth", createVenmAuth({
 *   google: {
 *     clientId: process.env.GOOGLE_CLIENT_ID!,
 *     clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
 *   },
 *   jwtSecret: process.env.JWT_SECRET!,
 *   database: createMongoDBAdapter({ uri: process.env.MONGODB_URI! }),
 * }));
 * ```
 */
export function createVenmAuth(config: VenmAuthConfig): Router {
  const router = Router();
  const { jwtSecret, database: db, google, facebook } = config;

  // ── Validate JWT Secret ────────────────────────────────────────
  // HS256 requires a key of at least 32 bytes for adequate security.
  // Short or weak secrets can be brute-forced to forge tokens.
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error(
      `VenmAuth: jwtSecret must be at least 32 characters long. ` +
      `Got ${jwtSecret?.length ?? 0} characters.`
    );
  }

  // ── Request Logger ────────────────────────────────────────────
  router.use((req: Request, _res: Response, next: NextFunction) => {
    const origin = req.headers["origin"] ?? "-";
    const contentType = req.headers["content-type"] ?? "-";
    console.log(`[venm-auth] ${req.method} ${req.path} origin=${origin} content-type=${contentType}`);
    next();
  });

  // Enable JSON body parsing for POST requests
  router.use(json());

  // Enable cookie parsing for CSRF state cookies
  router.use(cookieParser());

  // ── Health ─────────────────────────────────────────────────────
  router.use("/health", createHealthRoutes());

  // ── OAuth Result Store (in-memory, for server-side result relay) ──
  const oauthResultStore = new OauthResultStore();
  oauthResultStore.startCleanup();

  // Derive token expiry options from session config (if provided)
  const tokenExpiry = config.session
    ? {
        accessTokenExpiresIn: config.session.accessTokenExpiresIn,
        refreshTokenExpiresIn: config.session.refreshTokenExpiresIn,
      }
    : undefined;

  // ── OAuth Routes ──────────────────────────────────────────────
  if (google) {
    router.use("/google", oauthRateLimiter, csrfProtection(config.allowedOrigins), createGoogleRoutes(google, jwtSecret, db, config.prefix, oauthResultStore, tokenExpiry));
  }

  if (facebook) {
    router.use("/facebook", oauthRateLimiter, csrfProtection(config.allowedOrigins), createFacebookRoutes(facebook, jwtSecret, db, config.prefix, oauthResultStore, tokenExpiry));
  }

  // ── OAuth Result Retrieval (polled by client to bypass COOP) ──
  router.use("/result", resultRateLimiter, createResultRoutes(oauthResultStore));

  // ── Refresh Token Route ───────────────────────────────────────
  router.use("/refresh", sessionRateLimiter, createRefreshRoutes(jwtSecret, db, tokenExpiry));

  // ── Session & User Routes ─────────────────────────────────────
  router.use("/session", sessionRateLimiter, createSessionRoutes(jwtSecret, db));
  router.use("/user", sessionRateLimiter, createUserRoutes(jwtSecret, db));
  router.use("/logout", sessionRateLimiter, createLogoutRoutes(jwtSecret, db));

  // ── Error Handler ─────────────────────────────────────────────
  router.use(errorHandler);

  return router;
}
