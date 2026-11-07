/*
 * En liten och förlåtande LaTeX-tolk för formlerna som skrivs för hand i rutnätet (formel.tsx ritar dem). Den kan det vanligaste
 * i matte och statistik: index och exponenter, bråk, rötter, summor och integraler med gränser, funktioner som log och lim,
 * accenter som \bar och \hat, parenteser som växer med innehållet, matriser och cases, alla grekiska bokstäver och de vanligaste
 * relationerna och pilarna. Inget går sönder: ett okänt kommando skrivs som text och står i okanda, en klammer som aldrig
 * stängs stängs i slutet och står i fel, och $ eller \( \) runt formeln tas bort.
 *
 * Tecken som börjar med @ ritas för hand i formel.tsx, eftersom Mynerve saknar dem (som ≤, √ och ∞).
 */

export type Klass = "ord" | "op" | "bin" | "rel" | "open" | "close" | "punct" | "inner";
export type AccentTyp = "bar" | "hat" | "tilde" | "vec" | "dot" | "ddot" | "check" | "under" | "inte";

export type Nod =
  | { t: "tecken"; s: string; k: Klass }
  | { t: "text"; s: string }
  | { t: "grupp"; barn: Nod[] }
  | { t: "skript"; bas: Nod | null; upp: Nod | null; ned: Nod | null; uppForst: boolean }
  | { t: "brak"; tal: Nod; nam: Nod; stil: "d" | "t" | "auto"; streck: boolean }
  | { t: "rot"; inne: Nod; index: Nod | null }
  | { t: "accent"; typ: AccentTyp; inne: Nod }
  | { t: "stor"; s: string; granser: boolean | null }
  | { t: "funk"; namn: string; granser: boolean }
  | { t: "avgr"; v: string; h: string; inne: Nod; kv: Klass; kh: Klass }
  | { t: "delim"; s: string; storlek: number; k: Klass }
  | { t: "rum"; em: number }
  | { t: "stil"; stil: "bb" | "bf" | "rod"; inne: Nod }
  | { t: "tabell"; justering: "c" | "l" | "rl"; rader: Nod[][] }
  | { t: "stapla"; bas: Nod; over: Nod | null; under: Nod | null };

export type Tolkad = { noder: Nod[]; okanda: string[]; fel: string[] };

type Tok =
  | { k: "kmd"; v: string }
  | { k: "tkn"; v: string }
  | { k: "{" }
  | { k: "}" }
  | { k: "^" }
  | { k: "_" }
  | { k: "&" }
  | { k: "'" }
  | { k: "~" }
  | { k: "rum" };

const GREK: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε", zeta: "ζ", eta: "η", theta: "θ", vartheta: "θ",
  iota: "ι", kappa: "κ", varkappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", omicron: "ο", pi: "π", varpi: "π", rho: "ρ",
  varrho: "ρ", sigma: "σ", varsigma: "ς", tau: "τ", upsilon: "υ", phi: "φ", varphi: "φ", chi: "χ", psi: "ψ", omega: "ω",
  Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π", Sigma: "Σ", Upsilon: "Υ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
};

