import React, { useCallback, type ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";
import {
  facebookButtonStyle,
  spinnerLightStyle,
  buttonDisabledStyle,
} from "../styles";

export interface FacebookButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  children?: ReactNode;
  className?: string;
}

export function FacebookButton({
  onClick,
  disabled = false,
  loading = false,
  children,
  className,
}: FacebookButtonProps) {
  const { login, loading: authLoading } = useAuth();

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
    } else {
      login("facebook");
    }
  }, [onClick, login]);

  const isDisabled = disabled || loading || authLoading;

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      className={className}
      style={{
        ...facebookButtonStyle,
        ...(isDisabled ? buttonDisabledStyle : {}),
      }}
      type="button"
    >
      {(loading || authLoading) && (
        <span
          style={spinnerLightStyle}
          aria-hidden="true"
        />
      )}
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
      {children ?? "Continue with Facebook"}
    </button>
  );
}
