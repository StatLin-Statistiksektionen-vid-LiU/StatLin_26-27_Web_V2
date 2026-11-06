import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AdminHeader } from "@/components/admin/ui";
import { Edit } from "@/components/icons";
import { isEditor } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { listCommittees } from "@/lib/data/content";

export const metadata = { title: "Utskott" };

export default function AdminCommittees() {
  return (
    <Suspense>
      <Committees />
    </Suspense>
  );
}

async function Committees() {
  const user = await requireUser();
  if (!isEditor(user)) redirect(user.committee_id ? `/admin/utskott/${user.committee_id}` : "/admin");
  const committees = await listCommittees();
  return (
    <>
      <AdminHeader title="Utskott" description="Beskrivningar, loggor, kontaktuppgifter och färger för styrelsen och utskotten." />
      {/* grid-cols-1 också på telefonen: utan den blir kolumnen lika bred som det längsta namnet och sidan går att dra i sidled vid 320 pixlar. */}
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {committees.map((c) => (
          <li key={c.id}>
            <Link href={`/admin/utskott/${c.id}`} className="group flex items-center gap-4 rounded-[1.5rem] border border-ink/10 bg-white p-4 transition-colors hover:border-ink/30">
              {c.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.logo_url} alt="" className="size-14 shrink-0 object-contain" />
              )}
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-bold">
                  {c.short_name}
                  {!c.visible && <span className="chip bg-ink/[0.07] text-ink/60">Dold</span>}
                </span>
                <span className="block truncate text-sm text-stone">{c.name}</span>
              </span>
              <Edit size={16} className="text-stone group-hover:text-ink" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
