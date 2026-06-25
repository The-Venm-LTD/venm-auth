import React from "react";
import { describe, it, expect } from "vitest";
import { renderWithAuth, screen } from "../test/utils";
import { useUser } from "./useUser";
import type { User } from "../types/user";

function TestComponent() {
  const { user, loading } = useUser();
  return (
    <div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="user">{user?.name ?? "no-user"}</div>
    </div>
  );
}

describe("useUser", () => {
  it("should return null user by default", () => {
    renderWithAuth(<TestComponent />);
    expect(screen.getByTestId("user")).toHaveTextContent("no-user");
  });

  it("should return user when authenticated", () => {
    const user: User = {
      id: "u1",
      email: "test@example.com",
      name: "Test User",
      picture: null,
      provider: "google",
      emailVerified: true,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    };

    renderWithAuth(<TestComponent />, {
      contextValue: {
        user,
        session: {
          accessToken: "at",
          refreshToken: "rt",
          expiresAt: Date.now() + 3600000,
          authenticated: true,
        },
      },
    });
    expect(screen.getByTestId("user")).toHaveTextContent("Test User");
  });
});
