// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import {
  exchangeGoogleCode,
  fetchGoogleProfile,
  handleGoogleCallback,
} from "./google";
import type { GoogleOAuthConfig } from "./google";

vi.mock("axios");

const mockConfig: GoogleOAuthConfig = {
  clientId: "test-client-id.apps.googleusercontent.com",
  clientSecret: "test-client-secret",
};

describe("exchangeGoogleCode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should exchange authorization code for tokens without codeVerifier", async () => {
    const mockResponse = {
      data: {
        access_token: "ya29.mock-access-token",
        expires_in: 3600,
        token_type: "Bearer",
        scope: "openid email profile",
        id_token: "mock-id-token",
      },
    };
    vi.mocked(axios.post).mockResolvedValue(mockResponse);

    const result = await exchangeGoogleCode(
      "auth-code-123",
      "http://localhost:3000/api/auth/google/callback",
      mockConfig
    );

    expect(result.access_token).toBe("ya29.mock-access-token");
    expect(result.expires_in).toBe(3600);

    // Verify the request was sent to Google's token endpoint
    expect(axios.post).toHaveBeenCalledWith(
      "https://oauth2.googleapis.com/token",
      expect.any(String),
      expect.objectContaining({
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      })
    );

    // Verify the body contains the expected params
    const callBody = vi.mocked(axios.post).mock.calls[0]![1] as string;
    expect(callBody).toContain("code=auth-code-123");
    expect(callBody).toContain("client_id=test-client-id.apps.googleusercontent.com");
    expect(callBody).toContain("client_secret=test-client-secret");
    expect(callBody).toContain("redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fauth%2Fgoogle%2Fcallback");
    expect(callBody).toContain("grant_type=authorization_code");
    // Should NOT contain code_verifier when not provided
    expect(callBody).not.toContain("code_verifier");
  });

  it("should include code_verifier when provided (PKCE flow)", async () => {
    const mockResponse = {
      data: {
        access_token: "ya29.mock-pkce-token",
        expires_in: 3600,
        token_type: "Bearer",
        scope: "openid email profile",
      },
    };
    vi.mocked(axios.post).mockResolvedValue(mockResponse);

    const codeVerifier = "mock-verifier-string-abc123";
    const result = await exchangeGoogleCode(
      "auth-code-456",
      "http://localhost:3000/api/auth/google/callback",
      mockConfig,
      codeVerifier
    );

    expect(result.access_token).toBe("ya29.mock-pkce-token");

    // Verify code_verifier is in the request body
    const callBody = vi.mocked(axios.post).mock.calls[0]![1] as string;
    expect(callBody).toContain("code_verifier=mock-verifier-string-abc123");
    expect(callBody).toContain("code=auth-code-456");
  });

  it("should include code_verifier with special characters (base64url encoded)", async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: { access_token: "token", expires_in: 3600, token_type: "Bearer", scope: "" },
    });

    // Base64url-encoded verifier may contain hyphens and underscores
    const codeVerifier = "abc123-_def456";
    await exchangeGoogleCode(
      "code",
      "http://localhost:3000/callback",
      mockConfig,
      codeVerifier
    );

    const callBody = vi.mocked(axios.post).mock.calls[0]![1] as string;
    expect(callBody).toContain("code_verifier=abc123-_def456");
  });

  it("should throw when Google returns an error", async () => {
    vi.mocked(axios.post).mockRejectedValue(
      Object.assign(new Error("Request failed with status code 400"), {
        response: {
          status: 400,
          data: { error: "invalid_grant", error_description: "Bad Request" },
        },
      })
    );

    await expect(
      exchangeGoogleCode("bad-code", "http://localhost:3000/callback", mockConfig)
    ).rejects.toThrow("Request failed with status code 400");
  });
});

describe("fetchGoogleProfile", () => {
  it("should fetch user profile with access token", async () => {
    const mockProfile = {
      data: {
        id: "12345",
        email: "user@example.com",
        verified_email: true,
        name: "Test User",
        given_name: "Test",
        family_name: "User",
        picture: "https://example.com/photo.jpg",
        locale: "en",
      },
    };
    vi.mocked(axios.get).mockResolvedValue(mockProfile);

    const result = await fetchGoogleProfile("ya29.mock-token");

    expect(result.id).toBe("12345");
    expect(result.email).toBe("user@example.com");
    expect(result.name).toBe("Test User");
    expect(result.picture).toBe("https://example.com/photo.jpg");

    expect(axios.get).toHaveBeenCalledWith(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      expect.objectContaining({
        headers: { Authorization: "Bearer ya29.mock-token" },
      })
    );
  });

  it("should throw on profile fetch failure", async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error("Network error"));

    await expect(
      fetchGoogleProfile("bad-token")
    ).rejects.toThrow("Network error");
  });
});

describe("handleGoogleCallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should exchange code and fetch profile in one call", async () => {
    // Mock token exchange response
    vi.mocked(axios.post).mockResolvedValue({
      data: {
        access_token: "ya29.callback-token",
        refresh_token: "1//mock-refresh",
        expires_in: 3600,
        token_type: "Bearer",
        scope: "openid email profile",
      },
    });

    // Mock profile fetch response
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        id: "user-67890",
        email: "callback@example.com",
        verified_email: true,
        name: "Callback User",
        given_name: "Callback",
        family_name: "User",
        picture: "https://example.com/pic.jpg",
        locale: "en",
      },
    });

    const result = await handleGoogleCallback(
      "auth-code-789",
      "http://localhost:3000/api/auth/google/callback",
      mockConfig
    );

    // Verify combined result
    expect(result.tokens.access_token).toBe("ya29.callback-token");
    expect(result.tokens.refresh_token).toBe("1//mock-refresh");
    expect(result.profile.id).toBe("user-67890");
    expect(result.profile.email).toBe("callback@example.com");

    // Verify both calls were made
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it("should forward codeVerifier during token exchange", async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: { access_token: "pkce-token", expires_in: 3600, token_type: "Bearer", scope: "" },
    });
    vi.mocked(axios.get).mockResolvedValue({
      data: { id: "u1", email: "a@b.com", verified_email: true, name: "A", given_name: "A", family_name: "A", picture: "", locale: "en" },
    });

    const codeVerifier = "my-pkce-verifier-value";
    await handleGoogleCallback(
      "auth-code-pkce",
      "http://localhost:3000/callback",
      mockConfig,
      codeVerifier
    );

    // Verify code_verifier was sent in the token exchange request
    const callBody = vi.mocked(axios.post).mock.calls[0]![1] as string;
    expect(callBody).toContain("code_verifier=my-pkce-verifier-value");
  });
});
