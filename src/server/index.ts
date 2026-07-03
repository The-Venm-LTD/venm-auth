// ── Database Adapter ────────────────────────────────────────────────
export type { DatabaseAdapter, CreateUserData, CreateSessionData, ServerSession } from "./database/adapter";
export { createMongoDBAdapter } from "./database/adapters/mongodb";
export type { MongoDBAdapterConfig } from "./database/adapters/mongodb";

// ── JWT ─────────────────────────────────────────────────────────────
export { generateTokens, generateAccessToken, generateRefreshToken } from "./jwt/generate";
export type { TokenPayload, GeneratedTokens } from "./jwt/generate";
export { verifyToken, verifyRefreshToken, getSubjectFromToken } from "./jwt/verify";
export type { VerifiedToken } from "./jwt/verify";

// ── Session ─────────────────────────────────────────────────────────
export { SessionManager } from "./session/index";
export type { SessionConfig } from "./session/index";

// ── OAuth ───────────────────────────────────────────────────────────
export type { GoogleOAuthConfig, GoogleTokens, GoogleProfile, GoogleCallbackResult } from "./oauth/google";
export { exchangeGoogleCode, fetchGoogleProfile, handleGoogleCallback } from "./oauth/google";
export type { FacebookOAuthConfig, FacebookTokens, FacebookProfile, FacebookCallbackResult } from "./oauth/facebook";
export { exchangeFacebookCode, fetchFacebookProfile, handleFacebookCallback } from "./oauth/facebook";

// ── createVenmAuth ──────────────────────────────────────────────────
export { createVenmAuth } from "./createVenmAuth";
export type { VenmAuthConfig } from "./createVenmAuth";

// ── Error Handler ──────────────────────────────────────────────────
export { VenmAuthError, errorHandler } from "./middleware/error-handler";

// ── CSRF Middleware ────────────────────────────────────────────────
export { validateState, stateCookieMiddleware, CSRFError } from "./middleware/csrf";

// ── Rate Limit Middleware ──────────────────────────────────────────
export { createRateLimiter, oauthRateLimiter, resultRateLimiter, sessionRateLimiter, InMemoryStore } from "./middleware/rate-limit";
export type { RateLimitConfig, RateLimitStore } from "./middleware/rate-limit";

// ── OAuth Result Store ─────────────────────────────────────────────
export { OauthResultStore } from "./store/oauth-result-store";
