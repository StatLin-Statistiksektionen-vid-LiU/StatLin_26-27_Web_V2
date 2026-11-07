/**
 * Håller kvar besökarens plats vid omladdning och när hela sidan laddas om efter bakåt från en annan webbplats.
 *
 * Sidorna strömmas in: först kommer ett kort skal, sedan innehållet. Webbläsaren lägger tillbaka platsen medan skalet är allt som finns, fastnar
 * i dess botten och följer sedan med sidfoten ner när innehållet kommer, så besökaren hamnar någon helt annanstans. Här sparar sajten platsen
 * själv och lägger tillbaka den när sidan är lång nog, och igen när sidan har blivit längre.
 *
 * React visar en strömmad del en stund efter att den kommit, ibland först efter att dokumentet är färdigläst (upp till 2,3 s in). Därför är
 * platsen inte klar förrän ingen del väntar längre, det vill säga när mallarna B:n är borta. Så länge platsen läggs tillbaka är
 * scrollförankringen avstängd. Annars flyttar webbläsaren platsen när innehåll ovanför växer: WebKit håller fast vid sidfoten och hamnar lika
 * långt ner som delen är hög.
 *
 * Bakåt inom sajten sköter webbläsaren bra själv, utom till en adress med #ankare: då hoppar Chrome till ankaret när innehållet kommer, i stället
 * för till platsen man lämnade. Bara det fallet tas om hand här, och där hålls platsen fast tills sidan är klar.
 *
 * history.scrollRestoration står på "manual" bara medan det pågår, eftersom nya poster i historiken ärver läget. Skriptet ligger i head för att
 * hinna före webbläsarens första försök.
 */
export const SCROLL_RESTORE_SCRIPT = `(function () {
  try {
    var store = sessionStorage;
    var key = function () { return "statlin-plats:" + location.pathname + location.search + location.hash; };
    var restoring = false;
    // ScrollToAnchor frågar här om platsen håller på att läggas tillbaka. history.scrollRestoration duger inte till det: nya poster i historiken ärver "manual".
    try { Object.defineProperty(window, "__statlinPlats", { get: function () { return restoring; }, configurable: true }); } catch (e) {}
    var save = function () {
      if (restoring) return;
      try { store.setItem(key(), String(Math.round(scrollY))); } catch (e) {}
    };
    var timer = 0;
    addEventListener("scroll", function () {
      if (!timer) timer = setTimeout(function () { timer = 0; save(); }, 200);
    }, { passive: true });
    addEventListener("click", save, true);
    addEventListener("pagehide", save);

    var takeover = ["wheel", "touchstart", "keydown", "mousedown"];
    var root = document.documentElement;
    var cancel = null;
    var restore = function (hold) {
      var saved = store.getItem(key());
      if (saved === null) return;
      if (cancel) cancel();
      var target = Number(saved);
      var start = performance.now();
      var height = -1, changed = start, parsed = 0, applied = -1, over = false;
      // Ett eget stilark i stället för style på html, så att React inte hittar något oväntat när sidan hydreras.
      var anchoring = null;
      try {
        anchoring = new CSSStyleSheet();
        anchoring.replaceSync("html{overflow-anchor:none}");
        document.adoptedStyleSheets = Array.prototype.slice.call(document.adoptedStyleSheets).concat([anchoring]);
      } catch (e) { anchoring = null; }
      var finish = function () {
        if (over) return;
        over = true;
        cancel = null;
        restoring = false;
        history.scrollRestoration = "auto";
        takeover.forEach(function (e) { removeEventListener(e, finish, true); });
        if (anchoring) {
          try { document.adoptedStyleSheets = Array.prototype.filter.call(document.adoptedStyleSheets, function (s) { return s !== anchoring; }); } catch (e) {}
        }
      };
      cancel = finish;
      restoring = true;
      history.scrollRestoration = "manual";
      takeover.forEach(function (e) { addEventListener(e, finish, { capture: true, passive: true }); });
      var step = function () {
        if (over) return;
        var now = performance.now();
        var h = root.scrollHeight;
        if (h !== height) { height = h; changed = now; }
        if (!parsed && document.readyState !== "loading") parsed = now;
        // En del som har kommit men inte visats än har kvar sin mall.
        var waiting = parsed && document.querySelector('template[id^="B:"]');
        var max = h - innerHeight;
        var settled = (parsed && !waiting && now - parsed > (hold ? 800 : 500) && now - changed > 300 && (!hold || max >= target)) || now - start > 8000;
        if ((max >= target || settled) && (hold || applied !== h)) {
          applied = h;
          var y = Math.min(target, max);
          if (Math.abs(scrollY - y) > 1) scrollTo(0, y);
        }
        if (settled) finish();
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    var nav = performance.getEntriesByType("navigation")[0];
    if (nav && (nav.type === "reload" || nav.type === "back_forward")) restore(false);
    addEventListener("popstate", function () { if (location.hash) restore(true); });

    // Ett klick på en länk med #ankare inom sajten. Next 16 scrollar inte alls när ankaret inte finns än, och här strömmas det in efter
    // skalet. Sidan stod då kvar där förra sidan var, till exempel 1500 px ner, och ScrollToAnchor väntade på en sida högst upp: menylänken
    // Vad studenterna kan gjorde ingenting om man hade scrollat. Nu frågar ScrollToAnchor här om besökaren bad om ankaret, och scrollar dit
    // var sidan än står. Avsikten släpps när besökaren själv börjar scrolla eller går i historiken.
    var asked = null;
    try { Object.defineProperty(window, "__statlinAnkare", { get: function () { return asked; }, set: function (v) { asked = v; }, configurable: true }); } catch (e) {}
    // Next behåller tidigare sidor dolda i dokumentet, och där kan samma id finnas en gång till.
    var visible = function (id) {
      var all = document.querySelectorAll('[id="' + id.replace(/["\\\\]/g, "\\\\$&") + '"]');
      for (var i = 0; i < all.length; i++) if (all[i].getClientRects().length) return all[i];
      return null;
    };
    addEventListener("click", function (e) {
      try {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
        if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
        var url = new URL(a.getAttribute("href"), location.href);
        if (url.origin !== location.origin || url.hash.length < 2) return;
        var id = decodeURIComponent(url.hash.slice(1));
        asked = { id: id, path: url.pathname + url.search, at: Date.now() };
        // Samma adress som nu, ankaret inräknat: där scrollar varken Next eller webbläsaren, och Next gör adressen till #kompetens#kompetens.
        if (url.pathname + url.search + url.hash !== location.pathname + location.search + location.hash) return;
        var el = visible(id);
        if (!el) return;
        e.preventDefault();
        asked = null;
        el.scrollIntoView();
      } catch (err) {}
    }, true);
    var drop = function () { asked = null; };
    ["wheel", "touchstart", "keydown"].forEach(function (t) { addEventListener(t, drop, { capture: true, passive: true }); });
    addEventListener("popstate", drop);
  } catch (e) {}
})();`;
