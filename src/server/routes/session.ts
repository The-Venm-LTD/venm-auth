import { Router, type Request, type Response } from "express";
import type { DatabaseAdapter } from "../database/adapter";
import { verifyToken, verifyRefreshToken, getSubjectFromToken } from "../jwt/verify";
import { generateTokens } from "../jwt/generate";

// ── Route Builder ──────────────────────────────────────────────────

export function createSessionRoutes(
  jwtSecret: string,
  db: DatabaseAdapter
): Router {
  const router = Router();

  /**
   * GET /session — Verify and return current session
   * Requires Authorization: Bearer {accessToken} header.
   */
  router.get("/", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        res.status(401).json({
          error: { code: "MISSING_TOKEN", message: "No access token provided", status: 401 },
        });
        return;
      }

      const accessToken = authHeader.slice(7);
      const { payload } = await verifyToken(accessToken, jwtSecret);

      // Find the session in database
      const session = await db.findSessionByToken(accessToken);
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

      res.json({
        valid: true,
        session: {
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          expiresAt: session.expiresAt,
          authenticated: true,
        },
        user,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid token";
      res.status(401).json({
        error: { code: "INVALID_TOKEN", message, status: 401 },
      });
    }
  });

  /**
   * POST /refresh — Issue new access token using a refresh token
   * Body: { refreshToken: string }
   */
  router.post("/refresh", async (req: Request, res: Response) => {
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

      // Generate new tokens
      const newTokens = await generateTokens(
        { sub: user.id, email: user.email, provider: user.provider },
        jwtSecret
      );

      // Update session in database
      await db.updateSession(refreshToken, {
        accessToken: newTokens.accessToken,
        expiresAt: newTokens.expiresAt,
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
