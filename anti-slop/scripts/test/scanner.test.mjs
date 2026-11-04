import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import {
  scanContent,
  calculateScore,
  verdict,
  BANNED_WORDS,
  LOW_CONFIDENCE_WORDS,
  TEXT_CONSTRUCTS,
  DESIGN_PATTERNS,
  CODE_PATTERNS,
} from "../slop-scanner.mjs";
import { BANNED_WORD_REGEXES } from "../lib/rules.mjs";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

const has = (vs, pred) => vs.some(pred);
const named = (vs, name) => vs.some((v) => v.name === name);

// Renamed from "module imports without starting the MCP server": the body never tested
// servers, ports or the event loop, and that claim is asserted for real in no-mcp.test.mjs.
// What it does check is that the entry point re-exports a populated rule surface.
test("the entry point re-exports a populated rule surface", () => {
  assert.ok(Array.isArray(BANNED_WORDS) && BANNED_WORDS.length > 10);
  assert.ok(LOW_CONFIDENCE_WORDS.has("utilize"));
  assert.ok(TEXT_CONSTRUCTS.length > 5 && DESIGN_PATTERNS.length > 5 && CODE_PATTERNS.length > 5);
});

test("clean prose produces no violations", () => {
  const clean =
    "The migration moved 4,200 rows in under a second. We tested it on the staging copy first, " +
    "then ran it against production during the Tuesday maintenance window. Nothing broke. The old " +
    "import path still works for the two services that have not switched yet.";
  const vs = scanContent(clean, "note.md");
  assert.equal(vs.length, 0, JSON.stringify(vs));
});

test("slop prose: antithesis, boilerplate, closer, opener, em-dash density", () => {
  const slop = [
    "Honestly, this is not just a feature — it's a paradigm shift.",
    "In today's fast-paced world, we delve into a tapestry — a seamless synergy — leveraging cutting-edge tools — to unlock your full potential.",
    "As an AI language model, I cannot help — but reach out anytime.",
    "This — right here — is the moment. In conclusion, it's a game-changer.",
  ].join("\n");
  const vs = scanContent(slop, "post.md");
  assert.ok(named(vs, "antithesis-not-just-x-y"), "antithesis");
  assert.ok(named(vs, "assistant-boilerplate"), "assistant boilerplate");
  assert.ok(named(vs, "in-conclusion"), "in-conclusion closer");
  assert.ok(named(vs, "fast-paced-opener"), "fast-paced opener");
  assert.ok(named(vs, "unlock-potential"), "unlock potential");
  assert.ok(named(vs, "em-dash-density"), "em-dash density");
});

test("escape hatch suppresses a flagged line", () => {
  const withHatch =
    "This is not just X, it's Y. <!-- anti-slop-allow: deliberate rhetorical antithesis -->";
  const vs = scanContent(withHatch, "post.md");
  assert.ok(!named(vs, "antithesis-not-just-x-y"), JSON.stringify(vs));
});

test("low-confidence word: lone hit is clean, a cluster flags low", () => {
  const one = scanContent("We will leverage the new API for this report.", "a.md");
  assert.ok(!has(one, (v) => v.word === "leverage"), "single leverage should be clean");
  const many = scanContent("We leverage A. We leverage B. We leverage C.", "b.md");
  assert.ok(
    has(many, (v) => v.word === "leverage" && v.severity === "low"),
    "clustered leverage flags at low severity",
  );
});

test("noise-stripping: quoted and code-spanned tells are not flagged", () => {
  const doc = "The phrase `as an AI language model` is a tell. So is \"it's not just X, it's Y\".";
  const vs = scanContent(doc, "ref.md");
  assert.ok(!named(vs, "assistant-boilerplate"), "code-spanned boilerplate skipped");
  assert.ok(!named(vs, "antithesis-not-just-x-y"), "quoted antithesis skipped");
});

test("slop code: chat artifact, placeholder stub, swallowed error, eval, generic name", () => {
  const code = [
    "// Here's the updated code you requested",
    "function processData(data) {",
    "  try { return JSON.parse(data) } catch {}",
    "  // ... rest of your code here",
    "  return eval(userInput)",
    "}",
  ].join("\n");
  const vs = scanContent(code, "x.ts");
  assert.ok(named(vs, "chat-artifact"), "chat artifact");
  assert.ok(named(vs, "placeholder-comment"), "placeholder stub");
  assert.ok(named(vs, "swallowed-error"), "swallowed error");
  assert.ok(named(vs, "generic-naming"), "generic naming");
  assert.ok(has(vs, (v) => v.name === "eval-usage" && v.severity === "high"), "eval is high severity");
});

