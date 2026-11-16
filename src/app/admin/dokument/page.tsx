import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DocumentForm } from "@/components/admin/document-form";
import { AdminHeader, JumpToForm, Notice, StatusBadge } from "@/components/admin/ui";
import { Edit, FileText } from "@/components/icons";
import { canManageDocuments, isEditor } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { listDocuments } from "@/lib/data/content";
import { formatDate } from "@/lib/dates";
import { DOCUMENT_CATEGORIES } from "@/lib/types";

export const metadata = { title: "Dokument" };

export default function AdminDocuments(props: PageProps<"/admin/dokument">) {
  return (
    <Suspense>
      <Documents searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Documents({ searchParams }: { searchParams: PageProps<"/admin/dokument">["searchParams"] }) {
  const user = await requireUser();
  if (!canManageDocuments(user)) redirect("/admin?nekad=1");
  const [all, sp] = await Promise.all([listDocuments(), searchParams]);
  // Grafiskt ansvarig ser och lägger upp bara det grafiska materialet.
  const editor = isEditor(user);
  const docs = editor ? all : all.filter((d) => d.category === "grafiskt");
  return (
    <>
      {sp.sparad && <Notice>Dokumentet är tillagt.</Notice>}
      {sp.raderad && <Notice>Dokumentet är borttaget.</Notice>}
      {sp.nekad && <Notice tone="warning">Du har inte behörighet till det dokumentet.</Notice>}
      <AdminHeader
        title="Dokument"
        description={
          editor
            ? "Stadgar, reglemente, protokoll och annat som ska finnas tillgängligt för medlemmarna."
            : "Mallar och material till den grafiska profilen. De visas under Mallar och material på sidan Grafisk profil."
        }
        actions={docs.length > 0 && <JumpToForm href="#nytt-dokument">Nytt dokument</JumpToForm>}
      />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ul className="divide-y divide-ink/10 overflow-hidden rounded-[1.5rem] border border-ink/10 bg-white">
            {docs.length === 0 && <li className="p-6 text-sm text-stone">Inga dokument ännu.</li>}
            {docs.map((d) => (
              <li key={d.id} className="flex items-center gap-4 px-5 py-4">
                <FileText size={20} className="shrink-0 text-red" />
                <Link href={`/admin/dokument/${d.id}`} className="min-w-0 flex-1">
                  {/* På telefon tar statusen halva raden, och en avkortad titel lämnade bara några bokstäver kvar. */}
                  <span className="block font-semibold [overflow-wrap:anywhere] sm:truncate">{d.title}</span>
                  <span className="block text-xs text-stone">
                    {DOCUMENT_CATEGORIES[d.category]} {d.doc_date && `· ${formatDate(d.doc_date, true)}`}
                  </span>
                </Link>
                <StatusBadge published={!!d.published} />
                <Link href={`/admin/dokument/${d.id}`} className="grid size-9 place-items-center rounded-full hover:bg-paper" aria-label="Redigera">
                  <Edit size={16} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div id="nytt-dokument" className="scroll-mt-24 lg:col-span-2">
          <DocumentForm category={editor ? undefined : "grafiskt"} />
        </div>
      </div>
    </>
  );
}
