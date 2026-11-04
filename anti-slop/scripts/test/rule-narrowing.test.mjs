import { test } from "node:test";
import assert from "node:assert/strict";
import { scanContent } from "../lib/scan.mjs";
import { countOffScaleSpacing } from "../lib/rules.mjs";

const names = (content, path) => scanContent(content, path).map((v) => v.name);
const fires = (rule, content, path) => names(content, path).includes(rule);

// ── Item 1: the hero type scale ──────────────────────────────────────────────
// The rule catches the VERBATIM Tailwind default triplet as a genericness signal. It is
// not a rule against responsive typography: a remediation that deletes fluid type scaling
// makes the page worse and breaks WCAG 1.4.4, so any match wide enough to be cleared that
// way is the wrong match.

test("hero triplet: the verbatim Tailwind default run is a finding", () => {
  const html = '<h1 class="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">Ship faster</h1>';
  assert.ok(fires("tailwind-hero-triplet", html, "hero.html"));
});

test("hero triplet: a responsive scale on different steps is NOT a finding", () => {
  const html = '<h1 class="text-3xl md:text-5xl xl:text-7xl font-semibold tracking-tighter">Ship faster</h1>';
  assert.ok(!fires("tailwind-hero-triplet", html, "hero.html"));
});

test("hero triplet: a fluid clamp() ramp is NOT a finding", () => {
  const css = "h1 { font-size: clamp(2rem, 1.2rem + 3.2vw, 4.5rem); letter-spacing: -0.025em; }";
  assert.ok(!fires("tailwind-hero-triplet", css, "type.css"));
});

test("hero triplet: a single responsive size step is NOT a finding", () => {
  const html = '<h1 class="text-5xl font-bold">Ship faster</h1>';
  assert.ok(!fires("tailwind-hero-triplet", html, "hero.html"));
});

// ── eval-usage: the noun "eval" in prose, and Playwright's $eval, are not eval() ──
// Measured on one fleet (2.3.1): every Swift hit was a doc comment ("once per message per
// body eval (#787)", "a pure parent re-eval (an obscured row)"), and every JS hit under the
// audit scripts was Playwright's `page.$eval(` / `page.$$eval(`. Neither executes anything.

test("eval-usage: Playwright's $eval and $$eval are NOT findings", () => {
  const js = [
    'const title = await page.$eval("h1", (el) => el.textContent);',
    'const rows = await page.$$eval(".row", (els) => els.length);',
  ].join("\n");
  assert.ok(!fires("eval-usage", js, "probe.mjs"));
});

test("eval-usage: the noun eval in a comment is NOT a finding", () => {
  assert.ok(!fires("eval-usage", "/// once per message per body eval (#787), and\nlet x = 1\n", "AppSettings.swift"));
  assert.ok(!fires("eval-usage", "// so a pure parent re-eval (an obscured row) is cheap\nlet y = 2\n", "Coordinator.swift"));
  assert.ok(!fires("eval-usage", "# the eval (see notes) happens later\nx = 1\n", "job.py"));
});

test("eval-usage: a real eval call still fires, with or without a space, bare or on window", () => {
  assert.ok(fires("eval-usage", "return eval(userInput);", "app.ts"));
  assert.ok(fires("eval-usage", "return eval (userInput);", "app.ts"));
  assert.ok(fires("eval-usage", "window.eval(code);", "app.ts"));
  assert.ok(fires("eval-usage", "run(); eval(payload) // loads the plugin", "app.ts"));
});

// 2.3.2, from the independent review of 2.3.1: the comment suppress tested whether a line
// STARTS like a comment, not whether it IS one, and the hyphen in the lookbehind swallowed a
// unary minus. A security rule must not go quiet on code because a comment sits before it.
test("eval-usage: a comment that closes on the line does not shield the code after it", () => {
  assert.ok(fires("eval-usage", "/* setup */ eval(payload);\n", "app.ts"));
  assert.ok(fires("eval-usage", "  *gen() { eval(x); }\n", "app.ts"));
  assert.ok(fires("eval-usage", "return -eval(expr);\n", "app.ts"));
  assert.ok(!fires("eval-usage", "/* eval (notes) */\n", "app.ts"), "a one-line block comment is prose");
  assert.ok(!fires("eval-usage", " * the second eval (per row) is cheap\n", "app.ts"), "a JSDoc continuation is prose");
  assert.ok(!fires("eval-usage", "/* opens here, the eval (per row)\n", "app.ts"), "an unclosed block comment is prose");
});