test("design tells: gradient text, purple-blue gradient, cream/serif, AI purple", () => {
  const css = [
    '<h1 class="bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-blue-500">Hi</h1>',
    "body { background: #faf8f5; font-family: 'Instrument Serif'; }",
    "a { color: #6366f1; }",
    ".cta { background: #7c3aed; }",
  ].join("\n");
  const vs = scanContent(css, "page.css");
  assert.ok(named(vs, "gradient-text"), "gradient text");
  assert.ok(named(vs, "purple-blue-gradient"), "purple-blue gradient");
  assert.ok(named(vs, "cream-serif-default"), "cream/serif default (two legs of the combination)");
  assert.ok(named(vs, "ai-purple-hex"), "AI purple hex (used as the palette, not once)");
});

// Concentration tells report the density, not the instance. Both directions are pinned
// here on purpose: a threshold that only ever fires is the presence rule it replaced.
test("rounded-everything: uniform control radius flagged, one pill and the small avatar are not", () => {
  const uniform = scanContent(
    [
      '<input class="rounded-full border px-4">',
      '<select class="rounded-full border px-4"></select>',
      '<button class="rounded-full px-6 py-3">Go</button>',
    ].join("\n"),
    "a.tsx",
  );
  assert.ok(named(uniform, "rounded-everything"), "same radius on every control flagged");
  const onePill = scanContent('<button class="rounded-full px-6 py-3">Go</button>', "a.tsx");
  assert.ok(!named(onePill, "rounded-everything"), "a lone pill is a choice, not a pattern");
  const avatar = scanContent('<span class="rounded-full h-8 w-8 bg-slate-200"></span>', "b.tsx");
  assert.ok(!named(avatar, "rounded-everything"), "small box (h-8 w-8) suppressed");
});

test("calculateScore clamps to [0,50] and decreases by severity", () => {
  assert.equal(calculateScore([]), 50);
  assert.equal(
    calculateScore([{ severity: "high" }, { severity: "medium" }, { severity: "low" }]),
    50 - 5 - 2 - 1,
  );
  const overflow = Array.from({ length: 40 }, () => ({ severity: "high" }));
  assert.equal(calculateScore(overflow), 0);
});

// ── Regression tests for the completeness-audit port-fidelity fixes ──

test("AI purple is detected as a Tailwind class, not only as hex", () => {
  // The tell is "indigo IS the palette", so the concentration threshold applies: two or
  // more purple-family utilities, not the first one encountered.
  const palette = '<button class="bg-indigo-600 text-white">Go</button>\n<a class="text-violet-500">x</a>';
  assert.ok(named(scanContent(palette, "a.tsx"), "ai-purple-class"));
  assert.ok(
    !named(scanContent('<a class="text-indigo-600">Read the changelog</a>', "a.tsx"), "ai-purple-class"),
    "a lone purple utility is the floor rule, not a finding",
  );
  // purple-only scoping: blue / slate / below-band shades must NOT fire it
  assert.ok(!named(scanContent('<button class="bg-blue-600">Go</button>\n<div class="bg-blue-500">y</div>', "a.tsx"), "ai-purple-class"));
  assert.ok(!named(scanContent('<div class="bg-indigo-100">x</div>\n<div class="bg-indigo-200">y</div>', "a.tsx"), "ai-purple-class"));
});

test("raw-CSS linear-gradient purple is detected (the before.html slop control)", () => {
  assert.ok(named(scanContent(".hero{ background: linear-gradient(135deg,#7c3aed,#2563eb) }", "p.css"), "purple-blue-gradient"));
  assert.ok(!named(scanContent(".x{ background: linear-gradient(90deg,#16a34a,#15803d) }", "p.css"), "purple-blue-gradient"));
});

test("gradient-text catches unprefixed background-clip; shadcn --radius; Spectral serif", () => {
  assert.ok(named(scanContent("h1{ background-clip:text; color:transparent }", "p.css"), "gradient-text"));
  assert.ok(named(scanContent(":root{ --radius: 0.5rem }", "p.css"), "shadcn-default-card"));
  // Spectral is one leg of the cream/serif/sage combination. design-patterns.md has always
  // said the combination is the signal and "one alone may be a real decision"; the rule now
  // enforces that, so a serif display face on its own is clean.
  assert.ok(
    !named(scanContent("h1{ font-family:'Spectral' }", "p.css"), "cream-serif-default"),
    "a serif display face alone is a choice",
  );
  assert.ok(
    named(scanContent("body{ background:#f5f1e8 }\nh1{ font-family:'Spectral' }", "p.css"), "cream-serif-default"),
    "cream background plus serif display is the combination",
  );
});

