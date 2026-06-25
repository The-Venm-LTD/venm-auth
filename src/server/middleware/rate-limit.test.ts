// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  InMemoryStore,
  createRateLimiter,
  RateLimitError,
} from "./rate-limit";
import type { Request, Response } from "express";

// ── InMemoryStore Tests ──────────────────────────────────────────────

describe("InMemoryStore", () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore(10_000_000); // Long cleanup interval to avoid auto-cleanup during tests
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should increment a new key to count 1", async () => {
    const result = await store.increment("key-1", 60_000);
    expect(result.count).toBe(1);
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });

  it("should increment an existing key within the window", async () => {
    await store.increment("key-1", 60_000);
    const result = await store.increment("key-1", 60_000);
    expect(result.count).toBe(2);
  });

  it("should reset window when existing entry has expired", async () => {
    await store.increment("key-1", 60_000);

    // Fast-forward past the window by mocking Date.now
    const futureTime = Date.now() + 120_000;
    vi.setSystemTime(new Date(futureTime));

    const result = await store.increment("key-1", 60_000);
    expect(result.count).toBe(1);

    vi.useRealTimers();
  });

  it("should reset a key", async () => {
    await store.increment("key-1", 60_000);
    await store.reset("key-1");

    const result = await store.increment("key-1", 60_000);
    expect(result.count).toBe(1);
  });

  it("should handle multiple keys independently", async () => {
    const r1 = await store.increment("key-a", 60_000);
    const r2 = await store.increment("key-b", 60_000);
    expect(r1.count).toBe(1);
    expect(r2.count).toBe(1);

    const r1b = await store.increment("key-a", 60_000);
    expect(r1b.count).toBe(2);
    expect(r2.count).toBe(1); // unchanged
  });
});

// ── createRateLimiter Middleware Tests ───────────────────────────────

describe("createRateLimiter", () => {
  function createMockReq(overrides: Record<string, any> = {}): Partial<Request> {
    return {
      ip: "127.0.0.1",
      socket: { remoteAddress: "127.0.0.1" } as any,
      headers: {},
      path: "/test",
      ...overrides,
    };
  }

  function createMockRes() {
    const headers: Record<string, any> = {};
    return {
      setHeader: vi.fn((name: string, value: any) => {
        headers[name] = value;
      }),
      headers,
    } as unknown as Response;
  }

  it("should call next() when under the limit", async () => {
    const limiter = createRateLimiter({ maxRequests: 5, windowMs: 60_000 });
    const req = createMockReq() as Request;
    const res = createMockRes();
    const next = vi.fn();

    await limiter(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Limit", 5);
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", 4);
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Reset", expect.any(Number));
  });

  it("should call next with RateLimitError when over the limit", async () => {
    const limiter = createRateLimiter({ maxRequests: 2, windowMs: 60_000 });
    const req = createMockReq() as Request;
    const res = createMockRes();
    const next = vi.fn();

    // First two requests should succeed
    await limiter(req, res, next);
    expect(next).toHaveBeenCalledWith();
    next.mockClear();

    await limiter(req, res, next);
    expect(next).toHaveBeenCalledWith();
    next.mockClear();

    // Third request should be rate limited
    await limiter(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(RateLimitError));
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", 0);
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", expect.any(Number));
  });

  it("should use custom key generator", async () => {
    const keyGen = vi.fn((req) => `custom:${req.ip}`);
    const limiter = createRateLimiter({ maxRequests: 3, keyGenerator: keyGen });

    const req = createMockReq({ ip: "10.0.0.1" }) as Request;
    const res = createMockRes();
    const next = vi.fn();

    await limiter(req, res, next);

    expect(keyGen).toHaveBeenCalledWith(req);
    expect(next).toHaveBeenCalledWith();
  });

  it("should skip rate limiting when skip function returns true", async () => {
    const skip = vi.fn((req) => (req as any).skip === true);
    const limiter = createRateLimiter({ maxRequests: 1, skip });

    const req = createMockReq({ skip: true }) as Request;
    const res = createMockRes();
    const next = vi.fn();

    await limiter(req, res, next);

    expect(skip).toHaveBeenCalledWith(req);
    expect(next).toHaveBeenCalledWith();
    // Should NOT have set rate limit headers
    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it("should allow request through when store throws", async () => {
    const failingStore = {
      increment: vi.fn().mockRejectedValue(new Error("DB down")),
      reset: vi.fn(),
    };
    const limiter = createRateLimiter({ store: failingStore as any });

    const req = createMockReq() as Request;
    const res = createMockRes();
    const next = vi.fn();

    await limiter(req, res, next);

    // Should pass through on error
    expect(next).toHaveBeenCalledWith();
  });
});

// ── Pre-configured Rate Limiters ────────────────────────────────────

describe("oauthRateLimiter", () => {
  it("should key by IP and path", async () => {
    const { oauthRateLimiter } = await import("./rate-limit");

    const req = {
      ip: "10.0.0.5",
      socket: { remoteAddress: "10.0.0.5" } as any,
      headers: {},
      path: "/google",
    } as unknown as Request;

    const res = { setHeader: vi.fn() } as unknown as Response;
    const next = vi.fn();

    await oauthRateLimiter(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });
});

describe("sessionRateLimiter", () => {
  it("should allow up to 30 requests per minute", async () => {
    const { sessionRateLimiter } = await import("./rate-limit");

    const req = {
      ip: "10.0.0.6",
      socket: { remoteAddress: "10.0.0.6" } as any,
      headers: {},
      path: "/session",
    } as unknown as Request;

    const res = { setHeader: vi.fn() } as unknown as Response;

    // 30 requests should all succeed
    for (let i = 0; i < 30; i++) {
      const next = vi.fn();
      await sessionRateLimiter(req, res, next);
      expect(next).toHaveBeenCalledWith();
    }

    // 31st request should be rejected
    const next31 = vi.fn();
    await sessionRateLimiter(req, res, next31);
    expect(next31).toHaveBeenCalledWith(expect.any(RateLimitError));
  });
});
