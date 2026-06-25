import React from "react";
import { describe, it, expect } from "vitest";
import { renderWithAuth, screen } from "../test/utils";
import { VenmAuth } from "./VenmAuth";

describe("VenmAuth", () => {
  it("should render both provider buttons by default", () => {
    renderWithAuth(<VenmAuth />);
    expect(screen.getByText("Continue with Google")).toBeInTheDocument();
    expect(screen.getByText("Continue with Facebook")).toBeInTheDocument();
  });

  it("should render only the specified providers", () => {
    renderWithAuth(<VenmAuth providers={["google"]} />);
    expect(screen.getByText("Continue with Google")).toBeInTheDocument();
    expect(screen.queryByText("Continue with Facebook")).not.toBeInTheDocument();
  });

  it("should render nothing when authenticated", () => {
    renderWithAuth(<VenmAuth />, {
      contextValue: {
        user: { id: "u1", email: "a@b.com", name: "U", picture: null, provider: "google", emailVerified: true, createdAt: "", updatedAt: "" },
        session: { accessToken: "at", refreshToken: "rt", expiresAt: Date.now() + 3600000, authenticated: true },
      },
    });
    expect(screen.queryByText("Continue with Google")).not.toBeInTheDocument();
    expect(screen.queryByText("Continue with Facebook")).not.toBeInTheDocument();
  });

  it("should render with card layout", () => {
    const { container } = renderWithAuth(<VenmAuth layout="card" />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
