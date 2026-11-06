import { saveEvent } from "@/app/admin/_actions/events";
import { ActionForm } from "./action-form";
import { EndFollowsStart } from "./end-follows-start";
import { Field, FixedCommittee, FormSection, MoreDetails, Select, TextArea, TextInput, TitleSlugFields, Toggle } from "./fields";
import { ImageField } from "./image-field";
import { MarkdownEditor } from "./markdown-editor";
import { publishButtons } from "./publish-buttons";
import type { Committee, EventItem, ImageRef, SessionUser } from "@/lib/types";
import { TEXT_LIMITS } from "@/lib/admin/limits";

export function EventForm({
  event,
  copyOf,
  cover = event?.cover ?? null,
  committees,
  user,
  defaultStart,
  onSaved,
}: {
  event?: EventItem | null;
  /** Ett nytt evenemang som börjar från ett gammalt. Datum, omslag och anmälningslänk gäller det gamla och följer inte med. */
  copyOf?: EventItem | null;
  /** Omslaget i fältet – på redigeringssidan det som senast valts, också med stjärnan i galleriet. */
  cover?: ImageRef | null;
  committees: Committee[];
  user: Pick<SessionUser, "role" | "committee_id">;
  defaultStart: string;
  /** Redigeringspanelen på sajten stänger sig efter en sparning. */
  onSaved?: () => void;
}) {
  const lockedCommittee = user.role === "committee";
  const source = event ?? copyOf;
  const own = committees.find((c) => c.id === (source?.committee_id ?? user.committee_id));
  const hasDetails = !!(source?.ends_at || source?.all_day || source?.location_url || event?.signup_url || source?.price);
  return (
    <ActionForm action={saveEvent} {...publishButtons(event)} onSuccess={onSaved} version={event?.updated_at}>
      {event && <input type="hidden" name="id" value={event.id} />}
      <EndFollowsStart />
      <div className="grid grid-cols-1 gap-6 @2xl:grid-cols-3">
        <div className="space-y-6 @2xl:col-span-2">
          <FormSection title="Evenemanget">
            <TitleSlugFields defaultTitle={source?.title} defaultSlug={event?.slug} basePath="/evenemang" titleMaxLength={140} />
            <div className="grid gap-5 @md:grid-cols-2">
              <Field label="Datum och tid" name="starts_at" required>
                <TextInput type="datetime-local" name="starts_at" defaultValue={event?.starts_at ?? defaultStart} required />
              </Field>
              <Field label="Plats" name="location">
                <TextInput name="location" defaultValue={source?.location} placeholder="Kårallen, Campus Valla" maxLength={160} />
              </Field>
            </div>
            <Field label="Kort sammanfattning" name="summary" hint="Visas på evenemangskort och i delningar. 1–2 meningar.">
              <TextArea name="summary" defaultValue={source?.summary} rows={2} maxLength={300} />
            </Field>
            <MarkdownEditor name="body_md" label="Beskrivning" defaultValue={source?.body_md} max={TEXT_LIMITS.event} />
          </FormSection>

          <MoreDetails
            summary="Sluttid, heldag, kartlänk, anmälan och pris."
            fields={["ends_at", "all_day", "location_url", "signup_url", "price"]}
            defaultOpen={hasDetails}
          >
            <div className="grid gap-5 @md:grid-cols-2">
              <Field label="Slut" name="ends_at" hint="Valfritt. Vid heldag räknas hela slutdagen, oavsett klockslag.">
                <TextInput type="datetime-local" name="ends_at" defaultValue={source?.ends_at ?? ""} />
              </Field>
              <div className="@md:pt-8">
                <Toggle name="all_day" label="Heldag" defaultChecked={!!source?.all_day} hint="Visar inget klockslag." />
              </div>
            </div>
            <Field label="Kartlänk" name="location_url" hint="Lämna tomt för automatisk Google Maps-länk.">
              <TextInput name="location_url" type="url" defaultValue={source?.location_url} placeholder="https://" />
            </Field>
            <div className="grid gap-5 @md:grid-cols-2">
              <Field label="Anmälningslänk" name="signup_url" hint="T.ex. ett Google-formulär.">
                <TextInput name="signup_url" type="url" defaultValue={event?.signup_url} placeholder="https://" />
              </Field>
              <Field label="Pris" name="price">
                <TextInput name="price" defaultValue={source?.price} placeholder="Gratis / 295 kr" maxLength={80} />
              </Field>
            </div>
          </MoreDetails>
        </div>

        <div className="space-y-6">
          <FormSection title="Omslagsbild" description="Utan bild genereras ett omslag i utskottets färger.">
            {/* Ny key när omslaget bytts någon annanstans, så att fältet visar det och glömmer en tidigare ändring. */}
            <ImageField key={cover?.id ?? "ingen"} name="cover_media_id" label="Bild" defaultImage={cover} />
          </FormSection>
          <FormSection title="Arrangör">
            {lockedCommittee ? (
              <FixedCommittee label="Utskott" name={own ? `${own.short_name}: ${own.name}` : "Ditt utskott"} hint="Evenemanget visas på er utskottssida och i kalendern." />
            ) : (
              <Field label="Utskott" name="committee_id">
                <Select name="committee_id" defaultValue={String(source?.committee_id ?? user.committee_id ?? "")}>
                  <option value="">Ingen / hela sektionen</option>
                  {committees.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.short_name}: {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </FormSection>
        </div>
      </div>
    </ActionForm>
  );
}
