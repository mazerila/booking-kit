import { describe, expect, it } from "vitest";
import { DEFAULT_TERMS_VERSION, inlineParts, normalizeSettings, parseLinks, resolveTerms, richBlocks, TERMS_HREF } from "../src/core/index.js";

const base = normalizeSettings({
  businessName: "Leyaline Touch",
  base: { address: "Melun" },
  contact: { email: "contact@example.fr", phone: "06 00 00 00 00" },
  policies: { changeUntilHours: 48 },
});

describe("terms", () => {
  it("fills the default model with the business details", () => {
    const r = resolveTerms(base);
    expect(r.version).toBe(DEFAULT_TERMS_VERSION);
    expect(r.title.fr).toBe("Conditions générales de vente");
    expect(r.body.fr).toContain("**Leyaline Touch**");
    expect(r.body.fr).toContain("jusqu'à **48 heures**");
    expect(r.body.en).toContain("contact@example.fr");
    expect(r.body.fr).not.toMatch(/\{\w+\}/);
    expect(r.custom).toEqual({ fr: false, en: false });
  });

  it("uses the provider's text per language, with placeholders", () => {
    const s = normalizeSettings({
      ...base,
      terms: { title: { fr: "CGV" }, body: { fr: "Bienvenue chez {business}. Mise à jour : {updated}" }, updatedAt: "2026-10-17T10:00:00.000Z" },
    });
    const r = resolveTerms(s);
    expect(r.title).toEqual({ fr: "CGV", en: "Terms and conditions" });
    expect(r.body.fr).toBe("Bienvenue chez Leyaline Touch. Mise à jour : 17 octobre 2026");
    expect(r.body.en).toContain("These terms apply"); // English stays the default
    expect(r.version).toBe("2026-10-17T10:00:00.000Z");
    expect(r.custom).toEqual({ fr: true, en: false });
  });

  it("parses the text format", () => {
    expect(richBlocks("## Title\nIntro line\nsecond line\n- a\n- b\n\nEnd")).toEqual([
      { type: "h", text: "Title" },
      { type: "p", lines: ["Intro line", "second line"] },
      { type: "ul", items: ["a", "b"] },
      { type: "p", lines: ["End"] },
    ]);
    expect(inlineParts("Read **this** and [that](#terms) or [bad](javascript:x)")).toEqual([
      { text: "Read " },
      { text: "this", bold: true },
      { text: " and " },
      { text: "that", href: "#terms" },
      { text: " or " },
      { text: "bad" },
    ]);
  });

  it("keeps the #terms link in consent labels", () => {
    expect(parseLinks("J'accepte les [conditions générales](#terms).")).toContainEqual({ text: "conditions générales", href: TERMS_HREF });
  });
});
