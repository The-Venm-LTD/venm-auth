export type Theme = "light" | "dark" | "system";
export type Layout = "vertical" | "horizontal" | "card" | "minimal";
export type ButtonVariant = "default" | "outline" | "minimal";
export type ButtonSize = "sm" | "md" | "lg";

export interface ThemeConfig {
  theme?: Theme;
  layout?: Layout;
  buttonVariant?: ButtonVariant;
  buttonSize?: ButtonSize;
  className?: string;
}
