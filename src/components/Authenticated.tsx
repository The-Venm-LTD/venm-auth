import React, { type ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";

export interface AuthenticatedProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function Authenticated({
  children,
  fallback = null,
}: AuthenticatedProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (user) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
