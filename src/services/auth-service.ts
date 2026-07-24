import type { ProviderType } from "../types/auth";
import type { SDKConfig } from "../types/config";
import type { Session } from "../types/session";import type {
  AuthResponse,
  RefreshResponse,
  VerifyResponse,
  OneTapResponse,
} from "../types/responses";
import type { User } from "../types/user";
import { HttpClient } from "./http-client";
import { API_ENDPOINTS } from "../constants";

type GetSessionFn = () => Session | null;

export class AuthService {
  private http: HttpClient;
  private getSession: GetSessionFn;

  constructor(config: SDKConfig, getSession: GetSessionFn) {
    this.getSession = getSession;
    this.http = new HttpClient(config, getSession);
  }

  async loginWithGoogleOneTap(idToken: string): Promise<OneTapResponse> {
    return this.http.request<OneTapResponse>("POST", API_ENDPOINTS.AUTH_GOOGLE_ONE_TAP, {
      body: { idToken },
      skipAuth: true,
    });
  }

  async loginWithProvider(
    provider: ProviderType,
    authorizationCode: string,
    codeVerifier?: string
  ): Promise<AuthResponse> {
    const endpoint =
      provider === "google"
        ? API_ENDPOINTS.AUTH_GOOGLE
        : API_ENDPOINTS.AUTH_FACEBOOK;

    return this.http.request<AuthResponse>("POST", endpoint, {
      body: {
        code: authorizationCode,
        ...(codeVerifier ? { codeVerifier } : {}),
      },
      skipAuth: true,
    });
  }

  async refreshSession(refreshToken: string): Promise<RefreshResponse> {
    return this.http.request<RefreshResponse>("POST", API_ENDPOINTS.AUTH_REFRESH, {
      body: { refreshToken },
      skipAuth: true,
    });
  }

  async logout(): Promise<void> {
    try {
      await this.http.request<void>("POST", API_ENDPOINTS.AUTH_LOGOUT);
    } catch {
      // Logout is fire-and-forget — ignore network errors
    }
  }

  async verifySession(): Promise<VerifyResponse> {
    return this.http.request<VerifyResponse>("GET", API_ENDPOINTS.SESSION);
  }

  async getUser(): Promise<User> {
    return this.http.request<User>("GET", API_ENDPOINTS.USER);
  }
}
