"use client";

import { useState, type CSSProperties } from "react";
import { formatDateShort, formatDayMonthShort } from "@/lib/dates";
import {
  MIN_RESULTS,
  formatPercent,
  gradeColors,
  mergeGradeOrder,
  passRateByYear,
  primaryModule,
  summarizeModule,
  visibleOccasions,
  type ExamOccasion,
  type ExamStats,
} from "@/lib/exam-stats";
import { cn } from "@/lib/utils";
import "./exam.css";
import { GrafIn } from "./graf-in";
import { GradeDistribution } from "./grade-distribution";
import { PassRateTrend } from "./pass-rate-trend";

/** Så många tillfällen visas innan "Visa alla". Är det bara några få till visas alla direkt. */
const FIRST_ROWS = 12;
const SHOW_ALL_UP_TO = 15;

/** Datum, stapel och andel godkända: samma kolumner i rubrikraden, på årsraderna och på varje tillfälle. */
const ROW = "grid cursor-default grid-cols-[3.5rem_minmax(0,1fr)_5.75rem] items-center gap-3 px-2 py-1.5 sm:grid-cols-[4.5rem_minmax(0,1fr)_7.5rem] sm:px-3";

/** Två tillfällen behövs för att något ska kunna ändras över tid. */
const MIN_TREND_OCCASIONS = 2;

/** Raderna ritas ut uppifrån och ner, men de sista i en lång lista ska inte behöva vänta. */
const MAX_ROW_DELAY = 14;

/** Ungefär så hög är rutan med siffrorna, i pixlar. */
const TIP_ROOM = 190;

/**
 * Kursens statistik: nyckeltal, godkända över tid, betygen de senaste åren och betygen per tentatillfälle
 * som 100 %-staplar, nyast först och samlade per år, med andelen godkända och antalet skrivande bredvid.
 * Hovra eller tabba till en rad för exakta siffror; tabellvyn visar allt utan diagram. Mönstret följer
 * dataviz-skillen: tunna staplar, 2 px mellanrum mellan betygen, teckenförklaring och en tabell som tvilling.
 */
