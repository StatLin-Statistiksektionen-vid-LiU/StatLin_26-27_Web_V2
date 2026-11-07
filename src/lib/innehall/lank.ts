/**
 * Länkar som går att skriva in i redigeringsläget: en sida på sajten (/foretag, /foretag#kompetens), ett ankare på samma
 * sida (#kalender), en webbadress med https eller en e-postadress. Allt annat, som javascript:, stoppas här och på servern.
 */
export function arGiltigLank(href: string): boolean {
  const h = href.trim();
  if (!h || /\s/.test(h)) return false;
  if (h.startsWith("/")) return !h.startsWith("//");
  if (h.startsWith("#")) return h.length > 1;
  if (/^mailto:[^@\s]+@[^@\s]+$/i.test(h)) return true;
  try {
    const url = new URL(h);
    return (url.protocol === "https:" || url.protocol === "http:") && !!url.hostname;
  } catch {
    return false;
  }
}

/** Länkar inom sajten öppnas med Next:s Link, resten som vanliga länkar i en ny flik. */
export const arIntern = (href: string) => href.startsWith("/") || href.startsWith("#");

export const LANK_FEL = "Skriv en sida på sajten som /foretag, eller en hel adress som börjar med https://.";
