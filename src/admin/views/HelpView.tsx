/** The admin guide, in the admin's language. */
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { HELP, type HelpBlock, type HelpSection } from "../help.js";
import { useAdmin } from "../data.js";

/** Inline markup: **bold**, `code`, [text](href). */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let i = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<strong key={i++}>{m[1]}</strong>);
    else if (m[2]) out.push(<code key={i++}>{m[2]}</code>);
    else if (m[3]) out.push(<a key={i++} href={m[4]}>{m[3]}</a>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Block({ block }: { block: HelpBlock }) {
  if (typeof block === "string") return <p>{inline(block)}</p>;
  if ("tip" in block) return <p className="bka-tip">{inline(block.tip)}</p>;
  if ("steps" in block)
    return (
      <ol>
        {block.steps.map((s, i) => (
          <li key={i}>{inline(s)}</li>
        ))}
      </ol>
    );
  return (
    <ul>
      {block.list.map((s, i) => (
        <li key={i}>{inline(s)}</li>
      ))}
    </ul>
  );
}

const plain = (s: HelpSection) =>
  [s.title, s.summary, ...s.blocks.flatMap((b) => (typeof b === "string" ? [b] : "tip" in b ? [b.tip] : "steps" in b ? b.steps : b.list))].join(" ").toLowerCase();

export function HelpView({ section }: { section?: string }) {
  const { t, locale, support, extraHelp } = useAdmin();
  const sections = useMemo(() => [...(HELP[locale] ?? HELP.en!), ...(extraHelp?.[locale] ?? [])], [locale, extraHelp]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | undefined>(section);
  useEffect(() => {
    if (!section) return;
    setOpen(section);
    requestAnimationFrame(() => document.getElementById(`help-${section}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [section]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? sections.filter((x) => plain(x).includes(s)) : sections;
  }, [q, sections]);

  return (
    <div className="bka-view">
      <div className="bka-view__head">
        <h1>{t.navHelp}</h1>
      </div>
      <p className="bka-muted">{t.helpIntro}</p>
      {support && (
        <p className="bka-tip">
          {t.helpSupport} <strong>{support.name}</strong>
          {support.email && (
            <>
              {" · "}
              <a href={`mailto:${support.email}`}>{support.email}</a>
            </>
          )}
          {support.phone && (
            <>
              {" · "}
              <a href={`tel:${support.phone.replace(/[^\d+]/g, "")}`}>{support.phone}</a>
            </>
          )}
        </p>
      )}
      <input className="bka-input bka-search" type="search" placeholder={t.helpSearch} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t.helpSearch} />

      {!q && (
        <nav className="bka-toc" aria-label={t.helpContents}>
          {sections.map((s) => (
            <a key={s.id} href={`#/help/${s.id}`} className="bka-toc__item">
              <strong>{s.title}</strong>
              <span className="bka-muted">{s.summary}</span>
            </a>
          ))}
        </nav>
      )}

      {shown.length === 0 && <p className="bka-empty">{t.helpNoResult}</p>}
      <div className="bka-help-sections">
        {shown.map((s) => (
          <details
            key={s.id}
            id={`help-${s.id}`}
            className="bka-helpsec"
            open={!!q || open === s.id}
            onToggle={(e) => {
              if ((e.currentTarget as HTMLDetailsElement).open) setOpen(s.id);
            }}
          >
            <summary>
              <span>{s.title}</span>
            </summary>
            <div className="bka-helpsec__body">
              {s.blocks.map((b, i) => (
                <Fragment key={i}>
                  <Block block={b} />
                </Fragment>
              ))}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

/** "?" link from a screen to its help section. */
export function HelpLink({ section }: { section: string }) {
  const { t } = useAdmin();
  return (
    <a className="bka-btn bka-btn--sm bka-helplink" href={`#/help/${section}`} title={t.navHelp}>
      ? {t.navHelp}
    </a>
  );
}
