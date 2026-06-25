import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderWithAuth, screen, fireEvent } from "../test/utils";
import { useLogout } from "./useLogout";

function TestComponent() {
  const { logout, loading } = useLogout();
  return (
    <div>
      <div data-testid="loading">{String(loading)}</div>
      <button data-testid="logout-btn" onClick={() => logout()}>
        Logout
      </button>
    </div>
  );
}

describe("useLogout", () => {
  it("should provide logout method", () => {
    const logoutMock = vi.fn();
    renderWithAuth(<TestComponent />, {
      contextValue: { logout: logoutMock },
    });

    fireEvent.click(screen.getByTestId("logout-btn"));
    expect(logoutMock).toHaveBeenCalled();
  });
});
