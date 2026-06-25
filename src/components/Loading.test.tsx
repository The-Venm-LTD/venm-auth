import React from "react";
import { describe, it, expect } from "vitest";
import { renderWithAuth, screen } from "../test/utils";
import { Loading } from "./Loading";

describe("Loading", () => {
  it("should render nothing when not loading", () => {
    const { container } = renderWithAuth(<Loading />);
    expect(container.firstChild).toBeNull();
  });

  it("should render default spinner when loading", () => {
    renderWithAuth(<Loading />, {
      contextValue: { loading: true },
    });
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("should render custom children when loading", () => {
    renderWithAuth(
      <Loading>
        <div data-testid="custom-loading">Custom loader...</div>
      </Loading>,
      { contextValue: { loading: true } }
    );
    expect(screen.getByTestId("custom-loading")).toHaveTextContent("Custom loader...");
  });
});
