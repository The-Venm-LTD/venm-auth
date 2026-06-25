import React from "react";
import { describe, it, expect } from "vitest";
import { renderWithAuth, screen } from "../test/utils";
import { Authenticated } from "./Authenticated";

describe("Authenticated", () => {
  it("should render children when authenticated", () => {
    renderWithAuth(
      <Authenticated>
        <div data-testid="authed-content">Dashboard</div>
      </Authenticated>,
      {
        contextValue: {
          user: { id: "u1", email: "a@b.com", name: "U", picture: null, provider: "google", emailVerified: true, createdAt: "", updatedAt: "" },
          session: { accessToken: "at", refreshToken: "rt", expiresAt: Date.now() + 3600000, authenticated: true },
        },
      }
    );
    expect(screen.getByTestId("authed-content")).toHaveTextContent("Dashboard");
  });

  it("should render fallback when not authenticated", () => {
    renderWithAuth(
      <Authenticated fallback={<div data-testid="fallback">Please log in</div>}>
        <div data-testid="authed-content">Dashboard</div>
      </Authenticated>
    );
    expect(screen.getByTestId("fallback")).toHaveTextContent("Please log in");
    expect(screen.queryByTestId("authed-content")).not.toBeInTheDocument();
  });

  it("should render nothing when loading", () => {
    renderWithAuth(
      <Authenticated>
        <div data-testid="authed-content">Dashboard</div>
      </Authenticated>,
      { contextValue: { loading: true } }
    );
    expect(screen.queryByTestId("authed-content")).not.toBeInTheDocument();
  });
});
