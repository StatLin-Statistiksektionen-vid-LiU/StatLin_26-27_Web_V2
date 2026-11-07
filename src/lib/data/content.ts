import "server-only";
import { STAR_COPY } from "@/lib/seed-content";
import { cache } from "react";
import { SITE_TEXT_DEFAULTS } from "@/lib/site-texts";
import { DEFAULT_MEETING_TEMPLATE } from "@/lib/meeting-template";
import { readDb } from "./db";
import { fileHref, MEDIA_JSON_COLUMNS, parseMediaJson, toImageRef } from "@/lib/media-url";
import { EDUCATION_COMMITTEE_SLUG } from "@/lib/seed-content";
import type { BoardMember, Committee, DocumentItem, Page, Partner, SiteSettings } from "@/lib/types";

/* ---------- Inställningar ---------- */

export const DEFAULT_SETTINGS: SiteSettings = {
  contact_email: "styrelsen@statlin.se",
  instagram: "",
  facebook: "",
  linkedin: "",
  address: "Linköpings universitet, Campus Valla, 581 83 Linköping",
  sektionsrum: "",
  org_number: "",
  tagline: "Sektionen för dig som läser statistik och dataanalys eller Statistics and Machine Learning vid Linköpings universitet.",
  footer_slogan: "Allt blir mer *signifikant* tillsammans.",
  hero_kicker: "Statistiksektionen i Linköping",
  hero_title: "Sektionen för *statistik*, dataanalys och maskininlärning vid LiU",
  hero_text: "Sittningar, pubar, idrott, studiebevakning och kontakt med arbetslivet.\n_Drivet av studenter, för studenter._",
  hero_ring_color: "red",
  hero_formulas: "pa",
  band_color: "vit",
  home_intro: "Vi är statistikstudenternas sektion i Linköping. Här möts *gemenskap*, *utbildning* och vägen ut i *arbetslivet*.",
  announcement: "",
  announcement_url: "",
  star_event_id: "",
  star_live: "",
  star_subtitle: STAR_COPY.subtitle,
  star_intro: STAR_COPY.text,
  star_companies_intro: "Varje stjärna är ett företag. Välj vad du söker, så lyser bara de som passar. Under kartan finns alla som kort.",
  star_sponsors_intro: "De gör dagen möjlig.",
  star_tips:
    "Titta igenom vilka som kommer och välj två eller tre du verkligen vill prata med.\nSkriv ner en fråga till var och en, till exempel vad en statistiker gör hos dem en vanlig dag.\nTa med CV:t, gärna på papper.\nFråga om exjobb och sommarjobb, även om det ligger långt fram.",
  star_faq:
    "Är det för mig som precis har börjat?\nJa. Det är aldrig för tidigt att se vad utbildningen kan leda till och att börja prata med företagen.\n\nVad kan jag fråga företagen?\nTill exempel vad en statistiker gör hos dem en vanlig dag, vilka verktyg de använder och hur exjobb och sommarjobb går till.\n\nVi är ett företag och vill vara med. Hur gör vi?\nMejla SASU, så berättar de hur det går till och tar fram ett upplägg med er.",
  star_student_title: "Se vart statistiken kan ta dig.",
  star_student_text: "Prata med företagen, fråga om exjobb och sommarjobb och ta reda på vad en statistiker faktiskt gör om dagarna.",
  star_company_title: "Möt framtidens statistiker.",
  star_company_text: "Vill ni ställa ut eller sponsra? SASU berättar hur det går till och tar fram ett upplägg med er.",
  star_teaser: "Vi förbereder nästa STAR. Snart ser du här vilka företag som kommer, vad de söker och hur dagen ser ut.",
  education_committee_id: "",
  meeting_template: DEFAULT_MEETING_TEMPLATE,
  ...SITE_TEXT_DEFAULTS,
};

/** Läses en gång per rendering, hur många komponenter som än frågar: startsidan frågar sju gånger. Utanför en rendering läses den på nytt. */
export const getSettings = cache(async (): Promise<SiteSettings> => {
  const db = await readDb();
  const rows = db.prepare("SELECT key, value FROM settings WHERE key NOT LIKE 'innehall:%'").all() as { key: string; value: string }[];
  const s = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (r.key in s) (s as Record<string, string>)[r.key] = r.value;
  return s;
});

/* ---------- Utskott ---------- */

type CommitteeRow = Omit<Committee, "visible" | "wishes_open"> & { visible: number; wishes_open: number };
const mapCommittee = (r: CommitteeRow): Committee => ({ ...r, visible: Boolean(r.visible), wishes_open: Boolean(r.wishes_open) });

export async function listCommittees(opts: { visibleOnly?: boolean } = {}): Promise<Committee[]> {
  const db = await readDb();
  const rows = db
    .prepare(
      `SELECT * FROM committees ${opts.visibleOnly ? "WHERE visible = 1" : ""} ORDER BY sort_order, name`,
    )
    .all() as CommitteeRow[];
  return rows.map(mapCommittee);
}