// ── Item 1 sibling: !important on the reduced-motion idiom ───────────────────
// `* { transition: none !important }` inside a prefers-reduced-motion block is the
// canonical, correct implementation of WCAG 2.3.3. Flagging it invites a "fix" that
// deletes motion-preference handling, which is the same failure mode as the hero rule.

test("important-overuse: the reduced-motion idiom is NOT a finding", () => {
  const css = "@media (prefers-reduced-motion: reduce) {\n  * { transition: none !important; animation: none !important; }\n}";
  assert.ok(!fires("important-overuse", css, "base.css"));
});

test("important-overuse: a lone pragmatic override is NOT a finding", () => {
  const css = ".vendor-widget .title { color: var(--ink) !important; }";
  assert.ok(!fires("important-overuse", css, "overrides.css"));
});

test("important-overuse: genuine overuse still fires", () => {
  const css = [
    ".a { color: red !important; }",
    ".b { background: white !important; }",
    ".c { margin: 0 !important; }",
    ".d { padding: 0 !important; }",
  ].join("\n");
  assert.ok(fires("important-overuse", css, "styles.css"));
});

// ── Item 3: concentration thresholds ─────────────────────────────────────────

test("rounded-everything: a lone radius hit is NOT a finding (the floor rule)", () => {
  const html = '<span class="rounded-full h-8 w-8"><img src="/a.png" alt="Ada"></span>';
  assert.ok(!fires("rounded-everything", html, "avatar.html"));
});

test("rounded-everything: two radius hits are still NOT a finding", () => {
  const css = ".btn { border-radius: 999px; }\n.pill { border-radius: 999px; }";
  assert.ok(!fires("rounded-everything", css, "two.css"));
});

test("rounded-everything: the same radius on every control IS a finding", () => {
  const html = [
    '<input class="rounded-full border px-4">',
    '<select class="rounded-full border px-4"></select>',
    '<textarea class="rounded-full border px-4"></textarea>',
    '<button class="rounded-full px-4">Save</button>',
  ].join("\n");
  assert.ok(fires("rounded-everything", html, "form.html"));
});

test("cream-serif-default: one leg of the combination is NOT a finding", () => {
  const css = "body { background: #faf8f5; font-family: Charter, Georgia, serif; }";
  assert.ok(!fires("cream-serif-default", css, "one-leg.css"));
});

test("cream-serif-default: two legs of the combination ARE a finding", () => {
  const css = 'body { background: #faf8f5; }\nh1 { font-family: "Instrument Serif", serif; }';
  assert.ok(fires("cream-serif-default", css, "combo.css"));
});

test("ai-purple-class: a lone indigo utility is NOT a finding", () => {
  const html = '<a class="text-indigo-600 underline">Read the changelog</a>';
  assert.ok(!fires("ai-purple-class", html, "link.html"));
});

test("ai-purple-class: indigo used as the palette IS a finding", () => {
  const html = [
    '<button class="bg-indigo-600 text-white">Get started</button>',
    '<div class="border-indigo-500"><span class="text-indigo-700">New</span></div>',
  ].join("\n");
  assert.ok(fires("ai-purple-class", html, "hero.html"));
});

// ── Item 7: native tells ─────────────────────────────────────────────────────

test("native: UIScreen.main.bounds is a finding", () => {
  const swift = "let cardWidth = UIScreen.main.bounds.width - 32";
  assert.ok(fires("uiscreen-bounds", swift, "CardView.swift"));
});

test("native: a fixed content-width frame is a finding", () => {
  const swift = "VStack { Text(title) }.frame(width: 320)";
  assert.ok(fires("fixed-content-frame", swift, "DetailView.swift"));
});

test("native: a small control frame is NOT a finding", () => {
  const swift = "Image(systemName: \"gear\").frame(width: 44, height: 44)";
  assert.ok(!fires("fixed-content-frame", swift, "IconButton.swift"));
});

test("native: branching on the device idiom is a finding", () => {
  const swift = "if UIDevice.current.userInterfaceIdiom == .pad { wide() } else { narrow() }";
  assert.ok(fires("device-idiom-branch", swift, "RootView.swift"));
});

