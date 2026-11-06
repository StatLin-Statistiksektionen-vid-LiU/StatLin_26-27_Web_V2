import "server-only";
import {
  getSettings,
  listBoard,
  listCommittees,
  listDocuments,
  listPages,
  listPartners,
} from "@/lib/data/content";
import { listAllPublishedEvents } from "@/lib/data/events";
import { listLinks } from "@/lib/data/links";
import { listNews } from "@/lib/data/news";
import { listResources } from "@/lib/data/resources";
import { formatDate, todayLocal } from "@/lib/dates";
import { BRANSCHER, FARDIGHETER } from "@/lib/foretag-kompetens";
import { categoryLabel, isExternalUrl } from "@/lib/links";
import { starIsLive } from "@/lib/naringsliv";
import { committeeHref, NAV, PAGE_PATHS } from "@/lib/navigation";
import { RESOURCE_CATEGORIES, RESOURCE_PROGRAMS } from "@/lib/resources";
import type { SearchEntry } from "@/lib/search";
import { DOCUMENT_CATEGORIES } from "@/lib/types";
import { safeExternalUrl, stripMarkdown } from "@/lib/utils";

/** Brödtexten per träff kortas här, så att indexet som skickas till webbläsaren håller sig litet. */
const MAX_TEXT = 4000;
const plain = (md: string) => stripMarkdown(md ?? "", MAX_TEXT);

/** Ord som folk skriver men som inte står i sidans rubrik. */
const PAGE_KEYWORDS: Record<string, string> = {
  "/evenemang": "event aktiviteter sittning pub fest kalender",
  "/nyheter": "nyheter nytt aktuellt",
  "/sektionen": "om oss sektionen statlin historia",
  "/sektionen/styrelsen": "styrelse ordförande kassör sekreterare poster kontakt",
  "/utskott": "utskott grupper engagera engagemang",
  "/galleri": "bilder foton fotografier album",
  "/dokument": "stadgar protokoll reglemente styrdokument möten",
  "/grafisk-profil": "logga logotyp färger typsnitt profil",
  "/studenter/kandidat": "kandidatprogram statistik dataanalys kurser program",
  "/studenter/master": "masterprogram statistics machine learning kurser program",
  "/studenter/ny-student": "mottagning nollning overall nyantagen nya studenter vanliga frågor faq",
  "/studenter/lankar": "schema lisam timeedit länkar genvägar",
  "/studenter/hjalpmedel": "fusklapp formelsamling github guide kod hjälp",
  "/tentastatistik": "tenta tentor betyg statistik kurskod underkänd",
  "/foretag": "samarbete sponsor partner företag näringsliv",
  "/foretag#kompetens": "kompetens färdigheter rekrytera anställa examensarbete",
  "/star": "arbetsmarknadsdag mässa företag",
  "/lunchforelasningar": "lunch föreläsning önska önskemål",
  "/kontakt": "mejl mail e-post adress instagram kontakta",
  "/integritet": "personuppgifter gdpr kakor cookies integritet",
  "/en": "english international",
  "/en/masters": "english masters programme",
};

/** Sidor som inte står i menyn men går att hitta. Frågelådan är med flit inte här: den nås med kod eller länk. */
const EXTRA_PAGES: { href: string; title: string; meta: string }[] = [
  { href: "/evenemang?vy=kalender", title: "Kalender", meta: "Alla evenemang månad för månad" },
  { href: "/integritet", title: "Integritet", meta: "Hur sajten hanterar personuppgifter" },
  { href: "/en", title: "In English", meta: "StatLin for international students" },
  { href: "/en/masters", title: "Master's programme", meta: "Statistics and Machine Learning, in English" },
];

/**
 * Allt som går att hitta i sökfliken: sidorna i menyn med sina texter, evenemang, nyheter, utskott, styrelsen, dokument, länkar,
 * hjälpmedel, partner och vad studenterna kan. Bara det som är publicerat och syns på sajten kommer med.
 */
