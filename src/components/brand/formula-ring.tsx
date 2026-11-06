"use client";

import { useEffect, useId, useRef } from "react";
import { LOGO_GEOMETRY as G, LOGO_VIEWBOX } from "@/lib/brand/logo-paths";

/** Formlernas radie, utanför loggans tunna vita kant. */
const RADIUS = 494;
const PATH = `M${G.cx} ${G.cy - RADIUS}A${RADIUS} ${RADIUS} 0 1 1 ${G.cx - 0.01} ${G.cy - RADIUS}Z`;
const SEPARATOR = "  ∎  ";

// Gradientens radie i loggans enheter. Hela ringen ryms inom 2000.
const WHOLE_RING = 2000;
const ARC = 700;
const HIDDEN_BELOW = 8;

const STILL_MS = 1000;
const TAP_MS = 5000;
const DRAW_MS = 30;

const DEG = Math.PI / 180;
const FRAME_MS = 1000 / 60;

/** Synligheten runt musen är en normalfördelning: starkast närmast och svagare längre bort. */
const STOPS = Array.from({ length: 9 }, (_, i) => {
  const spread = 2.4;
  const tail = Math.exp(-(spread ** 2) / 2);
  const s = i / 8;
  const alpha = (Math.exp(-((spread * s) ** 2) / 2) - tail) / (1 - tail);
  return { offset: s.toFixed(3), opacity: (alpha * 0.85).toFixed(3) };
});

