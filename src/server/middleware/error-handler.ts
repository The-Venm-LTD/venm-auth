import type { Request, Response, NextFunction } from "express";

// ── Custom Error Class ──────────────────────────────────────────────

export class VenmAuthError extends Error {
  public statusCode: number;
  public code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = "VenmAuthError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

// ── Helper to safely extract axios error details ───────────────────

interface AxiosLikeError {
  isAxiosError?: boolean;
  response?: {
    status?: number;
    data?: Record<string, unknown>;
  };
}

function isAxiosError(err: unknown): err is AxiosLikeError {
  if (typeof err !== "object" || err === null) return false;
  const maybe = err as Record<string, unknown>;
  return maybe.isAxiosError === true || maybe.response !== undefined;
}

// ── Error Handler Middleware ────────────────────────────────────────

/**
 * Express error-handling middleware that catches all errors and returns
 * a consistent JSON error response.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const route = `${req.method} ${req.path}`;

  // VenmAuthError — custom errors from the auth package
  if (err instanceof VenmAuthError) {
    console.warn(`[venm-auth] ${err.code} on ${route}: ${err.message}`);
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        status: err.statusCode,
      },
    });
    return;
  }

  // Type-narrowed error with name
  const error = err as Error;

  // CSRFError — OAuth state validation errors
  if (error.name === "CSRFError") {
    console.warn(`[venm-auth] CSRFError on ${route}: ${error.message}`);
    const csrfErr = error as Error & { statusCode?: number; code?: string };
    res.status(csrfErr.statusCode ?? 403).json({
      error: {
        code: csrfErr.code ?? "CSRF_INVALID_STATE",
        message: error.message,
        status: csrfErr.statusCode ?? 403,
      },
    });
    return;
  }

  // RateLimitError — too many requests
  if (error.name === "RateLimitError") {
    const rateErr = error as Error & { statusCode?: number; code?: string; retryAfter?: number };
    const retryAfter = rateErr.retryAfter ?? 60;
    console.warn(`[venm-auth] RateLimitError on ${route}: ${error.message}`);
    res.status(429).json({
      error: {
        code: rateErr.code ?? "RATE_LIMITED",
        message: error.message,
        status: 429,
        retryAfter,
      },
    });
    return;
  }

  // Axios errors from Google/Facebook API calls
  if (isAxiosError(err)) {
    const status = err.response?.status ?? 502;
    const data = err.response?.data;
    const message =
      typeof data?.error === "object" && data.error !== null
        ? (data.error as Record<string, unknown>).message
        : data?.error ?? error.message ?? "External OAuth provider error";

    console.error(`[venm-auth] OAuth provider error on ${route}: status=${status}, body=${JSON.stringify(data)}`);
    res.status(status).json({
      error: {
        code: "OAUTH_PROVIDER_ERROR",
        message: typeof message === "string" ? message : "External OAuth provider error",
        status,
      },
    });
    return;
  }

  // JWT errors (jose throws errors like JWTExpired, JWTInvalid, JWTClaimValidationFailed, etc.)
  if (error.name?.startsWith("JWT") || error.message?.toLowerCase().includes("jwt")) {
    console.warn(`[venm-auth] JWT error on ${route}: ${error.message}`);
    res.status(401).json({
      error: {
        code: "INVALID_TOKEN",
        message: error.message ?? "Token is invalid or expired",
        status: 401,
      },
    });
    return;
  }

  // Generic fallback
  console.error(`[venm-auth] Unhandled error on ${route}:`, error);
  if (error instanceof Error && error.stack) {
    console.error(`[venm-auth] Stack:`, error.stack);
  }
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
      status: 500,
    },
  });
}


