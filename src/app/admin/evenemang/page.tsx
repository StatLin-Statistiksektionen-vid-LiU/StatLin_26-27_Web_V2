import Link from "next/link";
import { Suspense } from "react";
import { setEventChecked } from "@/app/admin/_actions/events";
import { InlineActionForm } from "@/components/admin/inline-action-form";
import { AdminHeader, EmptyState, Notice, ReviewBadge, StatusBadge } from "@/components/admin/ui";
import { PendingButton } from "@/components/admin/wheel-buttons";
import { ArrowUpRight, Check, Edit, Image as ImageIcon, Plus } from "@/components/icons";
import { canReviewEvents } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { listEventsForAdmin } from "@/lib/data/events";
import { eventEnd, formatDate, nowLocal } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata = { title: "Evenemang" };

export default function AdminEvents(props: PageProps<"/admin/evenemang">) {
  return (
    <Suspense>
      <Events searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Events({ searchParams }: { searchParams: PageProps<"/admin/evenemang">["searchParams"] }) {
  const user = await requireUser();
  const sp = await searchParams;
  const reviewer = canReviewEvents(user);
  const tab = sp.visa === "tidigare" || sp.visa === "utkast" ? sp.visa : sp.visa === "ogranskade" && reviewer ? "ogranskade" : "kommande";
  const events = await listEventsForAdmin(user.role === "committee" ? user.committee_id : null);
  const now = nowLocal();
  const isUpcoming = (e: (typeof events)[number]) => eventEnd(e.starts_at, e.ends_at, e.all_day) >= now;
  const latestFirst = (a: (typeof events)[number], b: (typeof events)[number]) => b.updated_at.localeCompare(a.updated_at);
  const drafts = events.filter((e) => !e.published).sort(latestFirst);
  const unreviewed = events.filter((e) => !e.checked_at).sort(latestFirst);
  const list = tab === "kommande" ? events.filter(isUpcoming).reverse() : tab === "tidigare" ? events.filter((e) => !isUpcoming(e)) : tab === "utkast" ? drafts : unreviewed;
  const tabs: { key: string; href: string; count?: number }[] = [
    { key: "kommande", href: "/admin/evenemang" },
    { key: "tidigare", href: "/admin/evenemang?visa=tidigare" },
    // Utkasten är sällan många. Fliken finns när det finns något att visa.
    ...(drafts.length > 0 || tab === "utkast" ? [{ key: "utkast", href: "/admin/evenemang?visa=utkast", count: drafts.length }] : []),
    ...(reviewer ? [{ key: "ogranskade", href: "/admin/evenemang?visa=ogranskade", count: unreviewed.length }] : []),
  ];

  // Fliken har en egen knapp på raden. På telefon får den platsen, och raden leder ändå till evenemanget.
  const iconClass = cn("place-items-center rounded-full hover:bg-paper size-9", tab === "tidigare" || tab === "ogranskade" ? "hidden sm:inline-grid" : "inline-grid");

  return (
    <>
      {sp.raderad && <Notice>Evenemanget är borttaget.</Notice>}
      <AdminHeader
        title="Evenemang"
        description={user.role === "committee" ? `Evenemang för ${user.committee_name}.` : "Alla sektionens evenemang."}
        actions={
          <Link href="/admin/evenemang/ny" className="btn btn-red">
            <Plus size={18} /> Nytt evenemang
          </Link>
        }
      />
      {/* På en telefon får flikarna inte plats på en rad, så de ligger två och två i stället för att gömmas utanför kanten. */}
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-2xl border border-ink/15 bg-white p-1 sm:flex sm:w-fit sm:max-w-full sm:gap-0 sm:overflow-x-auto sm:rounded-full [scrollbar-width:none] [&>:last-child:nth-child(odd)]:col-span-2">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn("shrink-0 rounded-xl px-3.5 py-2 text-center text-sm font-semibold capitalize sm:rounded-full sm:px-5", tab === t.key ? "bg-ink text-white" : "text-ink/60 hover:text-ink")}
          >
            {t.key}
            {!!t.count && <span className="tabular ml-1.5 font-normal">{t.count}</span>}
          </Link>
        ))}
      </div>
      {tab === "ogranskade" && (
        <p className="-mt-2 mb-5 text-sm text-stone">Senast ändrade först. Granskningen påverkar inte vad som visas på sajten.</p>
      )}

      {list.length === 0 ? (
        tab === "ogranskade" ? (
          <EmptyState title="Allt är granskat">Nya evenemang från utskotten och övriga poster hamnar här.</EmptyState>
        ) : tab === "utkast" ? (
          <EmptyState title="Inga utkast">Det som sparas som utkast hamnar här tills det publiceras.</EmptyState>
        ) : (
          <EmptyState
            title={tab === "kommande" ? "Inga kommande evenemang" : "Inga tidigare evenemang"}
            action={
              <Link href="/admin/evenemang/ny" className="btn btn-ink">
                <Plus size={18} /> Skapa ett
              </Link>
            }
          />
        )
      ) : (
        <div className="overflow-hidden rounded-[1.5rem] border border-ink/10 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink/10 bg-paper/60">
              <tr className="kicker text-stone">
                <th className="px-5 py-3 font-medium">Evenemang</th>
                <th className="hidden px-3 py-3 font-medium md:table-cell">Datum</th>
                <th className="hidden px-3 py-3 font-medium sm:table-cell">Status</th>
                <th className="hidden px-3 py-3 font-medium lg:table-cell">Bilder</th>
                <th className="px-5 py-3">
                  <span className="sr-only">Åtgärder</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {list.map((e) => (
                <tr key={e.id} className="group hover:bg-paper/40">
                  <td className="px-5 py-4">
                    <Link href={`/admin/evenemang/${e.id}`} className="block">
                      <span className="block font-semibold group-hover:text-red-deep">{e.title}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone">
                        {e.committee && (
                          <>
                            <span className="size-1.5 rounded-full" style={{ background: e.committee.accent }} />
                            {e.committee.short_name}
                          </>
                        )}
                        <span className="md:hidden">· {formatDate(e.starts_at)}</span>
                        {!e.published && <span className="font-semibold text-ink/70 sm:hidden">· Utkast</span>}
                      </span>
                    </Link>
                  </td>
                  <td className="hidden whitespace-nowrap px-3 py-4 tabular md:table-cell">
                    {formatDate(e.starts_at, true)} <span className="text-stone">{e.all_day ? "" : e.starts_at.slice(11)}</span>
                  </td>
                  <td className="hidden px-3 py-4 sm:table-cell">
                    <span className="flex flex-wrap gap-1.5">
                      <StatusBadge published={!!e.published} />
                      {reviewer && <ReviewBadge checked={!!e.checked_at} />}
                    </span>
                  </td>
                  <td className="hidden px-3 py-4 lg:table-cell">
                    <span className="inline-flex items-center gap-1.5 text-stone">
                      <ImageIcon size={15} /> {e.image_count}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-right">
                    {tab === "tidigare" && (
                      <Link href={`/admin/evenemang/ny?fran=${e.id}`} className="btn btn-ghost btn-sm mr-1 bg-white" aria-label={`Kopiera ${e.title}`}>
                        Kopiera
                      </Link>
                    )}
                    {tab === "ogranskade" && (
                      <InlineActionForm action={setEventChecked} className="mr-1 inline-block whitespace-normal text-left align-middle">
                        <input type="hidden" name="id" value={e.id} />
                        <input type="hidden" name="checked" value="1" />
                        <PendingButton className="btn btn-ink btn-sm gap-1.5">
                          <Check size={15} /> Granskad
                          <span className="sr-only">: {e.title}</span>
                        </PendingButton>
                      </InlineActionForm>
                    )}
                    <Link href={`/admin/evenemang/${e.id}`} className={iconClass} aria-label="Redigera">
                      <Edit size={16} />
                    </Link>
                    {!!e.published && (
                      <Link href={`/evenemang/${e.slug}`} target="_blank" className={iconClass} aria-label="Visa på sajten">
                        <ArrowUpRight size={16} />
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
