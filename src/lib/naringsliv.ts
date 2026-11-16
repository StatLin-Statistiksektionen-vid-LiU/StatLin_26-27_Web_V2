/**
 * Det STAR-sidan och lunchföreläsningarna delar. Rena funktioner utan databas, så att både sidorna, adminpanelen och
 * webbläsaren kan använda dem. Datan ligger i src/lib/data/naringsliv.ts.
 */
import { todayLocal } from "./dates";
import type { ImageRef } from "./types";

/* ---------- STAR-företagen ---------- */

export const SEEK_KINDS = ["exjobb", "sommarjobb", "trainee", "heltid"] as const;
export type SeekKind = (typeof SEEK_KINDS)[number];
export const SEEK_LABELS: Record<SeekKind, string> = { exjobb: "Exjobb", sommarjobb: "Sommarjobb", trainee: "Trainee", heltid: "Heltid" };

export const COMPANY_ROLES = ["utstallare", "huvudsponsor", "sponsor"] as const;
export type CompanyRole = (typeof COMPANY_ROLES)[number];
export const COMPANY_ROLE_LABELS: Record<CompanyRole, string> = { utstallare: "Utställare", huvudsponsor: "Huvudsponsor", sponsor: "Sponsor" };

export interface StarCompany {
  id: number;
  name: string;
  url: string;
  logo_media_id: number | null;
  description: string;
  /** Mellanslagsseparerat, så att CSS-filtret kan välja med [data-seeks~="exjobb"]. */
  seeks: string;
  role: CompanyRole;
  sort_order: number;
  active: number;
  logo: ImageRef | null;
}

/** Kolumnen som lista, i fast ordning och utan okända värden. */
export function parseSeeks(seeks: string): SeekKind[] {
  const set = new Set(seeks.split(/\s+/));
  return SEEK_KINDS.filter((k) => set.has(k));
}

/* ---------- Lunchönskemålen ---------- */

export const WISH_STATUSES = ["ny", "dold", "onskad", "pa_gang", "bokad", "genomford"] as const;
export type WishStatus = (typeof WISH_STATUSES)[number];
/** De som syns på sajten. Nya och dolda syns bara i adminpanelen. */
export const PUBLIC_WISH_STATUSES = ["onskad", "pa_gang", "bokad", "genomford"] as const;
export const WISH_STATUS_LABELS: Record<WishStatus, string> = {
  ny: "Ny",
  dold: "Dold",
  onskad: "Önskad",
  pa_gang: "På gång",
  bokad: "Bokad",
  genomford: "Genomförd",
};
/** Så länge föreläsningen inte är bokad går det att ge stjärnor. */
export const canVoteOnWish = (status: WishStatus) => status === "onskad" || status === "pa_gang";

export interface LectureWish {
  id: number;
  title: string;
  comment: string;
  status: WishStatus;
  votes: number;
  event_id: number | null;
  created_on: string;
  event_slug: string | null;
  event_title: string | null;
}

export const WISH_TITLE_MAX = 120;
export const WISH_COMMENT_MAX = 500;

/* ---------- Evenemangen ---------- */

/** Samma mönster som getStarEvent: adressen star eller star-<år>. */
export const isStarSlug = (slug: string) => /^star(-\d{4})?$/.test(slug);

/** Lunchföreläsningar är evenemang vars titel eller adress säger det. Ingen egen kolumn. */
export const isLunchEvent = (e: { title: string; slug: string }) => /^lunchföreläsning/i.test(e.title) || /^lunch/i.test(e.slug);

/** Hela dagar till datumet, räknat i svensk tid. */
export function daysUntil(local: string): number {
  const toUtc = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
  return Math.round((toUtc(local) - toUtc(todayLocal())) / 86_400_000);
}

/** "om 34 dagar", "i morgon", "i dag" för heron. Null om dagen redan varit: då pågår mässan fortfarande eller är slut. */
export function countdownText(local: string): string | null {
  const days = daysUntil(local);
  if (days < 0) return null;
  if (days === 0) return "i dag";
  if (days === 1) return "i morgon";
  return `om ${days} dagar`;
}

export type ProgramStop = { time: string; text: string };

/**
 * Avsnittet "## Program" i evenemangets text, med rader som "- **10.00** Mässan öppnar". Tiden får skrivas 10.00 eller 10:00.
 * Rader som inte följer mönstret hoppas över, och utan avsnitt blir listan tom så att sidan inte visar något program.
 */
export function parseProgram(bodyMd: string): ProgramStop[] {
  const lines = bodyMd.split(/\r?\n/);
  const start = lines.findIndex((l) => /^##\s+program\s*$/i.test(l.trim()));
  if (start === -1) return [];
  const stops: ProgramStop[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,2}\s/.test(line.trim())) break;
    const m = line.trim().match(/^(?:[-*]\s+)?\*\*(\d{1,2})[.:](\d{2})\*\*\s*[–—:-]?\s*(.+)$/);
    if (m) stops.push({ time: `${m[1].padStart(2, "0")}.${m[2]}`, text: m[3].trim() });
  }
  return stops;
}

/** STAR-sidan är dold tills SASU gör den live. Besökare ser då bara att den kommer snart, och länkarna hit försvinner. */
export const starIsLive = (settings: { star_live: string }) => settings.star_live === "1";

/** Tipsen under Förbered dig: ett per rad. Tomma rader och punkter som någon skrivit själv räknas inte. */
export function parseStarTips(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*•]\s*/, ""))
    .filter(Boolean);
}

export type StarFaq = { question: string; answer: string };

/** Frågan på första raden och svaret på resten. En tom rad börjar nästa fråga, och en fråga utan svar visas inte. */
export function parseStarFaq(raw: string): StarFaq[] {
  return raw
    .split(/\r?\n[ \t]*\r?\n/)
    .map((block) => {
      const [question = "", ...answer] = block
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      return { question, answer: answer.join(" ") };
    })
    .filter((f) => f.question && f.answer);
}

/** E-postlänk med ifyllt ämne. Ämnet kodas, så att åäö och mellanslag kommer fram i alla e-postprogram. */
export const mailtoWithSubject = (email: string, subject: string) => `mailto:${email}?subject=${encodeURIComponent(subject)}`;

/**
 * Felen som kan stå i adressen när ett önskemål skickats utan JavaScript. Next ger inte useActionState resultatet på en sådan
 * sida, så actionen skickar besökaren tillbaka med en kod. Bara kända koder ger en text.
 */
const WISH_ERRORS = {
  fel: `Kontrollera önskemålet: det måste fyllas i och får vara högst ${WISH_TITLE_MAX} tecken, och kommentaren högst ${WISH_COMMENT_MAX}.`,
  fort: "Du har skickat många önskemål på kort tid. Vänta en stund och försök igen.",
  full: "Önskelådan är full just nu. Försök igen om några dagar.",
} as const;
export type WishErrorCode = keyof typeof WISH_ERRORS;
export const wishErrorMessage = (code: WishErrorCode) => WISH_ERRORS[code];
export const wishErrorText = (code: unknown): string | null => (typeof code === "string" && Object.hasOwn(WISH_ERRORS, code) ? WISH_ERRORS[code as WishErrorCode] : null);
