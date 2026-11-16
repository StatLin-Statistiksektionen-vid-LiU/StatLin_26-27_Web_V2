import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { renewStarInvite, setStarLive } from "@/app/admin/_actions/naringsliv";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { StarCompanyForm } from "@/components/admin/star-company-form";
import { StarPageForm } from "@/components/admin/star-page-form";
import { AdminHeader, EmptyState, JumpToForm, Notice, StatusBadge } from "@/components/admin/ui";
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Edit, Handshake } from "@/components/icons";
import { CopyButton } from "@/components/ui/copy-button";
import { requireUser } from "@/lib/auth/session";
import { getCommitteeBySlug, getSettings } from "@/lib/data/content";
import { getStarEvent, listUpcomingEvents } from "@/lib/data/events";
import { canManageNaringsliv, countNewInterest, getStarInviteCode, listStarCompanies } from "@/lib/data/naringsliv";
import { formatDate } from "@/lib/dates";
import { mailIsConfigured } from "@/lib/mail";
import { COMPANY_ROLE_LABELS, parseProgram, parseSeeks, SEEK_LABELS, starIsLive } from "@/lib/naringsliv";
import { siteUrl } from "@/lib/site-url";
import { ScrollToAnchor } from "@/components/ui/scroll-to-anchor";
import { cn } from "@/lib/utils";

export const metadata = { title: "STAR" };

export default function AdminStar(props: PageProps<"/admin/star">) {
  return (
    <Suspense>
      <StarAdmin searchParams={props.searchParams} />
    </Suspense>
  );
}

