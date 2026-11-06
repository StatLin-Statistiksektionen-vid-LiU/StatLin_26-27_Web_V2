import Link from "next/link";
import { Suspense } from "react";
import { createMeeting, saveMeetingTemplate } from "@/app/admin/_actions/meetings";
import { ActionForm } from "@/components/admin/action-form";
import { Field, FormSection, TextArea, TextInput } from "@/components/admin/fields";
import { MeetingRow, meetingWhen, waitingLabel } from "@/components/admin/meeting-cards";
import { AdminHeader, EmptyState, JumpToForm, Notice } from "@/components/admin/ui";
import { ArrowUpRight } from "@/components/icons";
import { canManageMeetings } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/data/content";
import { listMeetings, type Meeting } from "@/lib/data/meetings";
import { addDaysLocal, relativeDay, todayLocal } from "@/lib/dates";
import { parseMeetingTemplate } from "@/lib/meeting-template";

export const metadata = { title: "Möten" };

const countLabel = (n: number) => (n === 1 ? "1 punkt" : `${n} punkter`);

export default function AdminMeetings(props: PageProps<"/admin/moten">) {
  return (
    <Suspense>
      <Meetings searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Meetings({ searchParams }: { searchParams: PageProps<"/admin/moten">["searchParams"] }) {
  const user = await requireUser();
  const chair = canManageMeetings(user);
  const [{ upcoming, past }, settings, sp] = await Promise.all([listMeetings(), getSettings(), searchParams]);
  const [next, ...later] = upcoming;
  return (
    <>
      {sp.raderat && <Notice>Mötet är borttaget.</Notice>}
      <AdminHeader
        title="Styrelsemöten"
        description={
          chair
            ? "Lägg in nästa möte, så får alla i portalen en notis på översikten och kan föreslå punkter. Du bestämmer vad som kommer med på dagordningen."
            : "När styrelsen ska ses och vad som står på dagordningen. Föreslå gärna punkter, så tar ordföranden ställning till dem."
        }
        actions={chair && <JumpToForm href="#nytt-mote">Nytt möte</JumpToForm>}
      />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        <div className="min-w-0 space-y-8 lg:col-span-3">
          {next ? (
            <NextMeeting m={next} />
          ) : (
            <EmptyState title="Inget möte inlagt">{chair ? "Lägg in nästa möte med formuläret, så fylls dagordningen i från mallen." : "Ordföranden har inte lagt in nästa möte än."}</EmptyState>
          )}
          {later.length > 0 && <MeetingSection id="langre-fram" title="Längre fram" meetings={later} />}
          {past.length > 0 && <MeetingSection id="tidigare" title="Tidigare möten" meetings={past} past />}
        </div>
        {chair && (
          <div className="min-w-0 space-y-8 lg:col-span-2">
            <div id="nytt-mote" className="scroll-mt-24">
              <ActionForm action={createMeeting} submitLabel="Lägg in mötet" stickyFooter={false}>
                <FormSection title="Nytt möte" description="Dagordningen fylls i från mallen nedanför. Du kan ändra den på mötets sida.">
                  <Field label="Dag och tid" name="starts_at" required>
                    <TextInput type="datetime-local" name="starts_at" defaultValue={addDaysLocal(`${todayLocal()}T17:15`, 7)} required />
                  </Field>
                  <Field label="Plats" name="place" hint="Till exempel sektionsrummet eller en länk till mötet.">
                    <TextInput name="place" maxLength={200} />
                  </Field>
                  <Field label="Meddelande" name="note" hint="Syns överst på dagordningen. Frivilligt.">
                    <TextArea name="note" maxLength={2000} rows={3} />
                  </Field>
                </FormSection>
              </ActionForm>
            </div>
            <div id="mall" className="scroll-mt-24">
              <ActionForm action={saveMeetingTemplate} submitLabel="Spara mallen" stickyFooter={false}>
                <FormSection title="Dagordningsmall" description="Punkterna som varje nytt möte börjar med, en per rad. Möten som redan är inlagda ändras inte.">
                  <Field label="Punkter" name="meeting_template" hint={`${countLabel(parseMeetingTemplate(settings.meeting_template).length)}. Sidan numrerar dem själv.`}>
                    <TextArea name="meeting_template" defaultValue={settings.meeting_template} rows={13} maxLength={6000} />
                  </Field>
                </FormSection>
              </ActionForm>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function NextMeeting({ m }: { m: Meeting }) {
  return (
    <section aria-labelledby="nasta-mote" className="rounded-[1.5rem] border border-red/25 bg-white p-5 md:p-6">
      <p className="kicker text-[0.62rem] text-red-deep">Nästa möte · {relativeDay(m.starts_at)}</p>
      <h2 id="nasta-mote" className="mt-1 text-xl font-bold">
        {meetingWhen(m)}
      </h2>
      <p className="mt-1 text-sm text-stone">{[m.place, waitingLabel(m.waiting)].filter(Boolean).join(" · ")}</p>
      {m.note && <p className="mt-3 whitespace-pre-line text-sm">{m.note}</p>}
      <Link href={`/admin/moten/${m.id}`} className="btn btn-red btn-sm mt-4 gap-1.5">
        Se dagordningen <ArrowUpRight size={15} />
      </Link>
    </section>
  );
}

function MeetingSection({ id, title, meetings, past }: { id: string; title: string; meetings: Meeting[]; past?: boolean }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="font-bold">
        {title}
      </h2>
      <ul className="mt-3 divide-y divide-ink/10 overflow-hidden rounded-[1.5rem] border border-ink/10 bg-white">
        {meetings.map((m) => (
          <MeetingRow key={m.id} m={m} past={past} />
        ))}
      </ul>
    </section>
  );
}
