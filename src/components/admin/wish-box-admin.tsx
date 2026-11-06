import Link from "next/link";
import { deleteWish, setWishesOpen, setWishHandled } from "@/app/admin/_actions/onskelada";
import { ArrowUpRight, Check } from "@/components/icons";
import type { CommitteeWish } from "@/lib/data/onskelada";
import type { Committee } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MarkWishesSeen } from "./mark-wishes-seen";

const MONTHS = ["januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"];
const monthLabel = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[m - 1] ?? month} ${y}`;
};

/** Önskelådan överst på utskottets sida i portalen: av och på med ett klick, och det som kommit in under. */
export function WishBoxAdmin({ committee, wishes, markSeen }: { committee: Committee; wishes: CommitteeWish[]; markSeen: boolean }) {
  const open = committee.wishes_open;
  const waiting = wishes.filter((w) => !w.handled);
  const handled = wishes.filter((w) => w.handled);
  return (
    <section aria-labelledby="onskelada-rubrik" className="mb-10 rounded-2xl border border-ink/10 bg-white p-5 shadow-[0_10px_26px_-22px_rgb(10_10_10/0.6)] md:p-6">
      {markSeen && <MarkWishesSeen committeeId={committee.id} />}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id="onskelada-rubrik" className="text-lg font-extrabold tracking-tight">
            Önskelåda på er sida
          </h2>
          <p className="mt-1 max-w-prose text-[0.95rem] text-stone">
            {open ? (
              <>
                På. Besökare kan önska något av er utan att skriva vem de är.{" "}
                <Link href={`/utskott/${committee.slug}#onskelada`} target="_blank" className="link-underline inline-flex items-center gap-0.5 font-semibold text-ink">
                  Se lådan <ArrowUpRight size={14} />
                </Link>
              </>
            ) : (
              "Av. Slå på den så får er sida ett formulär där vem som helst kan önska något av er, anonymt."
            )}
          </p>
        </div>
        <form action={setWishesOpen} className="shrink-0">
          <input type="hidden" name="id" value={committee.id} />
          <input type="hidden" name="open" value={open ? "0" : "1"} />
          <button
            type="submit"
            role="switch"
            aria-checked={open}
            aria-label="Önskelåda på er sida"
            className={cn(
              "relative inline-flex h-8 w-14 items-center rounded-full border transition-colors",
              open ? "border-red bg-red" : "border-ink/20 bg-paper-2 hover:border-ink/40",
            )}
          >
            <span
              aria-hidden
              // Knoppen är alltid vit, även i mörkt läge, så att den syns på det mörka spåret när lådan är av.
              className={cn("absolute left-[3px] size-6 rounded-full bg-[#fff] shadow-[0_1px_3px_rgb(0_0_0/0.35)] ring-1 ring-ink/10 transition-transform", open && "translate-x-6")}
            />
          </button>
        </form>
      </div>

      {wishes.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-ink/15 px-4 py-5 text-center text-[0.95rem] text-stone">
          {open ? "Inget önskemål än. När någon skriver dyker det upp här, och du får en siffra i menyn." : "Inga önskemål."}
        </p>
      ) : (
        <>
          {waiting.length > 0 ? (
            <ul className="mt-5 grid gap-3 md:grid-cols-2">
              {waiting.map((w) => (
                <WishItem key={w.id} wish={w} />
              ))}
            </ul>
          ) : (
            <p className="mt-5 text-[0.95rem] font-semibold">Inget nytt. Allt är klart.</p>
          )}
          {handled.length > 0 && (
            <details className="mt-5 border-t border-line pt-4">
              <summary className="cursor-pointer text-sm font-bold">Klara ({handled.length})</summary>
              <ul className="mt-3 grid gap-3 md:grid-cols-2">
                {handled.map((w) => (
                  <WishItem key={w.id} wish={w} />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}

function WishItem({ wish }: { wish: CommitteeWish }) {
  return (
    <li className={cn("flex flex-col rounded-xl border p-4", wish.handled ? "border-transparent bg-paper-2/60" : "border-ink/10 bg-white")}>
      <p className="font-mono text-xs uppercase tracking-wider text-stone">{monthLabel(wish.month)}</p>
      {/* Ren text: React escapar innehållet, och det går aldrig genom markdown. */}
      <p className={cn("mt-2 flex-1 whitespace-pre-wrap break-words leading-relaxed", wish.handled && "text-ink/70")}>{wish.body}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <form action={setWishHandled}>
          <input type="hidden" name="id" value={wish.id} />
          <input type="hidden" name="handled" value={wish.handled ? "0" : "1"} />
          <button type="submit" className="btn btn-sm btn-ghost bg-white">
            {wish.handled ? (
              "Ångra"
            ) : (
              <>
                <Check size={15} /> Klart
              </>
            )}
          </button>
        </form>
        {wish.handled && (
          <form action={deleteWish}>
            <input type="hidden" name="id" value={wish.id} />
            <button type="submit" className="btn btn-sm btn-ghost bg-white">
              Ta bort
            </button>
          </form>
        )}
      </div>
    </li>
  );
}
