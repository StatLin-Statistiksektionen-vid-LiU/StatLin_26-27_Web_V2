import { redirect } from "next/navigation";
import { Suspense } from "react";
import { saveSettings } from "@/app/admin/_actions/content";
import { ActionForm } from "@/components/admin/action-form";
import { AnnouncementSection, ContactSection, EducationCommitteeSection, HomeTextsSection, SiteTextsSection, SocialSection, TaglineSection } from "@/components/admin/content-forms";
import { AdminHeader } from "@/components/admin/ui";
import { canManageSettings } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { getSettings, listCommittees } from "@/lib/data/content";
import { SITE_TEXT_GROUPS, type SiteTextGroup } from "@/lib/site-texts";

export const metadata = { title: "Inställningar" };

export default function SettingsPage() {
  return (
    <Suspense>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  const user = await requireUser();
  if (!canManageSettings(user)) redirect("/admin?nekad=1");
  const [s, committees] = await Promise.all([getSettings(), listCommittees()]);
  return (
    <>
      <AdminHeader title="Inställningar" description="Startsidans texter, kontaktuppgifter och länkar som visas i sidfoten och på kontaktsidan." />
      <ActionForm action={saveSettings}>
        <div className="grid gap-6 lg:grid-cols-2">
          <HomeTextsSection s={s} className="lg:col-span-2" />
          <ContactSection s={s} />
          <SocialSection s={s} />
          <AnnouncementSection s={s} />
          <TaglineSection s={s} />
          <EducationCommitteeSection s={s} committees={committees} />
        </div>
      </ActionForm>
      {/* Samma fält som pennorna i redigeringsläget öppnar, se site-texts.ts. Ett eget formulär, så att listan inte blir en del av det ovan. */}
      <section id="texter" className="mt-12 scroll-mt-24">
        <h2 className="text-lg font-semibold">Texter på sajten</h2>
        <p className="mt-1 text-sm text-stone">Rubrikerna och knapparna på startsidan och huvudena på listsidorna. De går också att ändra med pennorna i redigeringsläget.</p>
        <div className="mt-6">
          <ActionForm action={saveSettings} submitLabel="Spara texterna">
            <div className="grid gap-6 lg:grid-cols-2">
              {(Object.keys(SITE_TEXT_GROUPS) as SiteTextGroup[]).map((group) => (
                <SiteTextsSection key={group} group={group} s={s} />
              ))}
            </div>
          </ActionForm>
        </div>
      </section>
    </>
  );
}