test("swallowed-error covers Go and Swift; a Python handler on the next line is clean", () => {
  assert.ok(named(scanContent("if err != nil {}", "a.go"), "swallowed-error"));
  assert.ok(named(scanContent("do { try x() } catch {}", "a.swift"), "swallowed-error"));
  // C17 fix: except with a real handler on the next line is NOT a swallow
  assert.ok(!named(scanContent("try:\n    risky()\nexcept Exception:\n    log.error('boom')\n    raise", "a.py"), "swallowed-error"));
  // bare except: still fires
  assert.ok(named(scanContent("try:\n    x()\nexcept:\n    pass", "a.py"), "swallowed-error"));
});

test("language coverage: Swift/Kotlin are scanned for code patterns", () => {
  assert.ok(named(scanContent("func processData(x) {}", "a.swift"), "generic-naming"));
  assert.ok(named(scanContent("// rest of your code here", "a.kt"), "placeholder-comment"));
});

test("low-confidence comprehensive: lone hit clean, cluster flags low", () => {
  assert.ok(!scanContent("A comprehensive plan for Q3.", "a.md").some((v) => v.word === "comprehensive"));
  assert.ok(scanContent("A comprehensive plan. A comprehensive review. A comprehensive audit.", "b.md").some((v) => v.word === "comprehensive" && v.severity === "low"));
  assert.ok(BANNED_WORDS.includes("comprehensive"));
});

test("restored markers: sk- key, existing-code stub, knowledge cutoff, star emoji", () => {
  assert.ok(named(scanContent('const k = "sk-xxx-placeholder";', "a.ts"), "boilerplate-marker"));
  assert.ok(named(scanContent("function f(){\n  // existing code unchanged\n}", "a.ts"), "placeholder-comment"));
  assert.ok(named(scanContent("As of my last knowledge cut-off I cannot verify that.", "a.md"), "assistant-boilerplate"));
  assert.ok(scanContent("const label = 'rating " + String.fromCodePoint(0x2b50) + "'", "a.ts").some((v) => v.type === "emoji"));
});

test("verdict ladder: CLEAN/MINOR/SOME/STRONG with the long-doc guard", () => {
  assert.equal(verdict([]), "CLEAN");
  assert.equal(verdict([{ severity: "low" }]), "MINOR");
  assert.equal(verdict([{ severity: "high" }]), "SOME");
  assert.equal(verdict([{ severity: "high" }, { severity: "high" }, { severity: "high" }]), "STRONG");
  // 3 medium (weighted 6) -> SOME in a short doc, demoted to MINOR in a long sparse one
  assert.equal(verdict([{ severity: "medium" }, { severity: "medium" }, { severity: "medium" }], 100), "SOME");
  assert.equal(verdict([{ severity: "medium" }, { severity: "medium" }, { severity: "medium" }], 5000), "MINOR");
});

test("fixture: before.html (slop control) flags a full AI-default page", () => {
  const vs = scanContent(readFileSync(join(FIXTURES, "before.html"), "utf8"), "before.html");
  const designNames = [...new Set(vs.filter((v) => v.type === "design-tell").map((v) => v.name))];
  assert.ok(designNames.length >= 4, `expected >=4 design tells, got ${designNames.join(",")}`);
  assert.ok(named(vs, "gradient-text"));
  assert.ok(vs.some((v) => v.type === "emoji"));
});

// The `important-overuse` exclusion this test used to carry was vacuous -- all four
// fixtures produce zero design tells, so the filter never removed anything, and a dead
// exclusion masks exactly the regression the test exists to catch. Asserting the whole
// design-tell set is empty is both stronger and honest about what these fixtures are.
test("fixture: the four 'after' designs carry no AI-aesthetic tells (escape hatch end-to-end)", () => {
  for (const f of ["editorial-bold.html", "technical-mono.html", "utilitarian-fintech.html", "warm-consumer.html"]) {
    const vs = scanContent(readFileSync(join(FIXTURES, f), "utf8"), f);
    const aiTells = vs.filter((v) => v.type === "design-tell");
    assert.equal(aiTells.length, 0, `${f} should have no AI-aesthetic design tells, got ${aiTells.map((v) => v.name).join(",")}`);
  }
});

