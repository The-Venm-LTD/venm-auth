import { Router, type Request, type Response } from "express";
import type { OauthResultStore } from "../store/oauth-result-store";

// ── Route Builder ──────────────────────────────────────────────────

export function createResultRoutes(store: OauthResultStore): Router {
  const router = Router();

  /**
   * GET /result/:authSessionId — Retrieve a stored OAuth authorization result.
   *
   * The main page polls this endpoint after opening the OAuth popup.
   * Once the OAuth callback handler has stored the result, this endpoint
   * returns it so the main page can proceed with token exchange.
   *
   * This avoids relying on window.opener.postMessage, which is broken
   * when the OAuth provider (e.g., Google) uses Cross-Origin-Opener-Policy
   * headers that sever the opener relationship.
   *
   * Response (200): { code: string, state: string } | { status: "PENDING" }
   */
  router.get("/:authSessionId", (req: Request, res: Response) => {
    const { authSessionId } = req.params;

    if (!authSessionId || typeof authSessionId !== "string") {
      res.status(400).json({ error: "INVALID_SESSION_ID" });
      return;
    }

    const result = store.getResult(authSessionId);

    if (result) {
      res.json(result);
    } else {
      // Return 200 with PENDING status instead of 404 to avoid
      // browser console noise from failed HTTP responses.
      // The client polls this endpoint and expects this response
      // until the OAuth callback stores the result.
      res.json({ status: "PENDING" });
    }
  });

  return router;
}