async function StarAdmin({ searchParams }: { searchParams: PageProps<"/admin/star">["searchParams"] }) {
  const user = await requireUser();
  if (!canManageNaringsliv(user)) redirect("/admin?nekad=1");
  const [companies, settings, events, sp, inviteCode, newInterest, sasu, base] = await Promise.all([
    listStarCompanies(),
    getSettings(),
    listUpcomingEvents(200),
    searchParams,
    getStarInviteCode(),
    countNewInterest(),
    getCommitteeBySlug("sasu"),
    siteUrl(),
  ]);
  const inviteUrl = `${base}/star/inbjudan/${inviteCode}`;
  const interestTo = sasu?.email || settings.contact_email;
  const event = await getStarEvent(Number(settings.star_event_id) || null);
  const live = starIsLive(settings);
  const visible = companies.filter((c) => c.active);
  const sponsors = visible.filter((c) => c.role !== "utstallare");
  const program = event ? parseProgram(event.body_md) : [];
  return (
    <>
      {sp.sparad && <Notice>Företaget är tillagt.</Notice>}
      {sp.raderad && <Notice>Företaget är borttaget.</Notice>}
      {sp.nylank && <Notice>Länken är bytt. Den gamla fungerar inte längre, så skicka den nya till företagen.</Notice>}
      <AdminHeader
        title="STAR"
        description="Datum, plats och program kommer från evenemanget. Resten sköts här."
        actions={
          <Link href="/star" target="_blank" className="btn btn-ghost btn-sm bg-white">
            {live ? "Visa sidan" : "Förhandsvisa"} <ArrowUpRight size={15} />
          </Link>
        }
      />

      <section aria-labelledby="star-laget" className="rounded-[1.6rem] bg-star-navy p-5 text-white md:p-7">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <p className="kicker flex items-center gap-2 text-white/70">
              <span aria-hidden className={cn("size-2.5 rounded-full", live ? "bg-[#7dffb0]" : "bg-[#ff5a5a]")} />
              {live ? "Live" : "Dold"}
            </p>
            <h2 id="star-laget" className="mt-2 text-2xl font-extrabold tracking-tight">
              {live ? "Sidan syns för alla" : "Sidan är dold för besökare"}
            </h2>
            <p className="mt-2 max-w-2xl text-white/75">
              {live
                ? "Den finns i menyn och på startsidan, och sökmotorer får hitta den. Dölj den om ni behöver göra om något i lugn och ro."
                : "Besökare ser bara att sidan kommer snart, och menyn och startsidan länkar inte hit. Du som är inloggad ser hela sidan, så gör klart den och tryck på knappen när ni är nöjda."}
            </p>
          </div>
          <form action={setStarLive} className="shrink-0">
            <input type="hidden" name="live" value={live ? "0" : "1"} />
            <button type="submit" className={live ? "btn btn-ghost-dark" : "btn btn-red"}>
              {live ? "Dölj sidan" : "Gör sidan live"}
            </button>
          </form>
        </div>
        <ul className="mt-6 grid gap-3 border-t border-white/15 pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <Ready ok={!!event} label="Evenemang" text={event ? `${event.title}, ${formatDate(event.starts_at, true)}` : "Inget kommande. Sidan säger att datum kommer snart."} href={event ? `/admin/evenemang/${event.id}` : "/admin/evenemang"} />
          <Ready ok={program.length > 0} label="Program" text={program.length > 0 ? `${program.length} punkter från evenemanget` : "Skrivs i evenemangets text, under rubriken Program."} href={event ? `/admin/evenemang/${event.id}` : "/admin/evenemang"} />
          <Ready ok={visible.length > 0} label="Företag" text={visible.length > 0 ? `${visible.length} syns på sidan` : "Inga än. Sidan säger att de presenteras snart."} href="#foretagen" />
          <Ready ok={sponsors.length > 0} label="Sponsorer" text={sponsors.length > 0 ? `${sponsors.length} syns på sidan` : "Inga än. Avsnittet syns inte förrän det finns någon."} href="#foretagen" />
        </ul>
      </section>

      <ScrollToAnchor id="inbjudan" />
      <section id="inbjudan" aria-labelledby="star-inbjudan" className="mt-6 scroll-mt-24 rounded-[1.6rem] border border-ink/10 bg-white p-5 md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-8">
          <div className="min-w-0">
            <h2 id="star-inbjudan" className="flex items-center gap-2.5 text-xl font-extrabold tracking-tight">
              <Handshake size={20} /> Inbjudan till företag
            </h2>
            <p className="mt-2 max-w-2xl text-stone">
              Skicka den här länken till företag ni vill ha med. Sidan säljer in studenterna och har en intresseanmälan med möjlighet att boka möte. Den syns inte i menyn eller på Google och fungerar även när STAR-sidan är dold.
            </p>
          </div>
          <Link href="/admin/intresseanmalningar" className="btn btn-ink btn-sm shrink-0">
            Anmälningar{newInterest > 0 && <span className="tabular opacity-80"> ({newInterest === 1 ? "1 ny" : `${newInterest} nya`})</span>} <ArrowRight size={15} />
          </Link>
        </div>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input readOnly aria-label="Inbjudningslänk" value={inviteUrl} className="min-w-0 flex-1 rounded-xl border border-ink/15 bg-paper px-3.5 py-2.5 font-mono text-sm text-ink outline-none focus:border-ink focus:ring-4 focus:ring-ink/[0.06]" />
          <div className="flex flex-wrap gap-2">
            <CopyButton value={inviteUrl} label="Kopiera länken" className="btn btn-ink btn-sm font-sans" />
            <Link href={inviteUrl} target="_blank" className="btn btn-ghost btn-sm">
              Öppna <ArrowUpRight size={15} />
            </Link>
            <ConfirmButton action={renewStarInvite} id={0} pendingLabel="Byter länk…" message="Byta länk? Den gamla slutar fungera direkt, också för företag som redan har fått den." className="font-semibold">
              Byt länk
            </ConfirmButton>
          </div>
        </div>
        <p className="mt-3 text-sm text-stone">
          {mailIsConfigured() ? `Varje anmälan mejlas till ${interestTo} och syns under Intresseanmälningar.` : `Mejl är inte inställt än, så anmälningar syns bara under Intresseanmälningar. När SMTP är på plats mejlas de till ${interestTo}.`}
        </p>
      </section>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
        <h2 id="foretagen" className="scroll-mt-24 text-xl font-extrabold tracking-tight">
          Företag och sponsorer
        </h2>
        {/* På telefon ligger formuläret under hela listan. */}
        <JumpToForm href="#nytt-foretag">Nytt företag</JumpToForm>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {companies.length === 0 ? (
            <EmptyState title="Inga företag ännu">Lägg till det första med formuläret. Tills dess står det att företagen presenteras snart.</EmptyState>
          ) : (
            <ul className="@container divide-y divide-ink/10 overflow-hidden rounded-[1.5rem] border border-ink/10 bg-white">
              {companies.map((c) => (
                <li key={c.id} className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1 px-3.5 py-3.5 @lg:flex @lg:gap-4 @lg:px-5 @lg:py-4">
                  {/* Loggan på en vit platta, som på sajten och under Sponsorer, så att mörk text i loggan syns även i mörkt läge. */}
                  <span className={cn("row-span-2 grid h-10 w-12 shrink-0 place-items-center rounded-lg @lg:w-20", c.logo && "bg-[#fff] px-1 ring-1 ring-line")}>
                    {c.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.logo.thumb} alt="" className="max-h-10 max-w-full object-contain" />
                    ) : (
                      <span className="text-center text-xs leading-tight text-stone">Ingen logga</span>
                    )}
                  </span>
                  <Link href={`/admin/star/${c.id}`} className="min-w-0 flex-1">
                    <span className="block truncate font-semibold leading-snug @max-lg:whitespace-normal @max-lg:[overflow-wrap:anywhere]">{c.name}</span>
                    <span className="block truncate text-xs text-stone">
                      {[COMPANY_ROLE_LABELS[c.role], ...parseSeeks(c.seeks).map((k) => SEEK_LABELS[k])].join(" · ")}
                    </span>
                  </Link>
                  {/* Bara undantaget syns: alla andra rader är på sidan. */}
                  {!c.active && (
                    <span className="col-start-2 row-start-2 justify-self-start @lg:contents">
                      <StatusBadge published={false} label="Dold" />
                    </span>
                  )}
                  <Link href={`/admin/star/${c.id}`} className="col-start-3 row-span-2 row-start-1 grid size-9 place-items-center rounded-full hover:bg-paper pointer-coarse:size-11" aria-label={`Redigera ${c.name}`}>
                    <Edit size={16} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div id="nytt-foretag" className="scroll-mt-24 lg:col-span-2">
          <StarCompanyForm nextOrder={(companies.length + 1) * 10} />
        </div>
      </div>

      {/* Texterna ändras sällan och är långa, och samma texter går att ändra med pennorna på sidan. */}
      <details id="texterna" className="group mt-8 scroll-mt-24">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-[1.5rem] border border-ink/10 bg-white p-5 outline-none focus-visible:ring-4 focus-visible:ring-ink/10 md:px-7 [&::-webkit-details-marker]:hidden">
          <span>
            <span className="block text-base font-bold">Evenemang och texter på sidan</span>
            <span className="mt-1 block text-sm text-stone">Samma texter går att ändra med pennorna på sidan när du är inloggad. Ett tomt fält tar bort texten.</span>
          </span>
          <ChevronDown size={18} className="shrink-0 text-stone transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-5">
          <StarPageForm s={settings} events={events} />
        </div>
      </details>
    </>
  );
}

function Ready({ ok, label, text, href }: { ok: boolean; label: string; text: string; href: string }) {
  return (
    <li>
      <Link href={href} className="group block rounded-xl p-2 -m-2 transition-colors hover:bg-white/[0.06]">
        <span className="flex items-center gap-2 font-semibold">
          <span aria-hidden className={cn("grid size-5 shrink-0 place-items-center rounded-full", ok ? "bg-white text-star-navy" : "border border-white/40")}>
            {ok && <Check size={13} />}
          </span>
          {label}
          <span className="sr-only">{ok ? ": klart" : ": inte klart"}</span>
        </span>
        <span className="mt-1 block text-sm text-white/70 [overflow-wrap:anywhere]">{text}</span>
      </Link>
    </li>
  );
}
