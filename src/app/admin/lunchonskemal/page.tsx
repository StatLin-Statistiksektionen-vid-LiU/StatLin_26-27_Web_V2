import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { deleteWish, saveWish, setWishStatus } from "@/app/admin/_actions/naringsliv";
import { ActionForm } from "@/components/admin/action-form";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Field, Select, TextArea, TextInput } from "@/components/admin/fields";
import { AdminHeader, EmptyState, Notice } from "@/components/admin/ui";
import { ArrowUpRight, Check, Close, Star, Trash } from "@/components/icons";
import { requireUser } from "@/lib/auth/session";
import { listEventsForAdmin } from "@/lib/data/events";
import { canManageNaringsliv, listWishesForAdmin } from "@/lib/data/naringsliv";
import { formatDate } from "@/lib/dates";
import { isLunchEvent, WISH_COMMENT_MAX, WISH_STATUS_LABELS, WISH_STATUSES, WISH_TITLE_MAX, type LectureWish } from "@/lib/naringsliv";
import type { EventItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata = { title: "Lunchönskemål" };

const TABS = [
  { key: "nya", label: "Nya", match: (w: LectureWish) => w.status === "ny" },
  { key: "listan", label: "På listan", match: (w: LectureWish) => w.status !== "ny" && w.status !== "dold" },
  { key: "dolda", label: "Dolda", match: (w: LectureWish) => w.status === "dold" },
] as const;

export default function AdminLunchWishes(props: PageProps<"/admin/lunchonskemal">) {
  return (
    <Suspense>
      <LunchWishes searchParams={props.searchParams} />
    </Suspense>
  );
}

async function LunchWishes({ searchParams }: { searchParams: PageProps<"/admin/lunchonskemal">["searchParams"] }) {
  const user = await requireUser();
  if (!canManageNaringsliv(user)) redirect("/admin?nekad=1");
  const [wishes, events, sp] = await Promise.all([listWishesForAdmin(), listEventsForAdmin(null), searchParams]);
  const newCount = wishes.filter((w) => w.status === "ny").length;
  const requested = TABS.find((t) => t.key === sp.flik);
  const tab = requested ?? (newCount > 0 ? TABS[0] : TABS[1]);
  const visible = wishes.filter(tab.match);
  if (tab.key === "listan") visible.sort((a, b) => b.votes - a.votes);
  const published = events.filter((e) => e.published);

  return (
    <>
      {typeof sp.klar === "string" && (WISH_STATUSES as readonly string[]).includes(sp.klar) && <Notice>Önskemålet är nu: {WISH_STATUS_LABELS[sp.klar as LectureWish["status"]].toLowerCase()}.</Notice>}
      {sp.raderad && <Notice>Önskemålet är borttaget.</Notice>}
      <AdminHeader
        title="Lunchönskemål"
        description="Studenternas önskemål från sidan Lunchföreläsningar syns där först när någon har godkänt dem. Inget om den som skrev sparas, men läs texten: står det något om en enskild person som inte hör dit, ta bort det."
        actions={
          <Link href="/lunchforelasningar" target="_blank" className="btn btn-ghost btn-sm">
            Visa sidan <ArrowUpRight size={15} />
          </Link>
        }
      />

      <nav aria-label="Urval" className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const count = wishes.filter(t.match).length;
          return (
            <Link
              key={t.key}
              href={`/admin/lunchonskemal?flik=${t.key}`}
              aria-current={t.key === tab.key ? "page" : undefined}
              className={cn("btn btn-sm", t.key === tab.key ? "btn-ink" : "btn-ghost")}
            >
              {t.label} <span className="tabular opacity-70">{count}</span>
            </Link>
          );
        })}
      </nav>

      {visible.length === 0 ? (
        <EmptyState title={tab.key === "nya" ? "Inga nya önskemål" : tab.key === "dolda" ? "Inga dolda önskemål" : "Listan är tom"}>
          {tab.key === "listan" ? "Godkända önskemål hamnar här och på sajten." : "Här finns inget att göra just nu."}
        </EmptyState>
      ) : (
        <ul className="space-y-4">
          {visible.map((w) => (
            <WishCard key={w.id} wish={w} tab={tab.key} events={published} />
          ))}
        </ul>
      )}
    </>
  );
}