const SYMBOL: Record<string, [string, Klass]> = {
  leq: ["@leq", "rel"], le: ["@leq", "rel"], leqslant: ["@leq", "rel"], geq: ["@geq", "rel"], ge: ["@geq", "rel"], geqslant: ["@geq", "rel"],
  neq: ["@neq", "rel"], ne: ["@neq", "rel"], approx: ["@approx", "rel"], sim: ["@sim", "rel"], simeq: ["@simeq", "rel"], cong: ["@cong", "rel"],
  equiv: ["@equiv", "rel"], propto: ["@propto", "rel"], in: ["@in", "rel"], notin: ["@notin", "rel"], ni: ["@ni", "rel"],
  subset: ["@subset", "rel"], subseteq: ["@subseteq", "rel"], supset: ["@supset", "rel"], supseteq: ["@supseteq", "rel"],
  to: ["@to", "rel"], rightarrow: ["@to", "rel"], leftarrow: ["@leftarrow", "rel"], gets: ["@leftarrow", "rel"],
  leftrightarrow: ["@leftrightarrow", "rel"], Rightarrow: ["@Rightarrow", "rel"], implies: ["@Rightarrow", "rel"],
  Leftarrow: ["@Leftarrow", "rel"], impliedby: ["@Leftarrow", "rel"], Leftrightarrow: ["@Leftrightarrow", "rel"], iff: ["@Leftrightarrow", "rel"],
  mapsto: ["@mapsto", "rel"], longrightarrow: ["@longrightarrow", "rel"], perp: ["@perp", "rel"], mid: ["|", "rel"], parallel: ["@Vert", "rel"],
  ll: ["@ll", "rel"], gg: ["@gg", "rel"], lt: ["<", "rel"], gt: [">", "rel"], colon: [":", "punct"],
  pm: ["±", "bin"], mp: ["@mp", "bin"], times: ["×", "bin"], div: ["÷", "bin"], cdot: ["·", "bin"], ast: ["*", "bin"], star: ["*", "bin"],
  circ: ["@circ", "bin"], bullet: ["•", "bin"], cup: ["@cup", "bin"], cap: ["@cap", "bin"], setminus: ["@setminus", "bin"],
  land: ["@land", "bin"], wedge: ["@land", "bin"], lor: ["@lor", "bin"], vee: ["@lor", "bin"],
  infty: ["@infty", "ord"], partial: ["@partial", "ord"], nabla: ["@nabla", "ord"], forall: ["@forall", "ord"], exists: ["@exists", "ord"],
  nexists: ["@nexists", "ord"], emptyset: ["@emptyset", "ord"], varnothing: ["@emptyset", "ord"], neg: ["¬", "ord"], lnot: ["¬", "ord"],
  top: ["T", "ord"], intercal: ["T", "ord"], prime: ["'", "ord"], ell: ["l", "ord"], degree: ["@circ", "ord"],
  ldots: ["…", "inner"], dots: ["…", "inner"], cdots: ["···", "inner"], vdots: ["@vdots", "ord"], ddots: ["@ddots", "inner"],
  langle: ["@langle", "open"], rangle: ["@rangle", "close"], lfloor: ["@lfloor", "open"], rfloor: ["@rfloor", "close"],
  lceil: ["@lceil", "open"], rceil: ["@rceil", "close"], vert: ["|", "ord"], lvert: ["|", "open"], rvert: ["|", "close"],
  Vert: ["@Vert", "ord"], lVert: ["@Vert", "open"], rVert: ["@Vert", "close"], backslash: ["@setminus", "ord"],
  "{": ["{", "open"], "}": ["}", "close"], "|": ["@Vert", "ord"], "%": ["%", "ord"], "#": ["#", "ord"], "&": ["&", "ord"],
  _: ["_", "ord"], $: ["$", "ord"],
};

/** Mellanrum i em. */
const RUM: Record<string, number> = {
  ",": 0.17, thinspace: 0.17, ":": 0.22, ">": 0.22, medspace: 0.22, ";": 0.28, thickspace: 0.28, "!": -0.17, negthinspace: -0.17,
  quad: 1, qquad: 2, " ": 0.25, enspace: 0.5, space: 0.25,
};

const FUNK = new Set(["log", "ln", "lg", "exp", "sin", "cos", "tan", "cot", "sec", "csc", "arcsin", "arccos", "arctan", "sinh", "cosh", "tanh", "det", "dim", "ker", "deg", "gcd", "hom", "arg", "Pr"]);
const FUNK_GRANSER: Record<string, string> = { lim: "lim", liminf: "lim inf", limsup: "lim sup", max: "max", min: "min", sup: "sup", inf: "inf", argmax: "arg max", argmin: "arg min", plim: "plim" };
/** Namn som ofta görs till egna kommandon i statistik, som \Var. De skrivs som funktioner utan att räknas som okända. */
const KANDA_NAMN = new Set(["Var", "Cov", "Corr", "Cor", "E", "P", "SE", "MSE", "RMSE", "Bias", "logit", "probit", "sgn", "sign", "tr", "diag", "rank", "Bin", "Po", "Unif", "Ber", "Exp"]);

const STORA: Record<string, string> = { sum: "Σ", prod: "Π", coprod: "Π", int: "@int", iint: "@iint", iiint: "@iiint", oint: "@oint", bigcup: "@bigcup", bigcap: "@bigcap" };

const ACCENT: Record<string, AccentTyp> = {
  bar: "bar", overline: "bar", hat: "hat", widehat: "hat", tilde: "tilde", widetilde: "tilde", vec: "vec", overrightarrow: "vec",
  dot: "dot", ddot: "ddot", check: "check", breve: "check", acute: "hat", grave: "hat", underline: "under",
};

