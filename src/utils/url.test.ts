import { describe, it, expect } from "vitest";
import { buildAuthorizationUrl, parseAuthResponseFromUrl } from "./url";

describe("url utils", () => {
  describe("buildAuthorizationUrl", () => {
    it("should build a valid Google OAuth authorization URL pointing to the dev server", () => {
      const url = buildAuthorizationUrl({
        apiUrl: "http://localhost:3000/api/auth",
        provider: "google",
        state: "test-state-123",
        codeChallenge: "test-challenge",
        scopes: ["openid", "email", "profile"],
      });

      expect(url).toContain("http://localhost:3000/api/auth/google");
      expect(url).toContain("state=test-state-123");
      expect(url).toContain("code_challenge=test-challenge");
    });

    it("should build URL without PKCE params when no code challenge (Facebook)", () => {
      const url = buildAuthorizationUrl({
        apiUrl: "http://localhost:3000/api/auth",
        provider: "facebook",
        state: "state-456",
      });

      expect(url).toContain("http://localhost:3000/api/auth/facebook");
      expect(url).toContain("state=state-456");
      expect(url).not.toContain("code_challenge");
    });

    it("should include redirect_uri when provided", () => {
      const url = buildAuthorizationUrl({
        apiUrl: "http://localhost:3000/api/auth",
        provider: "google",
        state: "state-789",
        redirectUri: "http://localhost:3000/api/auth/google/callback",
      });

      expect(url).toContain("redirect_uri=");
    });
  });

  describe("parseAuthResponseFromUrl", () => {
    it("should parse code and state from URL", () => {
      const result = parseAuthResponseFromUrl(
        "https://app.example.com/callback?code=auth-code-123&state=state-456"
      );
      expect(result.code).toBe("auth-code-123");
      expect(result.state).toBe("state-456");
    });

    it("should parse error from URL", () => {
      const result = parseAuthResponseFromUrl(
        "https://app.example.com/callback?error=access_denied&error_description=User+cancelled"
      );
      expect(result.error).toBe("access_denied");
      expect(result.code).toBeUndefined();
    });

    it("should return empty object for invalid URL", () => {
      const result = parseAuthResponseFromUrl("not-a-url");
      expect(result).toEqual({});
    });
  });
});
