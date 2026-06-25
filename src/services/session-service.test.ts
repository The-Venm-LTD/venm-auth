import { describe, it, expect, vi, beforeEach } from "vitest";
import { SessionService } from "./session-service";
import { AuthService } from "./auth-service";
import type { SDKConfig } from "../types/config";
import type { Session } from "../types/session";
import type { User } from "../types/user";

function createConfig(overrides: Partial<SDKConfig> = {}): SDKConfig {
  return {
    apiUrl: "http://localhost:3000/api/auth",
    environment: "development",
    autoRefresh: true,
    persistSession: true,
    storage: "localStorage",
    timeout: 10000,
    ...overrides,
  };
}

const mockUser: User = {
  id: "user-1",
  email: "test@example.com",
  name: "Test User",
  picture: null,
  provider: "google",
  emailVerified: true,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const mockSession: Session = {
  accessToken: "at-123",
  refreshToken: "rt-123",
  expiresAt: Date.now() + 3600000,
  authenticated: true,
};

describe("SessionService", () => {
  let authService: AuthService;
  let sessionService: SessionService;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    localStorage.clear();
    authService = new AuthService(createConfig(), () => null);
    sessionService = new SessionService(createConfig(), authService);
  });

  describe("initialize", () => {
    it("should return null session when no stored session", async () => {
      const result = await sessionService.initialize();
      expect(result.session).toBeNull();
      expect(result.user).toBeNull();
    });

    it("should return stored session when valid", async () => {
      localStorage.setItem("venm_auth_session", JSON.stringify(mockSession));
      localStorage.setItem("venm_auth_user", JSON.stringify(mockUser));

      const result = await sessionService.initialize();
      expect(result.session?.accessToken).toBe("at-123");
      expect(result.user?.email).toBe("test@example.com");
    });

    it("should clear expired session without refresh token", async () => {
      const expiredSession = {
        ...mockSession,
        expiresAt: Date.now() - 1000,
      };
      localStorage.setItem("venm_auth_session", JSON.stringify(expiredSession));
      localStorage.setItem("venm_auth_user", JSON.stringify(mockUser));

      const result = await sessionService.initialize();
      expect(result.session).toBeNull();
      expect(result.user).toBeNull();
      expect(localStorage.getItem("venm_auth_session")).toBeNull();
    });

    it("should attempt refresh for expired session with refresh token", async () => {
      const expiredSession: Session = {
        accessToken: "old-at",
        refreshToken: "rt-123",
        expiresAt: Date.now() - 1000,
        authenticated: true,
      };
      localStorage.setItem("venm_auth_session", JSON.stringify(expiredSession));
      localStorage.setItem("venm_auth_user", JSON.stringify(mockUser));

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          session: {
            accessToken: "new-at",
            refreshToken: "new-rt",
            expiresAt: Date.now() + 3600000,
            authenticated: true,
          },
        }),
      } as Response);

      const result = await sessionService.initialize();
      expect(result.session?.accessToken).toBe("new-at");
    });
  });

  describe("saveSession and clearSession", () => {
    it("should persist session and user to storage", () => {
      sessionService.saveSession(mockSession, mockUser);
      expect(JSON.parse(localStorage.getItem("venm_auth_session")!)).toEqual(mockSession);
      expect(JSON.parse(localStorage.getItem("venm_auth_user")!)).toEqual(mockUser);
    });

    it("should clear stored data", () => {
      sessionService.saveSession(mockSession, mockUser);
      sessionService.clearSession();
      expect(localStorage.getItem("venm_auth_session")).toBeNull();
      expect(localStorage.getItem("venm_auth_user")).toBeNull();
    });
  });

  describe("refreshSession", () => {
    it("should throw if no stored session", async () => {
      await expect(sessionService.refreshSession()).rejects.toMatchObject({
        code: "NO_REFRESH_TOKEN",
      });
    });

    it("should refresh and update stored session", async () => {
      sessionService.saveSession(mockSession, mockUser);

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          session: {
            accessToken: "refreshed-at",
            refreshToken: "refreshed-rt",
            expiresAt: Date.now() + 7200000,
            authenticated: true,
          },
        }),
      } as Response);

      const newSession = await sessionService.refreshSession();
      expect(newSession.accessToken).toBe("refreshed-at");
      // Verify storage was updated
      expect(
        JSON.parse(localStorage.getItem("venm_auth_session")!)?.accessToken
      ).toBe("refreshed-at");
    });
  });
});