const TEXT = new Set(["text", "textrm", "textit", "textbf", "textsf", "texttt", "textnormal", "mbox", "hbox", "textup"]);
const RAK = new Set(["mathrm", "mathit", "mathsf", "mathtt", "mathnormal", "rm", "it", "operatorname*"]);
const STIL: Record<string, "bb" | "bf"> = { mathbb: "bb", mathbf: "bf", boldsymbol: "bf", bm: "bf", bold: "bf", pmb: "bf", mathcal: "bf", mathscr: "bf", mathfrak: "bf" };
/** Kommandon som inte ändrar något i en formel för hand. */
const TYST = new Set(["displaystyle", "textstyle", "scriptstyle", "scriptscriptstyle", "limits", "nolimits", "nonumber", "notag", "left.", "relax", "strut", "big", "quad."]);
const MED_ARGUMENT_TYST = new Set(["label", "tag", "phantom", "hphantom", "vphantom", "mathstrut"]);
const STORLEK: Record<string, number> = { big: 1.2, Big: 1.8, bigg: 2.4, Bigg: 3 };
const MILJO = new Set(["pmatrix", "bmatrix", "Bmatrix", "vmatrix", "Vmatrix", "matrix", "smallmatrix", "cases", "dcases", "aligned", "align", "align*", "gathered", "split", "array", "eqnarray", "eqnarray*"]);

/** Tecken som skrivs direkt, som ≤ och √, gör samma sak som sina kommandon. */
const UNICODE: Record<string, string> = {
  "≤": "leq", "≥": "geq", "≠": "neq", "≈": "approx", "∼": "sim", "≃": "simeq", "≅": "cong", "≡": "equiv", "∝": "propto", "∈": "in",
  "∉": "notin", "∋": "ni", "⊂": "subset", "⊆": "subseteq", "⊃": "supset", "⊇": "supseteq", "→": "to", "←": "leftarrow",
  "↔": "leftrightarrow", "⇒": "Rightarrow", "⇐": "Leftarrow", "⇔": "Leftrightarrow", "↦": "mapsto", "⊥": "perp", "∓": "mp",
  "∘": "circ", "∪": "cup", "∩": "cap", "∧": "land", "∨": "lor", "∞": "infty", "∂": "partial", "∇": "nabla", "∀": "forall",
  "∃": "exists", "∅": "emptyset", "⟨": "langle", "⟩": "rangle", "⌊": "lfloor", "⌋": "rfloor", "⌈": "lceil", "⌉": "rceil",
  "‖": "Vert", "⋯": "cdots", "⋮": "vdots", "⋱": "ddots", "∑": "sum", "∏": "prod", "∫": "int", "∬": "iint", "∮": "oint",
  "√": "sqrt", "′": "prime", "ϵ": "epsilon", "ϑ": "theta", "ϕ": "phi", "ϱ": "rho", "ϖ": "pi", "ℓ": "ell", "≪": "ll", "≫": "gg",
  "⋅": "cdot", "∗": "ast", "≦": "leq", "≧": "geq",
};

/** Kombinerande tecken efter en bokstav, som x̄, blir accenter. */
const KOMBINERAD: Record<string, string> = { "̄": "bar", "̅": "bar", "̂": "hat", "̃": "tilde", "⃗": "vec", "̇": "dot", "̈": "ddot", "̌": "check" };

function tokens(tex: string): Tok[] {
  const ut: Tok[] = [];
  const t = [...tex];
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === "\\") {
      const j = i + 1;
      if (j >= t.length) break;
      if (/[a-zA-Z]/.test(t[j])) {
        let n = j;
        let namn = "";
        while (n < t.length && /[a-zA-Z]/.test(t[n])) namn += t[n++];
        // \operatorname* och \sum* är ett kommando med stjärna.
        if (namn === "operatorname" && t[n] === "*") {
          namn += "*";
          n++;
        }
        ut.push({ k: "kmd", v: namn });
        i = n - 1;
      } else {
        ut.push({ k: "kmd", v: t[j] });
        i = j;
      }
    } else if (c === "{" || c === "}" || c === "^" || c === "_" || c === "&" || c === "'" || c === "~") {
      ut.push({ k: c });
    } else if (/\s/.test(c)) {
      if (ut.at(-1)?.k !== "rum") ut.push({ k: "rum" });
    } else if (KOMBINERAD[c]) {
      const fore = ut.at(-1);
      if (fore?.k === "tkn") {
        ut.pop();
        ut.push({ k: "kmd", v: KOMBINERAD[c] }, { k: "{" }, fore, { k: "}" });
      }
    } else if (/\p{M}/u.test(c)) {
      // Andra kombinerande tecken hoppas över, de skulle hamna bredvid bokstaven.
    } else {
      ut.push({ k: "tkn", v: c });
    }
  }
  return ut;
}

