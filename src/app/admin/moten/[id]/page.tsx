import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { decideItem, deleteMeeting, proposeItem, updateMeeting, withdrawItem } from "@/app/admin/_actions/meetings";
import { ActionForm } from "@/components/admin/action-form";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Field, FormSection, TextArea, TextInput } from "@/components/admin/fields";
import { InlineActionForm } from "@/components/admin/inline-action-form";
import { meetingWhen } from "@/components/admin/meeting-cards";
import { MeetingMoveButtons } from "@/components/admin/meeting-order";
import { AdminHeader, Card, Notice } from "@/components/admin/ui";
import { canManageMeetings } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { getMeeting, isPastMeeting, type MeetingItem } from "@/lib/data/meetings";
import { capitalize, formatTimestamp } from "@/lib/dates";
import { MEETING_ITEM_TITLE_MAX } from "@/lib/meeting-template";

export const metadata = { title: "Dagordning" };

export default function AdminMeeting(props: PageProps<"/admin/moten/[id]">) {
  return (
    <Suspense>
      <MeetingPage params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function MeetingPage({ params, searchParams }: { params: PageProps<"/admin/moten/[id]">["params"]; searchParams: PageProps<"/admin/moten/[id]">["searchParams"] }) {
  const user = await requireUser();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!/^\d+$/.test(id)) notFound();
  const data = await getMeeting(Number(id));
  if (!data) notFound();
  const { meeting: m, items } = data;
  const chair = canManageMeetings(user);
  const past = isPastMeeting(m);
  const agenda = items.filter((i) => i.status === "agenda");
  const waiting = items.filter((i) => i.status === "proposed");
  const declined = items.filter((i) => i.status === "declined");
  const canPropose = chair || !past;

  return (
    <>
      {sp.ny && <Notice>Mötet är inlagt och dagordningen är ifylld från mallen. Alla i portalen ser mötet på översikten.</Notice>}
      <AdminHeader back={{ href: "/admin/moten", label: "Alla möten" }} kicker={past ? "Styrelsemöte som har varit" : "Styrelsemöte"} title={capitalize(meetingWhen(m))} description={m.place || undefined} />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        <div className="min-w-0 space-y-8 lg:col-span-3">
          {m.note && <Card className="whitespace-pre-line p-5 text-sm md:px-6">{m.note}</Card>}

          <section aria-labelledby="dagordning">
            <h2 id="dagordning" className="font-bold">
              Dagordning
            </h2>
            {agenda.length === 0 ? (
              <p className="mt-3 rounded-2xl border border-dashed border-ink/15 px-5 py-4 text-sm text-stone">Inga punkter än.</p>
            ) : (
              <ol className="mt-3 divide-y divide-ink/10 overflow-hidden rounded-[1.5rem] border border-ink/10 bg-white">
                {agenda.map((item, i) => (
                  <li key={item.id} className="flex items-start gap-3 px-4 py-3 sm:gap-4 sm:px-5">
                    <span className="w-9 shrink-0 pt-0.5 text-sm font-semibold tabular text-stone">§ {i + 1}</span>
                    <ItemText item={item} />
                    {chair && (
                      <span className="flex shrink-0 items-center gap-1">
                        <MeetingMoveButtons id={item.id} title={item.title} first={i === 0} last={i === agenda.length - 1} />
                        <Decide id={item.id} decision="declined" label={`Stryk ${item.title}`}>
                          Stryk
                        </Decide>
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section aria-labelledby="forslag">
            <h2 id="forslag" className="font-bold">
              Förslag som väntar
            </h2>
            <p className="mt-0.5 text-sm text-stone">{chair ? "Ta med ett förslag så hamnar det före Övriga frågor. Flytta det sedan med pilarna." : "Ordföranden bestämmer vilka förslag som kommer med."}</p>
            {waiting.length === 0 ? (
              <p className="mt-3 rounded-2xl border border-dashed border-ink/15 px-5 py-4 text-sm text-stone">Inga förslag väntar.</p>
            ) : (
              <ul className="mt-3 divide-y divide-ink/10 overflow-hidden rounded-[1.5rem] border border-ink/10 bg-white">
                {waiting.map((item) => (
                  <li key={item.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-start sm:px-5">
                    <ItemText item={item} when />
                    <span className="flex shrink-0 flex-wrap items-center gap-2">
                      {chair && (
                        <>
                          <Decide id={item.id} decision="agenda" label={`Ta med ${item.title}`} primary>
                            Ta med
                          </Decide>
                          <Decide id={item.id} decision="declined" label={`Avslå ${item.title}`}>
                            Avslå
                          </Decide>
                        </>
                      )}
                      {item.proposed_by === user.id && (
                        <InlineActionForm action={withdrawItem}>
                          <input type="hidden" name="id" value={item.id} />
                          <button type="submit" className="btn btn-ghost btn-sm bg-white" aria-label={`Dra tillbaka ${item.title}`}>
                            Dra tillbaka
                          </button>
                        </InlineActionForm>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {declined.length > 0 && (
            <section aria-labelledby="avslagna">
              <h2 id="avslagna" className="font-bold">
                Avslagna och strukna
              </h2>
              <ul className="mt-3 divide-y divide-ink/10 overflow-hidden rounded-[1.5rem] border border-ink/10 bg-white/60">
                {declined.map((item) => (
                  <li key={item.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:px-5">
                    <ItemText item={item} muted />
                    {chair && (
                      <Decide id={item.id} decision="agenda" label={`Lägg tillbaka ${item.title}`}>
                        Lägg tillbaka
                      </Decide>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="min-w-0 space-y-8 lg:col-span-2">
          {canPropose ? <ProposeForm meetingId={m.id} chair={chair} /> : <Card className="p-5 text-sm text-stone">Mötet har varit, så det går inte att föreslå fler punkter.</Card>}
          {chair && <EditMeeting m={m} />}
        </div>
      </div>
    </>
  );
}

function ItemText({ item, when, muted }: { item: MeetingItem; when?: boolean; muted?: boolean }) {
  const from = item.proposed_by !== null ? `Föreslagen av ${item.proposer ?? "ett borttaget konto"}` : null;
  return (
    <span className="min-w-0 flex-1">
      <span className={muted ? "block break-words font-semibold text-stone line-through decoration-ink/30" : "block break-words font-semibold"}>{item.title}</span>
      {item.description && <span className="mt-0.5 block whitespace-pre-line break-words text-sm text-stone">{item.description}</span>}
      {(from || when) && (
        <span className="mt-0.5 block text-xs text-stone">
          {[from, when ? formatTimestamp(item.created_at) : null].filter(Boolean).join(" · ")}
        </span>
      )}
    </span>
  );
}

/** En knapp som ändrar punktens status: ta med, avslå, stryk eller lägg tillbaka. */
function Decide({ id, decision, label, primary, children }: { id: number; decision: "agenda" | "declined"; label: string; primary?: boolean; children: ReactNode }) {
  return (
    <InlineActionForm action={decideItem}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="decision" value={decision} />
      <button type="submit" className={primary ? "btn btn-red btn-sm" : "btn btn-ghost btn-sm bg-white"} aria-label={label}>
        {children}
      </button>
    </InlineActionForm>
  );
}

function ProposeForm({ meetingId, chair }: { meetingId: number; chair: boolean }) {
  return (
    <div id="foresla" className="scroll-mt-24">
      <ActionForm action={proposeItem} submitLabel={chair ? "Lägg till punkten" : "Skicka förslaget"} stickyFooter={false} resetOnSuccess>
        <input type="hidden" name="meeting_id" value={meetingId} />
        <FormSection
          title={chair ? "Lägg till en punkt" : "Föreslå en punkt"}
          description={chair ? "Din punkt hamnar direkt på dagordningen, före Övriga frågor." : "Ordföranden ser förslaget och bestämmer om det kommer med. Ditt namn står vid förslaget."}
        >
          <Field label="Punkt" name="title" required>
            <TextInput name="title" maxLength={MEETING_ITEM_TITLE_MAX} required />
          </Field>
          <Field label="Beskrivning" name="description" hint="Vad ska styrelsen ta ställning till? Frivilligt.">
            <TextArea name="description" maxLength={1000} rows={3} />
          </Field>
        </FormSection>
      </ActionForm>
    </div>
  );
}

function EditMeeting({ m }: { m: { id: number; starts_at: string; place: string; note: string } }) {
  return (
    <div className="space-y-3">
      <ActionForm action={updateMeeting} submitLabel="Spara mötet" stickyFooter={false}>
        <input type="hidden" name="id" value={m.id} />
        <FormSection title="Ändra mötet">
          <Field label="Dag och tid" name="starts_at" required>
            <TextInput type="datetime-local" name="starts_at" defaultValue={m.starts_at} required />
          </Field>
          <Field label="Plats" name="place">
            <TextInput name="place" defaultValue={m.place} maxLength={200} />
          </Field>
          <Field label="Meddelande" name="note" hint="Syns överst på dagordningen.">
            <TextArea name="note" defaultValue={m.note} maxLength={2000} rows={3} />
          </Field>
        </FormSection>
      </ActionForm>
      <ConfirmButton action={deleteMeeting} id={m.id} message="Ta bort mötet och hela dagordningen, med alla förslag?">
        Ta bort mötet
      </ConfirmButton>
    </div>
  );
}
