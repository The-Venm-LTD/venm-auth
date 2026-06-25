import React from "react";
import { describe, it, expect } from "vitest";
import { renderWithAuth, screen } from "../test/utils";
import { useSession } from "./useSession";

function TestComponent() {
  const { accessToken, expiresAt, loading } = useSession();
  return (
    <div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="token">{accessToken ?? "no-token"}</div>
      <div data-testid="expires">{expiresAt !== null ? "has-expiry" : "no-expiry"}</div>
    </div>
  );
}

describe("useSession", () => {
  it("should return null values when unauthenticated", () => {
    renderWithAuth(<TestComponent />);
    expect(screen.getByTestId("token")).toHaveTextContent("no-token");
    expect(screen.getByTestId("expires")).toHaveTextContent("no-expiry");
  });

  it("should return session data when authenticated", () => {
    renderWithAuth(<TestComponent />, {
      contextValue: {
        session: {
          accessToken: "test-access-token",
          refreshToken: "test-refresh-token",
          expiresAt: 9999999999999,
          authenticated: true,
        },
      },
    });
    expect(screen.getByTestId("token")).toHaveTextContent("test-access-token");
    expect(screen.getByTestId("expires")).toHaveTextContent("has-expiry");
  });
});
