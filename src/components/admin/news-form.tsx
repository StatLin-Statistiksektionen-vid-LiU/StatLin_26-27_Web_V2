import { saveNews } from "@/app/admin/_actions/news";
import { ActionForm } from "./action-form";
import { Field, FixedCommittee, FormSection, MoreDetails, Select, TextArea, TextInput, TitleSlugFields, Toggle } from "./fields";
import { ImageField } from "./image-field";
import { MarkdownEditor } from "./markdown-editor";
import { publishButtons } from "./publish-buttons";
import { isoToLocalInput } from "@/lib/dates";
import type { Committee, NewsItem, SessionUser } from "@/lib/types";
import { TEXT_LIMITS } from "@/lib/admin/limits";

export function NewsForm({
  item,
  committees,
  user,
  onSaved,
}: {
  item?: NewsItem | null;
  committees: Committee[];
  user: Pick<SessionUser, "role" | "committee_id">;
  onSaved?: () => void;
}) {
  const locked = user.role === "committee";
  const own = committees.find((c) => c.id === (item?.committee_id ?? user.committee_id));
  const scheduled = !!item && item.published_at > new Date().toISOString();
  return (
    <ActionForm action={saveNews} {...publishButtons(item)} onSuccess={onSaved} version={item?.updated_at}>
      {item && <input type="hidden" name="id" value={item.id} />}
      <div className="grid grid-cols-1 gap-6 @2xl:grid-cols-3">
        <div className="space-y-6 @2xl:col-span-2">
          <FormSection title="Nyheten">
            <TitleSlugFields defaultTitle={item?.title} defaultSlug={item?.slug} basePath="/nyheter" titleLabel="Rubrik" />
            <Field label="Ingress" name="excerpt" hint="Kort sammanfattning som visas i listor och delningar.">
              <TextArea name="excerpt" defaultValue={item?.excerpt} rows={2} maxLength={320} />
            </Field>
            <MarkdownEditor name="body_md" label="Text" defaultValue={item?.body_md} rows={18} max={TEXT_LIMITS.news} />
          </FormSection>

          <MoreDetails summary="Schemalägg publiceringen till en senare tidpunkt." fields={["published_at"]} defaultOpen={scheduled}>
            <Field
              label="Publiceringsdatum"
              name="published_at"
              hint={item?.published ? "Datumet som visas på nyheten. Ett framtida datum schemalägger den." : "Lämna tomt för nu. Ett framtida datum schemalägger nyheten."}
            >
              {/* Ett utkast har inget publiceringsdatum att visa: det sätts när nyheten publiceras, om det inte är schemalagt. */}
              <TextInput type="datetime-local" name="published_at" defaultValue={item?.published || scheduled ? isoToLocalInput(item!.published_at) : ""} />
            </Field>
          </MoreDetails>
        </div>
        <div className="space-y-6">
          <FormSection title="Omslagsbild">
            {/* Ny key när omslaget bytts (sparat här eller någon annanstans), så att fältet glömmer en tidigare ändring. */}
            <ImageField key={item?.cover?.id ?? "ingen"} name="cover_media_id" label="Bild" defaultImage={item?.cover ?? null} />
          </FormSection>
          <FormSection title="Avsändare">
            {locked ? (
              <FixedCommittee label="Utskott" name={own ? `${own.short_name}: ${own.name}` : "Ditt utskott"} hint="Nyheten visas med er logga och på er utskottssida." />
            ) : (
              <>
                <Field label="Utskott" name="committee_id">
                  <Select name="committee_id" defaultValue={String(item?.committee_id ?? user.committee_id ?? "")}>
                    <option value="">Hela sektionen</option>
                    {committees.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.short_name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Toggle name="pinned" label="Fäst högst upp" defaultChecked={!!item?.pinned} hint="Visas först på startsidan och på sidan Nytt." />
              </>
            )}
          </FormSection>
        </div>
      </div>
    </ActionForm>
  );
}