// ── Extension routing (2.1.0) ────────────────────────────────────────────────
// Which rule FAMILIES an extension gets was decided entirely by set membership and
// asserted nowhere, in either direction. The omission that hid inside that silence: .html,
// .vue, .svelte and .astro were web surfaces but not code surfaces, so a <script> block
// containing eval(), an innerHTML assignment and a hardcoded key scanned completely clean.

const SCRIPT_BODY = [
  '<img src="hero.png" alt="Q3 revenue by region">',
  "<script>",
  'const API_KEY = "sk-live-3f9a2bc7d1e4";',
  "eval(userExpression);",
  "el.innerHTML = untrusted;",
  "</script>",
].join("\n");

test("routing: markup-with-script surfaces get the code rules", () => {
  for (const ext of [".html", ".htm", ".vue", ".svelte", ".astro", ".jsx", ".tsx", ".ts", ".js"]) {
    const found = scanContent(SCRIPT_BODY, `page${ext}`).map((v) => v.name).sort();
    assert.deepEqual(
      found,
      ["eval-usage", "hardcoded-secret", "img-no-dimensions", "innerhtml-usage"],
      `page${ext} did not receive the code rules`,
    );
  }
});

test("routing: prose and non-web code surfaces are left alone by the other tables", () => {
  assert.deepEqual(scanContent(SCRIPT_BODY, "notes.md").map((v) => v.name), [], "prose gets no code or design rules");
  // A Python file is a code surface and not a web surface: the design table must not run.
  const py = scanContent('el.innerHTML = x\n<div class="rounded-xl shadow-sm border">', "a.py").map((v) => v.name);
  assert.ok(py.includes("innerhtml-usage"), "code rules run on .py");
  assert.ok(!py.includes("shadow-border-rounded-combo"), "design tells must not run on .py");
});

test("routing: a test-shaped path still skips the security and dummy-data rules on the new surfaces", () => {
  const found = scanContent(SCRIPT_BODY, "src/__tests__/page.html").map((v) => v.name).sort();
  assert.deepEqual(found, ["eval-usage", "img-no-dimensions"], "skipInTests must apply on markup surfaces too");
});

// ── Emoji ranges (2.1.0) ─────────────────────────────────────────────────────
// 2.1.0 widened the code-point ranges to whole blocks (Arrows, Miscellaneous Technical,
// Geometric Shapes) after a pause/play toggle shipped as a text glyph. Measured on one
// fleet over two weeks of changes, that widening flagged 232 code files, 187 of them for
// a plain `→`, the rest mostly ⌘ in shortcut hints and ▸ ▲ ▼ as disclosure markers:
// typography, not emoji. Since 2.3.1 an emoji is what Unicode renders as one: a
// default-emoji-presentation character, a pictograph forced to emoji presentation by
// U+FE0F, a keycap sequence, or a flag. The bare media-control glyph used as a UI control
// is its own design/native tell (`media-control-glyph`, rule-additions.test.mjs), which
// is where the recorded incident belongs.

const DEFAULT_EMOJI = [
  ["fast forward", "⏩"], ["hourglass", "⌛"], ["watch", "⌚"], ["check mark button", "✅"],
  ["cross mark", "❌"], ["star", "⭐"], ["rocket", "🚀"], ["sparkles", "✨"], ["high voltage", "⚡"],
];

// Text-presentation pictographs: typography when bare, emoji only with U+FE0F.
const TEXT_PICTOGRAPHS = [
  ["play", "▶"], ["pause", "⏸"], ["stop", "⏹"], ["next track", "⏭"], ["record", "⏺"],
  ["eject", "⏏"], ["heavy check mark", "✔"], ["warning", "⚠"], ["left right arrow", "↔"],
  ["heavy black heart", "❤"],
];

