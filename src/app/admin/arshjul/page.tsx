import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { fillWheelSuggestions } from "@/app/admin/_actions/arshjul";
import { AdminHeader, EmptyState, Notice } from "@/components/admin/ui";
import { FillSuggestionsButton } from "@/components/admin/wheel-buttons";
import { WheelDial, WheelLegend } from "@/components/admin/wheel-dial";
import { WheelItemRow } from "@/components/admin/wheel-item";
import { ScrollChipIntoView, ScrollToListOnFilter } from "@/components/admin/wheel-scroll";
import { ChevronLeft, ChevronRight, Plus } from "@/components/icons";
import { effectiveStatus, itemTerm, matchesResponsible, MONTHS, MONTHS_SHORT, monthParam, TERM_NAMES, termOfMonth, yearInRange, type Term, type WheelItem } from "@/lib/arshjul";
import { WHEEL_SUGGESTIONS } from "@/lib/arshjul-forslag";
import { canChangeWheelItem } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { listWheelItems, wheelStates } from "@/lib/data/arshjul";
import { todayLocal } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata = { title: "Årshjul" };

export default function WheelPage(props: PageProps<"/admin/arshjul">) {
  return (
    <Suspense>
      <Wheel searchParams={props.searchParams} />
    </Suspense>
  );
}

const countLabel = (n: number) => (n === 1 ? "1 punkt" : `${n} punkter`);

/** Det man bläddrar mellan med pilarna: ett kalenderår, eller "nu", som är hjulet utan valt år. */
type View = number | "nu";

