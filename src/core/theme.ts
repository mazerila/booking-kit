/**
 * Look of the booking pages. A developer passes a theme in code; the provider
 * can also choose one in the admin (a preset, plus custom tweaks), stored in
 * `Settings.appearance`. The admin's choice wins unless it is "site" (follow
 * the website's design).
 */
import type { LocalizedText } from "./types.js";

export type BookingTheme = {
  /** Buttons, selected day and time. */
  primary?: string;
  /** Text on primary. Computed from `primary` when omitted. */
  onPrimary?: string;
  /** Badges, highlights, focus ring. */
  accent?: string;
  /** Behind the widget. Default: transparent (the page shows through). */
  background?: string;
  /** Cards and inputs. */
  surface?: string;
  text?: string;
  muted?: string;
  border?: string;
  danger?: string;
  success?: string;
  /** Corner radius of cards and inputs, e.g. "12px". */
  radius?: string;
  /** Corner radius of buttons: "999px" for pills, "8px" for soft squares. */
  buttonRadius?: string;
  /** CSS font-family, e.g. "Inter, sans-serif" or "inherit". */
  fontFamily?: string;
  headingFontFamily?: string;
  /** Base font size, e.g. "16px". */
  fontSize?: string;
  /** compact: tighter spacing, for narrow embeds. */
  density?: "comfortable" | "compact";
  maxWidth?: string;
};

/** What the admin stores: a preset and custom values on top of it. */
export type Appearance = {
  /** Id of a `THEME_PRESETS` entry; "site" = keep the website's own design. */
  preset: string;
  custom: BookingTheme;
};

export type ThemePreset = { id: string; name: LocalizedText; theme: BookingTheme };

const serif = (name: string) => `'${name}', Georgia, serif`;
const sans = (name: string) => `'${name}', system-ui, sans-serif`;

export const THEME_PRESETS: ThemePreset[] = [
  { id: "site", name: { fr: "Design du site", en: "Website design" }, theme: {} },
  {
    id: "classic",
    name: { fr: "Classique", en: "Classic" },
    theme: { primary: "#2b2b2e", accent: "#b5838d", surface: "#ffffff", border: "#e3e1e4", text: "#222226", muted: "#6b6b73", radius: "12px", buttonRadius: "999px" },
  },
  {
    id: "rose",
    name: { fr: "Rose poudré", en: "Powder pink" },
    theme: {
      primary: "#2e2c2f",
      accent: "#c98b86",
      surface: "#fffaf8",
      border: "#efdcd6",
      text: "#2e2c2f",
      muted: "#6f6467",
      radius: "16px",
      buttonRadius: "999px",
      headingFontFamily: serif("Cormorant Garamond"),
    },
  },
  {
    id: "sage",
    name: { fr: "Sauge", en: "Sage" },
    theme: {
      primary: "#3f5a4a",
      accent: "#9cb59a",
      surface: "#fbfcf9",
      border: "#dfe6dc",
      text: "#24302a",
      muted: "#5f6b63",
      radius: "14px",
      buttonRadius: "999px",
      headingFontFamily: serif("Lora"),
    },
  },
  {
    id: "sand",
    name: { fr: "Sable", en: "Sand" },
    theme: {
      primary: "#7a5c3e",
      accent: "#d4a373",
      surface: "#fffdf8",
      border: "#eadfce",
      text: "#3b2f25",
      muted: "#7a6a5a",
      radius: "10px",
      buttonRadius: "10px",
      headingFontFamily: serif("Playfair Display"),
    },
  },
  {
    id: "ocean",
    name: { fr: "Océan", en: "Ocean" },
    theme: {
      primary: "#1d4ed8",
      accent: "#60a5fa",
      surface: "#ffffff",
      border: "#dbe1ea",
      text: "#0f172a",
      muted: "#64748b",
      radius: "8px",
      buttonRadius: "8px",
      fontFamily: sans("Inter"),
    },
  },
  {
    id: "night",
    name: { fr: "Nuit", en: "Night" },
    theme: {
      primary: "#e9d8c4",
      accent: "#c9a27e",
      background: "#1b1a1f",
      surface: "#26242b",
      border: "#3a3741",
      text: "#f2efe9",
      muted: "#a8a3ad",
      radius: "14px",
      buttonRadius: "999px",
      headingFontFamily: serif("Cormorant Garamond"),
    },
  },
];

/** Fonts offered in the admin. Google fonts are loaded by the widget when used. */
export const FONT_CHOICES: { label: string; value: string; google?: string }[] = [
  { label: "Site", value: "inherit" },
  { label: "System", value: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  { label: "Georgia", value: "Georgia, 'Times New Roman', serif" },
  ...["Inter", "DM Sans", "Lato", "Montserrat", "Nunito", "Poppins"].map((f) => ({ label: f, value: sans(f), google: f })),
  ...["Cormorant Garamond", "Playfair Display", "Lora", "Libre Baskerville", "DM Serif Display"].map((f) => ({ label: f, value: serif(f), google: f })),
];

/** Google font names used by a theme (to load their stylesheets). */
export function googleFontsOf(theme: BookingTheme): string[] {
  const used = [theme.fontFamily, theme.headingFontFamily].filter(Boolean).join(",");
  return FONT_CHOICES.filter((f) => f.google && used.includes(`'${f.google}'`)).map((f) => f.google!);
}

export function googleFontsUrl(families: string[]): string | undefined {
  if (!families.length) return undefined;
  const q = families.map((f) => `family=${f.replace(/ /g, "+")}:wght@400;500;600`).join("&");
  return `https://fonts.googleapis.com/css2?${q}&display=swap`;
}

/** Black or white, whichever reads better on a color ("#rrggbb" or "#rgb"). */
export function readableOn(hex: string): string {
  const m = hex.trim().match(/^#?([\da-f]{3}|[\da-f]{6})$/i);
  if (!m) return "#ffffff";
  const h = m[1]!.length === 3 ? [...m[1]!].map((c) => c + c).join("") : m[1]!;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.45 ? "#1b1a1f" : "#ffffff";
}

/** Preset + custom values, with the text-on-primary color filled in. Undefined for "site". */
export function resolveAppearance(appearance: Appearance | undefined): BookingTheme | undefined {
  if (!appearance) return undefined;
  const preset = THEME_PRESETS.find((p) => p.id === appearance.preset);
  const custom = Object.fromEntries(Object.entries(appearance.custom ?? {}).filter(([, v]) => v !== "" && v != null)) as BookingTheme;
  if ((!preset || preset.id === "site") && !Object.keys(custom).length) return undefined;
  const theme = { ...preset?.theme, ...custom };
  if (theme.primary && !custom.onPrimary) theme.onPrimary = readableOn(theme.primary);
  return theme;
}

/** Final theme of a page: the code's theme, overridden by the admin's choice. */
export function mergeThemes(code: BookingTheme | undefined, admin: BookingTheme | undefined): BookingTheme {
  const theme = { ...code, ...admin };
  if (theme.primary && !theme.onPrimary) theme.onPrimary = readableOn(theme.primary);
  return theme;
}
