import React, { type ReactElement } from "react";
import { render, type RenderResult } from "@testing-library/react";
import { AuthContext, AuthProvider } from "../context/AuthContext";
import type { SDKConfig } from "../types/config";
import type { AuthState, AuthContextValue } from "../types/auth";

export { render, screen, fireEvent, waitFor } from "@testing-library/react";

interface RenderWithAuthOptions {
  config?: Partial<SDKConfig>;
  initialState?: Partial<AuthState>;
  contextValue?: Partial<AuthContextValue>;
}

const defaultConfig: SDKConfig = {
  apiUrl: "http://localhost:3000/api/auth",
  environment: "development",
  autoRefresh: true,
  persistSession: true,
  storage: "localStorage",
  timeout: 10000,
};

/**
 * Render a component with a mock AuthContext value.
 * Use this for unit-testing components/hooks in isolation.
 */
export function renderWithAuth(
  ui: ReactElement,
  options: RenderWithAuthOptions = {}
): RenderResult {
  const mockContextValue: AuthContextValue = {
    user: null,
    session: null,
    loading: false,
    error: null,
    login: async () => {},
    logout: async () => {},
    refresh: async () => {},
    ...options.contextValue,
  };

  return render(
    <AuthContext.Provider value={mockContextValue}>
      {ui}
    </AuthContext.Provider>
  );
}

/**
 * Render a component with a real AuthProvider.
 * Use this for integration tests. Requires fetch and crypto mocks.
 */
export function renderWithRealAuth(
  ui: ReactElement,
  config: Partial<SDKConfig> = {}
): RenderResult {
  const resolvedConfig: SDKConfig = { ...defaultConfig, ...config };

  return render(
    <AuthProvider config={resolvedConfig}>
      {ui}
    </AuthProvider>
  );
}
