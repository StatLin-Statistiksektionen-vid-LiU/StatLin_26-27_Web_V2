import type { Metadata } from "next";
import { Suspense } from "react";
import { BoardCard } from "@/components/content/board-card";
import { TextHero } from "@/components/ui/text-hero";
import { Reveal } from "@/components/ui/reveal";
import { PageSkeleton } from "@/components/ui/skeletons";
import { listBoard } from "@/lib/data/content";

export const metadata: Metadata = {
  title: "Styrelsen",
  description: "StatLins styrelse: poster, ansvarsområden och kontaktuppgifter.",
};

export default function BoardPage() {
  return (
    <>
      <TextHero group="styrelsen" />
      <Suspense fallback={<PageSkeleton />}>
        <Board />
      </Suspense>
    </>
  );
}

async function Board() {
  const board = await listBoard();
  return (
    <section className="container-site py-16 md:py-24">
      {board.length === 0 ? (
        <p className="text-center text-stone">Styrelsen presenteras snart.</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-5 gap-y-12 md:grid-cols-3 lg:grid-cols-4">
          {board.map((m, i) => (
            <Reveal key={m.id} delay={(i % 4) * 70}>
              <BoardCard member={m} />
            </Reveal>
          ))}
        </div>
      )}
    </section>
  );
}