function QuickStatus({ id, status, tab, children, primary }: { id: number; status: LectureWish["status"]; tab: string; children: React.ReactNode; primary?: boolean }) {
  return (
    <form action={setWishStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="flik" value={tab} />
      <button type="submit" className={cn("btn btn-sm", primary ? "btn-ink" : "btn-ghost")}>
        {children}
      </button>
    </form>
  );
}

function WishCard({ wish, tab, events }: { wish: LectureWish; tab: string; events: EventItem[] }) {
  const lunch = events.filter(isLunchEvent);
  const rest = events.filter((e) => !isLunchEvent(e));
  return (
    <li className="rounded-[1.5rem] border border-ink/10 bg-white p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold [overflow-wrap:anywhere]">{wish.title}</p>
          {wish.comment && <p className="mt-1 text-[0.95rem] text-stone [overflow-wrap:anywhere]">{wish.comment}</p>}
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone">
            <span className="font-semibold text-ink">{WISH_STATUS_LABELS[wish.status]}</span>
            <span>{formatDate(wish.created_on, true)}</span>
            <span className="inline-flex items-center gap-1 tabular">
              <Star size={13} /> {wish.votes}
            </span>
            {wish.event_slug && (
              <Link href={`/evenemang/${wish.event_slug}`} target="_blank" className="underline underline-offset-2">
                {wish.event_title}
              </Link>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {wish.status !== "onskad" && wish.status !== "pa_gang" && wish.status !== "bokad" && wish.status !== "genomford" && (
            <QuickStatus id={wish.id} status="onskad" tab={tab} primary>
              <Check size={15} /> Godkänn
            </QuickStatus>
          )}
          {wish.status !== "dold" && (
            <QuickStatus id={wish.id} status="dold" tab={tab}>
              <Close size={15} /> Dölj
            </QuickStatus>
          )}
          <ConfirmButton action={deleteWish} id={wish.id} message={`Ta bort "${wish.title}"? Det går inte att ångra.`}>
            <Trash size={15} /> Ta bort
          </ConfirmButton>
        </div>
      </div>
      <details className="mt-4 border-t border-ink/10 pt-3">
        <summary className="tryck cursor-pointer text-sm font-semibold">Ändra text, status och evenemang</summary>
        <div className="mt-4">
          <ActionForm action={saveWish} stickyFooter={false}>
            <input type="hidden" name="id" value={wish.id} />
            <Field label="Önskemål" name="title" inputId={`titel-${wish.id}`} required>
              <TextInput name="title" defaultValue={wish.title} maxLength={WISH_TITLE_MAX} id={`titel-${wish.id}`} />
            </Field>
            <Field label="Kommentar" name="comment" inputId={`kommentar-${wish.id}`}>
              <TextArea name="comment" defaultValue={wish.comment} maxLength={WISH_COMMENT_MAX} rows={2} id={`kommentar-${wish.id}`} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Status" name="status" inputId={`status-${wish.id}`}>
                <Select name="status" defaultValue={wish.status} id={`status-${wish.id}`}>
                  {WISH_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {WISH_STATUS_LABELS[s]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Evenemang" name="event_id" inputId={`evenemang-${wish.id}`}>
                <Select name="event_id" defaultValue={wish.event_id ?? ""} id={`evenemang-${wish.id}`}>
                  <option value="">Inget</option>
                  {lunch.length > 0 && (
                    <optgroup label="Lunchföreläsningar">
                      {lunch.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.title} ({formatDate(e.starts_at, true)})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Övriga">
                    {rest.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.title} ({formatDate(e.starts_at, true)})
                      </option>
                    ))}
                  </optgroup>
                </Select>
              </Field>
            </div>
          </ActionForm>
        </div>
      </details>
    </li>
  );
}
