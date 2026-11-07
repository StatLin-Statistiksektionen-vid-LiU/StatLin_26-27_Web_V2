import { Fragment } from "react";
import { ForHand } from "@/components/content/skrivning";

/** *ord* och **ord**. */
const ACCENT = /\*+([^*]+)\*+/g;
/**
 * _ord_ med understreck vid ordgräns, så att snake_case och adresser med understreck står kvar som de är. Tecknet före kommer med
 * i första gruppen, eftersom äldre Safari inte kan se bakåt i reguljära uttryck.
 */
const HAND = /(^|[^\p{L}\p{N}_])_(?![\s_])([^_\n]*?[^\s_])_(?![\p{L}\p{N}_])/gu;

/** *_ord_* betyder samma sak som _*ord*_: för hand med rödpenna. */
const ROD_HAND = /\*_(?![\s_])([^_\n]*?[^\s_])_\*/g;

type Bit = { hand: boolean; s: string; rod?: boolean };

/** Raden uppdelad i vanlig text och det som står _för hand_, med rödpenna när det står inom stjärnor. */
function bitar(text: string): Bit[] {
  const rad = text.replace(ROD_HAND, "_*$1*_");
  const ut: Bit[] = [];
  let i = 0;
  for (const m of rad.matchAll(HAND)) {
    const start = m.index + m[1].length;
    if (start > i) ut.push({ hand: false, s: rad.slice(i, start) });
    ut.push({ hand: true, s: m[2].replace(ACCENT, "$1"), rod: /\*[^*]+\*/.test(m[2]) });
    i = m.index + m[0].length;
  }
  if (i < rad.length) ut.push({ hand: false, s: rad.slice(i) });
  return ut;
}

/** En rad som bara är _för hand_ står för sig, som en anteckning under texten. */
const egenRad = (b: Bit[]) => b.length === 1 && b[0].hand;

/**
 * Text från adminpanelen där *ord* får accentstil, _ord_ skrivs för hand (_*ord*_ med rödpenna) och radbrytningar behålls. Den som skriver **ord** för
 * fetstil får samma sak som *ord*, så att stjärnorna aldrig syns på sajten. Används för redigerbara rubriker och texter, t.ex. hero
 * och "Om sektionen" på startsidan. stilla visar handskriften direkt (redigeringsläget), och plats är för osynliga kopior som bara
 * håller platsen (se ForHand).
 */
export function AccentText({
  text,
  accentClassName = "mono-accent text-red",
  stilla,
  plats,
}: {
  text: string;
  accentClassName?: string;
  stilla?: boolean;
  plats?: boolean;
}) {
  const rader = text
    .trim()
    .split(/\r?\n/)
    .map((rad) => {
      const b = bitar(rad.trim());
      return egenRad(b) ? b : bitar(rad);
    });
  return (
    <>
      {rader.map((b, i) => (
        <Fragment key={i}>
          {i > 0 && !egenRad(b) && !egenRad(rader[i - 1]) && <br />}
          {b.map((bit, j) =>
            bit.hand ? (
              <ForHand key={j} text={bit.s} rad={egenRad(b)} rod={bit.rod} stilla={stilla} plats={plats} />
            ) : (
              <Fragment key={j}>
                {bit.s.split(ACCENT).map((part, k) =>
                  k % 2 === 1 ? (
                    <span key={k} className={accentClassName}>
                      {part}
                    </span>
                  ) : (
                    part
                  ),
                )}
              </Fragment>
            ),
          )}
        </Fragment>
      ))}
    </>
  );
}

/** Samma text utan markeringar, för title-taggar och skärmläsare. */
export function stripAccent(text: string): string {
  return text.replace(ACCENT, "$1").replace(HAND, "$1$2").replace(/\s*\r?\n\s*/g, " ").trim();
}
