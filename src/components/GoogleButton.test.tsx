import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderWithAuth, screen, fireEvent } from "../test/utils";
import { GoogleButton } from "./GoogleButton";

describe("GoogleButton", () => {
  it("should render with default label", () => {
    renderWithAuth(<GoogleButton />);
    expect(screen.getByRole("button")).toHaveTextContent("Continue with Google");
  });

  it("should render with custom children", () => {
    renderWithAuth(<GoogleButton>Sign in with Google</GoogleButton>);
    expect(screen.getByRole("button")).toHaveTextContent("Sign in with Google");
  });

  it("should be disabled when disabled prop is true", () => {
    renderWithAuth(<GoogleButton disabled />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("should call custom onClick when provided", () => {
    const onClick = vi.fn();
    renderWithAuth(<GoogleButton onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalled();
  });

  it("should call login('google') when no onClick", () => {
    const loginMock = vi.fn();
    renderWithAuth(<GoogleButton />, {
      contextValue: { login: loginMock },
    });
    fireEvent.click(screen.getByRole("button"));
    expect(loginMock).toHaveBeenCalledWith("google");
  });

  it("should show loading spinner when loading prop is true", () => {
    renderWithAuth(<GoogleButton loading />);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });
});
