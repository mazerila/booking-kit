/**
 * General terms (conditions générales). Each site gets a default model, filled
 * with the business details; the provider can replace it per language in the
 * admin. Shown in a pop-up from the booking form (consent link "#terms") and,
 * optionally, as a page of the site (<BookingTerms />).
 *
 * Text format: paragraphs separated by blank lines, "## " headings, "- " bullet
 * lines, **bold** and [links](url). {placeholders} are filled when displayed.
 */
import { fill } from "./format.js";
import type { LocalizedText, Settings } from "./types.js";

/** Link target that opens the terms in the booking form: `[conditions générales](#terms)`. */
export const TERMS_HREF = "#terms";

/** Version stored on bookings accepted under the default text. */
export const DEFAULT_TERMS_VERSION = "default-1";

export const TERMS_PLACEHOLDERS = ["business", "address", "email", "phone", "changeUntilHours", "updated"] as const;

export const DEFAULT_TERMS_TITLE: LocalizedText = {
  fr: "Conditions générales de vente",
  en: "Terms and conditions",
};

export const DEFAULT_TERMS_BODY: LocalizedText = {
  fr: `## 1. Objet
Les présentes conditions générales s'appliquent aux prestations proposées par **{business}** (ci-après « le prestataire ») et réservées en ligne, par téléphone ou par message. Toute réservation implique leur acceptation.

## 2. Prestataire
{business} — {address}
Contact : {email} · {phone}

## 3. Réservation
- La réservation se fait en choisissant une prestation, une date et un horaire disponibles.
- Une réservation confirmée fait l'objet d'un e-mail de confirmation. Lorsqu'elle doit être validée par le prestataire, le client reçoit d'abord un accusé de réception, puis la confirmation ou le refus.
- Le client s'engage à fournir des coordonnées exactes, nécessaires au bon déroulement du rendez-vous.

## 4. Tarifs et paiement
- Les tarifs applicables sont ceux affichés au moment de la réservation, en euros.
- Aucun paiement n'est demandé lors de la réservation en ligne : la prestation est réglée sur place, le jour du rendez-vous, selon les moyens de paiement acceptés par le prestataire.

## 5. Modification et annulation par le client
- Le client peut modifier ou annuler gratuitement son rendez-vous jusqu'à **{changeUntilHours} heures** avant son début, grâce au lien reçu par e-mail ou en contactant le prestataire.
- Passé ce délai, merci de prévenir le prestataire au plus vite. Des annulations tardives répétées ou une absence sans prévenir peuvent conduire le prestataire à refuser de nouvelles réservations.

## 6. Annulation ou report par le prestataire
En cas d'empêchement, le prestataire prévient le client dans les meilleurs délais et lui propose un nouveau rendez-vous. Aucun frais n'est dû par le client.

## 7. Retard
En cas de retard du client, la prestation peut être écourtée afin de ne pas décaler les rendez-vous suivants, sans modification du tarif.

## 8. Déroulement de la prestation
- Le client informe le prestataire de toute information utile au bon déroulement de la prestation (état de santé, contre-indications, grossesse, accès au lieu…).
- Le prestataire peut refuser ou interrompre une prestation si elle lui paraît contre-indiquée.
- Les prestations de bien-être ne sont pas des actes médicaux et ne remplacent pas un avis ou un traitement médical.

## 9. Prestations à domicile
Le client s'assure que le prestataire peut accéder au lieu du rendez-vous et dispose d'un espace adapté. Les éventuels frais de déplacement sont indiqués avant la confirmation.

## 10. Droit de rétractation
Le client dispose d'un délai de 14 jours à compter de la réservation pour se rétracter (article L221-18 du Code de la consommation), en l'annulant comme indiqué à l'article 5. En réservant une prestation dont la date tombe dans ce délai, le client demande expressément son exécution avant la fin du délai de rétractation ; une prestation entièrement exécutée ne peut plus faire l'objet d'une rétractation (article L221-28).

## 11. Données personnelles
Les informations demandées servent uniquement à gérer les rendez-vous et la relation avec le client. Elles ne sont ni vendues ni cédées. Le client peut demander à y accéder, à les rectifier ou à les supprimer en écrivant à {email}. Pour en savoir plus, voir la politique de confidentialité du site.

## 12. Médiation et litiges
En cas de réclamation, le client contacte d'abord le prestataire. À défaut d'accord, il peut recourir gratuitement à un médiateur de la consommation : **[nom et coordonnées du médiateur à compléter]**. Les présentes conditions sont soumises au droit français.

Dernière mise à jour : {updated}`,
  en: `## 1. Purpose
These terms apply to the services offered by **{business}** (“the provider”) and booked online, by phone or by message. Making a booking means accepting them.

## 2. Provider
{business} — {address}
Contact: {email} · {phone}

## 3. Booking
- A booking is made by choosing a service, an available date and a time.
- A confirmed booking is followed by a confirmation e-mail. When the provider must approve it, the client first receives an acknowledgement, then the confirmation or refusal.
- The client agrees to provide accurate contact details, needed for the appointment.

## 4. Prices and payment
- The prices that apply are those shown at the time of booking, in euros.
- No payment is taken when booking online: the service is paid on site on the day of the appointment, using the payment methods the provider accepts.

## 5. Changes and cancellation by the client
- The client can change or cancel the appointment free of charge until **{changeUntilHours} hours** before it starts, using the link received by e-mail or by contacting the provider.
- After that, please tell the provider as soon as possible. Repeated late cancellations or not showing up without notice may lead the provider to refuse further bookings.

## 6. Cancellation or postponement by the provider
If the provider cannot attend, they inform the client as soon as possible and offer a new appointment. The client owes nothing.

## 7. Lateness
If the client is late, the service may be shortened so as not to delay the next appointments, at the same price.

## 8. During the service
- The client tells the provider anything useful for the service (health, contraindications, pregnancy, access to the place…).
- The provider may refuse or stop a service that seems contraindicated.
- Wellness services are not medical treatment and do not replace medical advice.

## 9. Home visits
The client makes sure the provider can access the place and has suitable space. Any travel fee is stated before confirmation.

## 10. Right of withdrawal
The client has 14 days from the booking to withdraw (French Consumer Code, article L221-18), by cancelling as described in article 5. By booking a service dated within that period, the client expressly asks for it to be performed before the withdrawal period ends; a fully performed service can no longer be withdrawn from (article L221-28).

## 11. Personal data
The information requested is only used to manage appointments and the relationship with the client. It is never sold or shared. The client can ask to access, correct or delete it by writing to {email}. See the website's privacy policy for more.

## 12. Mediation and disputes
For any complaint, the client first contacts the provider. Failing agreement, they can use a consumer mediator free of charge: **[mediator's name and contact details to be completed]**. These terms are governed by French law.

Last updated: {updated}`,
};