test("native: a fixed grid column array is a finding", () => {
  const swift = "let columns = [GridItem(.fixed(300)), GridItem(.fixed(300))]";
  assert.ok(fires("fixed-grid-columns", swift, "Grid.swift"));
});

test("native: an adaptive grid is NOT a finding", () => {
  const swift = "let columns = [GridItem(.adaptive(minimum: 280, maximum: 420), spacing: 16)]";
  assert.ok(!fires("fixed-grid-columns", swift, "Grid.swift"));
});

test("native: a repeating symbol effect is a finding", () => {
  const swift = 'Image(systemName: "dot.radiowaves.left.and.right").symbolEffect(.pulse, options: .repeating)';
  assert.ok(fires("repeating-symbol-effect", swift, "LiveBadge.swift"));
});

test("native: a one-shot symbol effect is NOT a finding", () => {
  const swift = 'Image(systemName: "checkmark").symbolEffect(.bounce, value: saved)';
  assert.ok(!fires("repeating-symbol-effect", swift, "SaveButton.swift"));
});

// ── Purple class rules read resting utilities in one class set (2.5.0) ───────
// A hover or focus purple, a /10 tint, and two halves of a gradient split across sibling
// elements were all counted through 2.4.0. Breakpoints and dark: still paint at rest.

test("ai-purple-class and purple-gradient-default: states, tints and sibling halves are not the palette", () => {
  const html = '<button class="hover:bg-indigo-500 text-white">One</button><button class="focus:ring-violet-500 text-white">Two</button>\n' +
    '<div class="bg-indigo-500/10 p-4">Tint</div><div class="bg-violet-600/5 p-4">Tint</div>\n' +
    '<span class="from-indigo-500 x"></span><span class="to-violet-600">x</span>';
  const got = names(html, "state-variant.html");
  assert.ok(!got.includes("ai-purple-class") && !got.includes("purple-gradient-default"), JSON.stringify(got));
});

test("ai-purple-class: breakpoint and dark: variants still paint at rest", () => {
  const v = scanContent('<div class="md:bg-indigo-600 dark:text-violet-400">x</div>', "a.html").find((x) => x.name === "ai-purple-class");
  assert.equal(v && v.count, 2);
  assert.equal(scanContent('<div class="bg-violet-600 hover:bg-violet-700">x</div><p class="text-violet-600">y</p>', "a.html").find((x) => x.name === "ai-purple-class").count, 2,
    "the resting tokens count and the hover one does not");
  assert.equal(scanContent('<a class="bg-gradient-to-r from-indigo-500 to-violet-600">x</a>', "a.html").find((x) => x.name === "ai-purple-class").count, 2,
    "gradient stops count beside the gradient they paint");
  assert.ok(!fires("ai-purple-class", '<i class="from-indigo-500"></i><i class="to-violet-600"></i>', "a.html"), "a stop with no gradient paints nothing");
});

test("ai-purple-class: an @apply line outside markup is read with token boundaries", () => {
  assert.ok(fires("ai-purple-class", ".btn { @apply bg-indigo-600 text-violet-500; }", "app.css"));
  assert.ok(!fires("ai-purple-class", ".btn { @apply hover:bg-indigo-600 bg-indigo-600/10; }", "app.css"));
});

test("purple gradients: both halves in one class set and one arm fire, split halves do not", () => {
  assert.ok(fires("purple-gradient-default", '<a class="bg-gradient-to-r from-indigo-500 to-violet-600">x</a>', "a.html"));
  assert.ok(!fires("purple-gradient-default", '<a className={on ? "from-indigo-500" : "to-violet-600"} />', "A.tsx"));
  assert.ok(fires("purple-blue-gradient", '<h1 class="to-blue-500 from-purple-600">x</h1>', "a.html"), "order-free inside one set");
  assert.ok(!fires("purple-blue-gradient", '<i class="from-purple-600"></i><i class="to-blue-500"></i>', "a.html"));
  assert.ok(fires("purple-blue-gradient", ".hero { background: linear-gradient(135deg, #6366f1, #8b5cf6); }", "a.css"), "the hex half is unchanged");
});

// ── neon-glow is a perceptible coloured glow (2.5.0) ─────────────────────────

