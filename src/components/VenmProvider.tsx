import React, { useMemo, type ReactNode } from "react";
import type { SDKConfig } from "../types/config";
import type { AuthState } from "../types/auth";
import { AuthProvider } from "../context/AuthContext";
import { validateConfig } from "../utils/validate";

export interface VenmProviderProps {
  children: ReactNode;
  config: SDKConfig;
  onAuthStateChange?: (state: AuthState) => void;
}

export function VenmProvider({
  children,
  config,
  onAuthStateChange,
}: VenmProviderProps) {
  // Validate config once and pass the resolved config downstream
  // so AuthProvider doesn't validate a second time.
  const resolvedConfig = useMemo(() => validateConfig(config), [config]);

  return (
    <AuthProvider config={resolvedConfig} onAuthStateChange={onAuthStateChange} skipValidation>
      {children}
    </AuthProvider>
  );
}
