// ── Constants ───────────────────────────────────────────────────────
export { DEVELOPMENT, PRODUCTION } from "./constants";

// ── Types ────────────────────────────────────────────────────────────
export type { User } from "./types/user";
export type { Session } from "./types/session";
export type { SDKConfig, OAuthConfig } from "./types/config";
export type {
  ProviderType,
  ProviderConfig,
  AuthState,
  AuthAction,
  AuthError,
  AuthContextValue,
} from "./types/auth";
export type {
  AuthResponse,
  LoginResponse,
  OneTapResponse,
  RefreshResponse,
  VerifyResponse,
  ErrorResponse,
  PopupOptions,
  RedirectOptions,
} from "./types/responses";
export type {
  Theme,
  Layout,
  ButtonVariant,
  ButtonSize,
  ThemeConfig,
} from "./types/theme";

// ── Component Type Exports ──────────────────────────────────────────
export type { VenmProviderProps } from "./components/VenmProvider";
export type { VenmAuthProps } from "./components/VenmAuth";
export type { GoogleButtonProps } from "./components/GoogleButton";
export type { FacebookButtonProps } from "./components/FacebookButton";
export type { AuthenticatedProps } from "./components/Authenticated";
export type { UnauthenticatedProps } from "./components/Unauthenticated";
export type { LoadingProps } from "./components/Loading";

// ── Hooks ────────────────────────────────────────────────────────────
export { useAuth } from "./hooks/useAuth";
export { useUser } from "./hooks/useUser";
export { useSession } from "./hooks/useSession";
export { useLogin } from "./hooks/useLogin";
export { useLogout } from "./hooks/useLogout";
export { useGoogleOneTap } from "./hooks/useGoogleOneTap";

// ── Components ───────────────────────────────────────────────────────
export { VenmProvider } from "./components/VenmProvider";
export { VenmAuth } from "./components/VenmAuth";
export { GoogleButton } from "./components/GoogleButton";
export { FacebookButton } from "./components/FacebookButton";
export { Authenticated } from "./components/Authenticated";
export { Unauthenticated } from "./components/Unauthenticated";
export { Loading } from "./components/Loading";
