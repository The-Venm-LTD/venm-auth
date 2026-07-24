import { Router, type Request, type Response } from "express";
import type { DatabaseAdapter, CreateUserData } from "../database/adapter";
import type { GoogleOAuthConfig } from "../oauth/google";
import { verifyGoogleOneTapToken } from "../oauth/google-onetap";
import { generateTokens, type TokenExpiryOptions } from "../jwt/generate";

/**
 * Create routes for Google One Tap sign-in.
 *
 * These routes accept a Google ID token (JWT) from the Capacitor
 * native Google One Tap plugin, verify it server-side, and create
 * a venm-auth session.
 *
 * Mounted at: POST {prefix}/google/onetap
 */
export function createGoogleOneTapRoutes(
  config: GoogleOAuthConfig,
  jwtSecret: string,
  db: DatabaseAdapter,
  tokenExpiry?: TokenExpiryOptions
): Router {
  const router = Router();

  /**
   * POST /onetap — Verify Google One Tap ID token and create session.
   *
   * Body: { idToken: string }
   * Response: { user, session }
   */
  router.post("/", async (req: Request, res: Response) => {
    const { idToken } = req.body ?? {};

    if (!idToken || typeof idToken !== "string") {
      res.status(400).json({
        error: {
          code: "MISSING_ID_TOKEN",
          message: "Google One Tap: idToken is required",
          status: 400,
        },
      });
      return;
    }

    console.log(
      `[venm-auth] Google One Tap: POST received, idToken length=${idToken.length}`
    );

    try {
      const allowedAudiences = [
        config.clientId,
      ];

      // Verify the ID token with Google
      const payload = await verifyGoogleOneTapToken(idToken, allowedAudiences);

      console.log(
        `[venm-auth] Google One Tap: token verified, sub=${payload.sub}, email=${payload.email}`
      );

      // Find or create user
      let user = await db.findUserByProvider("google", payload.sub);
      console.log(
        `[venm-auth] Google One Tap: user ${user ? "found" : "not found, creating new"}`
      );

      if (!user) {
        const userData: CreateUserData = {
          id: `google_${payload.sub}`,
          email: payload.email,
          name: payload.name,
          picture: payload.picture,
          provider: "google",
          emailVerified: payload.email_verified,
          providerAccountId: payload.sub,
        };
        user = await db.createUser(userData);
      } else {
        user = await db.updateUser(user.id, {
          name: payload.name,
          picture: payload.picture,
          email: payload.email,
        });
      }

      if (!user) {
        console.error(
          `[venm-auth] Google One Tap: failed to create/update user`
        );
        res.status(500).json({
          error: {
            code: "USER_CREATE_FAILED",
            message: "Failed to create or update user",
            status: 500,
          },
        });
        return;
      }

      // Generate JWT tokens
      const tokenPayload = {
        sub: user.id,
        email: user.email,
        provider: user.provider,
      };
      const jwtTokens = await generateTokens(tokenPayload, jwtSecret, tokenExpiry);

      console.log(
        `[venm-auth] Google One Tap: tokens generated, session expires at ${new Date(jwtTokens.expiresAt).toISOString()}`
      );

      // Store session in database
      await db.createSession({
        userId: user.id,
        accessToken: jwtTokens.accessToken,
        refreshToken: jwtTokens.refreshToken,
        expiresAt: jwtTokens.expiresAt,
        refreshExpiresAt: jwtTokens.refreshExpiresAt,
      });

      console.log(
        `[venm-auth] Google One Tap: success for user ${user.id}`
      );

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
      const message =
        err instanceof Error
          ? err.message
          : "Google One Tap token verification failed";
      console.error(
        `[venm-auth] Google One Tap: TOKEN_VERIFICATION_FAILED — ${message}`
      );
      res.status(500).json({
        error: { code: "TOKEN_VERIFICATION_FAILED", message, status: 500 },
      });
    }
  });

  return router;
}
