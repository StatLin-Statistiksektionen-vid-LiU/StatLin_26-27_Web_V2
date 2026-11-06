"use client";

import { saveWheelItem } from "@/app/admin/_actions/arshjul";
import { ActionForm } from "@/components/admin/action-form";
import { Field, MoreDetails, Select, TextArea, TextInput } from "@/components/admin/fields";
import { MONTHS, TERM_NAMES, type WheelItem } from "@/lib/arshjul";
import { PLAN_TEMPLATES } from "@/lib/projektplan-mallar";

export function WheelItemForm({
  item,
  responsibleOptions,
  defaultMonth,
  defaultResponsible,
  onlyOurs,
}: {
  item?: WheelItem | null;
  responsibleOptions: string[];
  defaultMonth?: number | null;
  /** Den egna posten på en ny punkt: ett utskott skriver mest in sådant det själv sköter. */
  defaultResponsible?: string;
  /** Kom man från hjulet med bara de egna punkterna, så kommer man tillbaka dit efter att ha lagt till punkten. */
  onlyOurs?: boolean;
}) {
  return (
    <ActionForm
      action={saveWheelItem}
      version={item?.updated_at}
      submitLabel={item ? "Spara" : "Lägg till punkten"}
      className="max-w-2xl"
    >
      {item && <input type="hidden" name="id" value={item.id} />}
      {onlyOurs && <input type="hidden" name="vara" value="1" />}
      <Field label="Rubrik" name="title" required>
        <TextInput name="title" defaultValue={item?.title} maxLength={140} />
      </Field>
      <Field label="När på året" name="month" required hint="Vet ni inte exakt, välj bara en termin.">
        <Select name="month" defaultValue={item?.month ?? item?.term ?? defaultMonth ?? ""}>
          <option value="">Välj…</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
          <optgroup label="Ingen bestämd månad">
            <option value="vt">{TERM_NAMES.vt}</option>
            <option value="ht">{TERM_NAMES.ht}</option>
          </optgroup>
        </Select>
      </Field>
      <Field label="Ansvarig" name="responsible" hint="En post eller ett utskott. Hittas kontot går uppdrag från punkten dit, annars blir de öppna för vem som helst.">
        <TextInput name="responsible" defaultValue={item?.responsible ?? defaultResponsible} maxLength={80} list="ansvariga" autoComplete="off" />
        <datalist id="ansvariga">
          {responsibleOptions.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      </Field>
      <Field label="Beskrivning" name="description" hint="Vad är det som ska hända, och vad behöver nästa års post veta?">
        <TextArea name="description" defaultValue={item?.description} maxLength={2000} />
      </Field>
      <MoreDetails title="Fler val" summary="Beror på andra, mall för projektplan" fields={["depends_on", "template"]} defaultOpen={!!(item?.depends_on || item?.template)}>
        <Field label="Beror på andra" name="depends_on" hint="Till exempel en gästföreläsare eller ett företag som måste bokas i god tid. Punkten hamnar då på kortet Att planera in denna termin.">
          <TextInput name="depends_on" defaultValue={item?.depends_on} maxLength={200} />
        </Field>
        <Field label="Mall för projektplan" name="template" hint="Planer från punkten börjar med den här mallen.">
          <Select name="template" defaultValue={item?.template ?? ""}>
            <option value="">Ingen särskild</option>
            {PLAN_TEMPLATES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
      </MoreDetails>
    </ActionForm>
  );
}
