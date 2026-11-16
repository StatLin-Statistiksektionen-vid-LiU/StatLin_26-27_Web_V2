"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { type FormState, formObject, invalid, zCheckbox, zEmail, zRequired, zText } from "@/lib/admin/form";
import { clientIp } from "@/lib/auth/rate-limit";
import { getCommitteeBySlug, getSettings } from "@/lib/data/content";
import { nowLocal } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { siteUrl } from "@/lib/site-url";
import { INTRESSE_MAX, INTRESSE_VAL, intresseFelText, intresseMejl, type IntresseFel } from "@/lib/star-intresse";
import { interestLimitHit } from "@/lib/wish-limits";

/** Så många obehandlade anmälningar får ligga och vänta. En attack mot en läckt länk ska inte kunna fylla databasen eller SASU:s inkorg. */
const MAX_UNREAD = 300;

const schema = z.object({
  foretag: zRequired(INTRESSE_MAX.foretag, "Företaget"),
  kontakt_namn: zRequired(INTRESSE_MAX.namn, "Namnet"),
  epost: zEmail,
  telefon: zText(INTRESSE_MAX.telefon, "Telefonnumret"),
  val: z.enum(INTRESSE_VAL).catch("med"),
  vill_boka_mote: zCheckbox,
  moteforslag: zText(INTRESSE_MAX.mote, "Förslaget"),
  meddelande: zText(INTRESSE_MAX.meddelande, "Meddelandet"),
});

/** Radbrytningar och styrtecken kommer aldrig från ett vanligt fält på en rad, och de ska inte kunna följa med in i mejlets ämne. */
const oneLine = (s: string) => s.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
/** Meddelandet får ha radbrytningar, men inga andra styrtecken. */
const multiLine = (s: string) => s.replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, " ").trim();

/**
 * Anmälan sparas först, så att den aldrig går förlorad även om mejlet inte kommer fram. Mejlet skickas efter svaret, så att företaget
 * inte får vänta på SMTP-servern. Hur det gick syns i portalen, där det också går att skicka om.
 */
export async function submitStarInterest(_prev: FormState, fd: FormData): Promise<FormState> {
  const kod = String(fd.get("kod") ?? "");
  const page = `/star/inbjudan/${encodeURIComponent(kod)}`;
  // Honungsfällan: fältet är dolt för människor. Boten får samma svar som alla andra och tror att det gick bra.
  if (String(fd.get("webbplats") ?? "") !== "") redirect(`${page}?tack=1#anmal`);
  const requestHeaders = await headers();
  // Utan JavaScript saknas rubriken next-action, och då når ett svar från actionen aldrig formuläret. Felet följer med adressen i stället.
  const fail = (code: IntresseFel, state?: FormState): FormState => {
    if (!requestHeaders.get("next-action")) redirect(`${page}?fel=${code}#anmal`);
    return state ?? { error: intresseFelText(code) };
  };

  const db = getDb();
  const current = db.prepare("SELECT value FROM settings WHERE key = 'star_inbjudan_kod'").get() as { value: string } | undefined;
  if (!current?.value || kod !== current.value) return fail("kod");

  const parsed = schema.safeParse(formObject(fd));
  if (!parsed.success) return fail("fel", invalid(parsed.error));
  const foretag = oneLine(parsed.data.foretag);
  const kontaktNamn = oneLine(parsed.data.kontakt_namn);
  if (!foretag) return fail("fel", { error: "Kontrollera fälten som är markerade.", fieldErrors: { foretag: "Företaget måste fyllas i." } });
  if (!kontaktNamn) return fail("fel", { error: "Kontrollera fälten som är markerade.", fieldErrors: { kontakt_namn: "Namnet måste fyllas i." } });

  if (interestLimitHit(clientIp(requestHeaders))) return fail("fort");
  const unread = db.prepare("SELECT COUNT(*) AS n FROM star_intresse WHERE status = 'ny'").get() as { n: number };
  if (unread.n >= MAX_UNREAD) return fail("full");

  const vill = parsed.data.vill_boka_mote === 1;
  const row = {
    foretag,
    kontakt_namn: kontaktNamn,
    epost: parsed.data.epost,
    telefon: oneLine(parsed.data.telefon),
    val: parsed.data.val,
    vill_boka_mote: vill,
    moteforslag: vill ? oneLine(parsed.data.moteforslag) : "",
    meddelande: multiLine(parsed.data.meddelande),
  };
  const thanks = `${page}?tack=${vill ? "mote" : "1"}#anmal`;

  // Samma anmälan två gånger (dubbeltryck, en omladdning) blir en rad och ett mejl. Företaget behöver inte veta det. Alla fält jämförs,
  // så att en rättad anmälan, till exempel med "boka möte" ikryssat i efterhand, inte försvinner tyst.
  const created = nowLocal();
  const same = db
    .prepare(
      "SELECT created_at FROM star_intresse WHERE epost = ? AND foretag = ? COLLATE NOCASE AND kontakt_namn = ? AND telefon = ? AND val = ? AND vill_boka_mote = ? AND moteforslag = ? AND meddelande = ? ORDER BY id DESC LIMIT 1",
    )
    .get(row.epost, row.foretag, row.kontakt_namn, row.telefon, row.val, vill ? 1 : 0, row.moteforslag, row.meddelande) as { created_at: string } | undefined;
  if (same && same.created_at.slice(0, 10) === created.slice(0, 10)) redirect(thanks);

  const saved = db
    .prepare("INSERT INTO star_intresse (foretag, kontakt_namn, epost, telefon, val, vill_boka_mote, moteforslag, meddelande, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id")
    .get(row.foretag, row.kontakt_namn, row.epost, row.telefon, row.val, vill ? 1 : 0, row.moteforslag, row.meddelande, created) as { id: number };

  // Allt som kräver anropet hämtas nu: i after får inga request-API:er användas.
  const [sasu, settings, base] = await Promise.all([getCommitteeBySlug("sasu"), getSettings(), siteUrl()]);
  const to = sasu?.email || settings.contact_email;
  const mail = intresseMejl(row, `${base}/admin/intresseanmalningar`);
  after(async () => {
    const result = await sendMail({ to, replyTo: row.epost, ...mail });
    getDb().prepare("UPDATE star_intresse SET mejl_status = ? WHERE id = ?").run(result, saved.id);
  });
  redirect(thanks);
}
