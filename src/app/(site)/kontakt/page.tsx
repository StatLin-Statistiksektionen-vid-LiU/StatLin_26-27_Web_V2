import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Markdown } from "@/components/content/markdown";
import { Editable } from "@/components/edit-mode/editable";
import { Facebook, Instagram, Linkedin, Mail, MapPin } from "@/components/icons";
import { AccentText, stripAccent } from "@/components/ui/accent-text";
import { PageHero } from "@/components/ui/page-hero";
import { PageSkeleton } from "@/components/ui/skeletons";
import { getPage, getSettings, listBoard, listCommittees } from "@/lib/data/content";

export const metadata: Metadata = {
  title: "Kontakt",
  description: "Kontakta StatLins styrelse och utskott.",
};

export default function ContactPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Contact />
    </Suspense>
  );
}

async function Contact() {
  const [page, settings, board, committees] = await Promise.all([getPage("kontakt"), getSettings(), listBoard(), listCommittees({ visibleOnly: true })]);
  const socials = [
    { href: settings.instagram, label: "Instagram", Icon: Instagram },
    { href: settings.facebook, label: "Facebook", Icon: Facebook },
    { href: settings.linkedin, label: "LinkedIn", Icon: Linkedin },
  ].filter((s) => s.href);
  const title = page?.title ?? "Kontakt";
  const body = page?.body_md.trim();

  return (
    <>
      <Editable target={{ type: "page", slug: "kontakt" }} label="Redigera sidan" inset penClassName="top-[calc(var(--header-h)+1rem)] right-4">
        <PageHero
          kicker="Kontakt"
          title={<AccentText text={title} accentClassName="text-red" />}
          fitTitle={stripAccent(title)}
          lead={page?.lead}
        >
          <Editable target={{ type: "contact" }} label="Redigera kontaktuppgifterna" className="w-fit">
            <a href={`mailto:${settings.contact_email}`} className="group inline-flex items-center gap-4 text-[clamp(1.3rem,3vw,2.2rem)] font-semibold">
              <span className="grid size-12 place-items-center rounded-full bg-red text-white transition-transform group-hover:rotate-[-12deg]">
                <Mail size={22} />
              </span>
              <span className="link-underline">{settings.contact_email}</span>
            </a>
          </Editable>
        </PageHero>
      </Editable>

      <section className="container-site grid gap-16 py-16 md:py-24 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-7">
          {body && (
            <Editable target={{ type: "page", slug: "kontakt" }} label="Redigera texten" className="mb-14">
              <Markdown source={body} />
            </Editable>
          )}
          <h2 className="kicker text-stone">Styrelsen</h2>
          <ul className="mt-4 border-t border-line">
            {board.map((m) => (
              <li key={m.id} className="grid gap-1 border-b border-line py-4 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6">
                <div>
                  <p className="font-semibold">{m.post}</p>
                  <p className="text-sm text-stone">{m.name || "Vakant"}</p>
                </div>
                {m.email && (
                  <a href={`mailto:${m.email}`} className="tryck inline-flex items-center gap-2 font-mono text-sm text-red-deep">
                    <Mail size={14} />
                    <span className="link-underline">{m.email}</span>
                  </a>
                )}
              </li>
            ))}
          </ul>

          <h2 className="kicker mt-14 text-stone">Utskott</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {committees
              .filter((c) => c.kind !== "styrelse" && c.email)
              .map((c) => (
                <li key={c.id}>
                  <a href={`mailto:${c.email}`} className="group flex items-center gap-4 rounded-xl border border-line bg-white p-4 transition-colors hover:border-ink/20">
                    {c.logo_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.logo_url} alt="" className="size-11 rounded-lg object-contain p-0.5 [[data-tema=mork]_&]:bg-ink" loading="lazy" />
                    )}
                    <span className="min-w-0">
                      <span className="block font-semibold">{c.short_name}</span>
                      <span className="block truncate font-mono text-xs text-stone group-hover:text-red-deep">{c.email}</span>
                    </span>
                  </a>
                </li>
              ))}
          </ul>
        </div>

        <aside className="space-y-4 lg:col-span-4 lg:col-start-9">
          <Editable target={{ type: "contact" }} label="Redigera kontaktuppgifterna" className="space-y-4">
            <div className="rounded-xl border border-line bg-white p-6">
              <MapPin size={22} className="text-red" />
              <p className="kicker mt-5 text-stone">Adress</p>
              <p className="mt-2 text-lg leading-relaxed">{settings.address}</p>
              {settings.sektionsrum && (
                <>
                  <p className="kicker mt-6 text-stone">Sektionsrum</p>
                  <p className="mt-2">{settings.sektionsrum}</p>
                </>
              )}
              {settings.org_number && <p className="kicker mt-6 text-stone">Org.nr {settings.org_number}</p>}
            </div>
            {socials.length > 0 && (
              <div className="rounded-xl border border-line bg-white p-6">
                <p className="kicker text-stone">Följ oss</p>
                <ul className="mt-4 space-y-2">
                  {socials.map(({ href, label, Icon }) => (
                    <li key={label}>
                      <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 font-semibold hover:text-red-deep">
                        <Icon size={18} /> {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Editable>
          <Link href="/foretag" className="block rounded-xl border border-line bg-white p-6 transition-colors hover:border-ink/20">
            <p className="kicker text-stone">Företag?</p>
            <p className="mt-2 font-semibold">Läs om samarbeten och STAR →</p>
          </Link>
        </aside>
      </section>
    </>
  );
}
