import { savePartner } from "@/app/admin/_actions/content";
import { ActionForm } from "./action-form";
import { Field, FormSection, Select, TextInput, Toggle } from "./fields";
import { ImageField } from "./image-field";
import type { Partner } from "@/lib/types";

/** En ny sponsor hamnar sist på sitt ställe och syns direkt. Ordningen ändras med pilarna i listan, eller med talet när sponsorn finns. */
export function PartnerForm({ partner, nextOrder = 0 }: { partner?: Partner | null; nextOrder?: number }) {
  return (
    <ActionForm action={savePartner} submitLabel={partner ? "Spara" : "Lägg till sponsor"} stickyFooter={false}>
      {partner && <input type="hidden" name="id" value={partner.id} />}
      <FormSection title={partner ? "Sponsor" : "Ny sponsor"}>
        <Field label="Företag" name="name" required>
          <TextInput name="name" defaultValue={partner?.name} maxLength={120} />
        </Field>
        <Field label="Webbplats" name="url">
          <TextInput name="url" type="url" defaultValue={partner?.url} placeholder="https://" />
        </Field>
        <Field label="Beskrivning" name="description">
          <TextInput name="description" defaultValue={partner?.description} maxLength={300} />
        </Field>
        <Field label="Var syns sponsorn?" name="tier" hint="Vid sidan står den som huvudsponsor: i sidomenyn på datorn, i menyn och sidfoten på telefonen. Fyra får plats där.">
          <Select name="tier" defaultValue={partner?.tier ?? "partner"}>
            <option value="partner">I sidfoten</option>
            <option value="huvudpartner">Vid sidan av skärmen</option>
          </Select>
        </Field>
        {partner && (
          <Field label="Plats i listan" name="sort_order" hint="Lägre tal visas först. Pilarna i listan gör samma sak.">
            <TextInput name="sort_order" type="number" min={0} defaultValue={partner.sort_order} className="max-w-40" />
          </Field>
        )}
        <ImageField name="logo_media_id" label="Logga" defaultImage={partner?.logo ?? null} aspect="aspect-[3/1]" fit="contain" />
        {partner ? (
          <Toggle name="active" label="Visas på sajten" defaultChecked={!!partner.active} />
        ) : (
          <>
            <input type="hidden" name="sort_order" value={nextOrder} />
            <input type="hidden" name="active" value="on" />
          </>
        )}
      </FormSection>
    </ActionForm>
  );
}
