"use client";

import { useState } from "react";
import { setEventCover } from "@/app/admin/_actions/events";
import type { ImageRef } from "@/lib/types";
import { CoverSlot } from "./cover-slot";
import { GalleryManager } from "./gallery-manager";

type Item = { id: number; caption: string; image: ImageRef };

/**
 * Omslag och galleri för ett evenemang, på sidan Bilder och i redigeringsläget. Omslagsfältet och
 * stjärnan i galleriet visar samma omslag, vilket av dem man än byter med.
 */
export function EventImagesEditor({ eventId, cover: savedCover, images }: { eventId: number; cover: ImageRef | null; images: Item[] }) {
  const [cover, setCover] = useState(savedCover);
  return (
    <div className="space-y-8">
      <div className="max-w-md">
        <CoverSlot
          name="cover_media_id"
          label="Omslagsbild"
          image={cover}
          save={(mediaId) => setEventCover(eventId, mediaId)}
          onSaved={setCover}
          hint="Visas överst på evenemangssidan och i listorna. Liggande bild, gärna 1600 × 900 px."
        />
      </div>
      <div>
        <p className="mb-1.5 text-sm font-semibold">Bildgalleri</p>
        <p className="mb-4 text-[0.82rem] text-stone">Bilderna sparas direkt och syns på evenemangssidan och i galleriet så länge evenemanget är publicerat. ★ gör en galleribild till omslag.</p>
        <GalleryManager eventId={eventId} initial={images} coverMediaId={cover?.id ?? null} onCoverChange={setCover} />
      </div>
    </div>
  );
}
