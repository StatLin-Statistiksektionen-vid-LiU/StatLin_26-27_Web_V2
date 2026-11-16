import Link from "next/link";
import { Suspense } from "react";
import { AdminHeader, EmptyState, Notice, StatusBadge } from "@/components/admin/ui";
import { ArrowUpRight, Edit, Plus } from "@/components/icons";
import { requireUser } from "@/lib/auth/session";
import { listNewsForAdmin } from "@/lib/data/news";
import { formatTimestamp } from "@/lib/dates";

export const metadata = { title: "Nytt" };

export default function AdminNews(props: PageProps<"/admin/nyheter">) {
  return (
    <Suspense>
      <News searchParams={props.searchParams} />
    </Suspense>
  );
}

async function News({ searchParams }: { searchParams: PageProps<"/admin/nyheter">["searchParams"] }) {
  const user = await requireUser();
  const sp = await searchParams;
  const items = await listNewsForAdmin(user.role === "committee" ? user.committee_id : null);
  const now = new Date().toISOString();
  return (
    <>
      {sp.raderad && <Notice>Nyheten är borttagen.</Notice>}
      {sp.nekad && <Notice tone="warning">Du har inte behörighet till den nyheten.</Notice>}
      <AdminHeader
        title="Nytt"
        actions={
          <Link href="/admin/nyheter/ny" className="btn btn-red">
            <Plus size={18} /> Ny nyhet
          </Link>
        }
      />
      {items.length === 0 ? (
        <EmptyState title="Inget nytt ännu" action={<Link href="/admin/nyheter/ny" className="btn btn-ink">Skriv den första</Link>} />
      ) : (
        <ul className="divide-y divide-ink/10 overflow-hidden rounded-[1.5rem] border border-ink/10 bg-white">
          {items.map((n) => (
            <li key={n.id} className="group flex items-center gap-4 px-5 py-4 hover:bg-paper/40">
              <Link href={`/admin/nyheter/${n.id}`} className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  {n.pinned && <span className="chip bg-red text-white">Fäst</span>}
                  <span className="font-semibold group-hover:text-red-deep sm:truncate">{n.title}</span>
                </span>
                <span className="mt-0.5 block text-xs text-stone">
                  {n.committee?.short_name ?? "Sektionen"} · {formatTimestamp(n.published_at)} {n.author_name && `· ${n.author_name}`}
                </span>
              </Link>
              {/* På telefon räcker det att det ovanliga syns: rubriken får platsen. */}
              <span className={!!n.published && n.published_at <= now ? "hidden sm:block" : undefined}>
                <StatusBadge published={!!n.published && n.published_at <= now} label={!n.published ? "Utkast" : n.published_at > now ? "Schemalagd" : "Publicerad"} />
              </span>
              <Link href={`/admin/nyheter/${n.id}`} className="grid size-9 place-items-center rounded-full hover:bg-paper" aria-label="Redigera">
                <Edit size={16} />
              </Link>
              {/* En schemalagd nyhet har ingen sida att visa än. */}
              {!!n.published && n.published_at <= now && (
                <Link href={`/nyheter/${n.slug}`} target="_blank" className="hidden size-9 place-items-center rounded-full hover:bg-paper sm:grid" aria-label="Visa">
                  <ArrowUpRight size={16} />
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
