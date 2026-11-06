"use client";

import { unstable_rethrow } from "next/navigation";
import { useRef, useState, useTransition, type DragEvent } from "react";
import { deleteEventImage, reorderEventImages, setEventCover, updateImageCaption } from "@/app/admin/_actions/events";
import { Check, ChevronLeft, ChevronRight, Grip, Image as ImageIcon, Star, Trash, Upload } from "@/components/icons";
import { useConfirm } from "./confirm-dialog";
import { isImageFile, uploadFile } from "./upload";
import type { ImageRef } from "@/lib/types";
import { cn } from "@/lib/utils";

type Item = { id: number; caption: string; image: ImageRef };
type Pending = { key: string; file: File; name: string; preview: string; progress: number; error?: string };
type Job = { key: string; file: File; order: number };

/** Servern kör sharp på en liten maskin (SD-22), så uppladdningarna köas i stället för att skickas samtidigt. */
const PARALLEL = 2;

/** En fil från datorn, inte en galleribild som flyttas. Webbläsaren öppnar filen och lämnar sidan om ingen tar emot den. */
const carriesFiles = (e: DragEvent) => e.dataTransfer.types.includes("Files");

/**
 * Bildgalleri för ett evenemang. Flera bilder kan dras in samtidigt; de laddas upp i en kö
 * med förlopp, optimeras på servern och dyker upp direkt på evenemangssidan.
 */
