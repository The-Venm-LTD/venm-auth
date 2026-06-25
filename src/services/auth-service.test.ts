import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthService } from "./auth-service";
import type { SDKConfig } from "../types/config";
import type { Session } from "../types/session";

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

describe("AuthService", () => {
  let service: AuthService;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    service = new AuthService(createConfig(), () => null);
  });

  it("should call Google auth endpoint on loginWithProvider('google')", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        user: {
          id: "user-1",
          email: "test@example.com",
          name: "Test",
          picture: null,
          provider: "google",
          emailVerified: true,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
        session: {
          accessToken: "at",
          refreshToken: "rt",
          expiresAt: Date.now() + 3600000,
          authenticated: true,
        },
      }),
    } as Response);

    const result = await service.loginWithProvider(
      "google",
      "auth-code-123",
      "https://app.example.com/callback"
    );

    expect(result.user.id).toBe("user-1");
    expect(result.session.accessToken).toBe("at");
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/auth/google",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("auth-code-123"),
      })
    );
  });

  it("should call Facebook auth endpoint on loginWithProvider('facebook')", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        user: { id: "user-2", email: "fb@example.com", name: "FB User", picture: null, provider: "facebook", emailVerified: true, createdAt: "", updatedAt: "" },
        session: { accessToken: "at2", refreshToken: "rt2", expiresAt: Date.now() + 3600000, authenticated: true },
      }),
    } as Response);

    const result = await service.loginWithProvider(
      "facebook",
      "fb-code-456",
      "https://app.example.com/callback"
    );

    expect(result.user.provider).toBe("facebook");
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/auth/facebook",
      expect.any(Object)
    );
  });

  it("should call refresh endpoint", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        session: {
          accessToken: "new-at",
          refreshToken: "new-rt",
          expiresAt: Date.now() + 7200000,
          authenticated: true,
        },
      }),
    } as Response);

    const result = await service.refreshSession("old-rt");
    expect(result.session.accessToken).toBe("new-at");
  });

  it("should call logout endpoint", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({}) } as Response);

    // Should not throw
    await expect(service.logout()).resolves.toBeUndefined();
  });

  it("should not throw on logout network error (fire-and-forget)", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("Network error"));

    await expect(service.logout()).resolves.toBeUndefined();
  });
});
