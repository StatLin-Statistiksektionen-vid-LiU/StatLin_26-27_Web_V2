import Link from "next/link";
import { Suspense } from "react";
import { ResourceForm } from "@/components/admin/resource-form";
import { AdminHeader, JumpToForm, Notice } from "@/components/admin/ui";
import { ArrowUpRight, Chain, Edit, FileText, Image as ImageIcon } from "@/components/icons";
import { requireUser } from "@/lib/auth/session";
import { listResources } from "@/lib/data/resources";
import { RESOURCE_CATEGORIES, RESOURCE_PROGRAMS, termLabel } from "@/lib/resources";

export const metadata = { title: "Hjälpmedel" };

export default function AdminResources(props: PageProps<"/admin/hjalpmedel">) {
  return (
    <Suspense>
      <Resources searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Resources({ searchParams }: { searchParams: PageProps<"/admin/hjalpmedel">["searchParams"] }) {
  await requireUser();
  const [resources, sp] = await Promise.all([listResources(), searchParams]);
  return (
    <>
      {sp.sparad && <Notice>Hjälpmedlet är tillagt.</Notice>}
      {sp.raderad && <Notice>Hjälpmedlet är borttaget.</Notice>}
      <AdminHeader
        title="Hjälpmedel"
        description="Fusklappar, GitHub-länkar och annat som hjälper studenterna, per program och termin. Alla poster, i styrelsen och i utskotten, kan lägga upp, ändra och ta bort."
        actions={
          <>
            {resources.length > 0 && <JumpToForm href="#nytt-hjalpmedel">Nytt hjälpmedel</JumpToForm>}
            <Link href="/studenter/hjalpmedel" target="_blank" className="btn btn-ghost btn-sm bg-white">
              Visa sidan <ArrowUpRight size={15} />
            </Link>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ul className="divide-y divide-ink/10 overflow-hidden rounded-[1.5rem] border border-ink/10 bg-white">
            {resources.length === 0 && <li className="p-6 text-sm text-stone">Inga hjälpmedel ännu.</li>}
            {resources.map((r) => {
              const Icon = !r.file ? Chain : r.file.image ? ImageIcon : FileText;
              return (
                <li key={r.id} className="flex items-center gap-4 px-5 py-4">
                  <Icon size={20} className="shrink-0 text-red" />
                  <Link href={`/admin/hjalpmedel/${r.id}`} className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{r.title}</span>
                    <span className="block text-xs text-stone">
                      {RESOURCE_PROGRAMS[r.program]} · {termLabel(r.term)} · {RESOURCE_CATEGORIES[r.category]}
                    </span>
                  </Link>
                  <Link href={`/admin/hjalpmedel/${r.id}`} className="grid size-9 place-items-center rounded-full hover:bg-paper" aria-label="Redigera">
                    <Edit size={16} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
        <div id="nytt-hjalpmedel" className="scroll-mt-24 lg:col-span-2">
          <ResourceForm />
        </div>
      </div>
    </>
  );
}
