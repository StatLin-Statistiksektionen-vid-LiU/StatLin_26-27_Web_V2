import Link from "next/link";
import { effectiveStatus, MONTHS, MONTHS_SHORT, itemTerm, termOfMonth, wheelAngle, type Term, type WheelItem, type WheelState, type WheelStatus } from "@/lib/arshjul";
import { cn } from "@/lib/utils";

const C = 320;
const point = (r: number, deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return { x: +(C + r * Math.sin(rad)).toFixed(2), y: +(C - r * Math.cos(rad)).toFixed(2) };
};
const arc = (r: number, from: number, to: number) => {
  const a = point(r, from);
  const b = point(r, to);
  return `M${a.x} ${a.y}A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${b.x} ${b.y}`;
};
const wedge = (outer: number, inner: number, from: number, to: number) => {
  const a = point(outer, from);
  const b = point(outer, to);
  const c = point(inner, to);
  const d = point(inner, from);
  return `M${a.x} ${a.y}A${outer} ${outer} 0 0 1 ${b.x} ${b.y}L${c.x} ${c.y}A${inner} ${inner} 0 0 0 ${d.x} ${d.y}Z`;
};

/** Skalan: ett streck per dag, längre vid varje månadsskifte. En enda path, så att hjulet inte blir hundratals element. */
function scalePath(year: number, springYear: number) {
  let d = "";
  for (let m = 0; m < 12; m++) {
    const days = new Date(Date.UTC(m < 6 ? springYear : year, m + 1, 0)).getUTCDate();
    for (let day = 0; day < days; day++) {
      const deg = (m + day / days) * 30;
      const a = point(day === 0 ? 268 : 276, deg);
      const b = point(284, deg);
      d += `M${a.x} ${a.y}L${b.x} ${b.y}`;
    }
  }
  return d;
}

const ROWS = [
  { r: 210, count: 5 },
  { r: 189, count: 4 },
  { r: 168, count: 4 },
];
const MONTH_CAPACITY = ROWS.reduce((n, row) => n + row.count, 0);

/** Var punkt nummer i hamnar i månadens segment: raderna fylls utifrån och in, centrerade i segmentet. */
function dotPosition(index: number, total: number, midDeg: number) {
  let left = index;
  let remaining = total;
  for (const row of ROWS) {
    const onRow = Math.min(row.count, remaining);
    if (left < onRow) {
      const spread = 21 * (360 / (2 * Math.PI * row.r));
      return point(row.r, midDeg + (left - (onRow - 1) / 2) * spread);
    }
    left -= onRow;
    remaining -= onRow;
  }
  return point(ROWS[0].r, midDeg);
}

/** Markeringen för en punkt. Formen säger läget: fylld är öppen, ring med prick planerad, tom ring klar. Beror den på andra blir den en romb. */
function Mark({ x, y, status, diamond, tone }: { x: number; y: number; status: WheelStatus; diamond: boolean; tone: "paper" | "ink" }) {
  const stroke = tone === "ink" ? "stroke-ink" : "stroke-paper";
  const fill = tone === "ink" ? "fill-ink" : "fill-paper";
  const size = 6;
  const shape = (cls: string, s: number) =>
    diamond ? <path d={`M${x} ${y - s}L${x + s} ${y}L${x} ${y + s}L${x - s} ${y}Z`} className={cls} /> : <circle cx={x} cy={y} r={s - 0.5} className={cls} />;
  if (status === "oppen") return shape(fill, size);
  if (status === "planerad")
    return (
      <>
        {shape(cn("fill-none stroke-[1.5]", stroke), size)}
        {shape(fill, 2.5)}
      </>
    );
  return <g className={status === "hoppad" ? "opacity-40" : "opacity-70"}>{shape(cn("fill-none stroke-[1.5]", stroke), size)}</g>;
}