test("neon-glow: soft neutral shadows, token definitions and hairline rings are not glows", () => {
  assert.ok(!fires("neon-glow", ".card { box-shadow: 0 0 24px rgba(0, 0, 0, 0.06); }", "soft-shadow.css"));
  assert.ok(!fires("neon-glow", ":root { --card-box-shadow: 0 0 20px #000; }", "token-prop.css"));
  assert.ok(!fires("neon-glow", '<div class="shadow-[0_0_1px_rgba(0,0,0,0.2)] p-4">x</div>', "tw-shadow.html"));
});

test("neon-glow: a coloured glow fires in computed form and as a Tailwind arbitrary value", () => {
  assert.ok(fires("neon-glow", ".cta { box-shadow: 0px 0px 28px rgba(34, 211, 238, 0.55); }", "a.css"), "zero offsets written 0px");
  assert.ok(fires("neon-glow", '<div class="shadow-[0_0_24px_rgba(168,85,247,0.6)]">x</div>', "a.html"));
  assert.ok(!fires("neon-glow", ".cta { box-shadow: 0 0 4px rgba(34, 211, 238, 1); }", "a.css"), "a 4px blur is a ring, not a glow");
  assert.ok(!fires("neon-glow", ".cta { box-shadow: 0 0 8px rgba(34, 211, 238, 0.2); }", "a.css"), "strength 1.6 is below what a viewer sees");
  assert.ok(!fires("neon-glow", ".cta { box-shadow: 0 4px 24px rgba(34, 211, 238, 0.6); }", "a.css"), "an offset shadow is elevation");
});

test("neon-glow: a focus halo is a state indicator, and the same halo at rest is a glow", () => {
  assert.ok(!fires("neon-glow", ".btn:focus-visible { box-shadow: 0 0 12px rgba(14, 165, 233, 0.6); }", "a.css"));
  assert.ok(!fires("neon-glow", '<button class="focus-visible:shadow-[0_0_12px_rgba(14,165,233,0.6)]">x</button>', "a.html"));
  assert.ok(fires("neon-glow", ".btn { box-shadow: 0 0 12px rgba(14, 165, 233, 0.6); }", "a.css"));
});

test("neon-glow: a halo along a thin bar is a lit track; a halo around a dot is the glow", () => {
  assert.ok(!fires("neon-glow", ".pass-glow-bar { width: 200px; height: 4px; box-shadow: 0 0 16px rgba(26, 58, 214, .8); }", "a.css"));
  assert.ok(fires("neon-glow", ".status-orb { width: 24px; height: 24px; border-radius: 50%; box-shadow: 0 0 18px rgba(34, 197, 94, 0.7); }", "a.css"),
    "a round element keeps the glow verdict however far its halo reaches");
  assert.ok(fires("neon-glow", ".card { width: 320px; height: 200px; box-shadow: 0 0 16px rgba(26, 58, 214, .8); }", "a.css"));
});

// ── token-drift-spacing reads spacing declarations, not token definitions (2.5.0) ──

test("countOffScaleSpacing: token definitions and scroll offsets are not spacing; grid-gap still is", () => {
  assert.equal(countOffScaleSpacing(":root { --space-1: 4px; --space-2: 8px; --card-padding: 13px; --x-margin: 13px; }"), 0);
  assert.equal(countOffScaleSpacing(".a { scroll-margin-top: 13px; }"), 0);
  assert.equal(countOffScaleSpacing(".a { padding: 13px; }"), 1);
  assert.equal(countOffScaleSpacing(".a { grid-gap: 13px; }"), 1, "the legacy alias is spacing");
  assert.equal(countOffScaleSpacing(".a { grid-row-gap: 13px; grid-column-gap: 13px; }"), 2);
});

test("countOffScaleSpacing: a JS style object's value stops at its own end", () => {
  assert.equal(countOffScaleSpacing("<div style={{ padding: '16px', fontSize: '13px', lineHeight: '21px' }}>x</div>"), 0);
  assert.equal(countOffScaleSpacing("<div style={{ padding: '13px', fontSize: '16px' }}>x</div>"), 1);
  assert.equal(countOffScaleSpacing("const s = { margin: 13, gap: 8 };"), 0, "bare numbers carry no px unit");
});

