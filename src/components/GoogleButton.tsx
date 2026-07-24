import React, { useCallback, type ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";
import { useAuthContext } from "../context/AuthContext";
import { useGoogleOneTap } from "../hooks/useGoogleOneTap";
import { googleButtonStyle, spinnerStyle, buttonDisabledStyle } from "../styles";

// ── Props ──────────────────────────────────────────────────────────

export interface GoogleButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  children?: ReactNode;
  className?: string;
  /**
   * When provided, uses the Capacitor native Google One Tap plugin for
   * sign-in instead of the browser popup-based OAuth flow. Requires
   * `capacitor-native-google-one-tap-signin` to be installed.
   *
   * - `true`: Uses the client ID from the SDK config's `oauth.google.clientId`
   * - A `string`: Uses the given value as the Google client ID
   * - `{ clientId: string }`: Uses the object's `clientId` value
   */
  useCapacitorOnetap?: boolean | string | { clientId: string };
  /**
   * Defines which native flow to use if useCapacitorOnetap is true.
   * - "autoOrOneTap": Attempts auto sign-in, falls back to One Tap dialog
   * - "oneTap": Shows the One Tap dialog
   * - "nativeButton": Uses signInWithGoogleButtonFlowForNative
   * 
   * @default "autoOrOneTap"
   */
  nativeFlow?: "autoOrOneTap" | "oneTap" | "nativeButton";
}

// ── Component ──────────────────────────────────────────────────────

export function GoogleButton({
  onClick,
  disabled = false,
  loading = false,
  children,
  className,
  useCapacitorOnetap,
  nativeFlow = "autoOrOneTap",
}: GoogleButtonProps) {
  const { login, loading: authLoading } = useAuth();
  const { googleClientId } = useAuthContext();

  // Resolve client ID for Capacitor One Tap — always call the hook
  // unconditionally to comply with React's Rules of Hooks.
  // When the prop is not set or set to `true`, look up the client ID from
  // the SDK config (accessible via the auth context).
  const oneTapClientId =
    typeof useCapacitorOnetap === "string"
      ? useCapacitorOnetap
      : typeof useCapacitorOnetap === "object" && useCapacitorOnetap !== null
        ? useCapacitorOnetap.clientId
        : useCapacitorOnetap === true
          ? googleClientId
          : "";

  // Always call the hook unconditionally
  const oneTap = useGoogleOneTap(oneTapClientId);

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
    } else if (useCapacitorOnetap && oneTap.isAvailable) {
      // Capacitor One Tap is available — use the native flow.
      let promise;
      if (nativeFlow === "nativeButton") {
        promise = oneTap.signInWithGoogleButtonFlowForNative();
      } else if (nativeFlow === "oneTap") {
        promise = oneTap.tryOneTapSignIn();
      } else {
        promise = oneTap.tryAutoOrOneTapSignIn();
      }

      promise.catch((err) => {
        // Safety net: if initialization somehow fails (e.g. race condition
        // with eager check), fall back to the popup OAuth flow.
        console.debug(
          "[venm-auth] Google One Tap unavailable, using popup fallback:",
          err
        );
        login("google");
      });
    } else {
      // Capacitor One Tap not available or not requested — use popup OAuth.
      login("google");
    }
  }, [onClick, login, useCapacitorOnetap, oneTap, nativeFlow]);

  const isDisabled = disabled || loading || authLoading || oneTap.loading;

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      className={className}
      style={{
        ...googleButtonStyle,
        ...(isDisabled ? buttonDisabledStyle : {}),
      }}
      type="button"
    >
      {(loading || authLoading || oneTap.loading) && (
        <span
          style={spinnerStyle}
          aria-hidden="true"
        />
      )}
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
          fill="#4285F4"
        />
        <path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"
        />
        <path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          fill="#EA4335"
        />
      </svg>
      {children ?? "Continue with Google"}
    </button>
  );
}