// Never emoji: the prose rules are built on the punctuation, and the rest is the
// typography a working codebase is full of.
const NEVER_EMOJI = [
  ["em dash", "—"], ["curly apostrophe", "’"], ["ellipsis", "…"], ["dagger", "†"],
  ["en dash", "–"], ["bullet", "•"], ["right arrow", "→"], ["double right arrow", "⇒"],
  ["left arrow", "←"], ["command key", "⌘"], ["small right triangle", "▸"],
  ["up triangle", "▲"], ["down triangle", "▼"], ["diamond", "◆"], ["black square", "■"],
  ["multiplication sign", "×"], ["copyright", "©"], ["registered", "®"], ["trade mark", "™"],
  ["black star", "★"], ["eighth note", "♪"], ["check mark", "✓"], ["ballot x", "✗"],
];

test("emoji: default-emoji-presentation glyphs are emoji, in prose and in code", () => {
  for (const [name, glyph] of DEFAULT_EMOJI) {
    for (const path of ["notes.md", "src/player.ts"]) {
      assert.ok(
        scanContent(`status ${glyph} here`, path).some((v) => v.type === "emoji"),
        `${name} (U+${glyph.codePointAt(0).toString(16).toUpperCase()}) is not detected in ${path}`,
      );
    }
  }
});

test("emoji: a text-presentation pictograph is typography bare and an emoji with U+FE0F", () => {
  for (const [name, glyph] of TEXT_PICTOGRAPHS) {
    assert.ok(
      !scanContent(`status ${glyph} here`, "src/player.ts").some((v) => v.type === "emoji"),
      `bare ${name} (U+${glyph.codePointAt(0).toString(16).toUpperCase()}) must not be treated as an emoji`,
    );
    assert.ok(
      scanContent(`status ${glyph}️ here`, "src/player.ts").some((v) => v.type === "emoji"),
      `${name} followed by U+FE0F is an emoji`,
    );
  }
});

test("emoji: typographic punctuation and symbols are never an emoji", () => {
  for (const [name, glyph] of NEVER_EMOJI) {
    assert.ok(
      !scanContent(`a ${glyph} b`, "src/copy.ts").some((v) => v.type === "emoji"),
      `${name} (U+${glyph.codePointAt(0).toString(16).toUpperCase()}) must not be treated as an emoji`,
    );
  }
  // And the em-dash rule that depends on them still works.
  const dashes = "One — two — three — four — five — six — seven words here.";
  assert.ok(named(scanContent(dashes, "post.md"), "em-dash-density"));
});

test("emoji: a keycap, a toned hand and a flag each count once", () => {
  const count = (s) => scanContent(s, "src/run.ts").find((v) => v.type === "emoji")?.count ?? 0;
  assert.equal(count("step 1️⃣ done"), 1, "keycap sequence");
  assert.equal(count("ok \u{1F44D}\u{1F3FD}"), 1, "thumbs up with a skin tone");
  assert.equal(count("\u{1F1EC}\u{1F1E7} store"), 1, "regional-indicator flag");
  assert.equal(count("\u{1F680}\u{1F680}"), 2);
});

// 2.3.2, from the independent review of 2.3.1: a ZWJ sequence counted once per component,
// so two family emoji escalated a finding that six rockets would not.
test("emoji: a ZWJ sequence counts once", () => {
  const count = (s) => scanContent(s, "src/run.ts").find((v) => v.type === "emoji")?.count ?? 0;
  assert.equal(count("\u{1F468}‍\u{1F469}‍\u{1F467}"), 1, "family");
  assert.equal(count("\u{1F469}‍\u{1F4BB}"), 1, "technologist");
  assert.equal(count("\u{1F3F3}️‍\u{1F308}"), 1, "rainbow flag");
  assert.equal(count("\u{1F468}‍\u{1F469}‍\u{1F467} and \u{1F680}"), 2);
});

// 2.3.2: the emoji rule was the one family with no surface gate, so a PNG read as UTF-8
// reported "1 emoji found". Text never carries a NUL byte; binary always does early on.
test("binary content (a NUL byte) matches no rule on any surface", () => {
  const png = "PNG\r\n\n   \rIHDR��\u{1F680} delve delve delve";
  assert.deepEqual(scanContent(png, "icon.png"), []);
  assert.deepEqual(scanContent(png, "src/blob.ts"), []);
  assert.deepEqual(scanContent(png, "notes.md"), []);
});

test("emoji: console-log-emoji tracks the same definition, never a subset of it", () => {
  for (const [name, glyph] of DEFAULT_EMOJI) {
    assert.ok(
      named(scanContent(`console.log("done ${glyph}");`, "src/run.ts"), "console-log-emoji"),
      `console-log-emoji missed ${name}, so its definition has drifted from EMOJI_REGEX`,
    );
  }
  assert.ok(named(scanContent('console.log("done ✔️");', "src/run.ts"), "console-log-emoji"));
  assert.ok(!named(scanContent('console.log("done — finally");', "src/run.ts"), "console-log-emoji"));
  assert.ok(!named(scanContent('console.log("a → b, ⌘K");', "src/run.ts"), "console-log-emoji"));
});