export async function getCommitteeBySlug(slug: string): Promise<Committee | null> {
  const db = await readDb();
  const row = db.prepare("SELECT * FROM committees WHERE slug = ?").get(slug) as CommitteeRow | undefined;
  return row ? mapCommittee(row) : null;
}

/**
 * Utskottet på programsidornas kontaktkort. Pekas ut i Admin → Inställningar. Utan val gäller adressen från grunddatan, så att
 * en databas där ingen valt något fungerar som förut. Finns inget av dem syns inget kort, och då ska det gå att se varför.
 */
export async function getEducationCommittee(): Promise<Committee | null> {
  const { education_committee_id: chosen } = await getSettings();
  const found = (chosen ? await getCommitteeById(Number(chosen)) : null) ?? (await getCommitteeBySlug(EDUCATION_COMMITTEE_SLUG));
  if (!found) console.warn("[statlin] Programsidorna saknar utbildningsutskott: välj ett under Admin → Inställningar.");
  return found;
}

export async function getCommitteeById(id: number): Promise<Committee | null> {
  const db = await readDb();
  const row = db.prepare("SELECT * FROM committees WHERE id = ?").get(id) as CommitteeRow | undefined;
  return row ? mapCommittee(row) : null;
}

/* ---------- Styrelse ---------- */

type BoardRow = Omit<BoardMember, "photo"> & { photo_json: string | null };

const mapBoard = (r: BoardRow): BoardMember => {
  const { photo_json, ...rest } = r;
  return { ...rest, photo: toImageRef(parseMediaJson(photo_json)) };
};

export async function listBoard(): Promise<BoardMember[]> {
  const db = await readDb();
  const rows = db
    .prepare(
      `SELECT b.*, ${MEDIA_JSON_COLUMNS("m")} AS photo_json
       FROM board_members b LEFT JOIN media m ON m.id = b.photo_media_id
       ORDER BY b.sort_order, b.id`,
    )
    .all() as BoardRow[];
  return rows.map(mapBoard);
}

export async function getBoardMember(id: number): Promise<BoardMember | null> {
  const db = await readDb();
  const row = db
    .prepare(
      `SELECT b.*, ${MEDIA_JSON_COLUMNS("m")} AS photo_json
       FROM board_members b LEFT JOIN media m ON m.id = b.photo_media_id WHERE b.id = ?`,
    )
    .get(id) as BoardRow | undefined;
  return row ? mapBoard(row) : null;
}

/* ---------- Sidor ---------- */

export async function getPage(slug: string): Promise<Page | null> {
  const db = await readDb();
  return (db.prepare("SELECT * FROM pages WHERE slug = ?").get(slug) as Page) ?? null;
}

export async function listPages(): Promise<Page[]> {
  const db = await readDb();
  return db.prepare("SELECT * FROM pages ORDER BY title").all() as Page[];
}

/* ---------- Partners ---------- */

type PartnerRow = Omit<Partner, "logo" | "active"> & { active: number; logo_json: string | null };

export async function listPartners(opts: { activeOnly?: boolean } = {}): Promise<Partner[]> {
  const db = await readDb();
  const rows = db
    .prepare(
      `SELECT p.*, ${MEDIA_JSON_COLUMNS("m")} AS logo_json
       FROM partners p LEFT JOIN media m ON m.id = p.logo_media_id
       ${opts.activeOnly ? "WHERE p.active = 1" : ""}
       ORDER BY CASE p.tier WHEN 'huvudpartner' THEN 0 ELSE 1 END, p.sort_order, p.name`,
    )
    .all() as PartnerRow[];
  return rows.map(({ logo_json, ...p }) => ({ ...p, active: Boolean(p.active), logo: toImageRef(parseMediaJson(logo_json)) }));
}

/* ---------- Dokument ---------- */

type DocRow = Omit<DocumentItem, "file" | "published"> & { published: number; media_json: string | null };

export async function listDocuments(opts: { publishedOnly?: boolean } = {}): Promise<DocumentItem[]> {
  const db = await readDb();
  const rows = db
    .prepare(
      `SELECT d.*, ${MEDIA_JSON_COLUMNS("m")} AS media_json
       FROM documents d LEFT JOIN media m ON m.id = d.media_id
       ${opts.publishedOnly ? "WHERE d.published = 1" : ""}
       ORDER BY d.category, d.sort_order, COALESCE(d.doc_date, d.created_at) DESC`,
    )
    .all() as DocRow[];
  return rows.map(({ media_json, ...d }) => {
    const m = parseMediaJson(media_json);
    return { ...d, published: Boolean(d.published), file: m ? { href: fileHref(m), size: m.size, ext: m.ext } : null };
  });
}
