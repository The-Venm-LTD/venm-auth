import React, { type ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";
import { spinnerStyle } from "../styles";

export interface LoadingProps {
  children?: ReactNode;
  className?: string;
}

export function Loading({ children, className }: LoadingProps) {
  const { loading } = useAuth();

  if (!loading) {
    return null;
  }

  if (children) {
    return <>{children}</>;
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px",
      }}
      className={className}
      role="status"
      aria-label="Loading"
    >
      <span
        style={{
          ...spinnerStyle,
          width: "24px",
          height: "24px",
          borderWidth: "3px",
        }}
        aria-hidden="true"
      />
    </div>
  );
}
