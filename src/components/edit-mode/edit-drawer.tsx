"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { setNewsCover } from "@/app/admin/_actions/news";
import { FormWatchCtx } from "@/components/admin/action-form";
import { BoardMemberForm, CommitteeForm, ContactSettingsForm, FooterSettingsForm, HomeTextsForm, PageForm, SiteTextsForm } from "@/components/admin/content-forms";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { CoverSlot } from "@/components/admin/cover-slot";
import { EventForm } from "@/components/admin/event-form";
import { EventImagesEditor } from "@/components/admin/event-images-editor";
import { NewsForm } from "@/components/admin/news-form";
import { StarPageForm } from "@/components/admin/star-page-form";
import { ArrowUpRight, Close } from "@/components/icons";
import type { BoardMember, Committee, EventItem, ImageRef, NewsItem, Page, SessionUser, SiteSettings } from "@/lib/types";
import { SITE_TEXT_GROUPS } from "@/lib/site-texts";
import { useFocusLayer } from "@/lib/use-focus-layer";
import { editStore, targetQuery, UNSAVED, useEditState, type EditTarget } from "./store";

const TITLES: Record<EditTarget["type"], string> = {
  page: "Sidans text",
  home: "Startsidans texter",
  footer: "Sidfot och meddelande",
  contact: "Kontaktuppgifter",
  texts: "Texter på sajten",
  committee: "Utskottssidan",
  event: "Evenemanget",
  news: "Nyheten",
  board: "Styrelseposten",
  "event-images": "Evenemangets bilder",
  "news-cover": "Nyhetens omslag",
  resources: "Hjälpmedel",
  star: "STAR-sidans texter",
};

function adminHref(t: EditTarget): string {
  switch (t.type) {
    case "page":
      return `/admin/sidor/${t.slug}`;
    case "home":
    case "footer":
    case "contact":
      return "/admin/installningar";
    case "texts":
      return "/admin/installningar#texter";
    case "committee":
      return `/admin/utskott/${t.id}`;
    case "event":
      return `/admin/evenemang/${t.id}`;
    case "news":
      return `/admin/nyheter/${t.id}`;
    case "board":
      return `/admin/styrelsen/${t.id}`;
    case "event-images":
      return `/admin/bilder/evenemang/${t.id}`;
    case "news-cover":
      return "/admin/bilder#nyheter";
    case "resources":
      return "/admin/hjalpmedel";
    case "star":
      return "/admin/star";
  }
}

/** Formulären i panelen berättar om osparade ändringar och uppladdningar, så att panelen kan fråga eller vänta. */
const WATCH = { dirty: editStore.setDirty, uploading: editStore.setUploading };

/** Sidopanelen som pennorna öppnar. Formulären är desamma som i adminpanelen. */
export function EditDrawer() {
  const { open, asking } = useEditState();
  const router = useRouter();
  const closeRef = useRef<HTMLButtonElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);

  useFocusLayer({ active: !!open, layers: () => [layerRef.current], initial: () => closeRef.current });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // Escape i en dialog ovanpå panelen stänger bara dialogen.
      if (e.key !== "Escape" || document.querySelector("dialog[open]")) return;
      // Annars stänger samma tryck dialogen som frågar om osparade ändringar, i samma ögonblick som den öppnats.
      e.preventDefault();
      editStore.requestClose();
    };
    const overflow = document.body.style.overflow;
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      // Galleribilderna laddas upp via API:t och inte med en server action, så sidan bakom visar dem först efter en uppdatering.
      if (open.type === "event-images") router.refresh();
    };
  }, [open, router]);

  if (!open) return null;
  return (
    <div ref={layerRef} className="fixed inset-0 z-[90]">
      {asking && <ConfirmDialog message={UNSAVED} confirmLabel="Stäng utan att spara" onAnswer={editStore.answerClose} />}
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={() => editStore.requestClose()} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="redigera-rubrik"
        className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col bg-paper text-ink shadow-2xl [animation:drawer-in_0.45s_var(--ease-out-expo)_both]"
      >
        <header className="flex items-center justify-between gap-3 border-b border-ink/10 bg-white px-5 py-4">
          <div className="min-w-0">
            <p className="kicker text-red-deep">Redigera</p>
            <h2 id="redigera-rubrik" className="truncate text-lg font-bold">
              {open.type === "texts" ? SITE_TEXT_GROUPS[open.group] : TITLES[open.type]}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* Med osparade ändringar frågar rutan först och kan stanna kvar, så laddningsraden ska inte starta på klicket. */}
            <Link
              href={adminHref(open)}
              data-utan-laddningsrad
              onClick={(e) => {
                if (!editStore.requestClose(() => router.push(adminHref(open)))) e.preventDefault();
              }}
              className="btn btn-ghost btn-sm hidden bg-white sm:inline-flex"
            >
              I adminpanelen <ArrowUpRight size={15} />
            </Link>
            <button ref={closeRef} type="button" onClick={() => editStore.requestClose()} aria-label="Stäng" className="grid size-10 place-items-center rounded-full border border-ink/15 hover:border-ink">
              <Close size={18} />
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-4 pt-5 sm:px-6">
          <FormWatchCtx value={WATCH}>
            <DrawerBody key={targetQuery(open)} target={open} />
          </FormWatchCtx>
        </div>
      </div>
    </div>
  );
}

