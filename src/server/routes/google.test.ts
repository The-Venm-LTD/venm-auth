// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGoogleRoutes } from "./google";
import type { GoogleOAuthConfig, GoogleTokens, GoogleProfile } from "../oauth/google";
import type { DatabaseAdapter } from "../database/adapter";
import type { User } from "../../types/user";

// ── Mocks ──────────────────────────────────────────────────────────

vi.mock("../oauth/google", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../oauth/google")>();
  return {
    ...actual,
    handleGoogleCallback: vi.fn(),
  };
});

vi.mock("../jwt/generate", () => ({
  generateTokens: vi.fn().mockResolvedValue({
    accessToken: "jwt-access-token",
    refreshToken: "jwt-refresh-token",
    expiresAt: Date.now() + 15 * 60 * 1000,
  }),
}));

const mockUser: User = {
  id: "google_user123",
  email: "testuser@gmail.com",
  name: "Test User",
  picture: "https://example.com/pic.jpg",
  provider: "google",
  emailVerified: true,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

function createMockDb(): DatabaseAdapter {
  return {
    findUserByProvider: vi.fn().mockResolvedValue(null),
    createUser: vi.fn().mockResolvedValue(mockUser),
    updateUser: vi.fn().mockResolvedValue(mockUser),
    findUserByEmail: vi.fn(),
    findUserById: vi.fn(),
    deleteUser: vi.fn(),
    createSession: vi.fn().mockResolvedValue({
      id: "session-1",
      userId: mockUser.id,
      accessToken: "jwt-access-token",
      refreshToken: "jwt-refresh-token",
      expiresAt: Date.now() + 15 * 60 * 1000,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    }),
    findSessionByToken: vi.fn(),
    findSessionsByUserId: vi.fn(),
    deleteSession: vi.fn(),
    deleteAllUserSessions: vi.fn(),
    updateSession: vi.fn(),
  };
}

// ── Test Helpers ────────────────────────────────────────────────────

function createMockReq(overrides: Record<string, any> = {}) {
  return {
    query: {},
    body: {},
    params: {},
    protocol: "http",
    get: vi.fn((header: string) => {
      if (header === "host") return "localhost:3000";
      return undefined;
    }),
    cookies: {},
    ...overrides,
  };
}

function createMockRes() {
  const state: Record<string, any> = {};
  const res: Record<string, any> = {
    statusCode: 200,
    headers: {},
    cookies: {},
    state,
    status: vi.fn(function (this: any, code: number) {
      this.statusCode = code;
      return this;
    }),
    json: vi.fn(function (this: any, data: any) {
      state.body = data;
      return this;
    }),
    send: vi.fn(function (this: any, html: string) {
      state.html = html;
      return this;
    }),
    redirect: vi.fn(function (this: any, statusCode: number, url: string) {
      state.redirectUrl = url;
      state.redirectStatusCode = statusCode;
      return this;
    }),
    cookie: vi.fn(function (this: any, name: string, value: string, options: any) {
      this.cookies[name] = { value, options };
      return this;
    }),
    clearCookie: vi.fn(function (this: any, name: string, options: any) {
      delete this.cookies[name];
      return this;
    }),
    setHeader: vi.fn(function (this: any, name: string, value: any) {
      this.headers[name] = value;
      return this;
    }),
  };
  return res;
}

function findRoute(routes: any[], method: string, path: string) {
  return routes.find(
    (r: any) => r.route?.path === path && r.route?.methods?.[method]
  );
}

// ── Tests ──────────────────────────────────────────────────────────

const googleConfig: GoogleOAuthConfig = {
  clientId: "test-client-id.apps.googleusercontent.com",
  clientSecret: "test-client-secret",
};

describe("Google OAuth Routes", () => {
  let db: DatabaseAdapter;
  let router: ReturnType<typeof createGoogleRoutes>;
  let routes: any[];

  beforeEach(() => {
    vi.clearAllMocks();
    db = createMockDb();
    router = createGoogleRoutes(googleConfig, "jwt-secret", db, "/api/auth");
    routes = router.stack;
  });

  describe("GET /", () => {
    it("should redirect to Google's consent screen with offline access by default", async () => {
      const req = createMockReq({
        query: {
          state: "mock-state-token",
          code_challenge: "mock-challenge-hash",
        },
      });
      const res = createMockRes();
      const next = vi.fn();

      // Find the route handler for GET /
      const route = findRoute(routes, "get", "/");
      expect(route).toBeDefined();

      // Execute the route's stack (stateCookieMiddleware.issue + handler)
      for (const layer of route.route.stack) {
        if (typeof layer.handle === "function") {
          await layer.handle(req, res, next);
        }
      }

      expect(res.redirect).toHaveBeenCalled();
      const redirectUrl = res.state.redirectUrl;
      expect(redirectUrl).toContain("https://accounts.google.com/o/oauth2/v2/auth");
      expect(redirectUrl).toContain("client_id=test-client-id.apps.googleusercontent.com");
      expect(redirectUrl).toContain("redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fauth%2Fgoogle%2Fcallback");
      expect(redirectUrl).toContain("response_type=code");
      expect(redirectUrl).toContain("scope=openid+email+profile");
      expect(redirectUrl).toContain("access_type=offline");
      expect(redirectUrl).not.toContain("prompt");
      expect(redirectUrl).toContain("state=mock-state-token");
      expect(redirectUrl).toContain("code_challenge=mock-challenge-hash");
      expect(redirectUrl).toContain("code_challenge_method=S256");
    });

    it("should omit access_type=offline when offline=false", async () => {
      const req = createMockReq({
        query: {
          state: "mock-state-token",
          code_challenge: "mock-challenge-hash",
          offline: "false",
        },
      });
      const res = createMockRes();
      const next = vi.fn();

      const route = findRoute(routes, "get", "/");
      expect(route).toBeDefined();

      for (const layer of route.route.stack) {
        if (typeof layer.handle === "function") {
          await layer.handle(req, res, next);
        }
      }

      expect(res.redirect).toHaveBeenCalled();
      const redirectUrl = res.state.redirectUrl;
      expect(redirectUrl).not.toContain("access_type");
    });

    it("should redirect without code_challenge when not provided", async () => {
      const req = createMockReq({
        query: { state: "state-123" },
      });
      const res = createMockRes();
      const next = vi.fn();

      const route = findRoute(routes, "get", "/");
      for (const layer of route.route.stack) {
        if (typeof layer.handle === "function") {
          await layer.handle(req, res, next);
        }
      }

      const redirectUrl = res.state.redirectUrl;
      expect(redirectUrl).not.toContain("code_challenge");
      expect(redirectUrl).not.toContain("code_challenge_method");
    });

    it("should use provided redirect_uri query param", async () => {
      const req = createMockReq({
        query: {
          state: "state-123",
          redirect_uri: "https://custom.example.com/callback",
        },
      });
      const res = createMockRes();
      const next = vi.fn();

      const route = findRoute(routes, "get", "/");
      for (const layer of route.route.stack) {
        if (typeof layer.handle === "function") {
          await layer.handle(req, res, next);
        }
      }

      const redirectUrl = res.state.redirectUrl;
      expect(redirectUrl).toContain(
        "redirect_uri=https%3A%2F%2Fcustom.example.com%2Fcallback"
      );
    });
  });

  describe("GET /callback", () => {
    it("should return callback HTML with authorization code", async () => {
      const req = createMockReq({
        query: { code: "auth-code-success", state: "valid-state" },
        cookies: { venm_oauth_state: "valid-state" },
      });
      const res = createMockRes();
      const next = vi.fn();

      const route = findRoute(routes, "get", "/callback");
      for (const layer of route.route.stack) {
        if (typeof layer.handle === "function") {
          await layer.handle(req, res, next);
        }
      }

      expect(res.send).toHaveBeenCalled();
      const html = res.state.html;
      expect(html).toContain("auth-code-success");
      expect(html).toContain("valid-state");
      expect(html).toContain("window.opener.postMessage");
      expect(html).toContain("venm_auth_response");
      expect(html).toContain("window.close()");
    });

    it("should handle OAuth error from Google", async () => {
      const req = createMockReq({
        query: { error: "access_denied" },
        cookies: { venm_oauth_state: "state" },
      });
      const res = createMockRes();
      const next = vi.fn();

      const route = findRoute(routes, "get", "/callback");
      for (const layer of route.route.stack) {
        if (typeof layer.handle === "function") {
          await layer.handle(req, res, next);
        }
      }

      const html = res.state.html;
      expect(html).toContain("Sign-in error");
      expect(html).toContain("access_denied");
    });

    it("should return 400 when authorization code is missing", async () => {
      const req = createMockReq({
        query: { state: "state" },
        cookies: { venm_oauth_state: "state" },
      });
      const res = createMockRes();
      const next = vi.fn();

      const route = findRoute(routes, "get", "/callback");
      for (const layer of route.route.stack) {
        if (typeof layer.handle === "function") {
          await layer.handle(req, res, next);
        }
      }

      expect(res.status).toHaveBeenCalledWith(400);
      const html = res.state.html;
      expect(html).toContain("Missing authorization code");
    });
  });

  describe("POST /", () => {
    it("should exchange code and return user and session", async () => {
      const mockGoogleTokens: GoogleTokens = {
        access_token: "ya29.mock-token",
        expires_in: 3600,
        token_type: "Bearer",
        scope: "openid email profile",
      };
      const mockGoogleProfile: GoogleProfile = {
        id: "user123",
        email: "testuser@gmail.com",
        verified_email: true,
        name: "Test User",
        given_name: "Test",
        family_name: "User",
        picture: "https://example.com/pic.jpg",
        locale: "en",
      };

      const { handleGoogleCallback } = await import("../oauth/google");
      vi.mocked(handleGoogleCallback).mockResolvedValue({
        tokens: mockGoogleTokens,
        profile: mockGoogleProfile,
      });

      const req = createMockReq({
        body: { code: "auth-code-123", redirectUri: "http://localhost:3000/api/auth/google/callback" },
      });
      const res = createMockRes();
      const next = vi.fn();

      const route = findRoute(routes, "post", "/");
      await route.route.stack[0].handle(req, res, next);

      // Verify handleGoogleCallback was called correctly
      expect(handleGoogleCallback).toHaveBeenCalledWith(
        "auth-code-123",
        "http://localhost:3000/api/auth/google/callback",
        googleConfig,
        undefined
      );

      // Verify response
      expect(res.json).toHaveBeenCalled();
      const body = res.state.body;
      expect(body.user.email).toBe("testuser@gmail.com");
      expect(body.session.accessToken).toBe("jwt-access-token");
      expect(body.session.authenticated).toBe(true);
    });

    it("should forward codeVerifier to handleGoogleCallback when provided", async () => {
      const { handleGoogleCallback } = await import("../oauth/google");
      vi.mocked(handleGoogleCallback).mockResolvedValue({
        tokens: { access_token: "tok", expires_in: 3600, token_type: "Bearer", scope: "" },
        profile: { id: "u1", email: "a@b.com", verified_email: true, name: "A", given_name: "A", family_name: "A", picture: "", locale: "en" },
      });

      const codeVerifier = "my-pkce-verifier-value-abc123";
      const req = createMockReq({
        body: { code: "auth-code-pkce", codeVerifier },
      });
      const res = createMockRes();
      const next = vi.fn();

      const route = findRoute(routes, "post", "/");
      await route.route.stack[0].handle(req, res, next);

      // Verify codeVerifier was forwarded
      expect(handleGoogleCallback).toHaveBeenCalledWith(
        "auth-code-pkce",
        "http://localhost:3000/api/auth/google/callback",
        googleConfig,
        codeVerifier
      );
    });

    it("should return 400 when code is missing", async () => {
      const req = createMockReq({ body: {} });
      const res = createMockRes();
      const next = vi.fn();

      const route = findRoute(routes, "post", "/");
      await route.route.stack[0].handle(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.state.body.error.code).toBe("MISSING_CODE");
    });

    it("should return 500 when token exchange fails", async () => {
      const { handleGoogleCallback } = await import("../oauth/google");
      vi.mocked(handleGoogleCallback).mockRejectedValue(
        new Error("Invalid grant")
      );

      const req = createMockReq({
        body: { code: "bad-code" },
      });
      const res = createMockRes();
      const next = vi.fn();

      const route = findRoute(routes, "post", "/");
      await route.route.stack[0].handle(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.state.body.error.code).toBe("TOKEN_EXCHANGE_FAILED");
      expect(res.state.body.error.message).toBe("Invalid grant");
    });

    it("should find existing user rather than creating new one", async () => {
      const existingUser: User = {
        ...mockUser,
        id: "google_existing",
      };
      const dbWithExistingUser: DatabaseAdapter = {
        ...createMockDb(),
        findUserByProvider: vi.fn().mockResolvedValue(existingUser),
      };

      const { handleGoogleCallback } = await import("../oauth/google");
      vi.mocked(handleGoogleCallback).mockResolvedValue({
        tokens: { access_token: "tok", expires_in: 3600, token_type: "Bearer", scope: "" },
        profile: { id: "existing", email: "existing@test.com", verified_email: true, name: "Existing", given_name: "Existing", family_name: "User", picture: "", locale: "en" },
      });

      const localRouter = createGoogleRoutes(googleConfig, "jwt-secret", dbWithExistingUser, "/api/auth");
      const localRoute = findRoute(localRouter.stack, "post", "/");

      const req = createMockReq({ body: { code: "existing-code" } });
      const res = createMockRes();
      const next = vi.fn();

      await localRoute.route.stack[0].handle(req, res, next);

      // Should update, not create
      expect(dbWithExistingUser.findUserByProvider).toHaveBeenCalledWith("google", "existing");
      expect(dbWithExistingUser.createUser).not.toHaveBeenCalled();
      expect(dbWithExistingUser.updateUser).toHaveBeenCalled();
    });
  });
});
