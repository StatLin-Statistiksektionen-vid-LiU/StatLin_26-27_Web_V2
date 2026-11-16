// Vilken färg och vilket motiv ett konto får i portalen. Kräver ingen server:
//   npx tsx --test tests/karaktar.test.mjs
import assert from "node:assert";
import { test } from "node:test";
import { egenFarg, karaktarFor, UTSKOTT } from "../src/lib/karaktar.ts";

const styrelsen = { slug: "styrelsen", accent: "#ff0707", kind: "styrelse" };

test("styrelsens poster känns igen på kontots post", () => {
  const motiv = (post) => karaktarFor(post, styrelsen).motiv;
  assert.equal(motiv("Ordförande"), "klubba");
  assert.equal(motiv("Vice ordförande"), "protokoll", "vice ordförande är inte ordförande");
  assert.equal(motiv("Vice ordförande / sekreterare"), "protokoll");
  assert.equal(motiv("Kassör"), "mynt");
  assert.equal(motiv("Informationsansvarig"), "vagor");
  assert.equal(motiv("Webbansvarig"), "vagor");
  assert.equal(motiv("Grafiskt ansvarig"), "kurva");
  assert.equal(motiv("Masteransvarig"), "hatt");
  assert.equal(motiv(""), "normal", "ett konto utan post får StatLins eget");
  assert.equal(karaktarFor("Kassör", null).motiv, "mynt", "posten räcker utan utskott");
});

test("bara kassören har ett smeknamn", () => {
  assert.equal(karaktarFor("Kassör", styrelsen).smeknamn, "money man");
  for (const post of ["Ordförande", "Vice ordförande", "Informationsansvarig", "Grafiskt ansvarig", "Masteransvarig", ""]) assert.equal(karaktarFor(post, styrelsen).smeknamn, undefined, post);
});

test("den som har ett eget utskott får utskottets färg och motiv, vad posten än heter", () => {
  const scb = { slug: "scb", accent: "#d5252b", kind: "utskott" };
  assert.deepEqual(karaktarFor("Ordförande SCB", scb), { farg: "#d5252b", motiv: "vimplar" });
  assert.deepEqual(karaktarFor("Kassör i puben", { slug: "statpub", accent: "#e8a33d", kind: "utskott" }), { farg: "#e8a33d", motiv: "bubblor" });
  assert.equal(karaktarFor("", { slug: "nytt-utskott", accent: "#123456", kind: "utskott" }).motiv, "normal", "ett utskott utan eget motiv");
  for (const slug of ["ubu", "sasu", "scb", "statpub", "stig", "estig", "amo"]) assert.ok(UTSKOTT[slug], slug);
});

test("en nästan svart eller trasig färg blir bläckets, som syns i båda lägena", () => {
  assert.equal(egenFarg("#2e3192")["--egen"], "#2e3192");
  assert.match(egenFarg("#2e3192")["--egen-ljus"], /#2e3192/);
  assert.equal(egenFarg("#2e3192")["--egen-pa"], "#fff");
  assert.equal(egenFarg("#e8a33d")["--egen-pa"], "#111", "mörk text på StatPubs gula");
  for (const farg of ["#111111", "#000000", "", "röd", "#fff"]) assert.deepEqual(egenFarg(farg), { "--egen": "var(--color-ink)", "--egen-ljus": "#ece8df", "--egen-pa": "var(--color-paper)" }, farg);
});
