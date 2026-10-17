"use client";
/**
 * The general terms as a page of the site (same text as the pop-up in the
 * booking form, edited in the admin):
 *
 *   <BookingTerms locale="fr" />      // e.g. on /cgv/
 */
import { useEffect, useMemo, useState } from "react";
import { mergeThemes, pick, type PublicConfig } from "../core/index.js";
import { BookingApiError, createApi } from "./api.js";
import { textsFor, type BookingTexts } from "./texts.js";
import { themeStyle, useThemeFonts, type BookingTheme } from "./theme.js";
import { Alert, errorText, RichBody, Spinner } from "./ui.js";

export type BookingTermsProps = {
  apiBase?: string;
  locale?: string;
  theme?: BookingTheme;
  useAdminTheme?: boolean;
  loadFonts?: boolean;
  texts?: Record<string, Partial<BookingTexts>>;
  /** Show the title as a heading. Default true. */
  showTitle?: boolean;
  className?: string;
};

export function BookingTerms(props: BookingTermsProps) {
  const api = useMemo(() => createApi(props.apiBase ?? "/api/booking"), [props.apiBase]);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const locale = props.locale ?? config?.defaultLocale ?? "fr";
  const t = useMemo(() => textsFor(locale, props.texts), [locale, props.texts]);
  const theme = useMemo(() => mergeThemes(props.theme, props.useAdminTheme === false ? undefined : config?.theme), [props.theme, props.useAdminTheme, config?.theme]);
  useThemeFonts(theme, props.loadFonts !== false);

  useEffect(() => {
    api.config().then(setConfig, (e: BookingApiError) => setError(errorText(t, e.code)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  return (
    <div className={`bk-root bk-terms${props.className ? ` ${props.className}` : ""}`} style={themeStyle(theme)} lang={locale}>
      {error ? (
        <Alert>{error}</Alert>
      ) : !config ? (
        <Spinner label={t.loading} />
      ) : (
        <>
          {props.showTitle !== false && <h1 className="bk-title">{pick(config.terms.title, locale, config.defaultLocale)}</h1>}
          <RichBody text={pick(config.terms.body, locale, config.defaultLocale)} />
        </>
      )}
    </div>
  );
}
