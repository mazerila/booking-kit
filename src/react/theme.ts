/**
 * Look of the widget, per site. Every value becomes a `--bk-*` CSS variable on
 * the widget root, so the module's stylesheet never needs editing. The same
 * variables can also be set from the site's own CSS on `.bk-root`.
 */
import type { CSSProperties } from "react";

export type BookingTheme = {
  /** Buttons, selected day and time. */
  primary?: string;
  /** Text on primary. */
  onPrimary?: string;
  /** Badges, highlights, focus ring. */
  accent?: string;
  background?: string;
  /** Cards and inputs. */
  surface?: string;
  text?: string;
  muted?: string;
  border?: string;
  danger?: string;
  success?: string;
  /** Corner radius of cards and inputs, e.g. "12px". Buttons use `buttonRadius`. */
  radius?: string;
  buttonRadius?: string;
  fontFamily?: string;
  headingFontFamily?: string;
  /** Base font size, e.g. "16px". */
  fontSize?: string;
  /** compact: tighter spacing, for narrow embeds. */
  density?: "comfortable" | "compact";
  maxWidth?: string;
};

const VARS: Record<Exclude<keyof BookingTheme, "density">, string> = {
  primary: "--bk-primary",
  onPrimary: "--bk-on-primary",
  accent: "--bk-accent",
  background: "--bk-bg",
  surface: "--bk-surface",
  text: "--bk-text",
  muted: "--bk-muted",
  border: "--bk-border",
  danger: "--bk-danger",
  success: "--bk-success",
  radius: "--bk-radius",
  buttonRadius: "--bk-button-radius",
  fontFamily: "--bk-font",
  headingFontFamily: "--bk-heading-font",
  fontSize: "--bk-font-size",
  maxWidth: "--bk-max-width",
};

export function themeStyle(theme: BookingTheme = {}): CSSProperties {
  const style: Record<string, string> = {};
  for (const [key, cssVar] of Object.entries(VARS)) {
    const v = theme[key as keyof typeof VARS];
    if (v) style[cssVar] = v;
  }
  if (theme.density === "compact") style["--bk-space"] = "0.75";
  return style as CSSProperties;
}