export type ResolvedTerms = { title: LocalizedText; body: LocalizedText; version: string; custom: Record<string, boolean> };

/**
 * Terms as shown to clients, per language: the provider's text where written,
 * otherwise the default model, with the business details filled in.
 */
export function resolveTerms(settings: Pick<Settings, "terms" | "businessName" | "base" | "contact" | "policies" | "locales" | "defaultLocale">): ResolvedTerms {
  const locales = [...new Set([...settings.locales, settings.defaultLocale])];
  const updated = settings.terms.updatedAt;
  const title: LocalizedText = {};
  const body: LocalizedText = {};
  const custom: Record<string, boolean> = {};
  for (const l of locales) {
    const own = settings.terms.body[l]?.trim();
    custom[l] = !!own;
    const dateLocale = l === "fr" ? "fr-FR" : l;
    const vars = {
      business: settings.businessName || "—",
      address: settings.base.address || "—",
      email: settings.contact.email || "—",
      phone: settings.contact.phone || "—",
      changeUntilHours: settings.policies.changeUntilHours,
      updated: updated ? new Intl.DateTimeFormat(dateLocale, { dateStyle: "long" }).format(new Date(updated)) : "—",
    };
    title[l] = settings.terms.title[l]?.trim() || DEFAULT_TERMS_TITLE[l] || DEFAULT_TERMS_TITLE.en!;
    body[l] = fill(own || DEFAULT_TERMS_BODY[l] || DEFAULT_TERMS_BODY.en!, vars);
  }
  return { title, body, version: updated ?? DEFAULT_TERMS_VERSION, custom };
}

export type RichBlock = { type: "h"; text: string } | { type: "p"; lines: string[] } | { type: "ul"; items: string[] };

/** Splits the simple text format into headings, paragraphs and lists (inline markup is left as-is). */
export function richBlocks(text: string): RichBlock[] {
  const out: RichBlock[] = [];
  for (const chunk of text.replace(/\r\n/g, "\n").split(/\n{2,}/)) {
    const lines = chunk.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim());
    let para: string[] = [];
    let list: string[] = [];
    const flush = () => {
      if (para.length) out.push({ type: "p", lines: para });
      if (list.length) out.push({ type: "ul", items: list });
      para = [];
      list = [];
    };
    for (const line of lines) {
      const t = line.trim();
      if (t.startsWith("## ") || t.startsWith("# ")) {
        flush();
        out.push({ type: "h", text: t.replace(/^#+\s*/, "") });
      } else if (/^[-•*]\s+/.test(t)) {
        if (para.length) {
          out.push({ type: "p", lines: para });
          para = [];
        }
        list.push(t.replace(/^[-•*]\s+/, ""));
      } else {
        if (list.length) {
          out.push({ type: "ul", items: list });
          list = [];
        }
        para.push(t);
      }
    }
    flush();
  }
  return out;
}

export type InlinePart = { text: string; bold?: boolean; href?: string };

/** **bold** and [text](href) (relative, http(s), mailto and #anchors only). */
export function inlineParts(text: string): InlinePart[] {
  const out: InlinePart[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ text: m[1], bold: true });
    else out.push(/^(\/|https?:|mailto:|#)/.test(m[3]!) ? { text: m[2]!, href: m[3]! } : { text: m[2]! });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}