/** $…$, $$…$$, \(…\) och \[…\] runt formeln tas bort. */
function utanRam(tex: string): string {
  let s = tex.trim();
  for (const [a, b] of [["$$", "$$"], ["$", "$"], ["\\(", "\\)"], ["\\[", "\\]"]] as const) {
    if (s.length >= a.length + b.length && s.startsWith(a) && s.endsWith(b)) {
      s = s.slice(a.length, s.length - b.length).trim();
      break;
    }
  }
  return s;
}

const tom = (): Nod => ({ t: "grupp", barn: [] });
const arSiffra = (n: Nod | undefined) => n?.t === "tecken" && /^\p{N}$/u.test(n.s);

class Tolk {
  i = 0;
  okanda = new Set<string>();
  fel = new Set<string>();
  constructor(private t: Tok[]) {}

  titta(steg = 0): Tok | undefined {
    return this.t[this.i + steg];
  }
  hoppaRum() {
    while (this.titta()?.k === "rum") this.i++;
  }

  lista(stopp: (t: Tok) => boolean): Nod[] {
    const ut: Nod[] = [];
    for (;;) {
      const t = this.titta();
      if (!t || stopp(t)) break;
      if (t.k === "rum") {
        this.i++;
        continue;
      }
      if (t.k === "}") {
        this.i++;
        this.fel.add("}");
        continue;
      }
      if (t.k === "^" || t.k === "_") {
        this.i++;
        this.skript(ut, t.k === "^" ? "upp" : "ned", this.argument());
        continue;
      }
      if (t.k === "'") {
        let s = "";
        while (this.titta()?.k === "'") {
          this.i++;
          s += "'";
        }
        this.skript(ut, "upp", { t: "tecken", s, k: "ord" });
        continue;
      }
      if (t.k === "&" || (t.k === "kmd" && (t.v === "\\" || t.v === "cr"))) {
        this.i++;
        continue;
      }
      if (t.k === "kmd" && t.v === "color") {
        this.i++;
        this.radText();
        const resten = this.lista(stopp);
        ut.push({ t: "stil", stil: "rod", inne: { t: "grupp", barn: resten } });
        break;
      }
      this.i++;
      const nod = this.atom(t);
      if (nod) ut.push(nod);
    }
    return parentespar(decimalkomma(ut));
  }

  /** ^ och _ hör till det som står närmast före. Ett primtecken och en exponent blir en exponent, som f'^2. */
  skript(ut: Nod[], plats: "upp" | "ned", arg: Nod) {
    const sista = ut.at(-1);
    if (sista?.t === "skript" && !sista[plats]) {
      sista[plats] = arg;
      return;
    }
    if (sista?.t === "skript" && plats === "upp" && sista.upp?.t === "tecken" && /^'+$/.test(sista.upp.s)) {
      sista.upp = { t: "grupp", barn: [sista.upp, arg] };
      return;
    }
    const bas = sista && sista.t !== "rum" ? ut.pop()! : null;
    ut.push({ t: "skript", bas, upp: plats === "upp" ? arg : null, ned: plats === "ned" ? arg : null, uppForst: plats === "upp" });
  }

  /** Ett argument: en grupp i klamrar, ett kommando eller ett enda tecken, som i \frac12. */
  argument(): Nod {
    this.hoppaRum();
    const t = this.titta();
    if (!t || t.k === "}" || t.k === "&" || t.k === "^" || t.k === "_") return tom();
    this.i++;
    if (t.k === "'") return { t: "tecken", s: "'", k: "ord" };
    return this.atom(t) ?? tom();
  }

