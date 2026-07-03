import { Router, type Request, type Response } from "express";
import type { DatabaseAdapter, CreateUserData } from "../database/adapter";
import type { FacebookOAuthConfig } from "../oauth/facebook";
import { handleFacebookCallback } from "../oauth/facebook";
import { generateTokens } from "../jwt/generate";
import { stateCookieMiddleware } from "../middleware/csrf";
import { callbackHtml } from "../utils/callback-html";
import type { OauthResultStore } from "../store/oauth-result-store";

// ── Route Builder ──────────────────────────────────────────────────

/**
 * @param prefix  The route prefix used for constructing callback URLs.
 *                Must match where the router is mounted. Default: "/api/auth".
 */
export function createFacebookRoutes(
  config: FacebookOAuthConfig,
  jwtSecret: string,
  db: DatabaseAdapter,
  prefix: string = "/api/auth",
  oauthResultStore?: OauthResultStore
): Router {
  const router = Router();

  const callbackPath = `${prefix}/facebook/callback`;

  /**
   * GET /facebook — Initiate Facebook OAuth redirect.
   * The popup opens this URL, which redirects to Facebook's login dialog.
   *
   * Query params:
   *   - state: Anti-CSRF state token (required)
   *   - redirect_uri: Optional override for the OAuth callback redirect URI
   */
  router.get("/", stateCookieMiddleware.issue, (req: Request, res: Response) => {
    console.log(`[venm-auth] Facebook OAuth: initiating redirect, state=${req.query.state ? "present" : "missing"}`);
    const { state, redirect_uri, auth_session_id } = req.query;

    // Store authSessionId mapping so the callback can look it up from the state
    if (oauthResultStore && state && auth_session_id) {
      oauthResultStore.setStateMapping(state as string, auth_session_id as string);
    }

    const protocol = req.protocol;
    const host = req.get("host") ?? "localhost:3000";
    const callbackUri = (redirect_uri as string) ?? `${protocol}://${host}${callbackPath}`;

    const params = new URLSearchParams({
      client_id: config.appId,
      redirect_uri: callbackUri,
      response_type: "code",
      scope: "email,public_profile",
    });

    if (state) params.set("state", state as string);

    const facebookAuthUrl = `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
    res.redirect(302, facebookAuthUrl);
  });

  /**
   * GET /facebook/callback — Facebook OAuth callback.
   * Facebook redirects here after the user signs in.
   * Validates the state parameter for CSRF protection,
   * then sends the authorization code back to the popup via postMessage.
   * The client then calls POST /facebook to exchange the code for tokens.
   */
  router.get(
    "/callback",
    stateCookieMiddleware.validate,
    async (req: Request, res: Response) => {
      try {
        const { code, state, error, error_description } = req.query;
        console.log(`[venm-auth] Facebook OAuth: callback received, code=${code ? "present" : "missing"}, error=${error ?? "none"}`);

        if (error || error_description) {
          const errorMessage = (error_description ?? error) as string;
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
        }

        // The popup's opener may have been severed by COOP headers, so
        // store the result on the server for the client to poll and retrieve.
        if (oauthResultStore) {
          oauthResultStore.storeResult(state as string, code);
        }

        res.send(callbackHtml(code, undefined, state as string | undefined));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Facebook OAuth callback failed";
        res.status(500).send(callbackHtml("", message));
      }
    }
  );

  /**
   * POST /facebook — Exchange authorization code for user/session.
   * Called by the client after receiving the code via postMessage.
   *
   * Body: { code: string, redirectUri?: string }
   * Response: { user, session }
   */
  router.post("/", async (req: Request, res: Response) => {
    const { code, redirectUri } = req.body ?? {};

    if (!code || typeof code !== "string") {
      console.warn(`[venm-auth] Facebook OAuth: POST missing code, body=${JSON.stringify(req.body)}`);
      res.status(400).json({
        error: { code: "MISSING_CODE", message: "Authorization code is required", status: 400 },
      });
      return;
    }

    console.log(`[venm-auth] Facebook OAuth: POST received`);

    try {
      const protocol = req.protocol;
      const host = req.get("host") ?? "localhost:3000";
      const effectiveRedirectUri = redirectUri ?? `${protocol}://${host}${callbackPath}`;

      console.log(`[venm-auth] Facebook OAuth: exchanging code with Facebook (redirectUri=${effectiveRedirectUri})`);

      // Exchange code for tokens and fetch profile
      const { tokens: fbTokens, profile } = await handleFacebookCallback(
        code,
        effectiveRedirectUri,
        config
      );

      console.log(`[venm-auth] Facebook OAuth: token exchange successful, profile.id=${profile.id}, email=${profile.email}`);

      // Extract picture URL
      const pictureUrl = profile.picture?.data?.url ?? null;

      // Find or create user
      let user = await db.findUserByProvider("facebook", profile.id);
      console.log(`[venm-auth] Facebook OAuth: user ${user ? "found" : "not found, creating new"}`);

      if (!user) {
        const userData: CreateUserData = {
          id: `facebook_${profile.id}`,
          email: profile.email,
          name: profile.name,
          picture: pictureUrl,
          provider: "facebook",
          emailVerified: true,
          providerAccountId: profile.id,
        };
        user = await db.createUser(userData);
      } else {
        user = await db.updateUser(user.id, {
          name: profile.name,
          picture: pictureUrl,
          email: profile.email,
        });
      }

      if (!user) {
        console.error(`[venm-auth] Facebook OAuth: failed to create/update user`);
        res.status(500).json({
          error: { code: "USER_CREATE_FAILED", message: "Failed to create or update user", status: 500 },
        });
        return;
      }

      // Generate JWT tokens
      const tokenPayload = { sub: user.id, email: user.email, provider: user.provider };
      const jwtTokens = await generateTokens(tokenPayload, jwtSecret);

      console.log(`[venm-auth] Facebook OAuth: tokens generated, session will expire at ${new Date(jwtTokens.expiresAt).toISOString()}`);

      // Store session in database
      await db.createSession({
        userId: user.id,
        accessToken: jwtTokens.accessToken,
        refreshToken: jwtTokens.refreshToken,
        expiresAt: jwtTokens.expiresAt,
      });

      console.log(`[venm-auth] Facebook OAuth: success for user ${user.id}`);
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
      const message = err instanceof Error ? err.message : "Facebook OAuth token exchange failed";
      console.error(`[venm-auth] Facebook OAuth: TOKEN_EXCHANGE_FAILED — ${message}`);
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


