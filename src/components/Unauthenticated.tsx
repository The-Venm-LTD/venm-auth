import React, { type ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";

export interface UnauthenticatedProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function Unauthenticated({
  children,
  fallback = null,
}: UnauthenticatedProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!user) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