async function Wheel({ searchParams }: { searchParams: PageProps<"/admin/arshjul">["searchParams"] }) {
  const user = await requireUser();
  const sp = await searchParams;
  const today = todayLocal();
  const thisYear = Number(today.slice(0, 4));
  const thisMonth = Number(today.slice(5, 7));
  const autumn = termOfMonth(thisMonth) === "ht";
  const requested = typeof sp.ar === "string" && /^\d{4}$/.test(sp.ar) ? Number(sp.ar) : null;
  // På våren är i år och nu samma sak. På hösten är i år ett eget val, för den som vill se hur våren gick.
  const view: View = requested !== null && yearInRange(requested, today) && (autumn || requested !== thisYear) ? requested : "nu";
  const year = view === "nu" ? thisYear : view;
  // På hösten visar hjulet terminen som pågår och våren efter nyår, så att det som ska förberedas före jul syns i tid.
  // Vårens punkter gäller då nästa år, både i listan, på hjulet och när de läggs på tavlan.
  const rolling = view === "nu" && autumn;
  const vtYear = rolling ? year + 1 : year;
  const month = monthParam(sp.manad);
  // Den egna posten eller det egna utskottet, för filtret Bara SCB.
  const ourLabel = user.committee_name?.trim() || user.post.trim();
  const ours = sp.vara === "1" && ourLabel !== "";
  const [allItems, stateOf] = await Promise.all([listWheelItems(), wheelStates(rolling ? [year, vtYear] : [year])]);
  const concernsUs = (i: WheelItem) => i.owner_user_id === user.id || matchesResponsible(user, i.responsible);
  const items = ours ? allItems.filter(concernsUs) : allItems;
  const yearOf = (i: Pick<WheelItem, "month" | "term">) => (itemTerm(i) === "vt" ? vtYear : year);
  const monthYear = (m: number) => (termOfMonth(m) === "vt" ? vtYear : year);

  const views: View[] = autumn ? [thisYear - 1, thisYear, "nu", thisYear + 1] : [thisYear - 1, "nu", thisYear + 1];
  const at = views.indexOf(view);
  const viewLabel = (v: View) => (v === "nu" ? (autumn ? `${thisYear}/${String(thisYear + 1).slice(2)}` : String(thisYear)) : String(v));
  const query = (v: View, m: number | null, onlyOurs = ours) => {
    const q = new URLSearchParams();
    if (v !== "nu") q.set("ar", String(v));
    if (m !== null) q.set("manad", String(m));
    if (onlyOurs) q.set("vara", "1");
    const s = q.toString();
    return s ? `/admin/arshjul?${s}` : "/admin/arshjul";
  };
  const href = (m: number | null) => query(view, m);
  // Filtret följer med till formuläret och tillbaka, så att den som bara ser sitt utskott hamnar där igen efter att ha lagt till något.
  const newHref = (m: number | null) => {
    const q = new URLSearchParams();
    if (m !== null) q.set("manad", String(m));
    if (ours) q.set("vara", "1");
    const s = q.toString();
    return s ? `/admin/arshjul/ny?${s}` : "/admin/arshjul/ny";
  };
  const currentMonth = year === thisYear ? thisMonth : null;

  const allMonths = Array.from({ length: 12 }, (_, i) => i + 1);
  const springMonths = allMonths.filter((m) => termOfMonth(m) === "vt");
  // Månadsknapparna på telefon går i samma ordning som listan: på hösten från juli till juni.
  const chipMonths = rolling ? [...allMonths.filter((m) => termOfMonth(m) === "ht"), ...springMonths] : allMonths;
  // Det som redan varit fälls ihop, så att det aktuella står först. Det är där telefonen börjar. På hösten hör våren till nästa år och står inte här.
  const pastMonths = currentMonth ? allMonths.filter((m) => m < currentMonth && !(rolling && termOfMonth(m) === "vt")) : [];
  const comingMonths = rolling ? allMonths.filter((m) => m >= thisMonth) : allMonths.filter((m) => !pastMonths.includes(m));
  const vtIsPast = !rolling && currentMonth !== null && termOfMonth(currentMonth) === "ht";
  const pastCount = items.filter((i) => (i.month !== null ? pastMonths.includes(i.month) : vtIsPast && itemTerm(i) === "vt")).length;
  // Det som fortfarande är öppet fast månaden har passerat kan ha glömts: antingen blev det av och bockas av, eller så hoppades det över.
  const isLate = (i: WheelItem) => i.month !== null && pastMonths.includes(i.month) && effectiveStatus(stateOf(i.id, yearOf(i))) === "oppen";
  const pastOpen = items.filter(isLate).length;

  const row = (item: WheelItem) => {
    const itemYear = yearOf(item);
    const state = stateOf(item.id, itemYear);
    return (
      <li key={item.id}>
        <WheelItemRow item={item} year={itemYear} thisYear={thisYear} state={state} status={effectiveStatus(state)} canChange={canChangeWheelItem(user, item)} late={isLate(item)} />
      </li>
    );
  };
  const group = (key: string, heading: ReactNode, list: WheelItem[], now = false, add?: { href: string; label: string }) =>
    list.length > 0 && (
      <section key={key} aria-labelledby={`grupp-${key}`} className="mt-6 first:mt-0">
        <div className="flex items-center gap-2">
          <h2 id={`grupp-${key}`} className="kicker flex min-w-0 flex-1 items-center gap-2 text-ink">
            {now && <span className="size-2 rounded-full bg-red" aria-hidden />}
            {heading}
            {now && <span className="text-stone">· Nu</span>}
            <span className="ml-auto text-stone tabular">{list.length}</span>
          </h2>
          {/* En punkt till i samma månad, utan att behöva leta upp knappen överst. */}
          {add && (
            <Link href={add.href} aria-label={add.label} className="-my-1 grid size-7 shrink-0 place-items-center rounded-full text-stone hover:bg-ink/5 hover:text-ink pointer-coarse:size-11">
              <Plus size={14} />
            </Link>
          )}
        </div>
        <ul className="mt-2.5 space-y-2.5">{list.map(row)}</ul>
      </section>
    );
  // Vårens rubriker får årtalet när våren är nästa år, så att ingen tror att den redan har varit.
  const nextYearSuffix = (term: Term) => (rolling && term === "vt" ? ` ${vtYear}` : "");
  const monthGroup = (m: number) =>
    group(`m${m}`, `${MONTHS[m - 1]}${nextYearSuffix(termOfMonth(m))}`, items.filter((i) => i.month === m), m === currentMonth && monthYear(m) === thisYear, {
      href: newHref(m),
      label: `Ny punkt i ${MONTHS[m - 1].toLowerCase()}`,
    });
  const termGroup = (term: Term) => group(term, `${TERM_NAMES[term]}${nextYearSuffix(term)}, ingen bestämd månad`, items.filter((i) => i.month === null && itemTerm(i) === term));

  const missingSuggestions = WHEEL_SUGGESTIONS.some((s) => !allItems.some((i) => i.seed_key === s.seed_key));
  const filtered = month !== null ? items.filter((i) => i.month === month) : items;
  const scope = month !== null ? ` i ${MONTHS[month - 1].toLowerCase()} ${monthYear(month)}` : rolling ? ` under hösten ${year} och våren ${vtYear}` : ` under ${year}`;

  return (
    <>
      {typeof sp.fylld === "string" && /^\d+$/.test(sp.fylld) && <Notice>{sp.fylld} förslag är inlagda. Allt går att ändra, och det som inte passar tar du bort.</Notice>}
      {sp.sparad && <Notice>Punkten ligger i hjulet.</Notice>}
      {sp.raderad && <Notice>Punkten är borttagen.</Notice>}
      <AdminHeader
        kicker="Alla poster"
        title="Årshjul"
        description="Det som brukar hända under ett år, så att nästa års post ser vad som väntar och när. Nästa år börjar hjulet om."
        actions={
          <>
            {allItems.length > 0 && missingSuggestions && <FillSuggestionsButton action={fillWheelSuggestions} className="btn btn-ghost bg-white" />}
            <Link href={newHref(month)} className="btn btn-red">
              <Plus size={18} /> Ny punkt
            </Link>
          </>
        }
      />
      <ScrollToListOnFilter month={month} target="punkter" />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,30rem)_minmax(0,1fr)]">
        {/* Hjulet: på telefon under listan och mindre, på datorn bredvid den och kvar när listan scrollas. */}
        <div className="order-2 lg:sticky lg:top-6 lg:order-1">
          <div className="mx-auto max-w-[23rem] rounded-[2rem] bg-ink p-4 text-paper sm:p-5 lg:max-w-none [[data-tema=mork]_&]:ring-1 [[data-tema=mork]_&]:ring-white/10 [[data-tema=mork]_&]:[--color-ink:#141413] [[data-tema=mork]_&]:[--color-ink-3:#262522] [[data-tema=mork]_&]:[--color-paper:#f9f8f5] [[data-tema=mork]_&]:[--color-white:#fff]">
            <nav aria-label="Välj år" className="mb-3 flex items-center justify-between">
              <YearLink target={views[at - 1]} href={(v) => query(v, month)} label={(v) => `Föregående, ${viewLabel(v)}`} Icon={ChevronLeft} />
              <p className="font-mono text-sm font-medium tracking-[0.2em] tabular">{viewLabel(view)}</p>
              <YearLink target={views[at + 1]} href={(v) => query(v, month)} label={(v) => `Nästa, ${viewLabel(v)}`} Icon={ChevronRight} />
            </nav>
            <WheelDial items={items} stateOf={stateOf} year={year} vtYear={vtYear} today={today} selected={month} href={href} />
            <WheelLegend />
          </div>
        </div>

        <div id="punkter" className="order-1 min-w-0 scroll-mt-20 lg:order-2">
          {/* Filtret syns för den som har något i hjulet, och alltid när det är på, så att det går att stänga av. */}
          {ourLabel && (ours || allItems.some(concernsUs)) && (
            <nav aria-label="Vems punkter" className="mb-3 flex w-fit max-w-full gap-1 rounded-full border border-ink/15 bg-white p-1">
              <FilterLink href={query(view, month, false)} active={!ours}>
                Hela sektionen
              </FilterLink>
              <FilterLink href={query(view, month, true)} active={ours}>
                Bara {ourLabel}
              </FilterLink>
            </nav>
          )}
          {items.length > 0 && (
            <nav id="manadsval" aria-label="Välj månad" className="relative -mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:hidden">
              <MonthChip href={href(null)} active={month === null} all>
                Alla
              </MonthChip>
              {chipMonths.map((m) => (
                <MonthChip key={m} href={href(m)} active={month === m} now={currentMonth === m}>
                  {MONTHS_SHORT[m - 1]}
                </MonthChip>
              ))}
            </nav>
          )}
          <ScrollChipIntoView target="manadsval" />
          <p role="status" className="mb-4 flex flex-wrap items-center gap-x-3 text-sm text-stone">
            <span>
              {countLabel(filtered.length)}
              {ours && ` för ${ourLabel}`}
              {scope}
            </span>
            {month !== null && (
              <Link href={href(null)} scroll={false} className="tryck font-semibold text-ink underline">
                Visa hela året
              </Link>
            )}
          </p>

          {allItems.length === 0 ? (
            <EmptyState
              title="Hjulet är tomt"
              action={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <FillSuggestionsButton action={fillWheelSuggestions} className="btn btn-ink" />
                  <Link href="/admin/arshjul/ny" className="btn btn-ghost bg-white">
                    <Plus size={18} /> Egen punkt
                  </Link>
                </div>
              }
            >
              Förslagen är det en studentsektion brukar göra under ett år: mottagning, sektionsmöten, val, överlämning, budget, STAR, sittningar och gästföreläsningar. Allt går att ändra efteråt.
            </EmptyState>
          ) : items.length === 0 ? (
            <EmptyState
              title={`Inget för ${ourLabel} ännu`}
              action={
                <Link href={newHref(month)} className="btn btn-ink">
                  <Plus size={18} /> Lägg till en punkt
                </Link>
              }
            >
              Här står det där {ourLabel} är ansvarig och det du själv har lagt in.
            </EmptyState>
          ) : month !== null ? (
            filtered.length === 0 ? (
              <EmptyState
                title={`Inget i ${MONTHS[month - 1].toLowerCase()}`}
                action={
                  <Link href={newHref(month)} className="btn btn-ink">
                    <Plus size={18} /> Lägg till en punkt
                  </Link>
                }
              >
                Brukar något hända då? Lägg in det, så ser nästa års post det också.
              </EmptyState>
            ) : (
              <ul className="space-y-2.5">{filtered.map(row)}</ul>
            )
          ) : (
            <>
              {rolling ? (
                <>
                  {comingMonths.map(monthGroup)}
                  {termGroup("ht")}
                  {springMonths.map(monthGroup)}
                  {termGroup("vt")}
                </>
              ) : (
                <>
                  {comingMonths.map(monthGroup)}
                  {!vtIsPast && termGroup("vt")}
                  {termGroup("ht")}
                </>
              )}
              {pastCount > 0 && (
                <details className="mt-6 rounded-2xl border border-ink/10 bg-white/50 p-4">
                  <summary className="tryck kicker flex cursor-pointer items-center justify-between gap-3 text-ink">
                    {rolling ? "Tidigare i höst" : "Tidigare i år"}
                    <span className="text-stone tabular">
                      {pastOpen > 0 && <span className="text-red-deep">{pastOpen === 1 ? "1 öppen" : `${pastOpen} öppna`} · </span>}
                      {pastCount}
                    </span>
                  </summary>
                  <div className="mt-4">
                    {pastMonths.map(monthGroup)}
                    {vtIsPast && termGroup("vt")}
                  </div>
                </details>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function YearLink({ target, href, label, Icon }: { target: View | undefined; href: (v: View) => string; label: (v: View) => string; Icon: typeof ChevronLeft }) {
  if (target === undefined) return <span className="size-9 pointer-coarse:size-11" aria-hidden />;
  return (
    <Link href={href(target)} scroll={false} aria-label={label(target)} className="grid size-9 place-items-center rounded-full border border-white/15 hover:bg-white/10 pointer-coarse:size-11">
      <Icon size={16} />
    </Link>
  );
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={cn("min-w-0 truncate rounded-full px-3.5 py-1.5 text-sm font-semibold pointer-coarse:py-2.5", active ? "bg-ink text-white" : "text-ink/60 hover:text-ink")}
    >
      {children}
    </Link>
  );
}

function MonthChip({ href, active, now, all, children }: { href: string; active: boolean; now?: boolean; all?: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      data-alla={all ? "" : undefined}
      data-nu={now ? "" : undefined}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 font-mono text-[0.72rem] uppercase tracking-wider pointer-coarse:py-3",
        active ? "border-ink bg-ink text-white" : "border-ink/15 bg-white text-ink/70",
      )}
    >
      {now && <span className="size-1.5 rounded-full bg-red" aria-hidden />}
      {children}
    </Link>
  );
}