test("emoji: the count escalates severity the way em-dash density does", () => {
  const at = (n) => scanContent("\u{1F680}".repeat(n), "src/run.ts").find((v) => v.type === "emoji");
  assert.equal(at(1).severity, "low", "one stray glyph is not a decorated README");
  assert.equal(at(5).severity, "low");
  assert.equal(at(6).severity, "medium");
  assert.equal(at(6).count, 6);
});

// ── Edge inputs ──────────────────────────────────────────────────────────────
// None of these had coverage, and all of them are shapes a real `git diff --name-only`
// pipeline hands the scanner.

test("edge input: an empty file and an extension-less path are clean, not crashes", () => {
  assert.deepEqual(scanContent("", "a.md"), []);
  assert.deepEqual(scanContent("", "a.ts"), []);
  assert.deepEqual(scanContent(" ", "Makefile"), []);
  assert.deepEqual(scanContent("We delve into it.", "LICENSE"), [], "no extension routes to no rule family");
});

test("edge input: every prose extension routes to the prose rules", () => {
  for (const ext of [".md", ".mdx", ".txt", ".rst"]) {
    const vs = scanContent("We delve into the tapestry.", `note${ext}`);
    assert.deepEqual(vs.map((v) => v.word).sort(), ["delve", "tapestry"], `${ext} did not route to prose rules`);
  }
});

test("edge input: a lone surrogate and binary-ish bytes do not throw or match", () => {
  assert.deepEqual(scanContent("\uD83D", "a.md"), [], "an unpaired high surrogate is not an emoji");
  const binary = Array.from({ length: 512 }, (_, i) => String.fromCharCode(i % 256)).join("");
  assert.doesNotThrow(() => scanContent(binary, "a.png"));
});

test("edge input: calculateScore treats an unrecognised severity as the lowest tier", () => {
  assert.equal(calculateScore([{ severity: "catastrophic" }]), 49, "an unknown severity falls through to -1");
  assert.equal(calculateScore([{ severity: undefined }]), 49);
});

// ── Final-review false-positive fixes ──

test("swallowed-error: a comment-catch with real recovery on the next line is NOT a swallow", () => {
  assert.ok(!named(scanContent("try { x() } catch (e) {  // expected sometimes\n  retry()\n}", "a.ts"), "swallowed-error"));
  assert.ok(!named(scanContent("if err != nil {  // log upstream\n  return fallback\n}", "a.go"), "swallowed-error"));
  // a one-line commented-empty catch IS still a swallow
  assert.ok(named(scanContent("try { x() } catch (e) { // ignore }", "a.ts"), "swallowed-error"));
  assert.ok(named(scanContent("if err != nil { // ignore }", "a.go"), "swallowed-error"));
});

test("placeholder-comment: a real why-comment containing 'here' is not a stub", () => {
  assert.ok(!named(scanContent("function f(){\n  // implementation here is naive but fine for now\n  return 1\n}", "a.ts"), "placeholder-comment"));
  // the genuine stub still fires
  assert.ok(named(scanContent("function f(){\n  // implementation goes here\n}", "a.ts"), "placeholder-comment"));
});

// ── 1.4.1: hardcoded-secret precision + test-file skipping ──

test("hardcoded-secret flags real secrets, not compound identifiers or non-secret values", () => {
  // real secrets still caught
  assert.ok(named(scanContent('const apiKey = "sk_live_abcdef123456"', "a.ts"), "hardcoded-secret"));
  assert.ok(named(scanContent('fetch({ token: "csrf-tok12xyz" })', "a.ts"), "hardcoded-secret"));
  // compound identifiers (the word is a substring) are not credentials
  assert.ok(!named(scanContent('const colorToken = "--color-positive"', "a.ts"), "hardcoded-secret"));
  assert.ok(!named(scanContent('{ currentPassword: "a-fresh-strong-passphrase-12345" }', "a.ts"), "hardcoded-secret"));
  assert.ok(!named(scanContent('const URL_CHANGE_PASSWORD = "/auth/change-password"', "a.ts"), "hardcoded-secret"));
  // non-secret values (URL / CSS var) are excluded
  assert.ok(!named(scanContent('const SKELETON_HEIGHT_TOKEN = "var(--nm-skel-h)"', "a.ts"), "hardcoded-secret"));
});