  /** [n] efter \sqrt. */
  valfritt(): Nod | null {
    this.hoppaRum();
    const t = this.titta();
    if (t?.k !== "tkn" || t.v !== "[") return null;
    this.i++;
    const barn = this.lista((x) => x.k === "tkn" && x.v === "]");
    if (this.titta()?.k === "tkn") this.i++;
    return { t: "grupp", barn };
  }

  /** Texten i en klammer som den står, med mellanslagen, för \text och miljöernas namn. */
  radText(): string {
    this.hoppaRum();
    const t = this.titta();
    if (!t) return "";
    if (t.k !== "{") {
      this.i++;
      return t.k === "tkn" || t.k === "kmd" ? t.v : "";
    }
    this.i++;
    let djup = 1;
    let s = "";
    for (let x = this.titta(); x; x = this.titta()) {
      this.i++;
      if (x.k === "{") djup++;
      else if (x.k === "}" && --djup === 0) return s;
      if (x.k === "tkn") s += x.v;
      else if (x.k === "rum" || x.k === "~") s += " ";
      else if (x.k === "kmd") s += RUM[x.v] !== undefined && x.v.length === 1 ? " " : x.v.length === 1 ? x.v : GREK[x.v] ?? x.v;
      else if (x.k === "'" || x.k === "^" || x.k === "_" || x.k === "&") s += x.k;
    }
    this.fel.add("{");
    return s;
  }

  /** Avgränsaren efter \left, \right och \big. */
  avgransare(): string {
    this.hoppaRum();
    const t = this.titta();
    if (!t) return ".";
    const s =
      t.k === "tkn"
        ? ({ "(": "(", ")": ")", "[": "[", "]": "]", "|": "|", ".": ".", "<": "⟨", ">": "⟩", "/": "/", "⟨": "⟨", "⟩": "⟩", "‖": "‖", "⌊": "⌊", "⌋": "⌋", "⌈": "⌈", "⌉": "⌉" } as Record<string, string>)[t.v]
        : t.k === "kmd"
          ? ({ "{": "{", "}": "}", "|": "‖", langle: "⟨", rangle: "⟩", lfloor: "⌊", rfloor: "⌋", lceil: "⌈", rceil: "⌉", vert: "|", lvert: "|", rvert: "|", Vert: "‖", lVert: "‖", rVert: "‖", backslash: "\\", lbrace: "{", rbrace: "}", lbrack: "[", rbrack: "]" } as Record<string, string>)[t.v]
          : undefined;
    if (!s) return ".";
    this.i++;
    return s;
  }

  /** \limits och \nolimits direkt efter en summa eller funktion. */
  granser(): boolean | null {
    let j = 0;
    while (this.titta(j)?.k === "rum") j++;
    const t = this.titta(j);
    if (t?.k === "kmd" && (t.v === "limits" || t.v === "nolimits")) {
      this.i += j + 1;
      return t.v === "limits";
    }
    return null;
  }

  atom(t: Tok): Nod | null {
    switch (t.k) {
      case "{": {
        const barn = this.lista((x) => x.k === "}");
        if (this.titta()?.k === "}") this.i++;
        else this.fel.add("{");
        return { t: "grupp", barn };
      }
      case "tkn":
        return this.tecken(t.v);
      case "~":
        return { t: "rum", em: 0.25 };
      case "kmd":
        return this.kommando(t.v);
      default:
        return null;
    }
  }

  tecken(c: string): Nod | null {
    if (UNICODE[c]) return this.kommando(UNICODE[c]);
    if (/[\p{L}\p{N}]/u.test(c)) return { t: "tecken", s: c, k: "ord" };
    switch (c) {
      case "+":
      case "±":
      case "×":
      case "÷":
      case "·":
      case "*":
        return { t: "tecken", s: c, k: "bin" };
      case "-":
      case "−":
        return { t: "tecken", s: "−", k: "bin" };
      case "=":
      case "<":
      case ">":
      case ":":
        return { t: "tecken", s: c, k: "rel" };
      case ",":
      case ";":
        return { t: "tecken", s: c, k: "punct" };
      case "(":
      case "[":
        return { t: "tecken", s: c, k: "open" };
      case ")":
      case "]":
      case "!":
      case "?":
        return { t: "tecken", s: c, k: "close" };
      default:
        return { t: "tecken", s: c, k: "ord" };
    }
  }

