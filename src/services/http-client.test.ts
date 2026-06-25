import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpClient } from "./http-client";
import type { SDKConfig } from "../types/config";

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

describe("HttpClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should make a successful GET request", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "user-1", name: "Test" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = new HttpClient(createConfig(), () => null);
    const result = await client.request("GET", "/user");

    expect(result).toEqual({ id: "user-1", name: "Test" });
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/auth/user",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("should attach Authorization header when session exists", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ valid: true }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = new HttpClient(createConfig(), () => ({
      accessToken: "test-token",
      refreshToken: "rt",
      expiresAt: Date.now() + 3600000,
      authenticated: true,
    }));

    await client.request("GET", "/session");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      })
    );
  });

  it("should not attach Authorization header when skipAuth is true", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user: {}, session: {} }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = new HttpClient(createConfig(), () => ({
      accessToken: "test-token",
      refreshToken: "rt",
      expiresAt: Date.now() + 3600000,
      authenticated: true,
    }));

    await client.request("POST", "/google", {
      body: { code: "abc" },
      skipAuth: true,
    });

    const callHeaders = mockFetch.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(callHeaders?.Authorization).toBeUndefined();
  });

  it("should throw AuthError on 401 response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({ error: { code: "UNAUTHORIZED", message: "Token expired", status: 401 } }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = new HttpClient(createConfig(), () => null);

    await expect(client.request("GET", "/user")).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      status: 401,
    });
  });

  it("should throw TIMEOUT error on abort", async () => {
    const controller = new AbortController();
    vi.stubGlobal("fetch", vi.fn().mockImplementation(
      () => new Promise((_, reject) => {
        controller.abort();
        reject(new DOMException("The operation was aborted", "AbortError"));
      })
    ));

    const client = new HttpClient(createConfig({ timeout: 100 }), () => null);

    await expect(client.request("GET", "/user")).rejects.toMatchObject({
      code: "TIMEOUT",
    });
  });
});
