import type { Session } from "./session";
import type { User } from "./user";

export type ProviderType = "google" | "facebook";

export interface ProviderConfig {
  provider: ProviderType;
  label: string;
  scopes?: string[];
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: AuthError | null;
}

export type AuthAction =
  | { type: "INIT" }
  | { type: "LOADING" }
  | { type: "AUTHENTICATED"; payload: { user: User; session: Session } }
  | { type: "UNAUTHENTICATED"; payload?: { error?: AuthError } }
  | { type: "SESSION_REFRESHED"; payload: Session }
  | { type: "ERROR"; payload: AuthError };

export interface AuthError {
  code: string;
  message: string;
  status?: number;
}

export interface AuthContextValue extends AuthState {
  login: (provider: ProviderType) => Promise<void>;
  /**
   * Login using a Google ID token from the Capacitor native Google One Tap plugin.
   * Bypasses the popup-based OAuth flow — sends the ID token directly to the
   * server for verification, then creates a venm-auth session.
   */
  loginWithIdToken: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;

  /**
   * The Google OAuth client ID resolved for the current platform.
   * - On Android: uses `oauth.google.androidClientId` if set, else `clientId`
   * - On iOS: uses `oauth.google.iosClientId` if set, else `clientId`
   * - On Web: uses `oauth.google.clientId`
   *
   * Used by components like GoogleButton to initialize the Capacitor One Tap plugin
   * when `useCapacitorOnetap` is set to `true`.
   * Falls back to empty string when not configured.
   */
  googleClientId: string;
}