  kommando(n: string): Nod | null {
    if (GREK[n]) return { t: "tecken", s: GREK[n], k: "ord" };
    const sym = SYMBOL[n];
    if (sym) return { t: "tecken", s: sym[0], k: sym[1] };
    if (RUM[n] !== undefined) return { t: "rum", em: RUM[n] };
    if (n === "frac" || n === "dfrac" || n === "tfrac" || n === "cfrac") {
      const tal = this.argument();
      const nam = this.argument();
      return { t: "brak", tal, nam, stil: n === "dfrac" || n === "cfrac" ? "d" : n === "tfrac" ? "t" : "auto", streck: true };
    }
    if (n === "binom" || n === "dbinom" || n === "tbinom") {
      const tal = this.argument();
      const nam = this.argument();
      return { t: "avgr", v: "(", h: ")", kv: "open", kh: "close", inne: { t: "brak", tal, nam, stil: n === "dbinom" ? "d" : n === "tbinom" ? "t" : "auto", streck: false } };
    }
    if (n === "sqrt") {
      const index = this.valfritt();
      return { t: "rot", inne: this.argument(), index };
    }
    if (ACCENT[n]) return { t: "accent", typ: ACCENT[n], inne: this.argument() };
    if (n === "not") {
      const nasta = this.argument();
      if (nasta.t === "tecken" && nasta.s === "=") return { t: "tecken", s: "@neq", k: "rel" };
      if (nasta.t === "tecken" && nasta.s === "@in") return { t: "tecken", s: "@notin", k: "rel" };
      return { t: "accent", typ: "inte", inne: nasta };
    }
    if (STORA[n]) return { t: "stor", s: STORA[n], granser: this.granser() };
    if (FUNK.has(n)) return { t: "funk", namn: n, granser: this.granser() ?? false };
    if (FUNK_GRANSER[n]) return { t: "funk", namn: FUNK_GRANSER[n], granser: this.granser() ?? true };
    if (n === "operatorname" || n === "operatorname*") {
      const namn = this.radText().trim();
      return { t: "funk", namn, granser: this.granser() ?? n.endsWith("*") };
    }
    if (TEXT.has(n)) return { t: "text", s: this.radText() };
    if (RAK.has(n)) return this.argument();
    if (STIL[n]) return { t: "stil", stil: STIL[n], inne: this.argument() };
    if (n === "textcolor") {
      this.radText();
      return { t: "stil", stil: "rod", inne: this.argument() };
    }
    if (n === "left") {
      const v = this.avgransare();
      const barn = this.lista((x) => x.k === "kmd" && x.v === "right");
      let h = ".";
      if (this.titta()?.k === "kmd") {
        this.i++;
        h = this.avgransare();
      } else this.fel.add("\\left");
      return { t: "avgr", v, h, inne: { t: "grupp", barn }, kv: "inner", kh: "inner" };
    }
    if (n === "right") {
      this.avgransare();
      this.fel.add("\\right");
      return null;
    }
    if (n === "middle") {
      const d = this.avgransare();
      return { t: "tecken", s: d === "‖" ? "@Vert" : d === "." ? "|" : d, k: "rel" };
    }
    const stor = /^(big|Big|bigg|Bigg)([lrm]?)$/.exec(n);
    if (stor) {
      const s = this.avgransare();
      return { t: "delim", s, storlek: STORLEK[stor[1]], k: stor[2] === "l" ? "open" : stor[2] === "r" ? "close" : "ord" };
    }
    if (n === "begin") return this.miljo(this.radText().trim());
    if (n === "end") {
      this.radText();
      this.fel.add("\\end");
      return null;
    }
    if (n === "overset" || n === "stackrel") {
      const over = this.argument();
      return { t: "stapla", bas: this.argument(), over, under: null };
    }
    if (n === "underset") {
      const under = this.argument();
      return { t: "stapla", bas: this.argument(), over: null, under };
    }
    if (n === "hspace" || n === "kern" || n === "mkern") {
      const m = /(-?[\d.]+)\s*(em|ex|mu|pt)?/.exec(this.radText());
      const v = m ? parseFloat(m[1]) * ({ em: 1, ex: 0.45, mu: 1 / 18, pt: 0.1 }[m[2] ?? "em"] ?? 1) : 0;
      return Number.isFinite(v) && v ? { t: "rum", em: Math.max(-2, Math.min(4, v)) } : null;
    }
    if (TYST.has(n)) return null;
    if (MED_ARGUMENT_TYST.has(n)) {
      this.argument();
      return null;
    }
    // Okänt: namnet skrivs som det står. Namn med stor bokstav och de vanliga i statistik, som \Var, blir funktioner.
    if (!KANDA_NAMN.has(n)) this.okanda.add(`\\${n}`);
    return KANDA_NAMN.has(n) || /^[A-Z]/.test(n) ? { t: "funk", namn: n, granser: false } : { t: "text", s: n };
  }

