import React from "react";
import type { ProviderType } from "../types/auth";
import type { Layout } from "../types/theme";
import { GoogleButton } from "./GoogleButton";
import { FacebookButton } from "./FacebookButton";
import { useAuth } from "../hooks/useAuth";
import { containerCard, containerVertical, containerHorizontal, dividerStyle } from "../styles";

export interface VenmAuthProps {
  providers?: ProviderType[];
  layout?: Layout;
  showDivider?: boolean;
  className?: string;
  googleButtonProps?: Partial<React.ComponentProps<typeof GoogleButton>>;
  facebookButtonProps?: Partial<React.ComponentProps<typeof FacebookButton>>;
}

const providerComponents = {
  google: GoogleButton,
  facebook: FacebookButton,
} as const;

const providerPropsMap = {
  google: "googleButtonProps" as const,
  facebook: "facebookButtonProps" as const,
} as const;

export function VenmAuth({
  providers = ["google", "facebook"],
  layout = "vertical",
  showDivider = false,
  className,
  googleButtonProps,
  facebookButtonProps,
}: VenmAuthProps) {
  const { user, loading } = useAuth();

  // Don't show auth UI if already authenticated
  if (user && !loading) {
    return null;
  }

  const containerStyle: React.CSSProperties = {
    ...(layout === "card"
      ? containerCard
      : layout === "horizontal"
        ? containerHorizontal
        : containerVertical),
    ...(className ? {} : undefined),
  };

  return (
    <div style={containerStyle} className={className}>
      {providers.map((provider, index) => {
        const Component = providerComponents[provider];
        const propKey = providerPropsMap[provider];
        const extraProps = propKey === "googleButtonProps" ? googleButtonProps : facebookButtonProps;

        return (
          <React.Fragment key={provider}>
            {index > 0 && showDivider && (
              <div style={dividerStyle} role="separator" aria-label="or">
                <span>or</span>
              </div>
            )}
            <Component {...extraProps} />
          </React.Fragment>
        );
      })}
    </div>
  );
}