export function ExamChart({ stats, today }: { stats: ExamStats; today: string }) {
  const now = new Date(today);
  const primary = primaryModule(stats, now);
  const modules = stats.modules
    .filter((m) => visibleOccasions(m).length > 0)
    .sort((a, b) => Number(b.code === primary?.code) - Number(a.code === primary?.code));
  const [moduleCode, setModuleCode] = useState(primary?.code ?? modules[0]?.code);
  const [view, setView] = useState<"chart" | "table">("chart");
  const [showAll, setShowAll] = useState(false);
  const [tip, setTip] = useState<{ index: number; place: TipPlace } | null>(null);

  const m = modules.find((x) => x.code === moduleCode) ?? modules[0];
  if (!m) return null;
  const occasions = visibleOccasions(m);
  const hidden = m.occasions.length - occasions.length;
  const collapsible = occasions.length > SHOW_ALL_UP_TO;
  const rows = showAll || !collapsible ? occasions : occasions.slice(0, FIRST_ROWS);
  // Samma färg för ett betyg på alla rader, även på tillfällen där inte alla betyg förekommer.
  const order = mergeGradeOrder(occasions.map((o) => o.grades.map((g) => g.grade)));
  const palette = gradeColors(order).map(temaGra);
  const color = new Map(order.map((g, i) => [g, palette[i]]));
  const summary = summarizeModule(m, now);
  // Kurser som inte getts på tre år visar i stället åren nyckeltalen bygger på.
  const [fromYear, toYear] = summary ? [summary.from.slice(0, 4), summary.to.slice(0, 4)] : ["", ""];
  const period = summary?.recent ? "de senaste tre åren" : fromYear === toYear ? fromYear : `${fromYear}–${toYear}`;
  const active = tip ? rows[tip.index] : null;
  const showTrend = occasions.length >= MIN_TREND_OCCASIONS;
  const yearRates = new Map(passRateByYear(occasions).map((y) => [y.year, y]));
  const groups = rows.reduce<{ year: string; items: { occasion: ExamOccasion; index: number }[] }[]>((all, occasion, index) => {
    const year = occasion.date.slice(0, 4);
    const group = all[all.length - 1];
    if (group?.year === year) group.items.push({ occasion, index });
    else all.push({ year, items: [{ occasion, index }] });
    return all;
  }, []);
  // Staplarna börjar med de underkända, så snittlinjen visar direkt vilka tillfällen som gick sämre än vanligt.
  const failShare = 1 - occasions.reduce((n, o) => n + o.passed, 0) / Math.max(1, occasions.reduce((n, o) => n + o.total, 0));
  const showAverage = occasions.length >= MIN_TREND_OCCASIONS && failShare >= 0.01 && failShare <= 0.99;

  return (
    <div>
      {modules.length > 1 && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Moment">
          {modules.map((x) => (
            <button
              key={x.code}
              type="button"
              aria-pressed={x.code === m.code}
              onClick={() => {
                setModuleCode(x.code);
                setTip(null);
                setShowAll(false);
              }}
              className={cn(
                "h-9 rounded-lg border px-3.5 text-[0.84rem] font-medium transition-colors pointer-coarse:h-10",
                x.code === m.code ? "border-ink bg-ink text-paper" : "border-line bg-white text-ink hover:border-ink/25",
              )}
            >
              {x.title} <span className={cn("ml-1 font-mono text-xs", x.code === m.code ? "text-paper/70" : "text-stone")}>{x.code}</span>
            </button>
          ))}
        </div>
      )}

      {summary && (
        <dl className="mt-8 grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-white lg:grid-cols-4">
          <Tile label="Godkända" value={formatPercent(summary.passRate)} note={period} meter={summary.passRate} className="border-b border-r lg:border-b-0" />
          <Tile label="Skrivningar" value={String(summary.total)} note={period} className="border-b lg:border-b-0 lg:border-r" />
          <Tile label="Vanligaste betyg" value={summary.commonGrade ?? "–"} note={`bland godkända, ${period}`} className="border-r" />
          <Tile
            label="Godkända senast"
            value={formatPercent(summary.latest.passed / summary.latest.total)}
            note={`${formatDateShort(summary.latest.date)}, ${summary.latest.total} skrivande`}
            meter={summary.latest.passed / summary.latest.total}
          />
        </dl>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        {showTrend && (
          <section className="min-w-0 rounded-xl border border-line bg-white p-5 md:p-6 lg:col-span-7">
            <PassRateTrend key={m.code} occasions={occasions} />
          </section>
        )}
        {summary && (
          <section className={cn("flex min-w-0 flex-col rounded-xl border border-line bg-white p-5 md:p-6", showTrend ? "lg:col-span-5" : "lg:col-span-12")}>
            <GradeDistribution key={m.code} grades={summary.grades} color={color} period={period} />
          </section>
        )}
      </div>

      <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="display-tight text-2xl">Betyg per tillfälle</h2>
          <p className="mt-1 text-sm text-stone">
            {m.title} ({m.code}) · nyast först
          </p>
        </div>
        <div className="inline-flex self-start rounded-lg border border-line bg-white p-0.5 sm:self-auto" role="group" aria-label="Visa som">
          {(["chart", "table"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={cn("h-8 rounded-md px-3.5 text-[0.84rem] font-medium transition-colors pointer-coarse:h-10", view === v ? "bg-ink text-paper" : "text-stone hover:text-ink")}
            >
              {v === "chart" ? "Diagram" : "Tabell"}
            </button>
          ))}
        </div>
      </div>

      {/* Teckenförklaring: sämsta betyget till vänster, som i staplarna. */}
      <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-stone" aria-label="Betyg">
        {order.map((g) => (
          <li key={g} className="inline-flex items-center gap-2">
            <span aria-hidden className="h-3 w-3 rounded-[3px]" style={{ background: color.get(g) }} />
            {g}
          </li>
        ))}
      </ul>

      {view === "chart" ? (
        // Med mus försvinner rutan när pekaren lämnar diagrammet. Med touch ligger den kvar tills man trycker någon annanstans.
        <div className="mt-4 rounded-xl border border-line bg-white px-2 py-4 sm:px-3 sm:py-5" onPointerLeave={(e) => e.pointerType !== "touch" && setTip(null)}>
          <div aria-hidden className={cn(ROW, "kicker cursor-auto py-0 pb-1 text-stone")}>
            <span>Datum</span>
            <span className="relative block h-lh">
              {showAverage && (
                <span
                  className={cn("absolute whitespace-nowrap", failShare < 0.14 ? "translate-x-0" : failShare > 0.86 ? "-translate-x-full" : "-translate-x-1/2")}
                  style={{ left: `${failShare * 100}%` }}
                >
                  snitt {formatPercent(failShare)}
                </span>
              )}
            </span>
            <span className="text-right">Godkända</span>
          </div>
          <GrafIn key={m.code} className="relative" lista>
            {showAverage && (
              <div aria-hidden className={cn(ROW, "pointer-events-none absolute inset-0 cursor-auto items-stretch py-0")}>
                <span />
                <span className="relative block">
                  <span className="absolute inset-y-0 border-l border-dashed border-ink/35" style={{ left: `${failShare * 100}%` }} />
                </span>
                <span />
              </div>
            )}
            {groups.map((group) => {
              const rate = yearRates.get(group.year);
              return (
                <section key={group.year} aria-label={group.year} className="[&+section]:mt-3">
                  <h3 className={cn(ROW, "cursor-auto")}>
                    <span className="text-sm font-semibold">{group.year}</span>
                    <span aria-hidden className="block h-px bg-ink/10" />
                    {rate && (
                      <span className="tabular whitespace-nowrap text-right text-sm text-stone">
                        {formatPercent(rate.passed / rate.total)} av {rate.total}
                        <span className="sr-only"> godkända under året</span>
                      </span>
                    )}
                  </h3>
                  <ol>
                    {group.items.map(({ occasion: o, index: i }) => (
                      <li
                        key={`${o.date}-${i}`}
                        tabIndex={0}
                        onPointerEnter={(e) => setTip({ index: i, place: tipPlace(e.currentTarget) })}
                        onFocus={(e) => setTip({ index: i, place: tipPlace(e.currentTarget) })}
                        onBlur={() => setTip(null)}
                        className={cn(
                          ROW,
                          "rounded-xl outline-none transition-colors focus-visible:ring-2 focus-visible:ring-red/50",
                          tip?.index === i ? "bg-paper-2" : "hover:bg-paper-2",
                        )}
                      >
                        <span className="tabular text-[0.8rem] text-stone sm:text-sm">{formatDayMonthShort(o.date)}</span>
                        <Bar occasion={o} color={color} delay={Math.min(i, MAX_ROW_DELAY)} />
                        <span className="tabular whitespace-nowrap text-right text-sm">
                          <span className="font-semibold">{formatPercent(o.passed / o.total)}</span>
                          <span className="text-stone"> av {o.total}</span>
                        </span>
                        <span className="sr-only">
                          {" "}
                          godkända av {o.total} skrivande. {o.grades.map((g) => `${g.grade}: ${g.count}`).join(", ")}.
                        </span>
                      </li>
                    ))}
                  </ol>
                </section>
              );
            })}
            {active && tip && <Tooltip occasion={active} color={color} place={tip.place} />}
          </GrafIn>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full min-w-max text-sm">
            <caption className="sr-only">
              Betyg per tentatillfälle för {m.title} ({m.code})
            </caption>
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="kicker px-4 py-3 font-medium text-stone">
                  Datum
                </th>
                {order.map((g) => (
                  <th key={g} scope="col" className="kicker px-3 py-3 text-right font-medium text-stone">
                    {g}
                  </th>
                ))}
                <th scope="col" className="kicker px-3 py-3 text-right font-medium text-stone">
                  Totalt
                </th>
                <th scope="col" className="kicker px-4 py-3 text-right font-medium text-stone">
                  Godkända
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((o, i) => (
                <tr key={`${o.date}-${i}`}>
                  <th scope="row" className="tabular whitespace-nowrap px-4 py-2.5 text-left font-normal">
                    {formatDateShort(o.date)}
                  </th>
                  {order.map((g) => (
                    <td key={g} className="tabular px-3 py-2.5 text-right">
                      {o.grades.find((x) => x.grade === g)?.count ?? "–"}
                    </td>
                  ))}
                  <td className="tabular px-3 py-2.5 text-right">{o.total}</td>
                  <td className="tabular px-4 py-2.5 text-right font-semibold">{formatPercent(o.passed / o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 text-sm text-stone sm:flex-row sm:items-center sm:justify-between">
        <p>
          Godkända = alla betyg utom U, F och Fx.
          {view === "chart" && showAverage && " Den streckade linjen visar hur stor andel som brukar bli underkänd."}
          {hidden > 0 && ` ${hidden} ${hidden === 1 ? "tillfälle" : "tillfällen"} med färre än ${MIN_RESULTS} resultat visas inte.`}
        </p>
        {collapsible && (
          <button type="button" onClick={() => setShowAll((s) => !s)} className="btn btn-ghost btn-sm self-start sm:self-auto">
            {showAll ? "Visa färre" : `Visa alla ${occasions.length} tillfällen`}
          </button>
        )}
      </div>

      {view === "table" && <YearTable occasions={occasions} caption={`${m.title} (${m.code})`} />}
    </div>
  );
}

/** Siffrorna bakom linjen i "Godkända över tid", nyast först. */
function YearTable({ occasions, caption }: { occasions: ExamOccasion[]; caption: string }) {
  return (
    <div className="mt-10">
      <h3 className="display-tight text-lg">Per år</h3>
      <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-max text-sm">
          <caption className="sr-only">Andel godkända per år för {caption}</caption>
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className="kicker px-4 py-3 font-medium text-stone">
                År
              </th>
              {/* På mobil räcker inte bredden till alla fyra, och Godkända är siffran man kommer hit för. */}
              <th scope="col" className="kicker hidden px-3 py-3 text-right font-medium text-stone sm:table-cell">
                Tillfällen
              </th>
              <th scope="col" className="kicker px-3 py-3 text-right font-medium text-stone">
                Skrivningar
              </th>
              <th scope="col" className="kicker px-4 py-3 text-right font-medium text-stone">
                Godkända
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {passRateByYear(occasions)
              .reverse()
              .map((y) => (
                <tr key={y.year}>
                  <th scope="row" className="tabular px-4 py-2.5 text-left font-normal">
                    {y.year}
                  </th>
                  <td className="tabular hidden px-3 py-2.5 text-right sm:table-cell">{y.occasions}</td>
                  <td className="tabular px-3 py-2.5 text-right">{y.total}</td>
                  <td className="tabular px-4 py-2.5 text-right font-semibold">{formatPercent(y.passed / y.total)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type TipPlace = { top: number } | { bottom: number };

/** Rutan med siffrorna hamnar precis under raden, men vänder uppåt längst ner så att den inte hamnar över texten under diagrammet. */
function tipPlace(row: HTMLElement): TipPlace {
  const list = (row.closest("[data-graf-lista]") as HTMLElement).getBoundingClientRect();
  const box = row.getBoundingClientRect();
  return list.bottom - box.bottom < TIP_ROOM ? { bottom: list.bottom - box.top + 4 } : { top: box.bottom - list.top + 4 };
}

function Tile({ label, value, note, meter, className }: { label: string; value: string; note: string; meter?: number; className?: string }) {
  return (
    <div className={cn("relative border-line p-5 md:p-6", className)}>
      {/* På mobil bryts längre etiketter på två rader – samma höjd på alla gör att värdena hamnar i linje. */}
      <dt className="kicker min-h-[2lh] text-stone sm:min-h-0">{label}</dt>
      <dd className="mt-3 text-[clamp(1.6rem,3vw,2.2rem)] font-semibold leading-none tracking-tight">{value}</dd>
      <dd className="mt-2 text-sm text-stone">{note}</dd>
      {meter !== undefined && (
        <dd aria-hidden className="absolute inset-x-5 bottom-0 h-0.5 bg-ink/[0.07] md:inset-x-6">
          <span className="graf-stapel-ut block h-full bg-ink" style={{ width: `${meter * 100}%` }} />
        </dd>
      )}
    </div>
  );
}

/** En 100 %-stapel: tunn, rak vid baslinjen till vänster och rundad i slutet, 2 px yta mellan betygen. */
function Bar({ occasion, color, delay }: { occasion: ExamOccasion; color: Map<string, string>; delay: number }) {
  return (
    <span aria-hidden className="graf-stapel-ut flex h-3 gap-[2px] overflow-hidden rounded-r-[4px]" style={{ "--i": delay } as CSSProperties}>
      {occasion.grades.map((g) =>
        g.count > 0 ? <span key={g.grade} className="min-w-[2px] basis-0" style={{ flexGrow: g.count, background: color.get(g.grade) }} /> : null,
      )}
    </span>
  );
}

/** Exakta siffror för raden. Värdet först och starkast, betyget efter, med en kort linje i betygets färg. */
function Tooltip({ occasion, color, place }: { occasion: ExamOccasion; color: Map<string, string>; place: TipPlace }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-[4.5rem] z-10 w-56 rounded-xl border border-line bg-white p-4 text-sm shadow-lg sm:left-[6rem]"
      style={place}
    >
      <p className="font-semibold">{formatDateShort(occasion.date)}</p>
      <p className="text-stone">
        {occasion.total} skrivande · {formatPercent(occasion.passed / occasion.total)} godkända
      </p>
      <ul className="mt-3 space-y-1.5">
        {occasion.grades.map((g) => (
          <li key={g.grade} className="flex items-center gap-2.5">
            <span aria-hidden className="h-[3px] w-3 rounded-full" style={{ background: color.get(g.grade) }} />
            <span className="tabular font-semibold">{g.count}</span>
            <span className="tabular text-stone">({formatPercent(g.count / occasion.total)})</span>
            <span className="ml-auto text-stone">{g.grade}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * gradeColors ger fasta gråa för ljus botten som slutar nästan svart. Här blir varje grå samma andel
 * textfärg blandad i ytan, så att skalan vänder i mörkt läge och bästa betyget alltid har textfärgen.
 * Underkänt är rött och lika i båda lägena.
 */
function temaGra(hex: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  if (Math.max(r, g, b) - Math.min(r, g, b) > 24) return hex;
  const andel = Math.round(Math.min(1, Math.max(0, (255 - r) / (255 - 0x1d))) * 100);
  return `color-mix(in oklab, var(--color-ink) ${andel}%, var(--color-white))`;
}