export function WheelLegend() {
  const row = (label: string, status: WheelStatus, diamond = false) => (
    <li className="flex items-center gap-1.5">
      <svg viewBox="-8 -8 16 16" className="size-3.5 shrink-0" aria-hidden>
        <Mark x={0} y={0} status={status} diamond={diamond} tone="paper" />
      </svg>
      {label}
    </li>
  );
  return (
    <ul className="kicker mt-5 flex flex-wrap justify-center gap-x-4 gap-y-2 text-[0.62rem] text-white/60">
      {row("Öppen", "oppen")}
      {row("Planerad", "planerad")}
      {row("Klar", "klar")}
      {row("Beror på andra", "oppen", true)}
      <li>Innersta ringen: ingen bestämd månad</li>
    </ul>
  );
}

/**
 * Hjulet: tolv segment som länkar till sin månad, så att det fungerar med tangentbord och utan JavaScript. Rött används bara till
 * nu-markeringen. Listan bredvid är den fullständiga vägen, så hjulets markeringar är dolda för skärmläsare.
 */
export function WheelDial({
  items,
  stateOf,
  year,
  vtYear,
  today,
  selected,
  href,
}: {
  items: WheelItem[];
  stateOf: (itemId: number, year: number) => WheelState | undefined;
  year: number;
  /** Året för vårens halva. På hösten är det nästa år, eftersom hjulet då visar våren efter nyår. */
  vtYear?: number;
  today: string;
  selected: number | null;
  href: (month: number | null) => string;
}) {
  const springYear = vtYear ?? year;
  const thisYear = Number(today.slice(0, 4)) === year;
  const currentMonth = thisYear ? Number(today.slice(5, 7)) : null;
  const currentTerm: Term | null = currentMonth ? termOfMonth(currentMonth) : null;
  const hand = thisYear ? wheelAngle(today) : null;
  const statusOf = (item: WheelItem) => effectiveStatus(stateOf(item.id, itemTerm(item) === "vt" ? springYear : year));
  const termOnly = (term: Term) => items.filter((i) => i.month === null && itemTerm(i) === term);
  const inSelected = selected !== null ? items.filter((i) => i.month === selected).length : 0;

  return (
    <svg viewBox="0 0 640 640" role="group" aria-label={`Årshjulet ${springYear === year ? year : `hösten ${year} och våren ${springYear}`}. Välj en månad för att visa dess punkter i listan.`} className="block w-full select-none">
      <defs>
        <path id="hjul-vt" d={arc(295, 4, 176)} />
        <path id="hjul-ht" d={arc(295, 184, 356)} />
      </defs>

      {/* Terminerna */}
      <g aria-hidden>
        {(["vt", "ht"] as const).map((term) => (
          <g key={term}>
            <path d={wedge(312, 284, term === "vt" ? 1 : 181, term === "vt" ? 179 : 359)} className={currentTerm === term ? "fill-white/[0.16]" : "fill-white/[0.06]"} />
            <text className="fill-paper font-mono text-[15px] font-medium tracking-[0.24em]">
              <textPath href={`#hjul-${term}`} startOffset="50%" textAnchor="middle">
                {term === "vt" ? `VT ${springYear} · JAN–JUN` : `HT ${year} · JUL–DEC`}
              </textPath>
            </text>
          </g>
        ))}
        <path d={scalePath(year, springYear)} className="fill-none stroke-paper/35 stroke-[1]" />
      </g>

      {/* Månaderna */}
      {MONTHS.map((name, i) => {
        const month = i + 1;
        const from = i * 30;
        const mid = from + 15;
        const monthItems = items.filter((it) => it.month === month);
        const isSelected = selected === month;
        const isCurrent = currentMonth === month;
        const label = point(246, mid);
        const shown = monthItems.slice(0, MONTH_CAPACITY);
        const hidden = monthItems.length - shown.length;
        return (
          <Link
            key={month}
            href={href(isSelected ? null : month)}
            scroll={false}
            aria-label={`${name}, ${monthItems.length === 1 ? "1 punkt" : `${monthItems.length} punkter`}${isCurrent ? ", innevarande månad" : ""}`}
            aria-current={isSelected ? "true" : undefined}
            className="group/manad outline-none"
          >
            <path
              d={wedge(268, 148, from + 0.4, from + 29.6)}
              className={cn(
                "transition-colors motion-reduce:transition-none",
                isSelected ? "fill-paper" : isCurrent ? "fill-white/[0.14] group-hover/manad:fill-white/[0.22]" : "fill-white/[0.05] group-hover/manad:fill-white/[0.14]",
              )}
            />
            {/* Fokusringen ligger innanför segmentet och byter färg med det, så att den syns också på den valda månaden. */}
            <path d={wedge(262, 154, from + 1.6, from + 28.4)} className={cn("fill-none stroke-[2.5] opacity-0 group-focus-visible/manad:opacity-100", isSelected ? "stroke-ink" : "stroke-paper")} />
            <text
              x={label.x}
              y={label.y}
              textAnchor="middle"
              dominantBaseline="central"
              className={cn("font-mono text-[19px] uppercase tracking-[0.08em]", isSelected ? "fill-ink font-bold" : isCurrent ? "fill-white font-bold" : "fill-paper/75 font-medium")}
            >
              {MONTHS_SHORT[i]}
            </text>
            <g aria-hidden>
              {shown.map((it, n) => {
                const at = dotPosition(n, shown.length, mid);
                return <Mark key={it.id} x={at.x} y={at.y} status={statusOf(it)} diamond={!!it.depends_on} tone={isSelected ? "ink" : "paper"} />;
              })}
              {hidden > 0 && (
                <text x={point(155, mid).x} y={point(155, mid).y} textAnchor="middle" dominantBaseline="central" className={cn("font-mono text-[12px]", isSelected ? "fill-ink" : "fill-paper/70")}>
                  +{hidden}
                </text>
              )}
            </g>
          </Link>
        );
      })}

      {/* Punkter som saknar månad ligger i en inre ring, på sin termins halva */}
      <g aria-hidden>
        <circle cx={C} cy={C} r={146} className="fill-none stroke-paper/15 stroke-[1]" />
        {(["vt", "ht"] as const).map((term) => {
          const list = termOnly(term).slice(0, 24);
          const start = term === "vt" ? 0 : 180;
          return list.map((it, n) => {
            const at = point(130, start + ((n + 1) * 180) / (list.length + 1));
            return <Mark key={it.id} x={at.x} y={at.y} status={statusOf(it)} diamond={!!it.depends_on} tone="paper" />;
          });
        })}
      </g>

      {/* Navet */}
      <g aria-hidden>
        <circle cx={C} cy={C} r={112} className="fill-ink-3 stroke-paper/25 stroke-[1]" />
        {selected !== null ? (
          <>
            <text x={C} y={C - 12} textAnchor="middle" dominantBaseline="central" className="fill-paper font-mono text-[26px] font-bold uppercase tracking-[0.04em]">
              {MONTHS_SHORT[selected - 1]}
            </text>
            <text x={C} y={C + 26} textAnchor="middle" dominantBaseline="central" className="fill-paper/70 font-mono text-[15px] tracking-[0.1em]">
              {inSelected === 1 ? "1 PUNKT" : `${inSelected} PUNKTER`}
            </text>
          </>
        ) : thisYear ? (
          <>
            <text x={C} y={C - 16} textAnchor="middle" dominantBaseline="central" className="fill-paper font-mono text-[62px] font-bold tracking-[-0.04em] tabular-nums">
              {today.slice(8, 10)}
            </text>
            <text x={C} y={C + 34} textAnchor="middle" dominantBaseline="central" className="fill-paper/70 font-mono text-[17px] uppercase tracking-[0.24em]">
              {MONTHS_SHORT[Number(today.slice(5, 7)) - 1]} {year}
            </text>
          </>
        ) : (
          <text x={C} y={C} textAnchor="middle" dominantBaseline="central" className="fill-paper font-mono text-[48px] font-bold tracking-[-0.04em] tabular-nums">
            {year}
          </text>
        )}
      </g>

      {/* Visaren för i dag */}
      {hand !== null && (
        <g aria-hidden className="pointer-events-none">
          <line x1={point(112, hand).x} y1={point(112, hand).y} x2={point(306, hand).x} y2={point(306, hand).y} className="stroke-red stroke-[2.5]" strokeLinecap="round" />
          <circle cx={point(306, hand).x} cy={point(306, hand).y} r={6} className="fill-red" />
          <circle cx={point(112, hand).x} cy={point(112, hand).y} r={3.5} className="fill-red" />
        </g>
      )}
    </svg>
  );
}
