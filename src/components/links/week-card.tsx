"use client";

import { useSyncExternalStore } from "react";
import { capitalize, isoWeek, parts, todayLocal } from "@/lib/dates";

const subscribe = () => () => {};

/** Veckonumret – det man oftast letar efter i schemat. Räknas om i webbläsaren, så att det aldrig blir inaktuellt. */
export function WeekCard({ today }: { today: string }) {
  const day = useSyncExternalStore(subscribe, todayLocal, () => today);
  const p = parts(day);
  return (
    <div className="@container flex w-full items-center justify-between gap-6 max-[359px]:gap-2 rounded-2xl border border-line bg-white p-6 md:block md:max-w-xs md:rotate-2 md:p-7">
      <div>
        <p className="kicker text-stone">Vecka</p>
        <p className="mt-2 text-stone md:hidden">
          {capitalize(p.weekday)} {p.day} {p.monthLong}
        </p>
      </div>
      {/* Fast bredd på telefon: annars tar veckonumret mer plats när typsnittet kommer, datumet bryts om och kortet växer. */}
      <p className="display w-[9.5rem] shrink-0 text-right text-[3.5rem] leading-none md:mt-4 md:w-auto md:text-left md:text-[min(5.5rem,34cqi)]">
        <span className="mono-accent normal-case text-red">v.</span>
        {isoWeek(day)}
      </p>
      <p className="mt-4 hidden font-mono text-xs uppercase tracking-[0.12em] text-stone md:block">
        {p.weekday} {p.day} {p.monthLong}
      </p>
    </div>
  );
}