type Data = {
  page?: Page;
  settings?: SiteSettings;
  committee?: Committee;
  editor?: boolean;
  event?: EventItem;
  item?: NewsItem;
  member?: BoardMember;
  committees?: Committee[];
  user?: Pick<SessionUser, "role" | "committee_id">;
  cover?: ImageRef | null;
  images?: { id: number; caption: string; image: ImageRef }[];
  events?: Pick<EventItem, "id" | "title" | "starts_at">[];
};

function DrawerBody({ target }: { target: EditTarget }) {
  const router = useRouter();
  const [result, setResult] = useState<{ data: Data } | { error: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/redigera?${targetQuery(target)}`, { signal: controller.signal, cache: "no-store" })
      .then(async (res) => {
        const body = await res.json();
        setResult(res.ok ? { data: body as Data } : { error: body.error ?? "Kunde inte hämta innehållet." });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ error: "Kunde inte hämta innehållet. Kontrollera anslutningen och försök igen." });
      });
    return () => controller.abort();
  }, [target]);

  if (!result) {
    return (
      <div className="grid h-48 place-items-center">
        <div role="status" className="size-8 animate-spin rounded-full border-2 border-ink/15 border-t-red" aria-label="Laddar" />
      </div>
    );
  }
  if ("error" in result) {
    return (
      <p role="alert" className="rounded-2xl border border-red/30 bg-red/[0.06] px-4 py-3 text-sm font-semibold text-red-dark">
        {result.error}
      </p>
    );
  }

  const d = result.data;
  const onSaved = () => {
    editStore.close("Sparat! Sidan visar nu ändringen.");
    router.refresh();
  };
  switch (target.type) {
    case "page":
      return d.page ? <PageForm page={d.page} onSaved={onSaved} /> : null;
    case "home":
      return d.settings ? <HomeTextsForm s={d.settings} onSaved={onSaved} /> : null;
    case "footer":
      return d.settings ? <FooterSettingsForm s={d.settings} onSaved={onSaved} /> : null;
    case "contact":
      return d.settings ? <ContactSettingsForm s={d.settings} onSaved={onSaved} /> : null;
    case "texts":
      return d.settings ? <SiteTextsForm group={target.group} s={d.settings} onSaved={onSaved} /> : null;
    case "committee":
      return d.committee ? <CommitteeForm committee={d.committee} editor={!!d.editor} onSaved={onSaved} /> : null;
    case "event":
      return d.event && d.committees && d.user ? (
        <EventForm event={d.event} committees={d.committees} user={d.user} defaultStart={d.event.starts_at} onSaved={onSaved} />
      ) : null;
    case "news":
      return d.item && d.committees && d.user ? <NewsForm item={d.item} committees={d.committees} user={d.user} onSaved={onSaved} /> : null;
    case "board":
      return d.member && d.committees ? <BoardMemberForm member={d.member} committees={d.committees} nextOrder={d.member.sort_order} onSaved={onSaved} /> : null;
    case "resources":
      return null;
    case "star":
      return d.settings && d.events ? <StarPageForm s={d.settings} events={d.events} onSaved={onSaved} /> : null;
    // Bilderna sparas direkt, och sidan bakom panelen uppdateras när de sparats.
    case "event-images":
      return d.images ? (
        <div className="pb-8">
          <EventImagesEditor eventId={target.id} cover={d.cover ?? null} images={d.images} />
        </div>
      ) : null;
    case "news-cover":
      return (
        <div className="max-w-md pb-8">
          <CoverSlot
            label="Omslagsbild"
            image={d.cover ?? null}
            save={(mediaId) => setNewsCover(target.id, mediaId)}
            hint="Visas under rubriken och på sidan Nytt. Liggande bild, gärna 2100 × 900 px."
          />
        </div>
      );
  }
}
