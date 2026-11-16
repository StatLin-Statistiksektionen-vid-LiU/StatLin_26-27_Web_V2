"use client";

import { useState } from "react";
import { saveUser } from "@/app/admin/_actions/users";
import { ActionForm, FieldError } from "./action-form";
import { Field, FormSection, Select, TextInput, Toggle } from "./fields";
import type { UserListItem } from "@/lib/data/admin";
import { committeeLabel, ROLE_DESCRIPTIONS, ROLE_LABELS, type Committee, type Role } from "@/lib/types";
import { cn } from "@/lib/utils";

export function UserForm({ user, committees }: { user?: UserListItem | null; committees: Pick<Committee, "id" | "short_name" | "name">[] }) {
  const initialRole = user?.role ?? "committee";
  // Bara för utseendet och hjälptexterna. Vad som skickas bestäms av radioknapparna, som är okontrollerade: form.reset() efter ett
  // nytt konto går då tillbaka till grundvalet, och knapparna och det som visas kan inte glida isär (SB-31).
  const [role, setRole] = useState<Role>(initialRole);
  return (
    <ActionForm action={saveUser} submitLabel={user ? "Spara konto" : "Skapa konto"} resetOnSuccess={!user} onSuccess={user ? undefined : () => setRole(initialRole)} stickyFooter={false}>
      {user && <input type="hidden" name="id" value={user.id} />}
      <FormSection title={user ? "Konto" : "Nytt konto"} description={user ? undefined : "Ett tillfälligt lösenord genereras och visas när kontot skapats."}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Namn" name="name" required>
            <TextInput name="name" defaultValue={user?.name} maxLength={120} />
          </Field>
          <Field label="E-post" name="email" required hint="Använd postens adress, t.ex. kassor@statlin.se.">
            <TextInput name="email" type="email" defaultValue={user?.email} />
          </Field>
        </div>
        <Field label="Post" name="post">
          <TextInput name="post" defaultValue={user?.post} placeholder="Informationsansvarig" maxLength={120} />
        </Field>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Roll</legend>
          {/* Efter formulärets bredd: bredvid listan är det för smalt för tre kolumner. */}
          <div className="grid gap-2 @xl:grid-cols-3">
            {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
              <label
                key={r}
                className={cn(
                  // Radioknappen är dold, så rutan visar var tangentbordet står.
                  "cursor-pointer rounded-2xl border p-3.5 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink",
                  role === r ? "border-ink bg-ink text-white" : "border-ink/15 bg-white hover:border-ink/40",
                )}
              >
                <input type="radio" name="role" value={r} defaultChecked={initialRole === r} onChange={() => setRole(r)} className="sr-only" />
                <span className="block text-sm font-bold">{ROLE_LABELS[r]}</span>
                <span className={cn("mt-1 block text-xs leading-snug", role === r ? "text-white/70" : "text-stone")}>{ROLE_DESCRIPTIONS[r]}</span>
              </label>
            ))}
          </div>
          <FieldError name="role" />
        </fieldset>
        <Field label="Utskott" name="committee_id" hint={role === "committee" ? "Kontot kan bara hantera innehåll för det här utskottet." : "Valfritt för administratörer och redaktörer."}>
          <Select name="committee_id" defaultValue={String(user?.committee_id ?? "")}>
            <option value="">{role === "committee" ? "Välj utskott…" : "Inget"}</option>
            {committees.map((c) => (
              <option key={c.id} value={c.id}>
                {committeeLabel(c)}
              </option>
            ))}
          </Select>
        </Field>
        {role === "committee" && (
          <Toggle
            name="design"
            label="Grafiskt ansvar"
            defaultChecked={!!user?.design}
            hint="Får byta omslag, galleribilder och utskottsloggor på hela sajten och lägga upp mallar under Grafisk profil. Texterna följer rollen."
          />
        )}
        {user && <Toggle name="active" label="Aktivt konto" defaultChecked={!!user.active} hint="Inaktiva konton kan inte logga in." />}
      </FormSection>
    </ActionForm>
  );
}
