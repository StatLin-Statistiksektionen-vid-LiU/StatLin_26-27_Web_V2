import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-ink/[0.06]", className)} />;
}

/** Utan JavaScript kommer innehållet aldrig i skelettets ställe. Då döljs benen (globals.css) och sidan säger varför (SB-27). */
function NoScriptNote({ className, english }: { className?: string; english?: boolean }) {
  return (
    <noscript>
      <p className={cn("max-w-xl text-lg", className)}>
        {english ? "This part of the page needs JavaScript. Turn it on in your browser to see the content." : "Den här delen av sidan behöver JavaScript. Slå på det i webbläsaren, så visas innehållet."}
      </p>
    </noscript>
  );
}

export function HomeSkeleton() {
  return (
    <div className="container-site space-y-8 py-24">
      <NoScriptNote className="text-stone" />
      <Bone className="h-10 w-1/3" />
      <Bone className="h-28 w-2/3" />
      <div className="grid gap-6 md:grid-cols-3">
        <Bone className="h-80" />
        <Bone className="h-80" />
        <Bone className="h-80" />
      </div>
    </div>
  );
}

/** `note={false}` när skelettet står under ett HeroSkeleton, som redan säger samma sak utan JavaScript. */
export function PageSkeleton({ note = true }: { note?: boolean }) {
  return (
    <div className="container-site space-y-6 py-20">
      {note && <NoScriptNote className="text-stone" />}
      <Bone className="h-8 w-48" />
      <Bone className="h-5 w-full max-w-2xl" />
      <Bone className="h-5 w-full max-w-xl" />
      <div className="grid gap-6 pt-6 md:grid-cols-3">
        <Bone className="h-64" />
        <Bone className="h-64" />
        <Bone className="h-64" />
      </div>
    </div>
  );
}

export function HeroSkeleton({ english }: { english?: boolean }) {
  return (
    <section className="border-b border-line pb-12 pt-[calc(var(--header-h)+3rem)] md:pb-14 md:pt-[calc(var(--header-h)+4.5rem)]">
      <div className="container-site space-y-6">
        <NoScriptNote className="text-stone" english={english} />
        <div className="h-3 w-40 animate-pulse rounded bg-ink/[0.06]" />
        <div className="h-20 w-2/3 animate-pulse rounded-xl bg-ink/[0.06]" />
        <div className="h-5 w-1/2 animate-pulse rounded bg-ink/[0.06]" />
      </div>
    </section>
  );
}
