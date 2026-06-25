import { describe, it, expect, beforeEach } from "vitest";
import { createStorage } from "./storage";

describe("storage utils", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should store and retrieve a session", () => {
    const storage = createStorage("localStorage");
    const session = {
      accessToken: "access-token-123",
      refreshToken: "refresh-token-123",
      expiresAt: Date.now() + 3600000,
      authenticated: true,
    };

    storage.setSession(session);
    const retrieved = storage.getSession();
    expect(retrieved).toEqual(session);
  });

  it("should store and retrieve a user", () => {
    const storage = createStorage("localStorage");
    const user = {
      id: "user-1",
      email: "test@example.com",
      name: "Test User",
      picture: null,
      provider: "google" as const,
      emailVerified: true,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    };

    storage.setUser(user);
    const retrieved = storage.getUser();
    expect(retrieved).toEqual(user);
  });

  it("should clear session data", () => {
    const storage = createStorage("localStorage");
    storage.setSession({
      accessToken: "at",
      refreshToken: "rt",
      expiresAt: Date.now() + 3600000,
      authenticated: true,
    });
    storage.setUser({
      id: "u1",
      email: "a@b.com",
      name: "A",
      picture: null,
      provider: "google",
      emailVerified: true,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    });

    storage.clear();
    expect(storage.getSession()).toBeNull();
    expect(storage.getUser()).toBeNull();
  });

  it("should return null when no session exists", () => {
    const storage = createStorage("localStorage");
    expect(storage.getSession()).toBeNull();
  });

  it("should handle JSON parse errors gracefully", () => {
    localStorage.setItem("venm_auth_session", "invalid-json}");
    const storage = createStorage("localStorage");
    expect(storage.getSession()).toBeNull();
  });
});
