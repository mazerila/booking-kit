/**
 * Look of the widget, per site. Every value becomes a `--bk-*` CSS variable on
 * the widget root, so the module's stylesheet never needs editing. The same
 * variables can also be set from the site's own CSS on `.bk-root`.
 */
import { useEffect } from "react";
import type { CSSProperties } from "react";
import { googleFontsOf, googleFontsUrl, type BookingTheme } from "../core/index.js";

export type { BookingTheme } from "../core/index.js";

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
  // A widget with its own background becomes a padded card.
  if (theme.background && theme.background !== "transparent") style["--bk-pad"] = "clamp(1rem, 4vw, 2rem)";
  return style as CSSProperties;
}

/** Adds the Google Fonts stylesheet of the theme's fonts to the page (once). */
export function useThemeFonts(theme: BookingTheme, enabled = true) {
  const url = enabled ? googleFontsUrl(googleFontsOf(theme)) : undefined;
  useEffect(() => {
    if (!url || typeof document === "undefined") return;
    if (document.querySelector(`link[data-bk-fonts="${url}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    link.dataset.bkFonts = url;
    document.head.appendChild(link);
  }, [url]);
}
