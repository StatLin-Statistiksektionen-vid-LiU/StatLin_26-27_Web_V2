import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { normalizeCourseCode } from "@/lib/exam-stats";
import { TEMA_KAKA, TEMA_STANDARD, temaKaka } from "@/lib/tema";

/**
 * Tre saker:
 * - Admin: utan sessionskaka skickas besökare direkt till inloggningen. Det är en optimistisk kontroll –
 *   den riktiga behörighetskontrollen görs mot databasen i varje sida och server action.
 * - Tentastatistik: kurssidorna har alltid koden med versaler (/tentastatistik/732g33 → 732G33), och
 *   sökformuläret utan JavaScript (/tentastatistik?kod=…) skickas vidare till kurssidan.
 * - Standardläget: en sida som hämtas får en kaka med läget som valts i Admin, se src/lib/tema.ts.
 */
export function proxy(request: NextRequest) {
  return medStandardlage(request, svar(request));
}

function svar(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  if (pathname === "/tentastatistik" || pathname.startsWith("/tentastatistik/")) {
    return examStatsRedirect(request) ?? NextResponse.next();
  }
  // Resten gäller bara Admin. Övriga sidor går genom proxyn för standardlägets skull.
  if (pathname !== "/admin" && !pathname.startsWith("/admin/")) return NextResponse.next();
  // SD-27: server actions (POST med next-action) kontrollerar sessionen själva och svarar med ett fel som formuläret visar.
  // Omdirigerades själva anropet hit tappade formuläret beskedet. Sidornas omdirigering nedan är oförändrad.
  const requested = requestedPath(request);
  if (!(request.method === "POST" && request.headers.has("next-action")) && !request.cookies.has("statlin_session")) {
    const url = new URL("/logga-in", request.url);
    url.searchParams.set("next", requested);
    return NextResponse.redirect(url);
  }
  // Layouten och requireUser skickar den vars session gått ut till inloggningen, med vägen tillbaka hit (SB-38).
  const headers = new Headers(request.headers);
  headers.set("x-pathname", requested);
  return NextResponse.next({ request: { headers } });
}

/**
 * Sätter kakan med standardläget när en hel sida hämtas och kakan inte stämmer med valet i Admin. Mörkt på båda behöver ingen kaka,
 * så en gammal tas bort då. Går databasen inte att läsa lämnas kakan som den är.
 */
function medStandardlage(request: NextRequest, response: NextResponse): NextResponse {
  if (request.method !== "GET" || !helSida(request)) return response;
  let varde: string;
  try {
    const rader = getDb().prepare("SELECT key, value FROM settings WHERE key IN ('tema_dator', 'tema_telefon')").all() as { key: string; value: string }[];
    const val = Object.fromEntries(rader.map((r) => [r.key, r.value]));
    varde = temaKaka(val.tema_dator, val.tema_telefon);
  } catch {
    return response;
  }
  const nu = request.cookies.get(TEMA_KAKA)?.value;
  if (varde === TEMA_STANDARD) {
    if (nu !== undefined) response.cookies.set(TEMA_KAKA, "", { path: "/", maxAge: 0 });
  } else if (nu !== varde) {
    response.cookies.set(TEMA_KAKA, varde, { path: "/", sameSite: "lax" });
  }
  return response;
}

/** Skriptet i head körs bara när en hel sida laddas, så sidbyten i klienten och förhämtningar behöver ingen kaka. */
function helSida(request: NextRequest): boolean {
  const dest = request.headers.get("sec-fetch-dest");
  if (dest) return dest === "document";
  return (request.headers.get("accept") ?? "").includes("text/html") && !request.headers.has("rsc");
}

/** Adressen som efterfrågades. _rsc är Nexts eget tillägg för sidbyten i klienten och hör inte till vägen tillbaka. */
function requestedPath(request: NextRequest): string {
  const { pathname, searchParams } = request.nextUrl;
  const query = new URLSearchParams(searchParams);
  query.delete("_rsc");
  const search = query.toString();
  return search ? `${pathname}?${search}` : pathname;
}

function examStatsRedirect(request: NextRequest): NextResponse | null {
  const { pathname, searchParams } = request.nextUrl;
  if (pathname === "/tentastatistik") {
    const code = normalizeCourseCode(searchParams.get("kod") ?? "");
    return code ? NextResponse.redirect(new URL(`/tentastatistik/${code}`, request.url)) : null;
  }
  let raw = pathname.slice("/tentastatistik/".length);
  try {
    raw = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const code = normalizeCourseCode(raw);
  return code && code !== raw ? NextResponse.redirect(new URL(`/tentastatistik/${code}`, request.url), 308) : null;
}

export const config = {
  // Admin och tentastatistiken som förut, och alla sidor för standardläget. Nexts egna filer, api, media och filer med ändelse går förbi.
  matcher: ["/admin/:path*", "/tentastatistik", "/tentastatistik/:kod", "/((?!_next/|api/|media/|.*\\.\\w+$).*)"],
};
