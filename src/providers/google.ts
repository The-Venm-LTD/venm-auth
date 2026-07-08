import type { ProviderType } from "../types/auth";
import type { SDKConfig } from "../types/config";
import { PopupManager } from "../services/popup-manager";
import { generatePKCEPair, generateState } from "../utils/crypto";
import { buildAuthorizationUrl } from "../utils/url";

interface OAuthProvider {
  provider: ProviderType;
  login(
    popupManager: PopupManager,
    config: SDKConfig
  ): Promise<{ authorizationCode: string; codeVerifier?: string }>;
}

export class GoogleOAuthProvider implements OAuthProvider {
  provider = "google" as const;

  async login(
    popupManager: PopupManager,
    config: SDKConfig
  ): Promise<{ authorizationCode: string; codeVerifier?: string }> {
    const { verifier, challenge } = await generatePKCEPair();
    const state = generateState();
    const authSessionId = generateState(24); // Unique session for server-side result relay
    const apiUrl = config.apiUrl!;
    const clientId = config.oauth?.google?.clientId ?? "";

    if (!clientId) {
      throw {
        code: "MISSING_CLIENT_ID",
        message: "Google OAuth clientId is required. Set it in SDKConfig.oauth.google.clientId.",
      };
    }

    const authUrl = buildAuthorizationUrl({
      apiUrl,
      provider: this.provider,
      state,
      codeChallenge: challenge,
      scopes: ["openid", "email", "profile"],
      authSessionId,
      offline: true,
    });

    const result = await popupManager.open(authUrl, { authSessionId });

    if (result.state !== state) {
      throw {
        code: "STATE_MISMATCH",
        message: "OAuth state parameter mismatch. Possible CSRF attack.",
      };
    }

    return { authorizationCode: result.code, codeVerifier: verifier };
  }
}
