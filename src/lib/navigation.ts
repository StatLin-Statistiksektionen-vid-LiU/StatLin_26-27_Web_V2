import { programFacts } from "@/lib/links";
import type { Committee } from "@/lib/types";

type NavItem = { href: string; label: string; description?: string };
export type NavGroup = { label: string; href: string; children?: NavItem[] };

export const NAV: NavGroup[] = [
  { label: "Evenemang", href: "/evenemang" },
  { label: "Nytt", href: "/nyheter" },
  {
    label: "Sektionen",
    href: "/sektionen",
    children: [
      { href: "/sektionen", label: "Om StatLin", description: "Vilka vi är och vad vi gör" },
      { href: "/sektionen/styrelsen", label: "Styrelsen", description: "Poster och kontaktuppgifter" },
      { href: "/utskott", label: "Utskott", description: "Alla utskott och grupper på sektionen" },
      { href: "/galleri", label: "Galleri", description: "Bilder från evenemang" },
      { href: "/dokument", label: "Dokument", description: "Stadgar, protokoll och styrdokument" },
      { href: "/grafisk-profil", label: "Grafisk profil", description: "Loggor, färger och typsnitt" },
    ],
  },
  {
    label: "Studenter",
    href: "/studenter",
    children: [
      { href: "/studenter/kandidat", label: "Kandidat", description: programFacts("kandidat") },
      { href: "/studenter/master", label: "Master", description: programFacts("master") },
      { href: "/studenter/ny-student", label: "Nya studenter", description: "Mottagning, overall och vanliga frågor" },
      { href: "/studenter/lankar", label: "Länkar", description: "Schema, tentor och genvägar" },
      { href: "/studenter/hjalpmedel", label: "Hjälpmedel", description: "Fusklappar, GitHub-länkar och guider per program" },
      { href: "/tentastatistik", label: "Tentastatistik", description: "Betyg per tentatillfälle, för alla kurser" },
      // Önskelistan är studenternas, så den står här. Företagen anmäler intresse på /foretag.
      { href: "/lunchforelasningar", label: "Lunchföreläsningar", description: "Önska föreläsare och se nästa föreläsning" },
    ],
  },
  {
    label: "Företag",
    href: "/foretag",
    children: [
      { href: "/foretag", label: "För företag", description: "Samarbeta med StatLin" },
      { href: "/foretag#kompetens", label: "Vad studenterna kan", description: "Färdigheter och branscher" },
      { href: "/star", label: "STAR", description: "Arbetsmarknadsdagen: vilka kommer och när" },
      { href: "/foretag#lunchforelasning", label: "Håll en lunchföreläsning", description: "Anmäl intresse och se hur det går till" },
    ],
  },
  { label: "Kontakt", href: "/kontakt" },
];

/** Var de redigerbara sidorna (pages-tabellen) visas på sajten. */
export const PAGE_PATHS: Record<string, string> = {
  om: "/sektionen",
  utbildning: "/studenter/kandidat",
  master: "/studenter/master",
  "ny-student": "/studenter/ny-student",
  lankar: "/studenter/lankar",
  hjalpmedel: "/studenter/hjalpmedel",
  foretag: "/foretag",
  kontakt: "/kontakt",
  en: "/en",
  "en-masters": "/en/masters",
};

/** Engelska sidor ligger under /en – resten av sajten är på svenska. */
const isEnglishPath = (pathname: string) => pathname === "/en" || pathname.startsWith("/en/");

/** Sidor som finns på båda språken: svenska, engelska. */
const LANGUAGE_PAIRS = [
  ["/", "/en"],
  ["/studenter/master", "/en/masters"],
] as const;

/** Språkväxlaren: motsvarande sida på det andra språket, annars /en från svenska sidor och startsidan från engelska. */
export function languageSwitch(pathname: string | null) {
  if (pathname !== null && isEnglishPath(pathname)) {
    return { href: LANGUAGE_PAIRS.find(([, en]) => en === pathname)?.[0] ?? "/", short: "SV", label: "På svenska", lang: "sv" };
  }
  return { href: LANGUAGE_PAIRS.find(([sv]) => sv === pathname)?.[1] ?? "/en", short: "EN", label: "In English", lang: "en" };
}

/** Sidan en arrangör länkar till. Styrelsen har sin sida under sektionen, och ett dolt utskott har ingen alls. */
export function committeeHref(committee: Pick<Committee, "slug" | "kind" | "visible">): string | null {
  if (committee.kind === "styrelse") return "/sektionen/styrelsen";
  return committee.visible ? `/utskott/${committee.slug}` : null;
}