const shortestTurn = (to: number, from: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
const smooth = (x: number) => x * x * (3 - 2 * x);
/** Andel av vägen mot målet för den här bildrutan, oavsett skärmens uppdateringsfrekvens. */
const ease = (perFrame: number, dt: number) => 1 - (1 - perFrame) ** (dt / FRAME_MS);

function Superscript({ children }: { children: string }) {
  return (
    <>
      <tspan dy="-0.42em" fontSize="0.72em">
        {children}
      </tspan>
      <tspan dy="0.3em">{" "}</tspan>
    </>
  );
}

function Formulas() {
  return (
    <>
      f(x) = 1/(σ√2π) · e<Superscript>−(x−μ)²/(2σ²)</Superscript>
      {SEPARATOR}
      P(A|B) = P(B|A) P(A) / P(B)
      {SEPARATOR}
      β̂ = (XᵀX)⁻¹Xᵀy
      {SEPARATOR}
      √n (X̄ − μ) →ᵈ N(0, σ²)
      {SEPARATOR}
      s² = Σ(xᵢ − x̄)² / (n − 1)
      {SEPARATOR}
      θ ← θ − η∇J(θ)
      {SEPARATOR}
      E[X] = Σ x p(x)
      {SEPARATOR}
      L(θ) = Π f(xᵢ | θ)
      {SEPARATOR}
      ∫ℝ e<Superscript>−x²</Superscript>dx = √π
      {SEPARATOR}
      e<Superscript>iπ</Superscript>+ 1 = 0
      {SEPARATOR}
    </>
  );
}

/**
 * Telefon och surfplatta: ingen mus att följa. Ringen kommer fram som helhet när man trycker på loggan och tonas bort igen, med CSS (data-shown).
 * Inget ritas om medan den syns: bara genomskinligheten ändras, och den sköter grafikkortet.
 */
function touchRing(layer: SVGSVGElement, root: HTMLElement) {
  let hideTimer = 0;
  const onTap = () => {
    window.clearTimeout(hideTimer);
    layer.dataset.shown = "true";
    hideTimer = window.setTimeout(() => delete layer.dataset.shown, TAP_MS);
  };
  root.addEventListener("click", onTap);
  return () => {
    window.clearTimeout(hideTimer);
    delete layer.dataset.shown;
    root.removeEventListener("click", onTap);
  };
}

/**
 * Formler som kommer fram runt loggan när musen rör sig nära den. Ringen rör sig aldrig av sig själv, så heron står lugn.
 * Texten ligger still på sin bana och fylls med en gradient, så bara gradienten och en rotation ändras när ringen rör sig.
 * Servern ritar gradienten med radie 0, vilket gör texten helt genomskinlig.
 * På telefon kommer hela ringen fram när man trycker på loggan, se touchRing.
 * Formlerna har ingen glöd i den här designen, bara bläckets färg på papperet.
 */
export function FormulaRing() {
  const rawId = useId();
  const id = rawId.replace(/[^a-zA-Z0-9_-]/g, "");
  const layerRef = useRef<SVGSVGElement>(null);
  const gradientRef = useRef<SVGRadialGradientElement>(null);

  useEffect(() => {
    const layer = layerRef.current;
    const gradient = gradientRef.current;
    const root = layer?.closest<HTMLElement>(".floating-logo");
    if (!layer || !gradient || !root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (window.matchMedia("(hover: none)").matches) return touchRing(layer, root);
    // Utan rörelse visas hela ringen stilla med CSS när musen är över loggan.
    if (reduced) return;

    let angle = -Math.PI / 2;
    let target = angle;
    let width = 0;
    let targetWidth = 0;
    let showUntil = 0;
    let last = 0;
    let raf = 0;
    let running = false;
    let visible = true;

    const tick = (t: number) => {
      // Ringen är mjuk och rör sig långsamt, så det syns inte att den ritas om mer sällan än skärmen.
      if (t - last < DRAW_MS) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const dt = Math.min(50, Math.max(0, t - last));
      last = t;

      // Musen står stilla: ringen tonar bort.
      if (targetWidth !== 0 && t > showUntil) targetWidth = 0;
      angle += shortestTurn(target, angle) * ease(0.09, dt);
      width += (targetWidth - width) * ease(targetWidth > width ? 0.07 : 0.035, dt);

      // Formlerna kryper långsamt medurs. Gradienten ligger i det roterade lagrets koordinater.
      const rotation = (t / 1000) * 0.028;
      layer.style.rotate = `${(rotation / DEG).toFixed(3)}deg`;
      gradient.setAttribute("cx", (G.cx + RADIUS * Math.cos(angle - rotation)).toFixed(1));
      gradient.setAttribute("cy", (G.cy + RADIUS * Math.sin(angle - rotation)).toFixed(1));
      gradient.setAttribute("r", width.toFixed(1));

      // Dold och inget på gång: loopen stannar helt.
      if (targetWidth === 0 && width < HIDDEN_BELOW) {
        width = 0;
        gradient.setAttribute("r", "0");
        delete layer.dataset.shown;
        running = false;
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      if (running || !visible) return;
      running = true;
      layer.dataset.shown = "true";
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };

    /** Visar ringen runt punkten närmast musen. */
    const showAround = (dx: number, dy: number, ringWidth: number, ms: number) => {
      target = Math.atan2(dy, dx);
      // Ringen börjar komma fram på den sida musen kom ifrån.
      if (width < HIDDEN_BELOW) angle = target;
      targetWidth = ringWidth;
      showUntil = performance.now() + ms;
      start();
    };

    const offsetFromCenter = (e: MouseEvent) => {
      const box = root.getBoundingClientRect();
      return { dx: e.clientX - (box.left + box.width / 2), dy: e.clientY - (box.top + box.height / 2), size: box.width };
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const { dx, dy, size } = offsetFromCenter(e);
      // 1 betyder att musen är på formlernas bana.
      const d = Math.hypot(dx, dy) / ((size * RADIUS) / (G.cx * 2));
      let near = 0;
      if (d <= 0.7) near = WHOLE_RING;
      else if (d <= 1) near = WHOLE_RING + (ARC - WHOLE_RING) * smooth((d - 0.7) / 0.3);
      else if (d < 1.7) near = ARC * (1 - smooth((d - 1) / 0.7));

      if (near > 0) {
        showAround(dx, dy, near, STILL_MS);
      } else if (targetWidth !== 0) {
        targetWidth = 0;
        start();
      }
    };
    const onLeave = () => {
      targetWidth = 0;
      start();
    };

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!visible) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (targetWidth !== 0 || width >= HIDDEN_BELOW) {
        start();
      }
    });
    io.observe(root);

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      // Sidan kan gömmas medan ringen syns. Annars står en halv ring frusen där när den visas igen.
      gradient.setAttribute("r", "0");
      delete layer.dataset.shown;
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <svg
      ref={layerRef}
      aria-hidden
      viewBox={LOGO_VIEWBOX}
      className="logo-formler pointer-events-none absolute inset-0 h-full w-full overflow-visible"
    >
      <defs>
        <radialGradient ref={gradientRef} id={`${id}-fade`} gradientUnits="userSpaceOnUse" cx={G.cx} cy={G.cy} r="0">
          {STOPS.map((stop) => (
            <stop key={stop.offset} offset={stop.offset} stopColor="currentColor" stopOpacity={stop.opacity} />
          ))}
        </radialGradient>
        <path id={`${id}-path`} d={PATH} />
      </defs>
      <text fill={`url(#${id}-fade)`}>
        <textPath href={`#${id}-path`} lengthAdjust="spacing" textLength={3100}>
          <Formulas />
        </textPath>
      </text>
    </svg>
  );
}
