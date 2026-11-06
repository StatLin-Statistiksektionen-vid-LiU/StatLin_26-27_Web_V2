import Link from "next/link";
import { Suspense } from "react";
import { deleteBox, setBoxOwner, setFrageladaOpen } from "@/app/admin/_actions/fragelada";
import { ActionForm } from "@/components/admin/action-form";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Field, Select, Toggle } from "@/components/admin/fields";
import { AdminHeader, Card, EmptyState, Notice } from "@/components/admin/ui";
import { Plus } from "@/components/icons";
import { canManageFragelada } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { readDb } from "@/lib/data/db";
import { boxStateLabel, frageladaIsOpen, listBoxOverview, listBoxOwnerCandidates, listOwnBoxes, type BoxOverview } from "@/lib/data/fragelada";
import { todayLocal } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata = { title: "Frågelådan" };

export default function FrageladaAdminPage(props: PageProps<"/admin/fragelada">) {
  return (
    <Suspense>
      <Inbox searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Inbox({ searchParams }: { searchParams: PageProps<"/admin/fragelada">["searchParams"] }) {
  const user = await requireUser();
  const sp = await searchParams;
  const db = await readDb();
  const open = frageladaIsOpen(db);
  const admin = canManageFragelada(user);
  const today = todayLocal();
  const own = await listOwnBoxes(user.id);

  return (
    <>
      {sp.nekad && <Notice tone="warning">Bara kontot som äger lådan kan öppna den.</Notice>}
      {sp.raderad && <Notice>Lådan är borttagen, med alla frågor i den.</Notice>}
      <AdminHeader
        kicker="Anonyma frågor"
        title="Frågelådan"
        description="Skapa en låda, visa koden för dem du vill höra från och läs frågorna här. Lådan är envägs: du kan inte svara, och ingen av oss kan se vem som skrev."
        actions={
          <Link href="/admin/fragelada/ny" className="btn btn-red">
            <Plus size={18} /> Ny låda
          </Link>
        }
      />
      {admin ? <Switch open={open} /> : !open && <Notice tone="info">Frågelådan är inte öppen för besökare än. Du kan förbereda en låda, men ingen kan skriva till den förrän en administratör slår på funktionen.</Notice>}

      <h2 className="kicker mt-10 text-stone">Dina lådor</h2>
      {own.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            title="Du har inga lådor än"
            action={
              <Link href="/admin/fragelada/ny" className="btn btn-ink">
                <Plus size={18} /> Skapa en låda
              </Link>
            }
          >
            Skapa en låda så får du en kod som går att visa i en föreläsningssal.
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-3 grid gap-3 md:grid-cols-2">
          {own.map((b) => {
            const state = boxStateLabel(b, today);
            return (
              <li key={b.id}>
                <Link href={`/admin/fragelada/${b.id}`} className="block rounded-2xl border border-ink/10 bg-white p-5 transition-colors hover:border-ink/40">
                  <span className="flex items-start justify-between gap-3">
                    <span className="font-bold break-words">{b.title}</span>
                    {b.unseen > 0 && <span className="grid min-w-6 place-items-center rounded-full bg-red px-1.5 text-xs font-bold leading-6 text-white tabular">{b.unseen}<span className="sr-only"> olästa</span></span>}
                  </span>
                  <span className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-stone">
                    {b.code && <span className="font-mono font-bold tracking-widest text-ink">{b.code}</span>}
                    <span>{state.label}</span>
                    <span className="tabular">
                      {b.total} {b.total === 1 ? "fråga" : "frågor"}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {admin && <AdminOverview userId={user.id} />}
    </>
  );
}

/** Reglaget. U-04 står i klartext, eftersom det är det enda som hindrar att någon slår på för tidigt. */
function Switch({ open }: { open: boolean }) {
  return (
    <Card className={cn("flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between", open && "border-ink/40")}>
      <div className="min-w-0">
        <p className="text-lg font-bold">{open ? "Frågelådan är på" : "Frågelådan är av"}</p>
        <p className="mt-1 max-w-xl text-[0.95rem] text-stone">
          {open
            ? "Besökare kan skriva till öppna lådor, och länkarna till UBU:s och AMO:s lådor syns på sajten."
            : "Besökare ser att frågelådan öppnar snart, inga länkar syns och inskick nekas."}{" "}
          Slå inte på förrän någon har bekräftat vem som är AMO och att posten läser sin låda (U-04).
        </p>
      </div>
      <form action={setFrageladaOpen} className="shrink-0">
        <input type="hidden" name="open" value={open ? "0" : "1"} />
        <button
          type="submit"
          role="switch"
          aria-checked={open}
          aria-label="Frågelådan öppen för besökare"
          className={cn("relative h-10 w-[4.5rem] rounded-full transition-colors", open ? "bg-ink" : "bg-paper-3")}
        >
          {/* Av är knoppen alltid vit, annars blir den mörk på det mörka spåret i mörkt läge. På följer den temat och blir mörk på det ljusa spåret. */}
          <span aria-hidden className={cn("absolute top-1 size-8 rounded-full shadow transition-[left]", open ? "left-[2.25rem] bg-white" : "left-1 bg-[#fff]")} />
        </button>
      </form>
    </Card>
  );
}

async function AdminOverview({ userId }: { userId: number }) {
  const [boxes, candidates] = await Promise.all([listBoxOverview(), listBoxOwnerCandidates()]);
  const fixed = boxes.filter((b) => b.slug !== null);
  const coded = boxes.filter((b) => b.slug === null);
  return (
    <div className="mt-12">
      <h2 className="text-xl font-extrabold tracking-tight">Alla lådor</h2>
      <p className="mt-1 max-w-2xl text-[0.95rem] text-stone">Du ser bara titlar och antal. Bara kontot som äger en låda kan läsa frågorna i den, och det gäller administratörer också.</p>

      <h3 className="kicker mt-6 text-stone">Fasta lådor</h3>
      <ul className="mt-3 grid gap-3 md:grid-cols-2">
        {fixed.map((b) => (
          <li key={b.id}>
            <FixedBoxCard box={b} candidates={candidates} />
          </li>
        ))}
      </ul>

      <h3 className="kicker mt-8 text-stone">Lådor med kod</h3>
      {coded.length === 0 ? (
        <p className="mt-3 text-stone">Inga lådor med kod än.</p>
      ) : (
        <ul className="mt-3 divide-y divide-ink/10 rounded-2xl border border-ink/10 bg-white">
          {coded.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <p className="font-bold break-words">{b.title}</p>
                <p className="text-sm text-stone">
                  {b.owner_id === userId ? "Din låda" : (b.owner_label ?? "Ingen ägare, tar inte emot frågor")} · <span className="tabular">{b.total}</span> {b.total === 1 ? "fråga" : "frågor"}
                </p>
              </div>
              <ConfirmButton action={deleteBox} id={b.id} message={`Ta bort lådan "${b.title}" och alla ${b.total} frågor i den? Det går inte att ångra.`}>
                Ta bort
              </ConfirmButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FixedBoxCard({ box, candidates }: { box: BoxOverview; candidates: { id: number; label: string }[] }) {
  const name = `owner_id_${box.id}`;
  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-5">
      <p className="font-bold">{box.title}</p>
      <p className="mt-1 text-sm text-stone">
        <span className="font-mono">/fragelada/{box.slug}</span> · <span className="tabular">{box.total}</span> {box.total === 1 ? "fråga" : "frågor"}
      </p>
      {box.owner_id === null && <p className="mt-2 text-sm font-semibold">Ingen ägare än. Lådan tar inte emot frågor förrän den har en.</p>}
      <ActionForm action={setBoxOwner} submitLabel="Spara ägare" stickyFooter={false} className="mt-4 space-y-3">
        <input type="hidden" name="id" value={box.id} />
        <OwnerField name={name} current={box.owner_id} candidates={candidates} />
        {box.total > 0 && <Toggle name="empty_ok" label="Radera frågorna i lådan" hint="Krävs för att byta ägare, så att ingen ny ägare kan läsa det som skrivits till den förra." />}
      </ActionForm>
    </div>
  );
}

function OwnerField({ name, current, candidates }: { name: string; current: number | null; candidates: { id: number; label: string }[] }) {
  return (
    <Field label="Ägare" name={name}>
      <Select name="owner_id" id={name} defaultValue={current === null ? "" : String(current)}>
        <option value="">Ingen ägare</option>
        {candidates.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}
