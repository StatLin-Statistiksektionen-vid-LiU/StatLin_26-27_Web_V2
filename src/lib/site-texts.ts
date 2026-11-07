/*
 * Sajtens fasta texter som inte hör till en sida i Admin: rubrikerna på startsidan och huvudena på listsidorna.
 * Standardtexten står här. Det som skrivs med pennan i redigeringsläget sparas som en vanlig inställning, och ett tomt
 * fält ger tillbaka standardtexten. Skriv *ord* med stjärnor för att göra dem röda där texten är en rubrik eller en ingress, och
 * _ord_ med understreck för att skriva dem för hand (_*ord*_ med rödpenna). Anteckningarna för hand med pil tas bort med ett -.
 */

/** Grupperna är det en penna öppnar, med rubriken i panelen. */
export const SITE_TEXT_GROUPS = {
  "start-om": "Startsidan: om sektionen",
  "start-evenemang": "Startsidan: evenemangen",
  "start-utskott": "Startsidan: utskotten",
  "start-nytt": "Startsidan: nytt",
  "start-vagar": "Startsidan: korten längst ner",
  evenemang: "Evenemang: sidhuvudet",
  nyheter: "Nytt: sidhuvudet",
  utskott: "Utskott: sidhuvudet",
  galleri: "Galleri: sidhuvudet",
  dokument: "Dokument: sidhuvudet",
  tentastatistik: "Tentastatistik: sidhuvudet",
  styrelsen: "Styrelsen: sidhuvudet",
  om: "Om StatLin: sidhuvudet",
} as const;

export type SiteTextGroup = keyof typeof SITE_TEXT_GROUPS;
export type HeroGroup = "evenemang" | "nyheter" | "utskott" | "galleri" | "dokument" | "tentastatistik" | "styrelsen";

export type TextDef = { group: SiteTextGroup; label: string; default: string; max: number; long?: boolean };

/** Ett sidhuvud: den lilla raden, rubriken och ingressen. */
function hero<G extends HeroGroup>(group: G, kicker: string, title: string, lead: string) {
  return {
    [`text_${group}_kicker`]: { group, label: "Liten rad ovanför", default: kicker, max: 60 },
    [`text_${group}_rubrik`]: { group, label: "Rubrik", default: title, max: 60 },
    [`text_${group}_ingress`]: { group, label: "Ingress", default: lead, max: 300, long: true },
  } as unknown as Record<`text_${G}_kicker` | `text_${G}_rubrik` | `text_${G}_ingress`, TextDef>;
}

/** En anteckning för hand med en pil till slutet av sidhuvudets rubrik (Anteckning i anteckning.tsx). */
function anteckningDef<G extends HeroGroup>(group: G, text: string) {
  return {
    [`text_${group}_anteckning`]: { group, label: "Anteckning för hand vid rubriken, - tar bort den, *text* blir röd", default: text, max: 40 },
  } as unknown as Record<`text_${G}_anteckning`, TextDef>;
}

const START = {
  text_start_om_kicker: { group: "start-om", label: "Liten rad ovanför texten om sektionen", default: "Om sektionen", max: 60 },
  text_start_siffra_utskott: { group: "start-om", label: "Siffrorna: utskotten", default: "Utskott & grupper", max: 40 },
  text_start_siffra_styrelsen: { group: "start-om", label: "Siffrorna: styrelsen", default: "Poster i styrelsen", max: 40 },
  text_start_siffra_styrelsen_not: { group: "start-om", label: "Siffrorna: raden under styrelsen", default: "väljs varje år", max: 60 },
  text_start_siffra_evenemang: { group: "start-om", label: "Siffrorna: evenemangen", default: "Kommande evenemang", max: 40 },
  text_start_siffra_evenemang_not: { group: "start-om", label: "Siffrorna: raden under evenemangen", default: "just nu i kalendern", max: 60 },
  text_start_siffra_program: { group: "start-om", label: "Siffrorna: programmen", default: "Program", max: 40 },

  text_start_evenemang_kicker: { group: "start-evenemang", label: "Liten rad ovanför", default: "Kalender", max: 60 },
  text_start_evenemang_rubrik: { group: "start-evenemang", label: "Rubrik", default: "Kommande *evenemang*", max: 80 },
  text_start_evenemang_lank: { group: "start-evenemang", label: "Länken till kalendern", default: "Hela kalendern", max: 40 },
  text_start_kalender_rubrik: { group: "start-evenemang", label: "Kalenderrutan: rubrik", default: "Prenumerera på kalendern", max: 80 },
  text_start_kalender_text: { group: "start-evenemang", label: "Kalenderrutan: text", default: "Alla evenemang direkt i Google Kalender, iPhone eller Outlook.", max: 200, long: true },

  text_start_utskott_kicker: { group: "start-utskott", label: "Liten rad ovanför", default: "Utskott", max: 60 },
  text_start_utskott_rubrik: { group: "start-utskott", label: "Rubrik", default: "Hitta ditt *sammanhang*", max: 80 },
  text_start_utskott_lank: { group: "start-utskott", label: "Länken till alla utskott", default: "Alla utskott", max: 40 },
  text_start_engagera_rubrik: { group: "start-utskott", label: "Rutan sist: rubrik", default: "Engagera dig", max: 40 },
  text_start_engagera_text: { group: "start-utskott", label: "Rutan sist: text", default: "Alla utskott söker folk, _*ingen erfarenhet krävs.*_", max: 160, long: true },

  text_start_nytt_kicker: { group: "start-nytt", label: "Liten rad ovanför", default: "Från sektionen", max: 60 },
  text_start_nytt_rubrik: { group: "start-nytt", label: "Rubrik", default: "Senaste *nytt*", max: 80 },
  text_start_nytt_lank: { group: "start-nytt", label: "Länken till allt nytt", default: "Allt nytt", max: 40 },

  text_start_ny_kicker: { group: "start-vagar", label: "Röda kortet: liten rad", default: "För dig som är ny", max: 60 },
  text_start_ny_rubrik: { group: "start-vagar", label: "Röda kortet: rubrik", default: "Ny student?", max: 40 },
  text_start_ny_text: { group: "start-vagar", label: "Röda kortet: text", default: "Mottagningen, overallen och allt du undrar inför första dagen, på kandidaten eller mastern.", max: 200, long: true },
  text_start_ny_knapp: { group: "start-vagar", label: "Röda kortet: knapp", default: "Läs mer", max: 30 },
  text_start_star_kicker: { group: "start-vagar", label: "STAR-kortet: liten rad", default: "Arbetsmarknadsdagen", max: 60 },
  text_start_star_text: {
    group: "start-vagar",
    label: "STAR-kortet: text",
    default: "StatLins arbetsmarknadsdag, och fler sätt att möta Linköpings statistik- och datastudenter.",
    max: 200,
    long: true,
  },
  text_start_star_knapp_live: { group: "start-vagar", label: "STAR-kortet: knapp när STAR är live", default: "Vilka kommer?", max: 40 },
  text_start_star_knapp: { group: "start-vagar", label: "STAR-kortet: knapp annars", default: "Fler sätt att samarbeta", max: 40 },
  text_evenemang_knapp: { group: "evenemang", label: "Knappen", default: "Prenumerera på kalendern", max: 40 },
} satisfies Record<string, TextDef>;