export async function buildSearchIndex(): Promise<SearchEntry[]> {
  const [settings, pages, events, news, committees, board, documents, links, resources, partners] = await Promise.all([
    getSettings(),
    listPages(),
    listAllPublishedEvents(),
    listNews(200),
    listCommittees({ visibleOnly: true }),
    listBoard(),
    listDocuments({ publishedOnly: true }),
    listLinks({ activeOnly: true }),
    listResources(),
    listPartners({ activeOnly: true }),
  ]);
  const starLive = starIsLive(settings);
  const entries: SearchEntry[] = [];

  // Sidorna: menyn ger rubrik och beskrivning, sidtexten från Admin → Sidor ger brödtexten.
  const pageText = new Map<string, string>();
  for (const page of pages) {
    const href = PAGE_PATHS[page.slug];
    if (href) pageText.set(href, [page.lead, plain(page.body_md)].filter(Boolean).join(" "));
  }
  const seen = new Set<string>();
  const addPage = (href: string, title: string, meta?: string) => {
    if (seen.has(href) || (href === "/star" && !starLive)) return;
    seen.add(href);
    entries.push({ href, kind: "sida", title, meta, keywords: PAGE_KEYWORDS[href], text: pageText.get(href), boost: 5 });
  };
  for (const group of NAV) {
    if (!group.children) addPage(group.href, group.label);
    for (const child of group.children ?? []) addPage(child.href, child.label, child.description);
  }
  for (const page of EXTRA_PAGES) addPage(page.href, page.title, page.meta);

  const today = todayLocal();
  for (const e of events) {
    const upcoming = (e.ends_at ?? e.starts_at).slice(0, 10) >= today;
    entries.push({
      href: `/evenemang/${e.slug}`,
      kind: "evenemang",
      title: e.title,
      meta: [formatDate(e.starts_at, true), e.location, upcoming ? "Kommande" : "Har varit"].filter(Boolean).join(" · "),
      keywords: [e.committee?.name, e.committee?.short_name].filter(Boolean).join(" "),
      text: [e.summary, plain(e.body_md)].filter(Boolean).join(" "),
      // Kommande först, sedan de senaste av dem som varit.
      boost: upcoming ? 3 : 0,
    });
  }

  for (const n of news) {
    entries.push({
      href: `/nyheter/${n.slug}`,
      kind: "nytt",
      title: n.title,
      meta: formatDate(n.published_at, true),
      keywords: [n.committee?.name, n.author_post].filter(Boolean).join(" "),
      text: [n.excerpt, plain(n.body_md)].filter(Boolean).join(" "),
      boost: n.pinned ? 2 : 1,
    });
  }

  for (const c of committees) {
    const href = committeeHref(c);
    if (!href || c.kind === "styrelse") continue;
    entries.push({
      href,
      kind: "utskott",
      title: c.name,
      meta: c.tagline || undefined,
      keywords: [c.short_name, c.email, c.instagram].filter(Boolean).join(" "),
      text: plain(c.description_md),
    });
  }

  for (const m of board) {
    entries.push({
      href: "/sektionen/styrelsen",
      kind: "styrelse",
      title: m.post,
      meta: [m.name, m.email].filter(Boolean).join(" · "),
      text: m.bio,
    });
  }

  for (const d of documents) {
    const href = d.file?.href ?? safeExternalUrl(d.url) ?? "/dokument";
    entries.push({
      href,
      kind: "dokument",
      title: d.title,
      meta: [DOCUMENT_CATEGORIES[d.category], d.doc_date ? formatDate(d.doc_date, true) : "", d.file?.ext?.toUpperCase()].filter(Boolean).join(" · "),
      text: d.description,
      external: isExternalUrl(href),
    });
  }

  for (const l of links) {
    const href = safeExternalUrl(l.url);
    if (!href) continue;
    entries.push({
      href,
      kind: "lank",
      title: l.label,
      meta: categoryLabel(l.category),
      keywords: l.keywords,
      text: l.description,
      external: isExternalUrl(href),
    });
  }

  for (const r of resources) {
    const href = r.file?.href ?? safeExternalUrl(r.url) ?? "/studenter/hjalpmedel";
    entries.push({
      href,
      kind: "hjalpmedel",
      title: r.title,
      meta: [RESOURCE_CATEGORIES[r.category], RESOURCE_PROGRAMS[r.program], r.term ? `termin ${r.term}` : ""].filter(Boolean).join(" · "),
      text: r.description,
      external: isExternalUrl(href),
    });
  }

  for (const p of partners) {
    entries.push({ href: "/foretag", kind: "foretag", title: p.name, meta: p.tier === "huvudpartner" ? "Huvudsponsor" : "Sponsor", text: p.description });
  }

  for (const group of FARDIGHETER) {
    for (const skill of group.rader) {
      entries.push({ href: "/foretag#kompetens", kind: "foretag", title: skill.namn, meta: `Vad studenterna kan · ${group.grupp}` });
    }
  }
  for (const b of BRANSCHER) {
    entries.push({ href: "/foretag#kompetens", kind: "foretag", title: b.namn, meta: "Branscher där studenterna passar", text: b.text });
  }

  return entries;
}
