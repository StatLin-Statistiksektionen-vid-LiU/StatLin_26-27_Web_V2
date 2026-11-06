import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { findResponsibleAccount } from "@/app/admin/_actions/projektplaner-hjalp";
import { deletePlan } from "@/app/admin/_actions/projektplaner";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { PlanEditForm, PlanStepForm } from "@/components/admin/plan-edit-form";
import { LessonsPanel } from "@/components/admin/plan-lessons";
import { PlanMeter } from "@/components/admin/plan-meter";
import { PlanSteps } from "@/components/admin/plan-steps";
import { Notice } from "@/components/admin/ui";
import { PrintButton } from "@/components/admin/wheel-buttons";
import { ArrowLeft, Printer, Trash } from "@/components/icons";
import { canChangePlan } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { getProjectPlan, getWheelItem, listLessons, listPlanSteps, listResponsibleOptions } from "@/lib/data/arshjul";
import { listTaskRecipients } from "@/lib/data/tasks";
import { formatDate, todayLocal } from "@/lib/dates";
import { planTemplate } from "@/lib/projektplan-mallar";
import { cn, simplify } from "@/lib/utils";

export const metadata = { title: "Projektplan" };

export default function PlanPage(props: PageProps<"/admin/projektplaner/[id]">) {
  return (
    <Suspense>
      <Plan params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

function Block({ title, children, empty }: { title: string; children: string; empty: string }) {
  return (
    <section className={cn("break-inside-avoid", !children && "print:hidden")}>
      <h2 className="kicker text-stone">{title}</h2>
      {children ? <p className="mt-1.5 whitespace-pre-line leading-relaxed print:text-[0.82rem] print:leading-snug">{children}</p> : <p className="mt-1.5 text-sm text-stone">{empty}</p>}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="kicker text-[0.62rem] text-stone">{label}</dt>
      <dd className="mt-0.5 font-mono text-sm font-medium break-words">{children}</dd>
    </div>
  );
}

async function Plan({ params, searchParams }: { params: PageProps<"/admin/projektplaner/[id]">["params"]; searchParams: PageProps<"/admin/projektplaner/[id]">["searchParams"] }) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const plan = /^\d+$/.test(id) ? await getProjectPlan(Number(id)) : null;
  if (!plan) notFound();
  const today = todayLocal();
  const canChange = canChangePlan(user, plan);
  const [steps, lessons, item, options, people] = await Promise.all([
    listPlanSteps(plan.id, user),
    plan.wheel_item_id ? listLessons(plan.wheel_item_id, plan.id) : [],
    plan.wheel_item_id ? getWheelItem(plan.wheel_item_id) : null,
    listResponsibleOptions(),
    canChange ? listTaskRecipients() : [],
  ]);
  const recipients = people.map((p) => ({
    id: p.id,
    label: p.committee && simplify(p.committee) !== simplify(p.label) ? `${p.label} (${p.committee})` : p.label,
    board: p.kind === "styrelse",
  }));
  const visible = steps.filter((s) => !s.hidden);
  const hiddenCount = steps.length - visible.length;
  const over = plan.plan_date < today;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/admin/projektplaner" className="tryck kicker inline-flex items-center gap-2 text-stone hover:text-ink">
          <ArrowLeft size={14} /> Projektplaner
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <PrintButton className="btn btn-ghost btn-sm bg-white">
            <Printer size={16} /> Skriv ut
          </PrintButton>
          {canChange && (
            <ConfirmButton action={deletePlan} id={plan.id} message="Ta bort projektplanen? Uppdrag som redan är skickade ligger kvar på tavlan, men utan koppling till planen.">
              <Trash size={15} /> Ta bort
            </ConfirmButton>
          )}
        </div>
      </div>
      <div className="print:hidden">
        {sp.skapad && visible.some((s) => s.task_id === null && !s.done) && <Notice>Planen är skapad. Stegen ligger här i planen tills du skickar dem till uppdragstavlan.</Notice>}
        {sp.borttaget && <Notice>Steget är borttaget ur planen.</Notice>}
        {over && !plan.lessons && canChange && <Notice tone="info">Datumet har passerat. Skriv några lärdomar till nästa år medan du minns dem.</Notice>}
        <LessonsPanel lessons={lessons} />
      </div>

      {/* Dokumentet. Utskriften är samma sak utan ram, meny och knappar, på en sida. */}
      <article className="rounded-[1.5rem] border border-ink/10 bg-white p-5 md:p-8 print:rounded-none print:border-0 print:p-0">
        <header>
          <p className="kicker text-red-deep print:text-ink">
            Projektplan · {planTemplate(plan.template)?.name ?? plan.template}
          </p>
          <h1 className="mt-1 break-words text-[clamp(1.8rem,3.5vw,2.5rem)] font-extrabold leading-tight tracking-tight hyphens-auto [font-stretch:110%] print:text-2xl">{plan.title}</h1>
          <dl className="mt-4 grid grid-cols-2 gap-4 border-y border-ink/10 py-4 sm:grid-cols-3 print:py-2">
            <Fact label="Datum">{formatDate(plan.plan_date, true)}</Fact>
            <Fact label="Ansvarig">{plan.responsible || "Inte bestämt"}</Fact>
            {item && (
              <Fact label="Årshjulet">
                <Link href={`/admin/arshjul${item.month ? `?manad=${item.month}` : ""}`} className="hover:underline">
                  {item.title}
                </Link>
              </Fact>
            )}
          </dl>
          <div className="mt-4">
            <p className="kicker mb-1.5 text-[0.62rem] text-stone">Framsteg</p>
            <PlanMeter done={plan.done} total={plan.total} />
          </div>
        </header>

        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] print:mt-4 print:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] print:gap-6">
          <div className="space-y-6 print:space-y-3">
            <Block title="Mål" empty="Inget mål är skrivet än.">
              {plan.goal}
            </Block>
            <Block title="Budget" empty="Ingen budget är skriven än.">
              {plan.budget}
            </Block>
            <Block title="Lärdomar till nästa år" empty="Skrivs efteråt. Det är det nästa års post har mest nytta av.">
              {plan.lessons}
            </Block>
          </div>
          <PlanSteps
            key={plan.responsible}
            planId={plan.id}
            planDate={plan.plan_date}
            today={today}
            steps={visible}
            hiddenCount={hiddenCount}
            canChange={canChange}
            recipients={recipients}
            defaultTo={canChange ? (findResponsibleAccount(plan.responsible) ?? user.id) : null}
          />
        </div>
      </article>

      {canChange && (
        <div className="mt-6 grid grid-cols-1 gap-4 print:hidden">
          <details className="rounded-[1.5rem] border border-ink/10 bg-white p-5" open={over && !plan.lessons}>
            <summary className="tryck cursor-pointer font-bold">Ändra planen</summary>
            <div className="mt-4">
              <PlanEditForm plan={plan} responsibleOptions={options} />
            </div>
          </details>
          <details className="rounded-[1.5rem] border border-ink/10 bg-white p-5">
            <summary className="tryck cursor-pointer font-bold">Lägg till ett steg</summary>
            <div className="mt-4">
              <PlanStepForm planId={plan.id} defaultDate={plan.plan_date} />
            </div>
          </details>
        </div>
      )}
    </>
  );
}
