import { highlight } from "@/lib/search";

/** Delar som söksidan och sökrutan har gemensamt. */

/** Visas innan man skrivit något. Ett tryck fyller i sökrutan. */
export const SUGGESTIONS = ["Tentastatistik", "Sittning", "Styrelsen", "Mottagning", "Hjälpmedel", "Kontakt"];

/** Sidor och poster öppnas i appen. Filer, API och andra webbplatser är vanliga länkar. */
export const isPageHref = (href: string) => href.startsWith("/") && !href.startsWith("/api/") && !/\.[a-z0-9]{2,5}(?:$|[?#])/i.test(href);

/** Frågan som kurskod när den ser ut som en (sex tecken med minst en siffra), annars null. */
export function courseCodeOf(query: string): string | null {
  const code = query.replace(/[\s-]+/g, "").toUpperCase();
  return /^[A-Z0-9]{6}$/.test(code) && /\d/.test(code) ? code : null;
}

/** Texten med sökorden markerade. */
export function Marked({ text, terms, corrected }: { text: string; terms: string[]; corrected: string[] }) {
  return (
    <>
      {highlight(text, terms, corrected).map((part, i) =>
        part.hit ? (
          <mark key={i} className="rounded-[0.2em] bg-red/[0.12] px-[0.08em] text-inherit">
            {part.text}
          </mark>
        ) : (
          part.text
        ),
      )}
    </>
  );
}
