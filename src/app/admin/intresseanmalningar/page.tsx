import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { deleteInterest, resendInterestMail, setInterestStatus } from "@/app/admin/_actions/naringsliv";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { AdminHeader, EmptyState, Notice } from "@/components/admin/ui";
import { PendingButton } from "@/components/admin/wheel-buttons";
import { ArrowUpRight, Check, Mail, Trash } from "@/components/icons";
import { requireUser } from "@/lib/auth/session";
import { getCommitteeBySlug, getSettings } from "@/lib/data/content";
import { canManageNaringsliv, listStarInterest } from "@/lib/data/naringsliv";
import { formatDate } from "@/lib/dates";
import { mailIsConfigured } from "@/lib/mail";
import { mailtoWithSubject } from "@/lib/naringsliv";
import { INTRESSE_VAL_LABELS, type StarIntresse } from "@/lib/star-intresse";
import { cn } from "@/lib/utils";

export const metadata = { title: "Intresseanmälningar" };

const TABS = [
  { key: "nya", label: "Nya", match: (a: StarIntresse) => a.status === "ny" },
  { key: "hanterade", label: "Hanterade", match: (a: StarIntresse) => a.status === "hanterad" },
] as const;

export default function AdminInterest(props: PageProps<"/admin/intresseanmalningar">) {
  return (
    <Suspense>
      <InterestList searchParams={props.searchParams} />
    </Suspense>
  );
}

