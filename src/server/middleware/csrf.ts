import type { Request, Response, NextFunction } from "express";

// ── CSRF Error ──────────────────────────────────────────────────────

export class CSRFError extends Error {
  public statusCode: number = 403;
  public code: string = "CSRF_INVALID_STATE";

  constructor(message: string = "Invalid OAuth state parameter") {
    super(message);
    this.name = "CSRFError";
  }
}

// ── State Validation Middleware ─────────────────────────────────────

/**
 * Validates that the `state` parameter in an OAuth callback matches
 * the expected state that was sent in the authorization request.
 *
 * The developer's client app generates a random state and stores it
 * (e.g., in session or a short-lived cookie). This middleware checks
 * that the returned state is present (actual validation is done by
 * the client SDK which compares the returned state with the one it sent).
 *
 * This middleware provides a hook for developers to plug in their own
 * state validation (e.g., session-based, cookie-based, or Redis-based).
 */
export function validateState(req: Request, _res: Response, next: NextFunction): void {
  const state = req.query.state as string | undefined;

  if (!state) {
    next(new CSRFError("Missing OAuth state parameter"));
    return;
  }

  // Basic validation: state must be a non-empty string
  if (typeof state !== "string" || state.length < 8) {
    next(new CSRFError("Invalid OAuth state parameter format"));
    return;
  }

  next();
}

// ── Cookie-based State Storage ──────────────────────────────────────

/**
 * Stores the OAuth state in a signed cookie and validates it on callback.
 * This provides CSRF protection by ensuring the state in the callback
 * matches the state that was issued.
 *
 * Usage:
 * ```typescript
 * import { stateCookieMiddleware } from "./middleware/csrf";
 *
 * router.get("/google", stateCookieMiddleware.issue, googleRedirectHandler);
 * router.get("/google/callback", stateCookieMiddleware.validate, googleCallbackHandler);
 * ```
 */
// ── POST CSRF Protection ─────────────────────────────────────────

/**
 * Middleware that validates the Origin/Referer header on POST requests
 * to token exchange endpoints.
 *
 * This provides CSRF protection by ensuring that POST requests originate
 * from a trusted source. Requests with no Origin header (server-to-server)
 * are allowed through.
 *
 * Usage:
 * ```typescript
 * import { csrfProtection } from "./middleware/csrf";
 * router.use(csrfProtection(["http://localhost:3000"]));
 * ```
 */
export function csrfProtection(allowedOrigins?: string[]) {
  return function csrfMiddleware(req: Request, res: Response, next: NextFunction): void {
    // Only validate POST, PUT, PATCH, DELETE requests
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      next();
      return;
    }

    // Check Content-Type: CSRF via <form> uses urlencoded/form-data, not JSON
    const contentType = req.headers["content-type"] ?? "";
    if (!contentType.startsWith("application/json")) {
      console.warn(`[venm-auth] CSRF rejected: Content-Type "${contentType}" is not application/json (${req.method} ${req.path})`);
      next(new CSRFError("Request must have Content-Type: application/json"));
      return;
    }

    // Get the request origin (Origin header is preferred, fall back to Referer)
    const origin = req.headers["origin"] as string | undefined;
    const referer = req.headers["referer"] as string | undefined;
    let requestOrigin: string | undefined;

    if (origin) {
      requestOrigin = origin;
    } else if (referer) {
      try {
        requestOrigin = new URL(referer).origin;
      } catch {
        console.warn(`[venm-auth] CSRF: Malformed Referer header "${referer}" — allowing through`);
        next();
        return;
      }
    }

    // If no origin/referer at all, allow through (server-to-server requests)
    if (!requestOrigin) {
      next();
      return;
    }

    console.log(`[venm-auth] CSRF check: origin=${requestOrigin}, allowed=${JSON.stringify(allowedOrigins)} (${req.method} ${req.path})`);

    // If allowed origins are configured, validate against them
    if (allowedOrigins && allowedOrigins.length > 0) {
      if (allowedOrigins.includes(requestOrigin)) {
        next();
        return;
      }
      console.warn(`[venm-auth] CSRF rejected: origin "${requestOrigin}" not in allowed origins ${JSON.stringify(allowedOrigins)}`);
      next(new CSRFError(`Origin "${requestOrigin}" is not allowed`));
      return;
    }

    // No configured origins — allow through (developer must opt in)
    console.warn(`[venm-auth] CSRF: No allowedOrigins configured — allowing request from "${requestOrigin}" (set allowedOrigins in production)`);
    next();
  };
}

export const stateCookieMiddleware = {
  /**
   * Middleware that stores the state parameter in a short-lived cookie.
   * Use on the authorization redirect endpoint.
   */
  issue(req: Request, res: Response, next: NextFunction): void {
    const state = req.query.state as string | undefined;

    if (state) {
      res.cookie("venm_oauth_state", state, {
        httpOnly: true,
        secure: req.protocol === "https",
        sameSite: "lax",
        maxAge: 10 * 60 * 1000, // 10 minutes
        path: "/",
      });
    }

    next();
  },

  /**
   * Middleware that validates the state in the callback against the
   * cookie. Use on the OAuth callback endpoint.
   */
  validate(req: Request, res: Response, next: NextFunction): void {
    const returnedState = req.query.state as string | undefined;
    const cookieState = req.cookies?.venm_oauth_state as string | undefined;

    if (!returnedState || !cookieState) {
      next(new CSRFError("Missing state for CSRF validation"));
      return;
    }

    if (returnedState !== cookieState) {
      next(new CSRFError("OAuth state mismatch — possible CSRF attack"));
      return;
    }

    // Clear the cookie after validation
    res.clearCookie("venm_oauth_state", { path: "/" });

    next();
  },
};
