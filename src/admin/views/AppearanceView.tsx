/** Look of the booking pages: a preset, custom tweaks, and a live preview. */
import { doc, setDoc } from "firebase/firestore";
import { useEffect, useState, type CSSProperties } from "react";
import { COL, CONFIG_DOC, FONT_CHOICES, googleFontsOf, mergeThemes, resolveAppearance, THEME_PRESETS, type Appearance, type BookingTheme } from "../../core/index.js";
import { themeStyle, useThemeFonts } from "../../react/theme.js";
import { useAdmin } from "../data.js";
import { HelpLink } from "./HelpView.js";
import { Field, Section, useFormat } from "../ui.js";

type ColorKey = "primary" | "accent" | "surface" | "background" | "text" | "border";

const RADII = ["4px", "10px", "16px", "24px"];
const BUTTONS = ["999px", "10px", "4px"];
const SIZES = ["15px", "16px", "17px"];

export function AppearanceView() {
  const { t, settings, db, toast, siteBookingUrl } = useAdmin();
  const f = useFormat();
  const [draft, setDraft] = useState<Appearance>(settings.appearance);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) setDraft(settings.appearance);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.appearance]);

  const preset = THEME_PRESETS.find((p) => p.id === draft.preset) ?? THEME_PRESETS[0]!;
  const resolved = resolveAppearance(draft);
  // What the preview shows: the preset (or neutral defaults for "site") with the custom values.
  const preview = mergeThemes(THEME_PRESETS.find((p) => p.id === "classic")!.theme, resolved ?? {});
  useThemeFonts(preview);

  const update = (next: Appearance) => {
    setDraft(next);
    setDirty(true);
  };
  const setCustom = (patch: Partial<BookingTheme>) => {
    const custom = { ...draft.custom, ...patch };
    for (const k of Object.keys(patch) as (keyof BookingTheme)[]) if (patch[k] === undefined) delete custom[k];
    update({ ...draft, custom });
  };

  async function save() {
    try {
      await setDoc(doc(db, COL.config, CONFIG_DOC.business), { appearance: JSON.parse(JSON.stringify(draft)) }, { merge: true });
      setDirty(false);
      toast(t.saved);
    } catch {
      toast(t.errorGeneric, "error");
    }
  }

  const value = (k: keyof BookingTheme) => (draft.custom[k] ?? preset.theme[k]) as string | undefined;
  const colors: { key: ColorKey; label: string }[] = [
    { key: "primary", label: t.colorPrimary },
    { key: "accent", label: t.colorAccent },
    { key: "surface", label: t.colorSurface },
    { key: "background", label: t.colorBackground },
    { key: "text", label: t.colorText },
    { key: "border", label: t.colorBorder },
  ];
  const fonts = (current: string | undefined) => {
    const list = [...FONT_CHOICES];
    if (current && !list.some((c) => c.value === current)) list.push({ label: current.split(",")[0]!.replace(/'/g, ""), value: current });
    return list;
  };

  return (
    <div className="bka-view bka-view--wide">
      <div className="bka-view__head">
        <h1>{t.navAppearance}</h1>
        <div className="bka-actions">
          {siteBookingUrl && (
            <a className="bka-btn" href={siteBookingUrl} target="_blank" rel="noreferrer">
              {t.viewOnSite}
            </a>
          )}
          <HelpLink section="appearance" />
        </div>
      </div>

      <div className="bka-appearance">
        <div className="bka-appearance__form">
          <Section title={t.presets} help={t.presetsHelp}>
            <div className="bka-presets">
              {THEME_PRESETS.map((p) => {
                const th = p.theme;
                const on = p.id === draft.preset;
                return (
                  <button
                    type="button"
                    key={p.id}
                    className={`bka-preset${on ? " bka-preset--on" : ""}`}
                    aria-pressed={on}
                    onClick={() => update({ preset: p.id, custom: {} })}
                    style={{ background: th.background ?? th.surface ?? "var(--bka-surface)", color: th.text ?? "inherit" } as CSSProperties}
                  >
                    <span className="bka-preset__sample" style={{ fontFamily: th.headingFontFamily ?? th.fontFamily }}>
                      Aa
                    </span>
                    <span className="bka-preset__swatches">
                      {p.id === "site" ? (
                        <span className="bka-preset__site">{t.presetSite}</span>
                      ) : (
                        [th.primary, th.accent, th.surface].map((c, i) => <span key={i} style={{ background: c }} />)
                      )}
                    </span>
                    <span className="bka-preset__name">{f.name(p.name)}</span>
                  </button>
                );
              })}
            </div>
          </Section>

          <Section
            title={t.customize}
            help={t.customizeHelp}
            actions={
              Object.keys(draft.custom).length > 0 && (
                <button type="button" className="bka-btn bka-btn--sm" onClick={() => update({ ...draft, custom: {} })}>
                  {t.resetCustom}
                </button>
              )
            }
          >
            <div className="bka-colors">
              {colors.map(({ key, label }) => {
                const v = value(key);
                return (
                  <div key={key} className="bka-color">
                    <label>
                      <input
                        type="color"
                        value={/^#[\da-f]{6}$/i.test(v ?? "") ? v : key === "text" ? "#222226" : "#ffffff"}
                        onChange={(e) => setCustom({ [key]: e.target.value })}
                        aria-label={label}
                      />
                      <span>
                        {label}
                        <span className="bka-muted">{v ?? t.fromSite}</span>
                      </span>
                    </label>
                    {draft.custom[key] && (
                      <button type="button" className="bka-iconbtn" aria-label={t.resetCustom} onClick={() => setCustom({ [key]: undefined })}>
                        ↺
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="bka-grid2">
              <Field label={t.fontBody}>
                {(id) => (
                  <select id={id} className="bka-input" value={value("fontFamily") ?? "inherit"} onChange={(e) => setCustom({ fontFamily: e.target.value })}>
                    {fonts(value("fontFamily")).map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.value === "inherit" ? t.fromSite : c.label}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label={t.fontHeading}>
                {(id) => (
                  <select id={id} className="bka-input" value={value("headingFontFamily") ?? "inherit"} onChange={(e) => setCustom({ headingFontFamily: e.target.value })}>
                    {fonts(value("headingFontFamily")).map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.value === "inherit" ? t.fromSite : c.label}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label={t.corners}>
                {(id) => (
                  <select id={id} className="bka-input" value={value("radius") ?? ""} onChange={(e) => setCustom({ radius: e.target.value || undefined })}>
                    <option value="">{t.defaultOption}</option>
                    {RADII.map((r, i) => (
                      <option key={r} value={r}>
                        {t.cornerNames[i]}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label={t.buttons}>
                {(id) => (
                  <select id={id} className="bka-input" value={value("buttonRadius") ?? ""} onChange={(e) => setCustom({ buttonRadius: e.target.value || undefined })}>
                    <option value="">{t.defaultOption}</option>
                    {BUTTONS.map((r, i) => (
                      <option key={r} value={r}>
                        {t.buttonNames[i]}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label={t.textSize}>
                {(id) => (
                  <select id={id} className="bka-input" value={value("fontSize") ?? ""} onChange={(e) => setCustom({ fontSize: e.target.value || undefined })}>
                    <option value="">{t.defaultOption}</option>
                    {SIZES.map((r, i) => (
                      <option key={r} value={r}>
                        {t.sizeNames[i]}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label={t.density}>
                {(id) => (
                  <select id={id} className="bka-input" value={value("density") ?? ""} onChange={(e) => setCustom({ density: (e.target.value || undefined) as BookingTheme["density"] })}>
                    <option value="">{t.defaultOption}</option>
                    <option value="comfortable">{t.densityComfortable}</option>
                    <option value="compact">{t.densityCompact}</option>
                  </select>
                )}
              </Field>
            </div>
            {googleFontsOf(preview).length > 0 && <p className="bka-help">{t.googleFontsNote}</p>}
          </Section>
        </div>

        <div className="bka-appearance__preview">
          <p className="bka-label">{t.preview}</p>
          <Preview theme={preview} />
          {draft.preset === "site" && !Object.keys(draft.custom).length && <p className="bka-help">{t.previewSiteNote}</p>}
        </div>
      </div>

      {dirty && (
        <div className="bka-savebar">
          <button type="button" className="bka-btn bka-btn--primary" onClick={save}>
            {t.save}
          </button>
          <button
            type="button"
            className="bka-btn"
            onClick={() => {
              setDraft(settings.appearance);
              setDirty(false);
            }}
          >
            {t.cancel}
          </button>
        </div>
      )}
    </div>
  );
}

/** A static copy of the widget's main pieces, using the real widget stylesheet. */
function Preview({ theme }: { theme: BookingTheme }) {
  const { t, services, settings, locale } = useAdmin();
  const f = useFormat();
  const s = services.find((x) => x.active) ?? services[0];
  const price = s?.price !== undefined ? new Intl.NumberFormat(locale, { style: "currency", currency: settings.currency, maximumFractionDigits: 0 }).format(s.price) : "";
  return (
    <div className="bka-preview-frame" style={{ background: theme.background ?? "var(--bka-bg)" }}>
      <div className="bk-root" style={themeStyle(theme)}>
        <div className="bk-flow">
          <ol className="bk-steps">
            <li className="bk-steps__item bk-steps__item--done">
              <span className="bk-steps__dot">✓</span>
            </li>
            <li className="bk-steps__item bk-steps__item--current">
              <span className="bk-steps__dot">2</span>
              <span className="bk-steps__label">{t.previewStep}</span>
            </li>
            <li className="bk-steps__item">
              <span className="bk-steps__dot">3</span>
            </li>
          </ol>
          <h2 className="bk-title">{t.previewTitle}</h2>
          {s && (
            <div className="bk-service" role="presentation">
              <span className="bk-service__main">
                <span className="bk-service__name">
                  {f.name(s.name)} {s.badge && <span className="bk-badge">{f.name(s.badge)}</span>}
                </span>
                {s.description && <span className="bk-service__desc">{f.name(s.description)}</span>}
              </span>
              <span className="bk-price">{price}</span>
            </div>
          )}
          <div className="bk-calendar">
            <div className="bk-calendar__row">
              {[12, 13, 14, 15, 16, 17, 18].map((d, i) => (
                <span key={d}>
                  <span className={`bk-day${i < 5 ? " bk-day--available" : ""}${i === 2 ? " bk-day--selected" : ""}`}>{d}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="bk-times__list">
            {["09:00", "10:30", "14:00", "15:30"].map((h, i) => (
              <span key={h} className={`bk-time${i === 1 ? " bk-time--selected" : ""}`} style={{ display: "grid", placeItems: "center" }}>
                {h}
              </span>
            ))}
          </div>
          <span className="bk-btn bk-btn--primary bk-btn--block">{t.previewButton}</span>
        </div>
      </div>
    </div>
  );
}
