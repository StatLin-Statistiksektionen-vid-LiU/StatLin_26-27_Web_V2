import type { Metadata } from "next";

/**
 * Metadata slås inte ihop på djupet: en sida som sätter openGraph eller alternates ersätter hela blocket från rotlayouten. Sidorna sprider
 * därför in de här i sina egna block. openGraph: undefined tar bort alla og-taggar, så en sida utan egen bild använder SITE_OG rakt av.
 */
export const SITE_OG = {
  type: "website",
  locale: "sv_SE",
  siteName: "StatLin",
  // ?v= byts när bilden byts, så att Facebook, Discord och andra som sparar bilden per adress hämtar den nya.
  images: [{ url: "/og.png?v=2", width: 1200, height: 630, alt: "StatLin · Statistiksektionen i Linköping" }],
} satisfies NonNullable<Metadata["openGraph"]>;

export const SITE_OG_EN = { ...SITE_OG, locale: "en_GB" } satisfies NonNullable<Metadata["openGraph"]>;

export const SITE_ALTERNATES = { types: { "text/calendar": "/kalender.ics" } } satisfies NonNullable<Metadata["alternates"]>;