export const SITE_TEXTS = {
  ...START,
  ...hero("evenemang", "Kalender", "Evene*mang*", "Sittningar, pubar, idrott, föreläsningar och sektionsmöten. Prenumerera på kalendern så _missar du inget._"),
  ...hero("nyheter", "Från sektionen", "Senaste *nytt*", "Information från styrelsen och utskotten, från sittningsanmälningar till beslut på sektionsmötet."),
  ...anteckningDef("nyheter", "(färskt ur pressen)"),
  ...hero(
    "utskott",
    "Sektionen / Utskott",
    "Utsk*ott*",
    "_Utskotten är hjärtat i sektionen._ Varje utskott har sin egen logga, alla byggda på samma baslogotyp men med sin egen bakgrundsgrafik.",
  ),
  ...hero("galleri", "Sektionen / Galleri", "Galle*ri*", "Bilder från sittningar, pubar, idrott och allt annat. Uppladdade av sektionens poster."),
  ...anteckningDef("galleri", "*(bevis på att P(kul) = 1)*"),
  ...hero("dokument", "Sektionen / Dokument", "Doku*ment*", "Stadgar, reglemente, mötesprotokoll och styrdokument. Allt som styr sektionen, samlat på ett ställe."),
  ...anteckningDef("dokument", "(spännande läsning, lovar)"),
  ...hero(
    "tentastatistik",
    "Studenter / Tentastatistik",
    "Tenta*statistik*",
    "_Hur brukar tentan gå?_ Sök på kurskoden, för vilken LiU-kurs som helst, och se betygen på varje tentatillfälle.",
  ),
  ...hero(
    "styrelsen",
    "Sektionen / Styrelsen",
    "Styrel*sen*",
    "Styrelsen väljs på sektionsmötet och leder sektionen under ett verksamhetsår. Hör av dig direkt till rätt post.",
  ),
  ...anteckningDef("styrelsen", "(vi bits inte)"),
  // Ändras där den står, i redigeringsläget på Om StatLin.
  text_om_anteckning: { group: "om", label: "Anteckningen för hand som pekar på StatLin i rubriken, - tar bort den, *text* blir röd", default: "(topp 5 sektion)", max: 40 } satisfies TextDef,
};

export type SiteTextKey = keyof typeof SITE_TEXTS;
export const SITE_TEXT_KEYS = Object.keys(SITE_TEXTS) as SiteTextKey[];
export const SITE_TEXT_DEFAULTS = Object.fromEntries(SITE_TEXT_KEYS.map((k) => [k, SITE_TEXTS[k].default])) as Record<SiteTextKey, string>;

export function isSiteTextGroup(value: string): value is SiteTextGroup {
  return Object.hasOwn(SITE_TEXT_GROUPS, value);
}

/** Texterna i en grupp, i den ordning de står ovan. */
export function textsIn(group: SiteTextGroup): SiteTextKey[] {
  return SITE_TEXT_KEYS.filter((k) => SITE_TEXTS[k].group === group);
}

export function textDef(key: SiteTextKey): TextDef {
  return SITE_TEXTS[key];
}

/** Den sparade texten, eller standardtexten när fältet är tomt. */
export function siteText(s: Record<SiteTextKey, string>, key: SiteTextKey): string {
  return s[key]?.trim() || SITE_TEXTS[key].default;
}

/** En anteckning för hand: den sparade texten eller standardtexten, och ingen alls när någon har skrivit - eller nyckeln inte finns. */
export function anteckningText(s: Record<SiteTextKey, string>, key: string): string {
  if (!Object.hasOwn(SITE_TEXTS, key)) return "";
  const v = siteText(s, key as SiteTextKey).trim();
  return v === "-" ? "" : v;
}
