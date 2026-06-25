import React from "react";
import { describe, it, expect } from "vitest";
import { renderWithAuth, screen } from "../test/utils";
import { Unauthenticated } from "./Unauthenticated";

describe("Unauthenticated", () => {
  it("should render children when not authenticated", () => {
    renderWithAuth(
      <Unauthenticated>
        <div data-testid="unauth-content">Login Page</div>
      </Unauthenticated>
    );
    expect(screen.getByTestId("unauth-content")).toHaveTextContent("Login Page");
  });

  it("should render fallback when authenticated", () => {
    renderWithAuth(
      <Unauthenticated fallback={<div data-testid="fallback">Already logged in</div>}>
        <div data-testid="unauth-content">Login Page</div>
      </Unauthenticated>,
      {
        contextValue: {
          user: { id: "u1", email: "test@test.com", name: "Test", picture: null, provider: "google", emailVerified: true, createdAt: "", updatedAt: "" },
          session: { accessToken: "at", refreshToken: "rt", expiresAt: Date.now() + 3600000, authenticated: true },
        },
      }
    );
    expect(screen.getByTestId("fallback")).toHaveTextContent("Already logged in");
    expect(screen.queryByTestId("unauth-content")).not.toBeInTheDocument();
  });

  it("should render nothing when loading", () => {
    renderWithAuth(
      <Unauthenticated>
        <div data-testid="unauth-content">Login Page</div>
      </Unauthenticated>,
      { contextValue: { loading: true } }
    );
    expect(screen.queryByTestId("unauth-content")).not.toBeInTheDocument();
  });
});
