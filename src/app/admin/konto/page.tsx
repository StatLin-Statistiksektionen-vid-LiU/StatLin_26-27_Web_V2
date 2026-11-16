import { Suspense } from "react";
import { changePassword, updateProfile } from "@/app/admin/_actions/auth";
import { LogoutOthersButton } from "@/components/admin/logout-others";
import { ActionForm } from "@/components/admin/action-form";
import { Field, FormSection, TextInput } from "@/components/admin/fields";
import { AdminHeader, Card, Notice } from "@/components/admin/ui";
import { requireUser } from "@/lib/auth/session";
import { sessionCount } from "@/lib/data/admin";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/types";

export const metadata = { title: "Mitt konto" };

export default function AccountPage(props: PageProps<"/admin/konto">) {
  return (
    <Suspense>
      <Account searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Account({ searchParams }: { searchParams: PageProps<"/admin/konto">["searchParams"] }) {
  const user = await requireUser({ allowTemporaryPassword: true });
  const [sp, sessions] = await Promise.all([searchParams, sessionCount(user.id)]);
  const board = user.role === "committee" && user.committee_kind === "styrelse";
  return (
    <>
      {sp.byt && user.must_change_password && <Notice tone="warning">Välj ett eget lösenord för att komma igång.</Notice>}
      <AdminHeader title="Mitt konto" description={user.email} />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        <div className="space-y-8 lg:col-span-3">
          <ActionForm action={changePassword} submitLabel="Byt lösenord" resetOnSuccess stickyFooter={false}>
            <FormSection title="Lösenord" description="Minst 10 tecken. En fras med flera ord är både säker och lätt att komma ihåg.">
              <Field label="Nuvarande lösenord" name="current" required>
                <TextInput name="current" type="password" autoComplete="current-password" />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Nytt lösenord" name="password" required>
                  <TextInput name="password" type="password" autoComplete="new-password" minLength={10} />
                </Field>
                <Field label="Upprepa" name="confirm" required>
                  <TextInput name="confirm" type="password" autoComplete="new-password" />
                </Field>
              </div>
            </FormSection>
          </ActionForm>
          <ActionForm action={updateProfile} submitLabel="Spara profil" stickyFooter={false}>
            <FormSection title="Profil" description="Visas som avsändare på det du skriver under Nytt.">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Namn" name="name" required>
                  <TextInput name="name" defaultValue={user.name} maxLength={120} />
                </Field>
                <Field label="Post" name="post">
                  <TextInput name="post" defaultValue={user.post} maxLength={120} />
                </Field>
              </div>
            </FormSection>
          </ActionForm>
        </div>
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-6">
            <p className="kicker text-stone">Din roll</p>
            <p className="mt-2 text-xl font-bold">
              {board ? "Styrelsepost" : ROLE_LABELS[user.role]}
              {user.committee_name && !board && <span className="text-stone"> · {user.committee_name}</span>}
            </p>
            <p className="mt-2 text-sm text-stone">
              {board ? "Styrelsens evenemang, nytt och bilder. Uppdragstavlan, projektplanerna och årshjulet delas med alla poster." : ROLE_DESCRIPTIONS[user.role]}
            </p>
          </Card>
          <Card className="p-6">
            <p className="kicker text-stone">Inloggade enheter</p>
            <p className="mt-2 text-xl font-bold tabular">{sessions}</p>
            <p className="mt-1 text-sm text-stone">Lämnat dig inloggad på en dator i sektionsrummet? Logga ut överallt utom här.</p>
            <LogoutOthersButton />
          </Card>
        </div>
      </div>
    </>
  );
}
