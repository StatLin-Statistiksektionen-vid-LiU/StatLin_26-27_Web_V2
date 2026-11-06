import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { FloatingLogo } from "@/components/brand/floating-logo";
import { HeroGrid } from "@/components/home/hero-grid";
import { ArrowLeft } from "@/components/icons";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { loginErrorText } from "@/lib/auth/login-errors";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Logga in",
  robots: { index: false },
};

// Sidan renderas hel vid varje anrop, utan statiskt skal. Med ett skal svarar Next på ett formulär som skickats utan JavaScript
// med bara det dynamiska innehållet, och besökaren får en vit sida. Felmeddelandet och "Du är utloggad" läses dessutom ur adressen,
// och ett hål i skalet skulle inte synas utan JavaScript (SB-27).
export const instant = false;

export default async function LoginPage(props: PageProps<"/logga-in">) {
  const { utloggad, next, fel } = await props.searchParams;
  return (
    <main className="grid min-h-dvh bg-paper text-ink lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* Samma millimeterpapper som startsidans hero, med loggan direkt på papperet. Rollfärgerna gör att den följer båda lägena. */}
      <section className="relative isolate hidden overflow-hidden border-r border-line lg:flex lg:flex-col">
        <HeroGrid className="hero-rutnat-mitt" />
        <div aria-hidden className="kicker flex justify-between px-10 pt-9 text-stone-light">
          <span>Fig. 2</span>
          <span>58.3978° N · 15.5760° E</span>
        </div>
        <div className="flex flex-1 items-center justify-center p-14">
          <FloatingLogo className="w-[min(27vw,420px)]" intro={false} />
        </div>
        <div className="px-10 pb-10">
          <p className="display-tight max-w-md text-[clamp(1.6rem,2.2vw,2.1rem)] leading-[1.04]">
            För sektionens <span className="mono-accent text-red">poster</span>
          </p>
          <p className="mt-3 max-w-md text-stone">Lägg upp evenemang och nytt, och dela upp jobbet med resten av sektionen på uppdragstavlan.</p>
        </div>
      </section>

      <section className="relative isolate flex flex-col px-5 py-6 sm:px-12 sm:py-8">
        <div aria-hidden className="grid-millimeter pointer-events-none absolute inset-0 -z-10 text-ink [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)] lg:hidden" />
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="tryck kicker inline-flex items-center gap-2 text-stone transition-colors hover:text-ink">
            <ArrowLeft size={14} /> Till startsidan
          </Link>
          <ThemeToggle className="tryck size-9 rounded-lg border border-line bg-white text-stone transition-colors hover:border-ink/25 hover:text-ink" />
        </div>
        <div className="mx-auto flex w-full max-w-[25rem] flex-1 flex-col justify-center py-10">
          <div className="rounded-2xl border border-line bg-white p-7 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_24px_48px_-24px_rgb(0_0_0/0.18)] [animation:fade-up_0.8s_var(--ease-out-expo)_backwards] sm:p-9">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/statlin.svg" alt="" className="mb-6 size-12 lg:hidden" />
            <p className="kicker text-red-deep">StatLin · Poster</p>
            <h1 className="display mt-3 text-[2.4rem]">Logga in</h1>
            <p className="mt-3 text-[0.95rem] leading-relaxed text-stone">Använd e-postadressen för din post. Saknar du konto? Fråga sektionens webbansvariga.</p>
            <Suspense fallback={null}>
              <LoggedInRedirect />
            </Suspense>
            {utloggad && (
              <p className="mt-6 rounded-lg border border-emerald-600/25 bg-emerald-600/[0.07] px-4 py-3 text-sm font-medium text-emerald-900">Du är utloggad.</p>
            )}
            <LoginForm error={loginErrorText(fel)}>
              {/* Sidan man skickades från, så att man hamnar rätt efter inloggningen. */}
              {typeof next === "string" && <input type="hidden" name="next" value={next} />}
            </LoginForm>
          </div>
          <p className="mt-6 text-center text-xs text-stone">Glömt lösenordet? Sektionens webbansvariga kan återställa det åt dig.</p>
        </div>
      </section>
    </main>
  );
}

/** Redan inloggad → vidare till adminpanelen. Egen Suspense-gräns: högst upp i sidan ger omdirigeringen en helt tom sida utan JavaScript (SB-27). */
async function LoggedInRedirect() {
  if (await getSessionUser()) redirect("/admin");
  return null;
}
