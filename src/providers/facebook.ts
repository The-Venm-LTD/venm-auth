import type { ProviderType } from "../types/auth";
import type { SDKConfig } from "../types/config";
import { PopupManager } from "../services/popup-manager";
import { generateState } from "../utils/crypto";
import { buildAuthorizationUrl } from "../utils/url";

interface OAuthProvider {
  provider: ProviderType;
  login(
    popupManager: PopupManager,
    config: SDKConfig
  ): Promise<{ authorizationCode: string; codeVerifier?: string }>;
}

export class FacebookOAuthProvider implements OAuthProvider {
  provider = "facebook" as const;

  async login(
    popupManager: PopupManager,
    config: SDKConfig
  ): Promise<{ authorizationCode: string; codeVerifier?: string }> {
    // Facebook does not support PKCE; use state parameter for CSRF protection
    const state = generateState();
    const authSessionId = generateState(24); // Unique session for server-side result relay
    const apiUrl = config.apiUrl!;
    const clientId = config.oauth?.facebook?.appId ?? "";

    if (!clientId) {
      throw {
        code: "MISSING_APP_ID",
        message: "Facebook OAuth appId is required. Set it in SDKConfig.oauth.facebook.appId.",
      };
    }

    const authUrl = buildAuthorizationUrl({
      apiUrl,
      provider: this.provider,
      state,
      scopes: ["email", "public_profile"],
      authSessionId,
    });

    const result = await popupManager.open(authUrl, { authSessionId });

    if (result.state !== state) {
      throw {
        code: "STATE_MISMATCH",
        message: "OAuth state parameter mismatch. Possible CSRF attack.",
      };
    }

    return { authorizationCode: result.code };
  }
}
