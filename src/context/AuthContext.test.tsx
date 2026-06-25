import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthProvider, authReducer } from "./AuthContext";
import type { AuthState, AuthAction, AuthError } from "../types/auth";
import type { Session } from "../types/session";
import type { User } from "../types/user";

describe("AuthContext reducer", () => {
  const initialState: AuthState = {
    user: null,
    session: null,
    loading: true,
    error: null,
  };

  const mockUser: User = {
    id: "u1",
    email: "test@example.com",
    name: "Test",
    picture: null,
    provider: "google",
    emailVerified: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  };

  const mockSession: Session = {
    accessToken: "at",
    refreshToken: "rt",
    expiresAt: Date.now() + 3600000,
    authenticated: true,
  };

  it("should handle INIT action", () => {
    const state = authReducer(initialState, { type: "INIT" });
    expect(state.loading).toBe(true);
    expect(state.error).toBeNull();
  });

  it("should handle AUTHENTICATED action", () => {
    const state = authReducer(initialState, {
      type: "AUTHENTICATED",
      payload: { user: mockUser, session: mockSession },
    });
    expect(state.user).toEqual(mockUser);
    expect(state.session).toEqual(mockSession);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("should handle UNAUTHENTICATED action", () => {
    const authedState: AuthState = {
      user: mockUser,
      session: mockSession,
      loading: false,
      error: null,
    };
    const state = authReducer(authedState, { type: "UNAUTHENTICATED" });
    expect(state.user).toBeNull();
    expect(state.session).toBeNull();
    expect(state.loading).toBe(false);
  });

  it("should handle UNAUTHENTICATED with error", () => {
    const error: AuthError = { code: "SESSION_EXPIRED", message: "Token expired" };
    const state = authReducer(initialState, {
      type: "UNAUTHENTICATED",
      payload: { error },
    });
    expect(state.error).toEqual(error);
  });

  it("should handle SESSION_REFRESHED action", () => {
    const authedState: AuthState = {
      user: mockUser,
      session: mockSession,
      loading: false,
      error: null,
    };
    const newSession: Session = {
      ...mockSession,
      accessToken: "new-at",
    };
    const state = authReducer(authedState, {
      type: "SESSION_REFRESHED",
      payload: newSession,
    });
    expect(state.session?.accessToken).toBe("new-at");
    expect(state.user).toEqual(mockUser);
  });

  it("should handle ERROR action", () => {
    const error: AuthError = { code: "TEST_ERROR", message: "Something went wrong" };
    const state = authReducer(initialState, { type: "ERROR", payload: error });
    expect(state.error).toEqual(error);
    expect(state.loading).toBe(false);
  });

  it("should return unchanged state for unknown action", () => {
    const state = authReducer(initialState, { type: "UNKNOWN" as any });
    expect(state).toEqual(initialState);
  });
});

describe("AuthProvider component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ valid: false }),
    }));
  });

  it("should render children", () => {
    render(
      <AuthProvider
        config={{
          environment: "development",
          apiUrl: "http://localhost:3000/api/auth",
          autoRefresh: true,
          persistSession: true,
          storage: "localStorage",
          timeout: 10000,
        }}
      >
        <div data-testid="child">Hello</div>
      </AuthProvider>
    );

    expect(screen.getByTestId("child")).toHaveTextContent("Hello");
  });
});
