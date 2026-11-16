import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { MoveButtons } from "@/components/admin/board-controls";
import { AdminHeader, EmptyState, Notice } from "@/components/admin/ui";
import { Avatar } from "@/components/content/avatar";
import { Edit, Plus } from "@/components/icons";
import { isEditor } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { listBoard } from "@/lib/data/content";

export const metadata = { title: "Styrelsen" };

export default function AdminBoard(props: PageProps<"/admin/styrelsen">) {
  return (
    <Suspense>
      <Board searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Board({ searchParams }: { searchParams: PageProps<"/admin/styrelsen">["searchParams"] }) {
  const user = await requireUser();
  if (!isEditor(user)) redirect("/admin?nekad=1");
  const [board, sp] = await Promise.all([listBoard(), searchParams]);
  return (
    <>
      {sp.sparad && <Notice>Posten är tillagd.</Notice>}
      {sp.raderad && <Notice>Posten är borttagen.</Notice>}
      <AdminHeader
        title="Styrelsen"
        description="Poster, namn, porträtt och kontaktuppgifter som visas på sajten. Byt namn och foto när en ny styrelse tillträder."
        actions={
          <Link href="/admin/styrelsen/ny" className="btn btn-red">
            <Plus size={18} /> Lägg till post
          </Link>
        }
      />
      {board.length === 0 ? (
        <EmptyState title="Inga poster ännu">Lägg till styrelsens poster, så visas de på sidan Styrelsen.</EmptyState>
      ) : (
        <ul className="divide-y divide-ink/10 overflow-hidden rounded-[1.5rem] border border-ink/10 bg-white">
          {board.map((m, i) => (
            <li key={m.id} className="flex items-center gap-4 px-4 py-3">
              <MoveButtons id={m.id} name={m.post} first={i === 0} last={i === board.length - 1} />
              <Avatar name={m.name || m.post} seed={`${m.id}-${m.post}`} photo={m.photo} className="size-12 shrink-0 rounded-full [&_span]:text-base" />
              <Link href={`/admin/styrelsen/${m.id}`} className="min-w-0 flex-1">
                <span className="block font-semibold">{m.post}</span>
                <span className="block text-sm text-stone [overflow-wrap:anywhere] sm:truncate">
                  {m.name || "Vakant"} {m.email && `· ${m.email}`}
                </span>
              </Link>
              <Link href={`/admin/styrelsen/${m.id}`} className="grid size-9 place-items-center rounded-full hover:bg-paper" aria-label={`Redigera ${m.post}`}>
                <Edit size={16} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
