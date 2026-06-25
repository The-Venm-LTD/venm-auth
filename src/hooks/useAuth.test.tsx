import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { renderWithAuth, screen } from "../test/utils";
import { useAuth } from "./useAuth";

function TestComponent() {
  const auth = useAuth();
  return (
    <div>
      <div data-testid="loading">{String(auth.loading)}</div>
      <div data-testid="authenticated">{String(!!auth.session)}</div>
      <button data-testid="login" onClick={() => auth.login("google")}>
        Login
      </button>
      <button data-testid="logout" onClick={() => auth.logout()}>
        Logout
      </button>
    </div>
  );
}

describe("useAuth", () => {
  it("should provide default auth state", () => {
    renderWithAuth(<TestComponent />);
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
  });

  it("should throw if used outside VenmProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestComponent />)).toThrow("useAuth()");
    spy.mockRestore();
  });
});