test("security / dummy-data patterns are skipped in test and fixture files, kept in prod", () => {
  assert.ok(!named(scanContent('fetch({ token: "csrf-tok12xyz" })', "x.test.ts"), "hardcoded-secret"));
  assert.ok(!named(scanContent("el.innerHTML = x", "x.test.tsx"), "innerhtml-usage"));
  assert.ok(!named(scanContent('const e = "user@example.com"', "x.test.ts"), "boilerplate-marker"));
  assert.ok(!named(scanContent('const t = "secret: passw0rd123"', "client/e2e/a.spec.ts"), "hardcoded-secret"));
  // the same patterns still fire in production code
  assert.ok(named(scanContent("el.innerHTML = userInput", "a.tsx"), "innerhtml-usage"));
  assert.ok(named(scanContent('const apiKey = "sk_live_abcdef123456"', "src/config.ts"), "hardcoded-secret"));
});

// ── D3: scanner optimization -- phrase counting, config filtering, context exceptions, ──
// ── precompiled-regex parity ──

test("a repeated banned phrase reports the total count and the first occurrence's line", () => {
  const doc = [
    "Great question! Let's get into it.",
    "Filler line with no tells.",
    "Great question, glad you asked again.",
  ].join("\n");
  const vs = scanContent(doc, "post.md");
  const hit = vs.find((v) => v.type === "banned-phrase" && v.phrase === "great question");
  assert.ok(hit, JSON.stringify(vs));
  assert.equal(hit.count, 2, "should count both occurrences, not just the first");
  assert.equal(hit.line, 1, "line should point at the FIRST occurrence");
});