test("token-drift-spacing: the probe files from the history set stay clean", () => {
  const tokens = ":root { --space-1: 4px; --space-2: 8px; --card-padding: 13px; --x-margin: 13px; }";
  assert.ok(!fires("token-drift-spacing", tokens, "token-prop.css"));
  const tsx = ":root { --space-1: 4px; --space-2: 8px; }\nexport const A = () => <div style={{ padding: '16px', fontSize: '13px', lineHeight: '21px' }}>x</div>;";
  assert.ok(!fires("token-drift-spacing", tsx, "jsx-style.tsx"));
});

// ── cream-serif-default counts distinct legs (2.5.0) ─────────────────────────

test("cream-serif-default: two hits of one leg are one leg", () => {
  assert.ok(!fires("cream-serif-default", ".a { background: #faf8f5 } .b { background: #f5f1e8 }", "a.css"));
  assert.ok(!fires("cream-serif-default", 'h1 { font-family: "Fraunces" } h2 { font-family: "Playfair Display" }', "a.css"));
});

test("cream-serif-default: the firing pairs, and a sage accent on cream", () => {
  assert.ok(fires("cream-serif-default", "body { background: #faf8f5 } .accent { color: #15573a }", "a.css"), "cream + sage");
  assert.ok(fires("cream-serif-default", 'h1 { font-family: "Instrument Serif" } .accent { color: #15573a }', "a.css"), "serif + sage");
  assert.ok(!fires("cream-serif-default", ".accent { color: #15573a } .cta { color: #c2410c }", "a.css"), "sage + clay alone");
  const v = scanContent('body { background: #faf8f5 }\nh1 { font-family: "Instrument Serif", serif }', "a.css").find((x) => x.name === "cream-serif-default");
  assert.equal(v.evidence, "cream #faf8f5 + serif Instrument Serif");
});

test("cream-serif-default: a hatched leg no longer completes the pair", () => {
  const css = 'body { background: #faf8f5 }\n.b { background: #f5f1e8 }\nh1 { font-family: "Instrument Serif" } /* anti-slop-allow: the brand face */';
  assert.ok(!fires("cream-serif-default", css, "a.css"), "two cream hexes are still one leg once the serif line is waived");
});

// ── shadow-border-rounded-combo fires on the repeated treatment (2.5.0) ──────

test("shadow-border-rounded-combo: one framed card among unframed sections is a choice", () => {
  const one = '<section class="py-12">a</section>\n<div class="shadow-sm border rounded-xl p-6">b</div>\n<section class="py-12">c</section>';
  assert.ok(!fires("shadow-border-rounded-combo", one, "a.html"));
});

test("shadow-border-rounded-combo: three trio cards fire; a colour-only border is not a leg", () => {
  const card = (cls) => `<div class="${cls}">x</div>`;
  assert.ok(fires("shadow-border-rounded-combo", [1, 2, 3].map(() => card("rounded-xl border shadow-sm p-6")).join("\n"), "a.html"));
  assert.ok(!fires("shadow-border-rounded-combo", [1, 2, 3].map(() => card("shadow-sm border-gray-200 rounded-xl p-6")).join("\n"), "a.html"));
});

test("shadow-border-rounded-combo: two trio cards fire only when they are every card on the surface", () => {
  const trio = '<div class="rounded-xl border shadow-sm p-6">a</div>\n<div class="rounded-lg border shadow p-4">b</div>';
  assert.ok(fires("shadow-border-rounded-combo", trio, "a.html"));
  assert.ok(!fires("shadow-border-rounded-combo", `${trio}\n<div class="rounded-2xl bg-stone-50 p-8">c</div>`, "a.html"), "a third, differently framed card");
});

test("shadow-border-rounded-combo: the arms of one element are one card", () => {
  const tsx = 'export const C = ({ on }) => <div className={cn("rounded-xl border shadow-sm p-6", on ? "bg-white" : "bg-stone-50")} />;';
  assert.ok(!fires("shadow-border-rounded-combo", tsx, "C.tsx"));
});

// ── uniform-literal-radius ignores zero resets (2.5.0) ───────────────────────

