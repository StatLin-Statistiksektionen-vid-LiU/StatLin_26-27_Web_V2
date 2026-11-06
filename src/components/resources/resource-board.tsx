"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { EditModeLink } from "@/components/edit-mode/editable";
import { ArrowUpRight, Chain, Download, FileText, Image as ImageIcon } from "@/components/icons";
import { PROGRAMS } from "@/lib/links";
import { fileLabel, groupResources, linkHost, RESOURCE_CATEGORIES, termSeason } from "@/lib/resources";
import type { Program, ResourceItem } from "@/lib/types";
import { cn, safeExternalUrl } from "@/lib/utils";

/** Hjälpmedlen under flikarna Kandidat och Master, per årskurs och termin. */
export function ResourceBoard({ resources, initialProgram }: { resources: ResourceItem[]; initialProgram: Program }) {
  const [program, setProgram] = useState(initialProgram);
  const { years, whole } = groupResources(resources, program);

  function chooseProgram(p: Program) {
    setProgram(p);
    // Fliken hamnar i adressen, så att länken till Master-fliken går att dela och överlever en omladdning.
    const url = new URL(window.location.href);
    if (p === "master") url.searchParams.set("program", "master");
    else url.searchParams.delete("program");
    window.history.replaceState(null, "", url);
  }

  return (
    <section aria-label="Hjälpmedel per program" className="container-site py-12 md:py-20">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div role="tablist" aria-label="Program" className="inline-flex rounded-lg border border-line bg-white p-0.5">
          {PROGRAMS.map((p) => (
            <button
              key={p.value}
              type="button"
              role="tab"
              id={`flik-${p.value}`}
              aria-selected={program === p.value}
              aria-controls="hjalpmedel-lista"
              tabIndex={program === p.value ? 0 : -1}
              onClick={() => chooseProgram(p.value)}
              onKeyDown={(e) => {
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
                e.preventDefault();
                const at = PROGRAMS.indexOf(p);
                const next =
                  e.key === "Home" ? PROGRAMS[0]
                  : e.key === "End" ? PROGRAMS[PROGRAMS.length - 1]
                  : PROGRAMS[(at + (e.key === "ArrowRight" ? 1 : -1) + PROGRAMS.length) % PROGRAMS.length];
                chooseProgram(next.value);
                document.getElementById(`flik-${next.value}`)?.focus();
              }}
              className={cn("h-8 rounded-md px-3.5 text-[0.84rem] font-medium transition-colors pointer-coarse:h-10", program === p.value ? "bg-ink text-paper" : "text-stone hover:text-ink")}
            >
              {p.label}
            </button>
          ))}
        </div>
        <EditModeLink target={{ type: "resources" }} href="/admin/hjalpmedel" icon="edit">
          Hantera hjälpmedel
        </EditModeLink>
      </div>

      <div id="hjalpmedel-lista" role="tabpanel" aria-labelledby={`flik-${program}`} className="mt-10 space-y-14 md:space-y-16">
        {years.length === 0 && whole.length === 0 && (
          <p className="max-w-xl leading-relaxed text-stone">
            Det finns inga hjälpmedel här ännu. Har du något som kan hjälpa andra?{" "}
            <Link href="/kontakt" className="font-semibold text-ink underline underline-offset-4 hover:text-red-deep">
              Hör av dig till styrelsen
            </Link>
            .
          </p>
        )}
        {years.map(({ year, terms }) => (
          <Group key={year} title={`År ${year}`}>
            <div className="space-y-10">
              {terms.map(({ term, items }) => (
                <div key={term}>
                  <h3 className="flex items-baseline justify-between gap-4 border-b border-ink/10 pb-3">
                    <span className="display-tight text-lg">Termin {term}</span>
                    <span className="kicker text-stone">{termSeason(term)}</span>
                  </h3>
                  <ResourceList items={items} />
                </div>
              ))}
            </div>
          </Group>
        ))}
        {whole.length > 0 && (
          <Group title="Hela programmet">
            <div className="border-t border-ink/10">
              <ResourceList items={whole} />
            </div>
          </Group>
        )}
      </div>
    </section>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <h2 className="display-tight text-2xl lg:col-span-3">{title}</h2>
      <div className="min-w-0 lg:col-span-9">{children}</div>
    </div>
  );
}

function ResourceList({ items }: { items: ResourceItem[] }) {
  return (
    <ul>
      {items.map((r) => {
        const href = r.file?.href ?? safeExternalUrl(r.url);
        const Icon = !r.file ? Chain : r.file.image ? ImageIcon : FileText;
        const Action = r.file ? Download : ArrowUpRight;
        const meta = r.file ? fileLabel(r.file) : linkHost(r.url);
        return (
          <li key={r.id} className="border-b border-line">
            <a href={href ?? "#"} target={href ? "_blank" : undefined} rel="noopener noreferrer" className="group flex items-center gap-4 py-5 transition-colors hover:bg-paper-2/60 sm:gap-5">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-paper-2/60 text-ink transition-colors group-hover:border-red/40 group-hover:text-red">
                <Icon size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className="min-w-0 font-bold tracking-tight [overflow-wrap:anywhere]">{r.title}</span>
                  <span className="rounded-md border border-line px-2 py-0.5 text-xs font-medium text-stone">{RESOURCE_CATEGORIES[r.category]}</span>
                </span>
                {r.description && <span className="mt-1 block text-sm text-stone">{r.description}</span>}
                {meta && <span className="kicker mt-1.5 block text-stone">{meta}</span>}
              </span>
              <Action size={20} className="shrink-0 text-red opacity-60 transition-opacity group-hover:opacity-100" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
