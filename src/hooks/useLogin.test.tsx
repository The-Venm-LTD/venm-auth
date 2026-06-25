import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderWithAuth, screen, fireEvent } from "../test/utils";
import { useLogin } from "./useLogin";

function TestComponent() {
  const { login, loading, error } = useLogin();
  return (
    <div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="error">{error?.message ?? "no-error"}</div>
      <button data-testid="login-google" onClick={() => login("google")}>
        Google
      </button>
      <button data-testid="login-facebook" onClick={() => login("facebook")}>
        Facebook
      </button>
    </div>
  );
}

describe("useLogin", () => {
  it("should provide login method", () => {
    const loginMock = vi.fn();
    renderWithAuth(<TestComponent />, {
      contextValue: { login: loginMock },
    });

    fireEvent.click(screen.getByTestId("login-google"));
    expect(loginMock).toHaveBeenCalledWith("google");

    fireEvent.click(screen.getByTestId("login-facebook"));
    expect(loginMock).toHaveBeenCalledWith("facebook");
  });
});
