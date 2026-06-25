import { Router, type Request, type Response } from "express";
import type { DatabaseAdapter } from "../database/adapter";
import { getSubjectFromToken } from "../jwt/verify";

// ── Route Builder ──────────────────────────────────────────────────

export function createUserRoutes(
  jwtSecret: string,
  db: DatabaseAdapter
): Router {
  const router = Router();

  /**
   * GET /user — Return the currently authenticated user.
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
      const userId = await getSubjectFromToken(accessToken, jwtSecret);

      const user = await db.findUserById(userId);
      if (!user) {
        res.status(404).json({
          error: { code: "USER_NOT_FOUND", message: "User not found", status: 404 },
        });
        return;
      }

      res.json(user);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid token";
      res.status(401).json({
        error: { code: "INVALID_TOKEN", message, status: 401 },
      });
    }
  });

  return router;
}
