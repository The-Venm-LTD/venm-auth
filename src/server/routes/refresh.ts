import { Router, type Request, type Response } from "express";
import type { DatabaseAdapter } from "../database/adapter";
import { verifyRefreshToken } from "../jwt/verify";
import { generateTokens, type TokenExpiryOptions } from "../jwt/generate";

// ── Route Builder ──────────────────────────────────────────────────

export function createRefreshRoutes(
  jwtSecret: string,
  db: DatabaseAdapter,
  tokenExpiry?: TokenExpiryOptions
): Router {
  const router = Router();

  /**
   * POST /refresh — Issue new access token using a refresh token
   * Body: { refreshToken: string }
   */
  router.post("/", async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken || typeof refreshToken !== "string") {
        res.status(400).json({
          error: { code: "MISSING_REFRESH_TOKEN", message: "Refresh token is required", status: 400 },
        });
        return;
      }

      // Verify the refresh token
      const { payload } = await verifyRefreshToken(refreshToken, jwtSecret);

      // Find the session in database
      const session = await db.findSessionByToken(refreshToken);
      if (!session) {
        res.status(401).json({
          error: { code: "SESSION_NOT_FOUND", message: "Session not found", status: 401 },
        });
        return;
      }

      // Find the user
      const user = await db.findUserById(payload.sub);
      if (!user) {
        res.status(401).json({
          error: { code: "USER_NOT_FOUND", message: "User not found", status: 401 },
        });
        return;
      }

      // Generate new tokens (using configured expiry, or defaults)
      const newTokens = await generateTokens(
        { sub: user.id, email: user.email, provider: user.provider },
        jwtSecret,
        tokenExpiry
      );

      // 🐛 FIX: Also update refreshToken in the database so subsequent
      // refresh attempts can find the session by the new refresh token.
      await db.updateSession(refreshToken, {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        expiresAt: newTokens.expiresAt,
        refreshExpiresAt: newTokens.refreshExpiresAt,
      });

      res.json({
        session: {
          accessToken: newTokens.accessToken,
          refreshToken: newTokens.refreshToken,
          expiresAt: newTokens.expiresAt,
          authenticated: true,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid refresh token";
      res.status(401).json({
        error: { code: "INVALID_REFRESH_TOKEN", message, status: 401 },
      });
    }
  });

  return router;
}
