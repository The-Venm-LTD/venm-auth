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
}

export interface RedirectOptions {
  redirectUri?: string;
  state?: string;
}