  /** Matriser, cases och aligned: rader med \\ och celler med &. */
  miljo(namn: string): Nod {
    if (namn === "array") this.radText();
    if (!MILJO.has(namn)) this.okanda.add(`\\begin{${namn}}`);
    const rader: Nod[][] = [[]];
    for (;;) {
      const cell = this.lista((x) => x.k === "&" || (x.k === "kmd" && (x.v === "\\" || x.v === "cr" || x.v === "end")));
      rader[rader.length - 1].push({ t: "grupp", barn: cell });
      const t = this.titta();
      if (!t) {
        this.fel.add("\\begin");
        break;
      }
      this.i++;
      if (t.k === "&") continue;
      if (t.k === "kmd" && t.v === "end") {
        this.radText();
        break;
      }
      this.valfritt();
      rader.push([]);
    }
    const tomRad = (r: Nod[]) => r.every((c) => c.t === "grupp" && c.barn.length === 0);
    if (rader.length > 1 && tomRad(rader[rader.length - 1])) rader.pop();
    const justering = namn === "cases" || namn === "dcases" ? "l" : /^(aligned|align\*?|split|eqnarray\*?)$/.test(namn) ? "rl" : "c";
    const tabell: Nod = { t: "tabell", justering, rader };
    const delim = ({ pmatrix: ["(", ")"], bmatrix: ["[", "]"], Bmatrix: ["{", "}"], vmatrix: ["|", "|"], Vmatrix: ["‖", "‖"], cases: ["{", "."], dcases: ["{", "."] } as Record<string, [string, string]>)[namn];
    return delim ? { t: "avgr", v: delim[0], h: delim[1], inne: tabell, kv: "open", kh: "close" } : tabell;
  }
}

/** Ett komma mellan två siffror är ett decimalkomma, som i 1,96, och får inget mellanrum efter sig. */
function decimalkomma(ut: Nod[]): Nod[] {
  for (let i = 1; i < ut.length - 1; i++) {
    const n = ut[i];
    if (n.t === "tecken" && n.s === "," && arSiffra(ut[i - 1]) && arSiffra(ut[i + 1])) ut[i] = { t: "tecken", s: ",", k: "ord" };
  }
  return ut;
}

/**
 * Parenteser och hakparenteser som hör ihop blir ett par, så att de kan växa med det som står inom dem (ett bråk, en summa).
 * Ett par med vanligt innehåll ritas som vanliga tecken. En exponent efter parentesen, som i (x − μ)^2, hör till hela paret.
 */
function parentespar(ut: Nod[]): Nod[] {
  const oppna: number[] = [];
  const stang = (n: Nod): string | null => {
    const x = n.t === "skript" ? n.bas : n;
    return x?.t === "tecken" && x.k === "close" && (x.s === ")" || x.s === "]") ? x.s : null;
  };
  for (let i = 0; i < ut.length; i++) {
    const n = ut[i];
    if (n.t === "tecken" && n.k === "open" && (n.s === "(" || n.s === "[")) {
      oppna.push(i);
      continue;
    }
    const s = stang(n);
    if (!s) continue;
    const vill = s === ")" ? "(" : "[";
    const j = oppna.findLastIndex((o) => (ut[o] as { s: string }).s === vill);
    if (j < 0) continue;
    const start = oppna[j];
    oppna.length = j;
    const par: Nod = { t: "avgr", v: vill, h: s, inne: { t: "grupp", barn: ut.slice(start + 1, i) }, kv: "open", kh: "close" };
    const ny: Nod = n.t === "skript" ? { ...n, bas: par } : par;
    ut.splice(start, i - start + 1, ny);
    i = start;
  }
  return ut;
}

export function tolkaLatex(tex: string): Tolkad {
  const tolk = new Tolk(tokens(utanRam(tex)));
  const noder = tolk.lista(() => false);
  return { noder, okanda: [...tolk.okanda], fel: [...tolk.fel] };
}