test("uniform-literal-radius: three zero resets are not a radius choice; three sub-rem radii are", () => {
  assert.ok(!fires("uniform-literal-radius", ".a { border-radius: 0px; }\n.b { border-radius: 0px; }\n.c { border-radius: 0px; }", "square.css"));
  assert.ok(!fires("uniform-literal-radius", ".a { border-radius: 0; }\n.b { border-radius: 0rem; }\n.c { border-radius: 0.0rem; }", "square.css"));
  assert.ok(fires("uniform-literal-radius", ".a { border-radius: 0.5rem; }\n.b { border-radius: 0.5rem; }\n.c { border-radius: 0.5rem; }", "rem.css"),
    "0.5rem starts with a zero and is still a radius");
  assert.ok(fires("uniform-literal-radius", ".a { border-radius: 0.25rem; }\n.b { border-radius: 0.375rem; }\n.c { border-radius: 10px; }", "mixed.css"));
});

test("neon-glow: a glow in a keyframe step counts when a painted element runs it", () => {
  const kf = "@keyframes breathe { 50% { box-shadow: 0 0 14px rgba(255, 0, 200, 0.5); } }";
  assert.ok(fires("neon-glow", `${kf}\n.pulse { animation: breathe 3s infinite; }`, "a.css"));
  assert.ok(!fires("neon-glow", kf, "a.css"), "keyframes nothing runs");
  assert.ok(!fires("neon-glow", `${kf}\n.pulse { display: none; animation: breathe 3s infinite; }`, "a.css"), "run only by a hidden element");
  const html = (cls) => `<style>${kf} .pulse { animation: breathe 3s infinite; }</style><button class="${cls}">Go</button>`;
  assert.ok(fires("neon-glow", html("pulse"), "a.html"));
  assert.ok(!fires("neon-glow", html("other"), "a.html"), "no element in the markup carries the running class");
});

// ── Smaller history-proven fixes (2.5.0, P2) ─────────────────────────────────

test("ai-purple-hex: an unread scale-named palette token is a tokens file, a semantic role is the brand", () => {
  assert.ok(!fires("ai-purple-hex", ":root { --violet-500: #8b5cf6; --indigo-600: #4f46e5; }", "tokens.css"));
  const read = ":root { --violet-500: #8b5cf6; --indigo-600: #4f46e5; }\n.cta { background: var(--violet-500) } .link { color: var(--indigo-600) }";
  assert.equal(scanContent(read, "tokens.css").find((v) => v.name === "ai-purple-hex").count, 2, "the same tokens, read");
  assert.equal(scanContent(":root { --primary: #7c3aed; --primary-hover: #6d28d9; }", "tokens.css").find((v) => v.name === "ai-purple-hex").count, 2,
    "a semantic role counts even when another file reads it");
  assert.ok(fires("ai-purple-hex", ".a { color: #7c3aed } .b { border-color: #6d28d9 }", "a.css"), "literal uses are unchanged");
});

test("em-dash-density: a dash alone in a table cell is the table's none", () => {
  const table = "| Plan | Seats | SSO | Audit log |\n|---|---|---|---|\n| Free | 1 | — | — |\n| Team | 10 | — | — |\n| Business | 50 | yes | — |\n| Enterprise | any | yes | yes |";
  assert.ok(!scanContent(table, "table.md").some((v) => v.name === "em-dash-density"));
  const prose = "One — two — three — four — five — six dashes in a short line of prose.";
  assert.ok(scanContent(prose, "post.md").some((v) => v.name === "em-dash-density"), "dashes in sentences still count");
});

test("neon-glow: a coloured text-shadow halo is a glow; a soft drop shadow is not", () => {
  assert.ok(fires("neon-glow", "h1 { text-shadow: 0 0 20px rgba(168, 85, 247, 0.8); }", "a.css"));
  assert.ok(!fires("neon-glow", "h1 { text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3); }", "a.css"));
});

test("a finding that spans several lines carries every line, and the text report names them", () => {
  const css = ".a { color: #7c3aed }\n.b { padding: 4px }\n.c { border-color: #6d28d9 }";
  const v = scanContent(css, "a.css").find((x) => x.name === "ai-purple-hex");
  assert.deepEqual(v.lines, [1, 3]);
  const js = "eval(a);\nconst b = 1;\neval(c);\n";
  assert.deepEqual(scanContent(js, "a.js").find((x) => x.name === "eval-usage").lines, [1, 3]);
});