async function InterestList({ searchParams }: { searchParams: PageProps<"/admin/intresseanmalningar">["searchParams"] }) {
  const user = await requireUser();
  if (!canManageNaringsliv(user)) redirect("/admin?nekad=1");
  const [interest, sasu, settings, sp] = await Promise.all([listStarInterest(), getCommitteeBySlug("sasu"), getSettings(), searchParams]);
  const to = sasu?.email || settings.contact_email;
  const configured = mailIsConfigured();
  const newCount = interest.filter((a) => a.status === "ny").length;
  const handled = interest.length - newCount;
  // Kommer man hit utan val och allt är hanterat är det hanterade det enda som finns att titta på.
  const tab = TABS.find((t) => t.key === sp.flik) ?? (newCount === 0 && handled > 0 ? TABS[1] : TABS[0]);
  const visible = interest.filter(tab.match);

  return (
    <>
      {sp.klar === "hanterad" && <Notice>Anmälan är markerad som hanterad.</Notice>}
      {sp.klar === "ny" && <Notice>Anmälan ligger bland de nya igen.</Notice>}
      {sp.raderad && <Notice>Anmälan är borttagen.</Notice>}
      {sp.mejl === "skickat" && <Notice>Mejlet är skickat till {to}.</Notice>}
      {sp.mejl === "misslyckades" && <Notice tone="warning">Mejlet gick inte att skicka. Anmälan finns kvar här, så försök igen senare eller svara direkt.</Notice>}
      {sp.mejl === "ej_installt" && <Notice tone="warning">Mejl är inte inställt än, så inget mejl skickades.</Notice>}
      <AdminHeader
        // Mjukt bindestreck: på en smal telefon delas ordet som Intresse-anmälningar i stället för mitt i.
        title={"Intresse­anmälningar"}
        description="Företag som har anmält intresse för STAR via inbjudningslänken. Länken hittar du under STAR."
        actions={
          <Link href="/admin/star#inbjudan" className="btn btn-ghost btn-sm">
            Till länken <ArrowUpRight size={15} />
          </Link>
        }
      />

      {!configured && (
        <Notice tone="info">Mejl är inte inställt än, så anmälningar syns bara här och i menyn. När SMTP är på plats mejlas de till {to}, och de som redan har kommit in går att skicka härifrån.</Notice>
      )}

      <nav aria-label="Urval" className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/intresseanmalningar?flik=${t.key}`}
            aria-current={t.key === tab.key ? "page" : undefined}
            className={cn("btn btn-sm", t.key === tab.key ? "btn-ink" : "btn-ghost")}
          >
            {t.label} <span className="tabular opacity-70">{interest.filter(t.match).length}</span>
          </Link>
        ))}
      </nav>

      {visible.length === 0 ? (
        <EmptyState title={tab.key === "nya" ? "Inga nya anmälningar" : "Inga hanterade anmälningar"}>
          {tab.key === "nya" ? "Skicka inbjudningslänken till ett företag, så hamnar svaret här." : "Det du markerar som hanterat hamnar här."}
        </EmptyState>
      ) : (
        <ul className="space-y-4">
          {visible.map((a) => (
            <InterestCard key={a.id} interest={a} configured={configured} />
          ))}
        </ul>
      )}
    </>
  );
}

const MAIL_NOTE: Record<StarIntresse["mejl_status"], string> = {
  skickat: "Mejlad till SASU",
  vantar: "Mejlet är på väg",
  misslyckades: "Mejlet gick inte att skicka",
  ej_installt: "Inget mejl skickat",
};

function InterestCard({ interest: a, configured }: { interest: StarIntresse; configured: boolean }) {
  const subject = a.vill_boka_mote ? "Möte om STAR" : "Er intresseanmälan till STAR";
  return (
    <li className="rounded-[1.5rem] border border-ink/10 bg-white p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 basis-72">
          <p className="text-lg font-semibold [overflow-wrap:anywhere]">{a.foretag}</p>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
            <span className="font-semibold">{INTRESSE_VAL_LABELS[a.val]}</span>
            {a.vill_boka_mote && <span className="chip bg-ink text-white">Vill boka möte</span>}
            <span className="text-stone">{formatDate(a.created_at, true)}</span>
          </p>
          <dl className="mt-3 grid gap-x-4 gap-y-1 text-[0.95rem] sm:grid-cols-[auto_minmax(0,1fr)]">
            <dt className="text-stone">Kontakt</dt>
            <dd className="[overflow-wrap:anywhere]">{a.kontakt_namn}</dd>
            <dt className="text-stone">E-post</dt>
            <dd className="[overflow-wrap:anywhere]">
              <a href={`mailto:${a.epost}`} className="underline underline-offset-2">
                {a.epost}
              </a>
            </dd>
            {a.telefon && (
              <>
                <dt className="text-stone">Telefon</dt>
                <dd>
                  <a href={`tel:${a.telefon.replace(/[^\d+]/g, "")}`} className="underline underline-offset-2">
                    {a.telefon}
                  </a>
                </dd>
              </>
            )}
            {a.moteforslag && (
              <>
                <dt className="text-stone">När det passar</dt>
                <dd className="[overflow-wrap:anywhere]">{a.moteforslag}</dd>
              </>
            )}
          </dl>
          {a.meddelande && <p className="mt-3 whitespace-pre-line text-[0.95rem] text-ink/85 [overflow-wrap:anywhere]">{a.meddelande}</p>}
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone">
            <span className={cn("inline-flex items-center gap-1", a.mejl_status === "misslyckades" && "font-semibold text-red-dark")}>
              {a.mejl_status === "skickat" && <Check size={13} />} {MAIL_NOTE[a.mejl_status]}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={mailtoWithSubject(a.epost, subject)} className="btn btn-ghost btn-sm">
            <Mail size={15} /> Svara
          </a>
          <form action={setInterestStatus}>
            <input type="hidden" name="id" value={a.id} />
            <input type="hidden" name="status" value={a.status === "ny" ? "hanterad" : "ny"} />
            <PendingButton className={cn("btn btn-sm", a.status === "ny" ? "btn-ink" : "btn-ghost")}>
              {a.status === "ny" ? (
                <>
                  <Check size={15} /> Markera som hanterad
                </>
              ) : (
                "Flytta till nya"
              )}
            </PendingButton>
          </form>
          {configured && a.mejl_status !== "skickat" && (
            <form action={resendInterestMail}>
              <input type="hidden" name="id" value={a.id} />
              <PendingButton className="btn btn-ghost btn-sm">Skicka mejlet</PendingButton>
            </form>
          )}
          <ConfirmButton action={deleteInterest} id={a.id} message={`Ta bort anmälan från ${a.foretag}?`}>
            <Trash size={15} /> Ta bort
          </ConfirmButton>
        </div>
      </div>
    </li>
  );
}
