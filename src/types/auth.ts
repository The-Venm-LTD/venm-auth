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
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}
