import Link from "next/link";
import { ArrowUpRight } from "@/components/icons";
import { getNextMeeting, type Meeting } from "@/lib/data/meetings";
import { capitalize, formatDateLong, parts, relativeDay } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** "Tisdag 10 november kl. 17:15", och året när det inte är i år. */
export function meetingWhen(m: Pick<Meeting, "starts_at">) {
  return `${formatDateLong(m.starts_at)} kl. ${parts(m.starts_at).time}`;
}

export function waitingLabel(n: number) {
  return n === 0 ? "Inga förslag väntar" : n === 1 ? "1 förslag väntar" : `${n} förslag väntar`;
}

/** Datumbrickan, som på översiktens evenemang. */
function DateBadge({ starts_at, strong }: { starts_at: string; strong?: boolean }) {
  const p = parts(starts_at);
  return (
    <span className={cn("flex w-12 shrink-0 flex-col items-center rounded-xl py-1.5 tabular", strong ? "bg-red/[0.08]" : "bg-paper")}>
      <span className="kicker text-[0.55rem] text-red-deep">{p.monthShort}</span>
      <span className="text-lg font-bold leading-none">{p.day}</span>
    </span>
  );
}

/** Notisen på översikten: nästa styrelsemöte, med en länk till dagordningen. Syns bara när ett möte är inlagt. */
export async function NextMeetingNotice() {
  const m = await getNextMeeting();
  if (!m) return null;
  return (
    <Link
      href={`/admin/moten/${m.id}`}
      className="tryck mt-6 flex items-center gap-4 rounded-[1.5rem] border border-red/25 bg-white p-4 transition-colors hover:border-red/50 sm:px-5"
    >
      <DateBadge starts_at={m.starts_at} strong />
      <span className="min-w-0 flex-1">
        <span className="kicker block text-[0.62rem] text-red-deep">Nästa styrelsemöte · {relativeDay(m.starts_at)}</span>
        <span className="mt-0.5 block font-bold">{meetingWhen(m)}</span>
        <span className="block text-sm text-stone">
          {m.place ? `${m.place} · ` : ""}
          {waitingLabel(m.waiting)}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-red-deep">
        <span className="hidden sm:inline">Se dagordningen</span>
        <ArrowUpRight size={16} />
      </span>
    </Link>
  );
}

/** En rad i listan under Möten. Ett möte som har varit visar bara platsen: förslag som väntar spelar ingen roll längre. */
export function MeetingRow({ m, past }: { m: Meeting; past?: boolean }) {
  const meta = past ? m.place : [m.place, waitingLabel(m.waiting)].filter(Boolean).join(" · ");
  return (
    <li>
      <Link href={`/admin/moten/${m.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-paper/60 sm:px-5">
        <DateBadge starts_at={m.starts_at} />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{capitalize(meetingWhen(m))}</span>
          {meta && <span className="block truncate text-xs text-stone">{meta}</span>}
        </span>
        <ArrowUpRight size={16} className="shrink-0 text-stone" />
      </Link>
    </li>
  );
}
