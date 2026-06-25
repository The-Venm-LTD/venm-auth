import type { Request, Response, NextFunction } from "express";

// ── Rate Limit Error ────────────────────────────────────────────────

export class RateLimitError extends Error {
  public statusCode: number = 429;
  public code: string = "RATE_LIMITED";
  public retryAfter: number;

  constructor(retryAfter: number) {
    super(`Too many requests. Retry after ${retryAfter} seconds.`);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

// ── In-Memory Store ─────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
  reset(key: string): Promise<void>;
}

/**
 * Simple in-memory store for rate limiting.
 * Suitable for single-process deployments.
 * For multi-process or production deployments, replace with Redis or similar.
 */
export class InMemoryStore implements RateLimitStore {
  private entries: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(cleanupIntervalMs: number = 60_000) {
    // Periodically clean up expired entries
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.entries) {
        if (entry.resetAt <= now) {
          this.entries.delete(key);
        }
      }
    }, cleanupIntervalMs);

    // Allow the timer to not block process exit
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  async increment(key: string, windowMs: number): Promise<{ count: number; resetAt: number }> {
    const now = Date.now();
    const existing = this.entries.get(key);

    if (!existing || existing.resetAt <= now) {
      // New window
      const entry: RateLimitEntry = { count: 1, resetAt: now + windowMs };
      this.entries.set(key, entry);
      return { count: 1, resetAt: entry.resetAt };
    }

    existing.count++;
    return { count: existing.count, resetAt: existing.resetAt };
  }

  async reset(key: string): Promise<void> {
    this.entries.delete(key);
  }
}

// ── Configuration ──────────────────────────────────────────────────

export interface RateLimitConfig {
  /** Time window in milliseconds. Default: 60_000 (1 minute). */
  windowMs?: number;
  /** Maximum number of requests within the window. Default: 10. */
  maxRequests?: number;
  /** Custom key generator. Default: uses IP address. */
  keyGenerator?: (req: Request) => string;
  /** Custom store. Default: InMemoryStore. */
  store?: RateLimitStore;
  /** Whether to skip rate limiting for certain requests. */
  skip?: (req: Request) => boolean;
}

// ── Helper to get client IP ────────────────────────────────────────

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded) ?? req.ip ?? req.socket.remoteAddress ?? "unknown";
  return ip;
}

// ── Middleware Factory ──────────────────────────────────────────────

/**
 * Creates Express rate limiting middleware.
 *
 * Usage:
 * ```typescript
 * import { createRateLimiter } from "./middleware/rate-limit";
 *
 * const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 20 });
 * router.use("/auth", limiter);
 * ```
 */
export function createRateLimiter(config: RateLimitConfig = {}) {
  const {
    windowMs = 60_000,
    maxRequests = 10,
    keyGenerator = getClientIp,
    store = new InMemoryStore(),
    skip,
  } = config;

  return async function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (skip?.(req)) {
      next();
      return;
    }

    const key = keyGenerator(req);

    try {
      const { count, resetAt } = await store.increment(key, windowMs);

      // Set rate limit headers
      res.setHeader("X-RateLimit-Limit", maxRequests);
      res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - count));
      res.setHeader("X-RateLimit-Reset", Math.ceil(resetAt / 1000));

      if (count > maxRequests) {
        const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
        res.setHeader("Retry-After", retryAfter);
        next(new RateLimitError(retryAfter));
        return;
      }

      next();
    } catch {
      // If rate limiting fails, allow the request through
      next();
    }
  };
}

// ── Default Rate Limiter ───────────────────────────────────────────

/**
 * Pre-configured rate limiter for OAuth endpoints.
 * 10 requests per minute per IP.
 */
export const oauthRateLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 10,
  keyGenerator: (req) => {
    return `${getClientIp(req)}:${req.path}`;
  },
});

/**
 * Pre-configured rate limiter for session endpoints.
 * 30 requests per minute per IP.
 */
export const sessionRateLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 30,
});
