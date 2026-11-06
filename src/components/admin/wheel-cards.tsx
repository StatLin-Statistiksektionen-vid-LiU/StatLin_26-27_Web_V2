import Link from "next/link";
import type { ReactNode } from "react";
import { fillWheelSuggestions } from "@/app/admin/_actions/arshjul";
import { FillSuggestionsButton } from "@/components/admin/wheel-buttons";
import { WheelItemRow } from "@/components/admin/wheel-item";
import { Wheel } from "@/components/icons";
import { matchesResponsible, MONTHS, TERM_NAMES, wheelCards, type WheelCardItem } from "@/lib/arshjul";
import { canChangeWheelItem } from "@/lib/auth/permissions";
import { listWheelItems, wheelStates } from "@/lib/data/arshjul";
import { todayLocal } from "@/lib/dates";
import type { SessionUser } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Så många punkter står på ett kort. Resten finns i hjulet. */
const CARD_LIMIT = 3;

function WheelCard({
  id,
  title,
  kicker,
  rows,
  user,
  thisYear,
  more,
  empty,
  showPlacement,
}: {
  id: string;
  title: string;
  kicker: string;
  rows: WheelCardItem[];
  user: SessionUser;
  thisYear: number;
  more: string;
  empty: ReactNode;
  showPlacement?: boolean;
}) {
  return (
    <section aria-labelledby={id} className="min-w-0 rounded-[1.5rem] border border-ink/10 bg-paper-2/60 p-3 sm:p-4 md:p-5">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <div className="min-w-0">
          <p className="kicker text-[0.62rem] text-stone">{kicker}</p>
          <h2 id={id} className="mt-0.5 font-bold">
            {title}
          </h2>
        </div>
        {rows.length > 0 && (
          <Link href={more} className="tryck shrink-0 text-sm font-semibold text-red-deep hover:underline">
            {rows.length > CARD_LIMIT ? `Alla ${rows.length}` : "Hjulet"}
          </Link>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-ink/20 px-4 py-6 text-sm text-stone">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {rows.slice(0, CARD_LIMIT).map((r) => (
            <li key={r.item.id}>
              <WheelItemRow compact item={r.item} year={r.year} thisYear={thisYear} state={r.state} status={r.status} canChange={canChangeWheelItem(user, r.item)} late={r.late} showPlacement={showPlacement && r.item.month !== null} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Översiktens två kort från årshjulet. På en sajt utan punkter blir de en enda inbjudan att fylla hjulet. */
export async function WheelCards({ user }: { user: SessionUser }) {
  const today = todayLocal();
  const thisYear = Number(today.slice(0, 4));
  const [items, stateOf] = await Promise.all([listWheelItems(), wheelStates([thisYear, thisYear + 1])]);

  if (items.length === 0) {
    return (
      <section aria-labelledby="arshjul-tomt" className="mt-8 flex flex-col gap-4 rounded-[1.5rem] border border-dashed border-ink/20 bg-white/50 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <Wheel size={28} className="mt-0.5 shrink-0" />
          <div>
            <h2 id="arshjul-tomt" className="font-bold">
              Årshjulet är tomt
            </h2>
            <p className="mt-1 max-w-xl text-sm text-stone">Hjulet visar vad som brukar hända och när, så att nästa års post inte behöver gissa. Börja med förslagen för en studentsektion. Allt går att ändra.</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <FillSuggestionsButton action={fillWheelSuggestions} className="btn btn-ink" />
          <Link href="/admin/arshjul" className="btn btn-ghost bg-white">
            Öppna hjulet
          </Link>
        </div>
      </section>
    );
  }

  const cards = wheelCards(items, stateOf, today);
  const { next, current } = cards;
  // Det som är ens eget står först. Ett utskott ser bara det, och det ingen är ansvarig för: resten finns i hjulet.
  const mine = (r: WheelCardItem) => r.item.owner_user_id === user.id || matchesResponsible(user, r.item.responsible);
  const forUser = (rows: WheelCardItem[]) =>
    user.role === "committee" ? rows.filter((r) => mine(r) || !r.item.responsible.trim()) : [...rows.filter(mine), ...rows.filter((r) => !mine(r))];
  const nextMonth = forUser(cards.nextMonth);
  const toPlan = forUser(cards.toPlan);
  // Ett tomt kort säger inget till ett utskott, som ändå bara ser sitt eget. Redaktörerna ser hela sektionens läge, också när inget väntar.
  const hideEmpty = user.role === "committee";
  if (hideEmpty && nextMonth.length === 0 && toPlan.length === 0) return null;
  const nextName = MONTHS[next.month - 1];
  return (
    <div className={cn("mt-6 grid grid-cols-1 gap-4", (!hideEmpty || (nextMonth.length > 0 && toPlan.length > 0)) && "lg:grid-cols-2")}>
      {(!hideEmpty || nextMonth.length > 0) && <WheelCard
        id="kort-nasta-manad"
        kicker={next.year === thisYear ? nextName : `${nextName} ${next.year}`}
        title="Kommer nästa månad"
        rows={nextMonth}
        user={user}
        thisYear={thisYear}
        // Hjulet utan valt år visar på hösten också våren efter nyår, så januari i december hamnar rätt utan årtal.
        more={`/admin/arshjul?manad=${next.month}`}
        empty={
          <>
            Inget väntar i {nextName.toLowerCase()}.{" "}
            <Link href="/admin/arshjul" className="font-semibold text-ink underline">
              Titta i hjulet
            </Link>{" "}
            om något saknas.
          </>
        }
      />}
      {(!hideEmpty || toPlan.length > 0) && <WheelCard
        id="kort-att-planera"
        kicker={`${TERM_NAMES[current.term]} ${current.year}`}
        title="Att planera in denna termin"
        rows={toPlan}
        user={user}
        thisYear={thisYear}
        more="/admin/arshjul"
        showPlacement
        empty={
          <>
            Allt som beror på andra är planerat.{" "}
            <Link href="/admin/arshjul" className="font-semibold text-ink underline">
              Hela hjulet
            </Link>{" "}
            finns ett klick bort.
          </>
        }
      />}
    </div>
  );
}
