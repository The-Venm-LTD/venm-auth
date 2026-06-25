import { Router, type Request, type Response } from "express";
import type { DatabaseAdapter } from "../database/adapter";
import { getSubjectFromToken } from "../jwt/verify";

// ── Route Builder ──────────────────────────────────────────────────

export function createLogoutRoutes(
  jwtSecret: string,
  db: DatabaseAdapter
): Router {
  const router = Router();

  /**
   * POST /logout — Destroy the current session.
   * Requires Authorization: Bearer {accessToken} header.
   * Deletes the session from the database.
   */
  router.post("/", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        res.status(401).json({
          error: { code: "MISSING_TOKEN", message: "No access token provided", status: 401 },
        });
        return;
      }

      const accessToken = authHeader.slice(7);

      // Verify token and get user ID
      const userId = await getSubjectFromToken(accessToken, jwtSecret);

      // Delete the session
      await db.deleteSession(accessToken);

      // Optionally delete all sessions for this user
      // (uncomment for full logout from all devices)
      // await db.deleteAllUserSessions(userId);

      res.json({ success: true });
    } catch {
      // Even if the token is invalid, we still want to clear client-side state
      // Return success so the client can proceed with clearing local storage
      res.json({ success: true });
    }
  });

  /**
   * POST /logout/all — Destroy all sessions for the current user.
   */
  router.post("/all", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        res.status(401).json({
          error: { code: "MISSING_TOKEN", message: "No access token provided", status: 401 },
        });
        return;
      }

      const accessToken = authHeader.slice(7);
      const userId = await getSubjectFromToken(accessToken, jwtSecret);

      await db.deleteAllUserSessions(userId);

      res.json({ success: true });
    } catch {
      res.json({ success: true });
    }
  });

  return router;
}
