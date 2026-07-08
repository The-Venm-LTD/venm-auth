import { Router, type Request, type Response } from "express";
import type { DatabaseAdapter, CreateUserData } from "../database/adapter";
import type { GoogleOAuthConfig } from "../oauth/google";
import { handleGoogleCallback } from "../oauth/google";
import { generateTokens } from "../jwt/generate";
import { stateCookieMiddleware } from "../middleware/csrf";
import { callbackHtml } from "../utils/callback-html";
import type { OauthResultStore } from "../store/oauth-result-store";

// ── Route Builder ──────────────────────────────────────────────────

/**
 * @param prefix  The route prefix used for constructing callback URLs.
 *                Must match where the router is mounted. Default: "/api/auth".
 */
export function createGoogleRoutes(
  config: GoogleOAuthConfig,
  jwtSecret: string,
  db: DatabaseAdapter,
  prefix: string = "/api/auth",
  oauthResultStore?: OauthResultStore
): Router {
  const router = Router();

  const callbackPath = `${prefix}/google/callback`;

  /**
   * GET /google — Initiate Google OAuth redirect.
   * The popup opens this URL, which redirects to Google's consent screen.
   *
   * Query params:
   *   - state: Anti-CSRF state token (required)
   *   - code_challenge: PKCE code challenge (S256)
   *   - redirect_uri: Optional override for the OAuth callback redirect URI
   */
  router.get("/", stateCookieMiddleware.issue, (req: Request, res: Response) => {
    console.log(`[venm-auth] Google OAuth: initiating redirect, state=${req.query.state ? "present" : "missing"}, code_challenge=${req.query.code_challenge ? "present" : "missing"}`);
    const { state, code_challenge, redirect_uri, auth_session_id, offline } = req.query;

    // Store authSessionId mapping so the callback can look it up from the state
    if (oauthResultStore && state && auth_session_id) {
      oauthResultStore.setStateMapping(state as string, auth_session_id as string);
    }

    const protocol = req.protocol;
    const host = req.get("host") ?? "localhost:3000";
    const callbackUri = (redirect_uri as string) ?? `${protocol}://${host}${callbackPath}`;

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: callbackUri,
      response_type: "code",
      scope: "openid email profile",
    });

    // Request offline access (refresh token) unless explicitly opted out
    const shouldRequestOffline = offline !== "false";
    if (shouldRequestOffline) {
      params.set("access_type", "offline");
    }

    if (state) params.set("state", state as string);
    if (code_challenge) {
      params.set("code_challenge", code_challenge as string);
      params.set("code_challenge_method", "S256");
    }

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    res.redirect(302, googleAuthUrl);
  });

  /**
   * GET /google/callback — Google OAuth callback.
   * Google redirects here after the user signs in.
   * Validates the state parameter for CSRF protection,
   * then sends the authorization code back to the popup via postMessage.
   * The client then calls POST /google to exchange the code for tokens.
   */
  router.get(
    "/callback",
    stateCookieMiddleware.validate,
    async (req: Request, res: Response) => {
      try {
        const { code, state, error } = req.query;
        console.log(`[venm-auth] Google OAuth: callback received, code=${code ? "present" : "missing"}, error=${error ?? "none"}`);

        if (error) {
          const errorMessage = `Google sign-in error: ${error}`;
          if (oauthResultStore && state) {
            oauthResultStore.storeError(state as string, errorMessage);
          }
          res.send(callbackHtml("", errorMessage));
          return;
        }

        if (!code || typeof code !== "string") {
          const errorMessage = "Missing authorization code";
          if (oauthResultStore && state) {
            oauthResultStore.storeError(state as string, errorMessage);
          }
          res.status(400).send(callbackHtml("", errorMessage));
          return;
        }          // The popup's opener may have been severed by COOP headers, so
        // store the result on the server for the client to poll and retrieve.
        if (oauthResultStore) {
          oauthResultStore.storeResult(state as string, code);
        }

        // Send a simple page that tries postMessage (fast path) and closes.
        res.send(callbackHtml(code, undefined, state as string | undefined));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Google OAuth callback failed";
        res.status(500).send(callbackHtml("", message));
      }
    }
  );

  /**
   * POST /google — Exchange authorization code for user/session.
   * Called by the client after receiving the code via postMessage.
   *
   * Body: { code: string, redirectUri?: string }
   * Response: { user, session }
   */
  router.post("/", async (req: Request, res: Response) => {
    const { code, codeVerifier } = req.body ?? {};

    if (!code || typeof code !== "string") {
      console.warn(`[venm-auth] Google OAuth: POST missing code, body=${JSON.stringify(req.body)}`);
      res.status(400).json({
        error: { code: "MISSING_CODE", message: "Authorization code is required", status: 400 },
      });
      return;
    }

    console.log(`[venm-auth] Google OAuth: POST received, codeVerifier=${codeVerifier ? "present" : "not provided"}`);

    try {
      const protocol = req.protocol;
      const host = req.get("host") ?? "localhost:3000";
      const effectiveRedirectUri = `${protocol}://${host}${callbackPath}`;

      console.log(`[venm-auth] Google OAuth: exchanging code with Google (redirectUri=${effectiveRedirectUri})`);

      // Exchange code for tokens and fetch profile
      const { tokens: googleTokens, profile } = await handleGoogleCallback(
        code,
        effectiveRedirectUri,
        config,
        codeVerifier
      );

      console.log(`[venm-auth] Google OAuth: token exchange successful, profile.id=${profile.id}, email=${profile.email}`);

      // Find or create user
      let user = await db.findUserByProvider("google", profile.id);
      console.log(`[venm-auth] Google OAuth: user ${user ? "found" : "not found, creating new"}`);

      if (!user) {
        const userData: CreateUserData = {
          id: `google_${profile.id}`,
          email: profile.email,
          name: profile.name,
          picture: profile.picture,
          provider: "google",
          emailVerified: profile.verified_email,
          providerAccountId: profile.id,
        };
        user = await db.createUser(userData);
      } else {
        user = await db.updateUser(user.id, {
          name: profile.name,
          picture: profile.picture,
          email: profile.email,
        });
      }

      if (!user) {
        console.error(`[venm-auth] Google OAuth: failed to create/update user`);
        res.status(500).json({
          error: { code: "USER_CREATE_FAILED", message: "Failed to create or update user", status: 500 },
        });
        return;
      }

      // Generate JWT tokens
      const tokenPayload = { sub: user.id, email: user.email, provider: user.provider };
      const jwtTokens = await generateTokens(tokenPayload, jwtSecret);

      console.log(`[venm-auth] Google OAuth: tokens generated, session will expire at ${new Date(jwtTokens.expiresAt).toISOString()}`);

      // Store session in database
      await db.createSession({
        userId: user.id,
        accessToken: jwtTokens.accessToken,
        refreshToken: jwtTokens.refreshToken,
        expiresAt: jwtTokens.expiresAt,
      });

      console.log(`[venm-auth] Google OAuth: success for user ${user.id}`);
      res.json({
        user,
        session: {
          accessToken: jwtTokens.accessToken,
          refreshToken: jwtTokens.refreshToken,
          expiresAt: jwtTokens.expiresAt,
          authenticated: true,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Google OAuth token exchange failed";
      console.error(`[venm-auth] Google OAuth: TOKEN_EXCHANGE_FAILED — ${message}`);
      if (err instanceof Error && err.stack) {
        console.error(`[venm-auth] Stack:`, err.stack);
      }
      res.status(500).json({
        error: { code: "TOKEN_EXCHANGE_FAILED", message, status: 500 },
      });
    }
  });

  return router;
}


