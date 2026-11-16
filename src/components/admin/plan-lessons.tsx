import Link from "next/link";
import type { PlanLessons } from "@/lib/data/arshjul";
import { formatDate } from "@/lib/dates";

/** Det förra årets post skrev till den här. Visas när nästa plan skapas från samma årshjulspunkt, och på planen själv. */
export function LessonsPanel({ lessons }: { lessons: PlanLessons[] }) {
  if (lessons.length === 0) return null;
  return (
    <section aria-labelledby="lardomar-tidigare" className="mb-6 rounded-[1.5rem] bg-ink p-5 text-paper md:p-6">
      <h2 id="lardomar-tidigare" className="kicker text-paper/70">
        Lärdomar från tidigare år
      </h2>
      <ul className="mt-3 space-y-4">
        {lessons.map((l) => (
          <li key={l.id}>
            <p className="whitespace-pre-line leading-relaxed">{l.lessons}</p>
            <Link href={`/admin/projektplaner/${l.id}`} className="mt-1 inline-block font-mono text-[0.72rem] text-paper/70 underline hover:text-paper">
              {l.title}, {formatDate(l.plan_date, true)}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
