import { Router, type Request, type Response } from "express";

// ── Route Builder ──────────────────────────────────────────────────

export function createHealthRoutes(): Router {
  const router = Router();

  /**
   * GET /health — Health check endpoint.
   * Returns the server status and timestamp.
   */
  router.get("/", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      service: "venm-auth",
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
