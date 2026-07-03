import type { User } from "./user";
import type { Session } from "./session";

export interface AuthResponse {
  user: User;
  session: Session;
}

export type LoginResponse = AuthResponse;

export interface RefreshResponse {
  session: Session;
}

export interface VerifyResponse {
  valid: boolean;
  user?: User;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    status: number;
  };
}

export interface PopupOptions {
  width?: number;
  height?: number;
  redirectUri?: string;
  /**
   * Unique session ID for server-side OAuth result polling.
   * Required when the OAuth provider uses COOP headers that sever
   * the popup's window.opener reference (e.g., Google).
   */
  authSessionId?: string;
}

export interface RedirectOptions {
  redirectUri?: string;
  state?: string;
}