test("allowedWords in .anti-slop/config.json suppresses a banned word", async () => {
  // loadProjectConfig() reads .anti-slop/config.json relative to process.cwd() captured at
  // module-load time in lib/store.mjs -- it cannot be faked by chdir-ing inside this test
  // process (other tests in this file depend on the real cwd). Spawn a fresh child process
  // with its cwd pointed at a temp project dir instead.
  const dir = mkdtempSync(join(tmpdir(), "anti-slop-allowedwords-"));
  try {
    mkdirSync(join(dir, ".anti-slop"), { recursive: true });
    writeFileSync(
      join(dir, ".anti-slop", "config.json"),
      JSON.stringify({ allowedWords: ["leverage"] }),
    );
    const scanMjsUrl = pathToFileURL(
      join(dirname(fileURLToPath(import.meta.url)), "..", "lib", "scan.mjs"),
    ).href;
    const script = [
      `import { scanContent } from ${JSON.stringify(scanMjsUrl)};`,
      `const vs = scanContent("We leverage A. We leverage B. We leverage C.", "b.md");`,
      `console.log(JSON.stringify({ flagged: vs.some((v) => v.word === "leverage") }));`,
    ].join("\n");
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    const { flagged } = JSON.parse(result.stdout.trim());
    assert.equal(flagged, false, "allowedWords should suppress the banned word even when clustered");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a CONTEXT_EXCEPTIONS word is not flagged when its domain context is present", () => {
  // "realm" is low-confidence (needs clustering) -- use two occurrences so the base case
  // (no domain context) actually flags, then show the domain word suppresses it.
  const withoutContext = "Welcome to the enchanted realm. In this realm, everything feels possible.";
  const vsWithout = scanContent(withoutContext, "a.md");
  assert.ok(vsWithout.some((v) => v.word === "realm"), "realm should flag without domain context (clustered)");

  const withContext = withoutContext + " The server handles each request in milliseconds.";
  const vsWith = scanContent(withContext, "a.md");
  assert.ok(!vsWith.some((v) => v.word === "realm"), "realm should be excused once 'server' appears in the doc");
});

test("precompiled banned-word regexes cover every word, case-insensitively, with word boundaries", () => {
  for (const word of BANNED_WORDS) {
    assert.ok(BANNED_WORD_REGEXES.has(word), `missing compiled regex for "${word}"`);
    const re = BANNED_WORD_REGEXES.get(word);
    assert.ok(re instanceof RegExp, `"${word}" entry should be a RegExp`);
    assert.ok(re.global && re.ignoreCase, `"${word}" regex must be global + case-insensitive`);
  }
  const delveRe = BANNED_WORD_REGEXES.get("delve");
  assert.ok("We DELVE into details.".match(delveRe), "case-insensitive match should still work");
  assert.ok(!"We delved into details.".match(delveRe), '"delved" must not match \\bdelve\\b');
});

// Data and config files get no emoji findings; the same object literal in a component does.
test("emoji: data and config files are not a surface, a component is", () => {
  const obj = '{"label": "✨ New"}';
  for (const path of ["a.json", "a.yml", "a.toml", "a.csv", "a.svg", "a.xml"]) {
    assert.ok(!scanContent(obj, path).some((v) => v.type === "emoji"), path);
  }
  const tsx = scanContent(`export const badge = ${obj};`, "a.tsx").find((v) => v.type === "emoji");
  assert.equal(tsx && tsx.severity, "low");
});

// A banned word inside typographic quotes is a quoted example, the same as inside straight ones.
test("noise-stripping: a word quoted in curly double quotes is not flagged", () => {
  const words = (text) => scanContent(text, "post.md").filter((v) => v.type === "banned-word").map((v) => v.word);
  assert.deepEqual(words("Avoid words like \u201Cdelve\u201D in release notes."), []);
  assert.deepEqual(words("We delve into release notes."), ["delve"]);
  assert.deepEqual(words("Avoid \u201Cdelve\nacross lines\u201D here."), ["delve"], "a span never crosses a line");
});

// ── Rule-scoped waivers (2.5.0) ──────────────────────────────────────────────
// `anti-slop-allow: <id>[, <id>] -- <reason>` waives the named table rules on its line and
// leaves every other rule reading it; a marker with no ` -- ` is free text, line-wide.

const wordmark = (marker) => `<h1 class="bg-clip-text text-transparent bg-gradient-to-r from-amber-600 to-red-700" style="background: #fff; color: #aaa"> <!-- ${marker} -->Halcyon</h1>`;
const ruleNames = (content, path = "a.html", opts) => scanContent(content, path, opts).map((v) => v.name || v.type);

test("waiver: a scoped waiver suppresses only the rule it names", () => {
  const got = ruleNames(wordmark("anti-slop-allow: gradient-text -- wordmark from the identity guide"));
  assert.ok(!got.includes("gradient-text"), JSON.stringify(got));
  assert.ok(got.includes("low-contrast"), "the contrast failure on the waived line still reports");
});

test("waiver: free text with no ` -- ` stays line-wide, as every existing marker is", () => {
  for (const marker of ["anti-slop-allow: the wordmark", "anti-slop-allow: on-brand gradient", "unslop-ignore"]) {
    const got = ruleNames(wordmark(marker));
    assert.ok(!got.includes("gradient-text") && !got.includes("low-contrast"), `${marker}: ${JSON.stringify(got)}`);
  }
});

test("waiver: an unknown id suppresses nothing, and the scan says so", () => {
  const warnings = [];
  const got = ruleNames(wordmark("anti-slop-allow: no-such-rule -- x"), "a.html", { warnings });
  assert.ok(got.includes("gradient-text") && got.includes("low-contrast"), JSON.stringify(got));
  assert.deepEqual(warnings, [{ file: "a.html", line: 1, unknown: ["no-such-rule"] }]);
  const mixed = ruleNames(wordmark("anti-slop-allow: gradient-text, no-such-rule -- x"));
  assert.ok(mixed.includes("gradient-text"), "one unknown id voids the whole waiver");
});

test("waiver: code rules take the scoped form; the suppressed capture says which waiver", () => {
  const js = "run(); eval(payload); // anti-slop-allow: eval-usage -- sandboxed loader\n";
  assert.ok(!ruleNames(js, "loader.js").includes("eval-usage"));
  const suppressed = scanContent(wordmark("anti-slop-allow: gradient-text -- wordmark"), "a.html", { collectSuppressed: true }).filter((v) => v.suppressed);
  assert.deepEqual(suppressed.map((v) => [v.name, v.suppressedBy]), [["gradient-text", "waiver:gradient-text"]]);
});

test("waiver: the prose families stay line-wide for any marker", () => {
  const md = "Great question! We delve into it. <!-- anti-slop-allow: gradient-text -- x -->\n";
  assert.deepEqual(scanContent(md, "post.md").filter((v) => v.type === "banned-phrase" || v.type === "banned-word"), []);
});
