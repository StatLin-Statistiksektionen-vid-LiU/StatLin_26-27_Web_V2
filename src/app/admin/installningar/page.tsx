import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { saveSettings } from "@/app/admin/_actions/content";
import { ActionForm } from "@/components/admin/action-form";
import { AnnouncementSection, ContactSection, EducationCommitteeSection, HomeTextsSection, SiteTextsSection, SocialSection, TaglineSection, ThemeSection } from "@/components/admin/content-forms";
import { AdminHeader } from "@/components/admin/ui";
import { canManageSettings } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { getSettings, listCommittees } from "@/lib/data/content";
import { SITE_TEXT_GROUPS, type SiteTextGroup } from "@/lib/site-texts";
import { cn } from "@/lib/utils";

export const metadata = { title: "Inställningar" };

export default function SettingsPage() {
  return (
    <Suspense>
      <Settings />
    </Suspense>
  );
}

/** Hopplänkar till avsnitten på en lång sida. */
function Jump({ label, links, className }: { label: string; links: [id: string, text: string][]; className?: string }) {
  return (
    <nav aria-label={label} className={cn("flex flex-wrap gap-1.5", className)}>
      {links.map(([id, text]) => (
        <a key={id} href={`#${id}`} className="btn btn-ghost btn-sm bg-white">
          {text}
        </a>
      ))}
    </nav>
  );
}

async function Settings() {
  const user = await requireUser();
  if (!canManageSettings(user)) redirect("/admin?nekad=1");
  const [s, committees] = await Promise.all([getSettings(), listCommittees()]);
  // Avsnitten i den ordning de står. Samma lista ger hopplänkarna överst, så att de inte kan gå isär.
  const sections: { id: string; label: string; node: ReactNode; wide?: boolean }[] = [
    { id: "startsidan", label: "Startsidan", node: <HomeTextsSection s={s} />, wide: true },
    { id: "kontakt", label: "Kontakt", node: <ContactSection s={s} /> },
    { id: "sociala-medier", label: "Sociala medier", node: <SocialSection s={s} /> },
    { id: "meddelande", label: "Meddelande", node: <AnnouncementSection s={s} /> },
    { id: "sidfoten", label: "Sidfoten", node: <TaglineSection s={s} /> },
    { id: "utbildningsutskottet", label: "Utbildningsutskottet", node: <EducationCommitteeSection s={s} committees={committees} /> },
    { id: "lage", label: "Mörkt eller ljust läge", node: <ThemeSection s={s} /> },
  ];
  const textGroups = Object.keys(SITE_TEXT_GROUPS) as SiteTextGroup[];
  return (
    <>
      <AdminHeader title="Inställningar" description="Startsidans texter, kontaktuppgifter och länkar som visas i sidfoten och på kontaktsidan, och läget sajten öppnas i." />
      <Jump label="Avsnitt på sidan" className="mb-6" links={[...sections.map((x): [string, string] => [x.id, x.label]), ["texter", "Texter på sajten"]]} />
      <ActionForm action={saveSettings}>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Rutan runt avsnittet är det länken hoppar till. grid gör att avsnittet fyller hela rutan, som när det låg direkt i rutnätet. */}
          {sections.map((x) => (
            <div key={x.id} id={x.id} className={cn("grid scroll-mt-4", x.wide && "lg:col-span-2")}>
              {x.node}
            </div>
          ))}
        </div>
      </ActionForm>
      {/* Samma fält som pennorna i redigeringsläget öppnar, se site-texts.ts. Ett eget formulär, så att listan inte blir en del av det ovan. */}
      <section id="texter" className="mt-12 scroll-mt-4">
        <h2 className="text-lg font-semibold">Texter på sajten</h2>
        <p className="mt-1 text-sm text-stone">Rubrikerna och knapparna på startsidan och huvudena på listsidorna. De går också att ändra med pennorna i redigeringsläget.</p>
        <Jump label="Texter på sajten" className="mt-4" links={textGroups.map((g) => [`texter-${g}`, SITE_TEXT_GROUPS[g]])} />
        <div className="mt-6">
          <ActionForm action={saveSettings} submitLabel="Spara texterna">
            <div className="grid gap-6 lg:grid-cols-2">
              {textGroups.map((group) => (
                <div key={group} id={`texter-${group}`} className="grid scroll-mt-4">
                  <SiteTextsSection group={group} s={s} />
                </div>
              ))}
            </div>
          </ActionForm>
        </div>
      </section>
    </>
  );
}