export function GalleryManager({
  eventId,
  initial,
  coverMediaId,
  onCoverChange,
}: {
  eventId: number;
  initial: Item[];
  coverMediaId: number | null;
  /** Körs när stjärnan väljer eller tar bort omslaget, så att ett omslagsfält bredvid kan visa det. */
  onCoverChange?: (image: ImageRef | null) => void;
}) {
  const [items, setItems] = useState<Item[]>(initial);
  const [pending, setPending] = useState<Pending[]>([]);
  const [cover, setCover] = useState<number | null>(coverMediaId);
  // Omslaget kan också bytas utanför galleriet (formuläret eller omslagsfältet) – följ med när det sparats.
  const [coverProp, setCoverProp] = useState(coverMediaId);
  if (coverMediaId !== coverProp) {
    setCoverProp(coverMediaId);
    setCover(coverMediaId);
  }
  const [over, setOver] = useState(false);
  const [dragId, setDragId] = useState<number | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [moved, setMoved] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [confirm, confirmDialog] = useConfirm();
  const inputRef = useRef<HTMLInputElement>(null);

  // Listan läses när uppladdningarna är klara, så den måste alltid vara aktuell – inte som vid en tidigare rendering.
  const itemsRef = useRef(items);
  const updateItems = (update: (list: Item[]) => Item[]) => {
    itemsRef.current = update(itemsRef.current);
    setItems(itemsRef.current);
  };

  // En enda kö, också när nya bilder dras in medan andra laddas upp. Rangen är ordningen de valdes i.
  const queue = useRef<Job[]>([]);
  const active = useRef(0);
  const nextOrder = useRef(0);
  const rank = useRef(new Map<number, number>());

  /** Kör en sparning och visar felet i galleriet. Svarar med om den gick igenom. */
  const attempt = async (save: () => Promise<{ error: string } | void>) => {
    try {
      const res = await save();
      if (res && "error" in res) {
        setNotice(res.error);
        return false;
      }
      return true;
    } catch (err) {
      unstable_rethrow(err);
      setNotice("Det gick inte att spara. Ladda om sidan och försök igen.");
      return false;
    }
  };

  const saveOrder = () => startTransition(async () => void (await attempt(() => reorderEventImages(eventId, itemsRef.current.map((x) => x.id)))));

  const upload = async ({ file, key, order }: Job) => {
    try {
      const res = await uploadFile(file, { purpose: "gallery", eventId: String(eventId) }, (progress) =>
        setPending((p) => p.map((x) => (x.key === key ? { ...x, progress } : x))),
      );
      rank.current.set(res.id, order);
      if (res.image) {
        const added = { id: res.id, caption: "", image: res.image };
        // Bilderna blir klara i olika takt – de nya läggs i urvalsordningen.
        updateItems((list) => {
          const next = [...list, added];
          const fresh = next.filter((x) => rank.current.has(x.id)).sort((a, b) => rank.current.get(a.id)! - rank.current.get(b.id)!);
          return [...next.filter((x) => !rank.current.has(x.id)), ...fresh];
        });
      }
      setPending((p) => {
        const done = p.find((x) => x.key === key);
        if (done) URL.revokeObjectURL(done.preview);
        return p.filter((x) => x.key !== key);
      });
    } catch (e) {
      setPending((p) => p.map((x) => (x.key === key ? { ...x, error: (e as Error).message } : x)));
    }
  };

  const runQueue = () => {
    while (active.current < PARALLEL && queue.current.length > 0) {
      active.current++;
      upload(queue.current.shift()!).finally(() => {
        active.current--;
        runQueue();
        if (active.current > 0 || queue.current.length > 0) return;
        // Ordningen räknas från listan som den ser ut nu, så att en borttagen bild inte kommer tillbaka och en ny inte tappas.
        const moved = rank.current.size > 1;
        rank.current.clear();
        if (moved) saveOrder();
      });
    }
  };

  const addFiles = (files: File[]) => {
    const images = files.filter(isImageFile);
    setNotice(images.length < files.length ? "Bara bilder kan läggas i galleriet. De andra filerna hoppades över." : null);
    if (images.length === 0) return;
    const jobs = images.map((file) => ({ file, key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`, order: nextOrder.current++ }));
    setPending((p) => [...p, ...jobs.map((j) => ({ key: j.key, file: j.file, name: j.file.name, preview: URL.createObjectURL(j.file), progress: 0 }))]);
    queue.current.push(...jobs);
    runQueue();
  };

  const retry = (p: Pending) => {
    setPending((list) => list.map((x) => (x.key === p.key ? { ...x, error: undefined, progress: 0 } : x)));
    queue.current.push({ file: p.file, key: p.key, order: nextOrder.current++ });
    runQueue();
  };

  const dismiss = (p: Pending) => {
    URL.revokeObjectURL(p.preview);
    setPending((list) => list.filter((x) => x.key !== p.key));
  };

  const remove = async (item: Item) => {
    if (!(await confirm("Ta bort bilden från galleriet?"))) return;
    const index = itemsRef.current.findIndex((x) => x.id === item.id);
    const wasCover = cover === item.image.id;
    setNotice(null);
    updateItems((list) => list.filter((x) => x.id !== item.id));
    if (wasCover) {
      setCover(null);
      onCoverChange?.(null);
    }
    startTransition(async () => {
      if (await attempt(() => deleteEventImage(item.id))) return;
      // Bilden finns kvar på servern, så den ska också synas kvar.
      updateItems((list) => [...list.slice(0, index), item, ...list.slice(index)]);
      if (wasCover) {
        setCover(item.image.id);
        onCoverChange?.(item.image);
      }
    });
  };

  const makeCover = (item: Item) => {
    const before = cover;
    const next = cover === item.image.id ? null : item.image.id;
    setNotice(null);
    setCover(next);
    onCoverChange?.(next === null ? null : item.image);
    startTransition(async () => {
      if (await attempt(() => setEventCover(eventId, next))) return;
      setCover(before);
      onCoverChange?.(itemsRef.current.find((x) => x.image.id === before)?.image ?? null);
    });
  };

  const saveCaption = (item: Item, caption: string) => {
    if (caption === item.caption) return;
    setNotice(null);
    updateItems((list) => list.map((x) => (x.id === item.id ? { ...x, caption } : x)));
    startTransition(async () => {
      // Bocken bara när bildtexten faktiskt sparats (inte t.ex. med en utgången session).
      if (!(await attempt(() => updateImageCaption(item.id, caption)))) {
        // Texten står kvar i rutan, och nästa gång man lämnar rutan försöker den igen.
        updateItems((list) => list.map((x) => (x.id === item.id ? { ...x, caption: item.caption } : x)));
        return;
      }
      setSaved(item.id);
      setTimeout(() => setSaved((s) => (s === item.id ? null : s)), 1500);
    });
  };

  const onDropReorder = (targetId: number) => {
    if (dragId === null || dragId === targetId) return;
    setNotice(null);
    updateItems((current) => {
      const list = [...current];
      const from = list.findIndex((x) => x.id === dragId);
      const to = list.findIndex((x) => x.id === targetId);
      const [moved] = list.splice(from, 1);
      list.splice(to, 0, moved);
      return list;
    });
    setDragId(null);
    // Handen går före urvalsordningen: bilder som blir klara senare läggs efter de som redan flyttats.
    rank.current.clear();
    saveOrder();
  };

  /** Flyttar med knapparna, som alternativ till att dra. Fokus följer med knappen, också när den tar slut vid kanten. */
  const move = (index: number, step: -1 | 1, button: HTMLButtonElement) => {
    const list = [...itemsRef.current];
    const [moved] = list.splice(index, 1);
    list.splice(index + step, 0, moved);
    setNotice(null);
    updateItems(() => list);
    setMoved(`Bilden flyttades till plats ${index + step + 1} av ${list.length}.`);
    // Handen går före urvalsordningen, precis som när man drar.
    rank.current.clear();
    saveOrder();
    requestAnimationFrame(() => (button.disabled ? button.parentElement?.querySelector<HTMLButtonElement>("button:not(:disabled)") : button)?.focus());
  };

  return (
    <div
      onDragOver={(e) => {
        if (carriesFiles(e)) e.preventDefault();
      }}
      onDrop={(e) => {
        if (!carriesFiles(e)) return;
        e.preventDefault();
        setOver(false);
        addFiles([...e.dataTransfer.files]);
      }}
    >
      {confirmDialog}
      <div
        onDragOver={() => {
          if (dragId === null) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
          over ? "border-red bg-red/5" : "border-ink/15 bg-paper/50",
        )}
      >
        <span className="grid size-12 place-items-center rounded-full bg-ink text-white">
          <Upload size={20} />
        </span>
        <div>
          <p className="font-semibold">Dra in bilder här</p>
          <p className="text-sm text-stone">eller välj flera på en gång. De optimeras automatiskt, och bilderna på sajten saknar platsdata (originalet sparas internt, utan att vara åtkomligt från webben).</p>
        </div>
        <button type="button" onClick={() => inputRef.current?.click()} className="btn btn-ink btn-sm">
          <ImageIcon size={15} /> Välj bilder
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          aria-label="Välj bilder till galleriet"
          className="hidden"
          onChange={(e) => {
            addFiles([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
      </div>

      {notice && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-deep">
          {notice}
        </p>
      )}

      {(items.length > 0 || pending.length > 0) && (
        <>
          <p className="mt-6 text-sm text-stone">
            {items.length} {items.length === 1 ? "bild" : "bilder"} · dra eller använd pilarna för att ändra ordning · ★ = omslagsbild
          </p>
          <p role="status" className="sr-only">
            {moved}
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item, i) => {
              const name = `bild ${i + 1}${item.caption ? `, ${item.caption}` : ""}`;
              return (
              <li
                key={item.id}
                draggable
                onDragStart={() => setDragId(item.id)}
                onDragEnd={() => setDragId(null)}
                onDragOver={(e) => dragId !== null && e.preventDefault()}
                onDrop={(e) => {
                  if (dragId === null) return;
                  e.preventDefault();
                  onDropReorder(item.id);
                }}
                className={cn(
                  "group overflow-hidden rounded-2xl border bg-white transition-all",
                  dragId === item.id ? "scale-95 opacity-40" : "border-ink/10",
                  cover === item.image.id && "ring-2 ring-red",
                )}
              >
                <div className="relative aspect-[4/3] cursor-grab active:cursor-grabbing">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.image.thumb} alt="" className="h-full w-full object-cover" style={{ backgroundColor: item.image.color }} draggable={false} />
                  <span className="absolute left-2 top-2 grid size-7 place-items-center tema-fast rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100">
                    <Grip size={14} />
                  </span>
                  <div className="absolute right-2 top-2 flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => makeCover(item)}
                      title={cover === item.image.id ? "Omslagsbild (klicka för att ta bort)" : "Använd som omslagsbild"}
                      aria-label={cover === item.image.id ? `Ta bort ${name} som omslagsbild` : `Använd ${name} som omslagsbild`}
                      aria-pressed={cover === item.image.id}
                      className={cn("grid size-8 place-items-center rounded-full shadow", cover === item.image.id ? "bg-red text-white" : "bg-white/90 text-ink hover:bg-white")}
                    >
                      <Star size={15} fill={cover === item.image.id ? "currentColor" : "none"} />
                    </button>
                    <button type="button" onClick={() => remove(item)} title="Ta bort" aria-label={`Ta bort ${name}`} className="grid size-8 place-items-center rounded-full bg-white/90 text-red-deep shadow hover:bg-white">
                      <Trash size={15} />
                    </button>
                  </div>
                  {items.length > 1 && (
                    <div className="absolute bottom-2 left-2 flex gap-1.5">
                      <button
                        type="button"
                        disabled={i === 0}
                        onClick={(e) => move(i, -1, e.currentTarget)}
                        title="Flytta vänster"
                        aria-label={`Flytta ${name} ett steg åt vänster`}
                        className="grid size-8 place-items-center rounded-full bg-white/90 text-ink shadow hover:bg-white disabled:opacity-40"
                      >
                        <ChevronLeft size={15} />
                      </button>
                      <button
                        type="button"
                        disabled={i === items.length - 1}
                        onClick={(e) => move(i, 1, e.currentTarget)}
                        title="Flytta höger"
                        aria-label={`Flytta ${name} ett steg åt höger`}
                        className="grid size-8 place-items-center rounded-full bg-white/90 text-ink shadow hover:bg-white disabled:opacity-40"
                      >
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="relative">
                  <input
                    defaultValue={item.caption}
                    placeholder="Bildtext…"
                    aria-label="Bildtext"
                    maxLength={300}
                    onBlur={(e) => saveCaption(item, e.target.value.trim())}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), (e.target as HTMLInputElement).blur())}
                    className="w-full border-t border-ink/10 px-3 py-2 pr-8 text-sm outline-none focus:bg-paper/60"
                  />
                  {saved === item.id && <Check size={15} className="absolute right-2.5 top-2.5 text-emerald-600" />}
                </div>
              </li>
              );
            })}
            {pending.map((p) => (
              <li key={p.key} className="overflow-hidden rounded-2xl border border-ink/10 bg-white">
                <div className="relative aspect-[4/3]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.preview} alt="" className="h-full w-full object-cover opacity-50" />
                  <div className="absolute inset-x-3 bottom-3">
                    {p.error ? (
                      <p className="rounded-lg bg-white px-2 py-1 text-xs font-semibold text-red-deep">{p.error}</p>
                    ) : (
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/70">
                        <div className="h-full bg-red transition-[width]" style={{ width: `${Math.max(4, Math.round(p.progress * 100))}%` }} />
                      </div>
                    )}
                  </div>
                </div>
                {p.error ? (
                  <div className="border-t border-ink/10 px-3 py-2">
                    <p className="truncate text-xs text-stone">{p.name}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <button type="button" onClick={() => retry(p)} className="btn btn-sm btn-ink">
                        Försök igen
                      </button>
                      <button type="button" onClick={() => dismiss(p)} className="btn btn-sm btn-ghost bg-white">
                        Ta bort
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="truncate border-t border-ink/10 px-3 py-2 text-xs text-stone">{p.progress < 1 ? `Laddar upp ${p.name}` : "Optimerar…"}</p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
