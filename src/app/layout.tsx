import type { Metadata, Viewport } from "next";
import { preload } from "react-dom";
import "@fontsource-variable/jetbrains-mono/index.css";
import "./globals.css";
import { SITE_ALTERNATES, SITE_OG } from "@/lib/site-metadata";
import { SCROLL_RESTORE_SCRIPT } from "@/lib/scroll-restore";
import { NavProgress } from "@/components/layout/nav-progress";
import { ARCHIVO_FONT_FACES, ARCHIVO_LATIN } from "./fonts";

// Läses vid bygget för förrenderade sidor – se Dockerfile (ARG SITE_URL).
const SITE_URL = process.env.SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "StatLin · Statistiksektionen i Linköping",
    template: "%s · StatLin",
  },
  description:
    "StatLin är sektionen för dig som läser statistik och dataanalys eller Statistics and Machine Learning vid Linköpings universitet. Evenemang, nytt, utskott, studiebevakning och kontakt med arbetslivet.",
  applicationName: "StatLin",
  openGraph: SITE_OG,
  twitter: { card: "summary_large_image" },
  // När icons sätts här lägger Next inte till src/app/icon.svg själv – därför står den med.
  icons: { icon: { url: "/icon.svg", type: "image/svg+xml" }, apple: "/apple-touch-icon.png" },
  alternates: SITE_ALTERNATES,
};

// Mörkt läge är standard, se THEME_SCRIPT.
export const viewport: Viewport = {
  themeColor: "#121211",
  colorScheme: "dark",
};

/**
 * Sätter temat innan något ritas, så att sidan inte blinkar i fel läge. Mörkt är standard: bara ett sparat ljust val ger ljust läge,
 * och ett tidigare sparat mörkt val ("mork") ger mörkt som förut. Se theme-toggle.tsx.
 */
const THEME_SCRIPT = "var t;try{t=localStorage.getItem('statlin-tema')}catch(e){}if(t==='ljust'){var m=document.querySelector('meta[name=theme-color]');if(m)m.setAttribute('content','#f9f8f5')}else document.documentElement.dataset.tema='mork'";

export default function RootLayout({ children }: LayoutProps<"/">) {
  // Typsnitt hämtas alltid med CORS, så utan crossOrigin skulle webbläsaren inte använda filen och hämta den en gång till. Se fonts.ts.
  preload(ARCHIVO_LATIN, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  return (
    <html lang="sv" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: ARCHIVO_FONT_FACES }} />
        {/* Markerar att JS körs. Utan klassen döljs skeletten i globals.css, eftersom innehållet aldrig kommer i deras ställe. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: SCROLL_RESTORE_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        {children}
        <NavProgress />
      </body>
    </html>
  );
}
