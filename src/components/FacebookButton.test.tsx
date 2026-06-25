import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderWithAuth, screen, fireEvent } from "../test/utils";
import { FacebookButton } from "./FacebookButton";

describe("FacebookButton", () => {
  it("should render with default label", () => {
    renderWithAuth(<FacebookButton />);
    expect(screen.getByRole("button")).toHaveTextContent("Continue with Facebook");
  });

  it("should render with custom children", () => {
    renderWithAuth(<FacebookButton>FB Login</FacebookButton>);
    expect(screen.getByRole("button")).toHaveTextContent("FB Login");
  });

  it("should be disabled when disabled prop is true", () => {
    renderWithAuth(<FacebookButton disabled />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("should call custom onClick when provided", () => {
    const onClick = vi.fn();
    renderWithAuth(<FacebookButton onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalled();
  });

  it("should call login('facebook') when no onClick", () => {
    const loginMock = vi.fn();
    renderWithAuth(<FacebookButton />, {
      contextValue: { login: loginMock },
    });
    fireEvent.click(screen.getByRole("button"));
    expect(loginMock).toHaveBeenCalledWith("facebook");
  });

  it("should show loading spinner when loading prop is true", () => {
    renderWithAuth(<FacebookButton loading />);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });
});
