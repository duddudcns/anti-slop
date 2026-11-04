import { test } from "node:test";
import assert from "node:assert/strict";
import {
  prepareSource,
  classTokenSets,
  effectiveClassSets,
  tailwindToken,
  isStateVariant,
  cssBlocks,
  customProperties,
  resolveVars,
  parseColor,
  toOklch,
  toHex,
  relativeLuminance,
  contrastRatio,
  composite,
  ratioLabel,
  fontStack,
  primaryFamily,
  parseWaiver,
  waiverCovers,
  makeContext,
  NAMED_COLORS,
  backgroundOf,
} from "../lib/design-detect.mjs";

// The shared module both scanners run (ui-craft vendors it byte for byte). Every helper is
// probed here in both directions, because a parser that returns something plausible for
// every input passes a one-sided test as well as a correct one does.

const near = (a, b, tol) => Math.abs(a - b) <= tol;
const rgbNear = (c, [r, g, b], tol = 1) => c && near(c.r, r, tol) && near(c.g, g, tol) && near(c.b, b, tol);

// ── prepareSource ────────────────────────────────────────────────────────────

test("prepareSource keeps the line count and blanks /* */ in CSS", () => {
  const css = "/* old radii:\n  border-radius: 8px;\n*/\n.a { color: red; }";
  const { text, rawLines } = prepareSource(css, ".css");
  assert.equal(text.split("\n").length, css.split("\n").length);
  assert.ok(!text.includes("border-radius"));
  assert.ok(text.includes(".a { color: red; }"));
  assert.equal(rawLines[1], "  border-radius: 8px;");
});

test("prepareSource blanks <!-- --> in markup and keeps the markup around it", () => {
  const html = "<p>Hi</p>\n<!-- <img src=\"x.png\"> -->\n<p>Bye</p>";
  const { text } = prepareSource(html, ".html");
  assert.ok(!text.includes("<img"));
  assert.ok(text.includes("<p>Hi</p>") && text.includes("<p>Bye</p>"));
  assert.equal(text.length, html.length);
});

test("prepareSource blanks // comments in script but not URLs, strings or regex literals", () => {
  const js = [
    'const url = "https://cdn.example/x"; // trailing note',
    "const re = /a\\/\\/b/g;",
    "const t = `color: red; /* tpl comment */`;",
    "<a href={link}>see http://example.org</a>",
  ].join("\n");
  const { text } = prepareSource(js, ".tsx");
  assert.ok(text.includes('"https://cdn.example/x"'));
  assert.ok(!text.includes("trailing note"));
  assert.ok(text.includes("/a\\/\\/b/g"));
  assert.ok(!text.includes("tpl comment"));
  assert.ok(text.includes("http://example.org"), "a URL in JSX text follows a colon and is not a comment");
});

test("prepareSource: an apostrophe in JSX text costs one line, not the rest of the file", () => {
  const tsx = "<p>Don't panic</p>\n// a real comment\n<div />";
  assert.ok(!prepareSource(tsx, ".tsx").text.includes("a real comment"));
});

test("prepareSource: // in SCSS and <style lang=\"scss\"> is a comment, but url(//cdn) is not", () => {
  const scss = ".a { color: red; } // note\n.b { background: url(//cdn.example/x.png); }";
  const { text } = prepareSource(scss, ".scss");
  assert.ok(!text.includes("note"));
  assert.ok(text.includes("url(//cdn.example/x.png)"));
  assert.ok(prepareSource(".a { color: red; } // note", ".css").text.includes("// note"), "plain CSS has no // comments");
  const vue = '<style lang="scss">\n.a { color: red; } // vue note\n</style>';
  assert.ok(!prepareSource(vue, ".vue").text.includes("vue note"));
});

test("prepareSource blanks the contents of <code> and <pre> in markup, keeping their attributes", () => {
  const html = '<p>Use <code class="x">border-radius: 8px</code></p>\n<pre>.a { background: linear-gradient(#6366f1, #8b5cf6) }</pre>';
  const { text } = prepareSource(html, ".html");
  assert.ok(!text.includes("border-radius") && !text.includes("6366f1"));
  assert.ok(text.includes('<code class="x">'));
});

test("prepareSource on markdown: a glob in prose is never a comment opener", () => {
  const md = "See `aesthetic/*` and `**/icons/**` for the files.\n\nNext paragraph */ stays.\n\n```css\n/* fenced */ .a { color: red }\n```\n";
  const { text } = prepareSource(md, ".md");
  assert.ok(text.includes("aesthetic/*") && text.includes("Next paragraph */ stays."));
  assert.ok(!text.includes("fenced"));
});

// ── classTokenSets ───────────────────────────────────────────────────────────

test("classTokenSets: a multi-line class attribute is one set that starts on its first line", () => {
  const sets = classTokenSets('<p>x</p>\n<div\n  class="rounded-full\n   bg-blue-100 p-3">');
  assert.equal(sets.length, 1);
  assert.deepEqual(sets[0].tokens, ["rounded-full", "bg-blue-100", "p-3"]);
  assert.equal(sets[0].line, 3);
  assert.equal(sets[0].tag, "div");
});

test("classTokenSets: cn() arguments join one set, and a ternary yields two exclusive arms", () => {
  const sets = classTokenSets('<div className={cn("rounded-full p-3", active ? "bg-blue-100" : "bg-white")} />');
  const base = sets.filter((s) => s.arm === null);
  const arms = sets.filter((s) => s.arm !== null);
  assert.deepEqual(base.map((s) => s.tokens), [["rounded-full", "p-3"]]);
  assert.deepEqual(arms.map((s) => s.tokens), [["bg-blue-100"], ["bg-white"]]);
  const effective = effectiveClassSets(sets).map((s) => s.tokens.join(" "));
  assert.deepEqual(effective, ["rounded-full p-3 bg-blue-100", "rounded-full p-3 bg-white"]);
});

test("classTokenSets: a condition's own strings and ${} interpolations are not tokens", () => {
  const sets = classTokenSets('<a className={cn(variant === "primary" && "bg-teal-600", `p-${size} ring-1`)} />');
  const tokens = sets.flatMap((s) => s.tokens);
  assert.ok(tokens.includes("bg-teal-600") && tokens.includes("ring-1"));
  assert.ok(!tokens.includes("primary"));
  assert.ok(!tokens.some((t) => t.includes("$")));
});

test("classTokenSets: clsx objects, arrays, bare helper calls and cva variants", () => {
  const obj = classTokenSets("<i className={clsx({ 'bg-red-500': err }, ['p-2'])} />");
  assert.deepEqual(obj.flatMap((s) => s.tokens).sort(), ["bg-red-500", "p-2"]);
  const bare = classTokenSets('const base = twMerge("rounded-xl border", extra);');
  assert.equal(bare.length, 1);
  assert.equal(bare[0].tag, null);
  const cva = classTokenSets('const button = cva("px-4 py-2", { variants: { intent: { primary: "bg-indigo-600", ghost: "bg-transparent" } } });');
  assert.deepEqual(cva.filter((s) => s.arm !== null).map((s) => s.tokens), [["bg-indigo-600"], ["bg-transparent"]]);
});

// ── tailwindToken / isStateVariant ───────────────────────────────────────────

test("tailwindToken splits variants, base, opacity and the important flag", () => {
  assert.deepEqual(tailwindToken("md:hover:bg-indigo-500/10"), { variants: ["md", "hover"], base: "bg-indigo-500", opacity: "10", important: false });
  assert.deepEqual(tailwindToken("!text-white"), { variants: [], base: "text-white", opacity: null, important: true });
  assert.deepEqual(tailwindToken("[&:hover]:shadow-[0_0_4px_rgba(0,0,0,.5)]").variants, ["[&:hover]"]);
});

test("isStateVariant: states paint only in their state; breakpoints and dark: always paint", () => {
  for (const v of ["hover", "focus", "focus-visible", "active", "disabled", "group-hover", "peer-checked", "aria-selected", "data-[state=open]", "has-checked"]) {
    assert.ok(isStateVariant(v), v);
  }
  for (const v of ["sm", "md", "2xl", "max-md", "dark", "print", "motion-safe", "rtl", "before", "selection"]) {
    assert.ok(!isStateVariant(v), v);
  }
});

// ── cssBlocks ────────────────────────────────────────────────────────────────

test("cssBlocks: stylesheet blocks, nesting, at-rules and keyframes", () => {
  const css = ".a { color: red; &:hover { color: blue } }\n@media (min-width: 40rem) { .b { gap: 1rem } }\n@keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: .4 } }";
  const { blocks, keyframes } = cssBlocks(css, ".css");
  const sel = blocks.map((b) => b.selector);
  assert.deepEqual(sel, [".a", ".a:hover", ".b"]);
  assert.deepEqual(blocks[2].atRules, ["@media (min-width: 40rem)"]);
  assert.deepEqual(keyframes.get("pulse").steps.map((s) => s.offsets), [[0, 1], [0.5]]);
  assert.equal(blocks[0].decls[0].line, 1);
});

test("cssBlocks: <style>, inline style attributes, JSX style objects and styled templates", () => {
  const html = '<style>\n.card { background: #fff }\n</style>\n<p class="note" style="color: #8a8a8a; font-size: 11px">x</p>';
  const h = cssBlocks(html, ".html").blocks;
  assert.deepEqual(h.map((b) => b.selector), [".card", "p.note[style]"]);
  assert.equal(h[1].inline, true);
  assert.equal(h[1].line, 4);
  const tsx = 'const A = () => <div style={{ borderLeft: "4px solid #0f766e", fontSize: 12, lineHeight: 1.2 }} />;\nconst B = styled.div`\n  color: ${(p) => p.c};\n  &:hover { color: red; }\n`;';
  const t = cssBlocks(tsx, ".tsx").blocks;
  const inline = t.find((b) => b.inline);
  assert.deepEqual(inline.decls.map((d) => [d.prop, d.value]), [["border-left", "4px solid #0f766e"], ["font-size", "12px"], ["line-height", "1.2"]]);
  assert.ok(t.some((b) => b.selector === "&" && b.decls[0].value === "var(--js)"));
  assert.ok(t.some((b) => b.selector === "&:hover"));
});

test("cssBlocks: declarations split at depth 0 keep a data URI whole, and !important becomes a flag", () => {
  const { blocks } = cssBlocks('.a { background: url("data:image/svg+xml;utf8,<svg/>"); color: red !important }', ".css");
  assert.equal(blocks[0].decls.length, 2);
  assert.deepEqual(blocks[0].decls[1], { prop: "color", value: "red", important: true, line: 1 });
});

// ── customProperties / resolveVars ───────────────────────────────────────────

test("resolveVars resolves recursively, uses fallbacks, and leaves an unknown var() in place", () => {
  const { blocks } = cssBlocks(":root { --ink: var(--gray-900); --gray-900: #111827 }\n@media (prefers-color-scheme: dark) { :root { --ink: #fff } }", ".css");
  const props = customProperties(blocks);
  assert.equal(resolveVars("var(--ink)", props), "#111827", "the root definition outranks the dark-mode override");
  assert.equal(resolveVars("var(--missing, #222)", props), "#222");
  assert.equal(resolveVars("var(--missing)", props), "var(--missing)");
  const loop = new Map([["--a", "var(--a)"]]);
  assert.ok(resolveVars("var(--a)", loop).includes("var("), "a cycle stops and stays unknown");
});

// ── parseColor and the WCAG maths ────────────────────────────────────────────

test("parseColor reads every supported notation", () => {
  assert.ok(rgbNear(parseColor("rgb(214, 166, 46)"), [214, 166, 46], 0));
  assert.ok(rgbNear(parseColor("rgb(214 166 46 / 50%)"), [214, 166, 46], 0));
  assert.equal(parseColor("rgba(214, 166, 46, 0.5)").a, 0.5);
  assert.ok(rgbNear(parseColor("oklch(0.75 0.14 85)"), [214, 166, 46]));
  const hairline = parseColor("oklch(0.75 0.14 85 / 0.08)");
  assert.ok(rgbNear(hairline, [214, 166, 46]) && near(hairline.a, 0.08, 0.001));
  assert.ok(rgbNear(parseColor("oklch(75% 35% 85)"), [214, 166, 46]), "percent L and C (100% = 0.4)");
  assert.ok(rgbNear(parseColor("oklch(0.75 0.14 0.2361turn)"), [214, 166, 46]));
  assert.ok(rgbNear(parseColor("oklab(0.75 0.0122 0.1395)"), [214, 166, 46], 2));
  assert.ok(rgbNear(parseColor("hsl(220 13% 91%)"), [229, 231, 235]));
  assert.ok(rgbNear(parseColor("hsla(0.5turn, 100%, 50%, 1)"), [0, 255, 255]));
  assert.ok(rgbNear(parseColor("#0f766e"), [15, 118, 110], 0));
  assert.ok(rgbNear(parseColor("#fa0"), [255, 170, 0], 0));
  assert.ok(near(parseColor("#00000080").a, 0.502, 0.001));
  assert.ok(rgbNear(parseColor("rebeccapurple"), [102, 51, 153], 0));
  assert.equal(parseColor("transparent").a, 0);
  assert.equal(NAMED_COLORS.size, 148);
});

test("parseColor returns null for anything it cannot measure", () => {
  for (const v of ["color-mix(in oklch, red, blue)", "oklch(from var(--x) l c h)", "currentColor", "Canvas", "var(--x)", "rgb(var(--r) 0 0)", "", "#12", "inherit", "lab(50 0 0)"]) {
    assert.equal(parseColor(v), null, v);
  }
});

test("contrast maths: #767676 on white is 4.54:1, and a failing ratio never prints as the bar", () => {
  const ratio = contrastRatio(parseColor("#767676"), parseColor("#fff"));
  assert.ok(near(ratio, 4.54, 0.005), String(ratio));
  assert.equal(ratioLabel(4.4983, 4.5), "4.49");
  assert.equal(ratioLabel(4.46, 4.5), "4.46");
  assert.equal(ratioLabel(3.42, 4.5), "3.4");
  assert.equal(ratioLabel(6.65, 4.5), "6.7");
  assert.ok(near(relativeLuminance({ r: 255, g: 255, b: 255 }), 1, 1e-9));
  assert.deepEqual(composite({ r: 0, g: 0, b: 0, a: 0.5 }, { r: 255, g: 255, b: 255 }), { r: 127.5, g: 127.5, b: 127.5, a: 1 });
  assert.equal(toHex({ r: 15.4, g: 118, b: 110 }), "#0f766e");
  const o = toOklch(parseColor("oklch(0.62 0.17 145)"));
  assert.ok(near(o.L, 0.62, 0.005) && near(o.C, 0.17, 0.005) && near(o.H, 145, 1));
});

test("backgroundOf: a colour, a transparent ground, an image and an unknown are distinct", () => {
  const { blocks } = cssBlocks(".a { background: #0f172a } .b { background: transparent } .c { background: linear-gradient(red, blue) } .d { background: var(--x) } .e { background: #fff no-repeat center }", ".css");
  const kinds = blocks.map((b) => backgroundOf(b, new Map()).kind);
  assert.deepEqual(kinds, ["colour", "none", "image", "unknown", "colour"]);
});

// ── Font stacks ──────────────────────────────────────────────────────────────

test("primaryFamily reads the first non-generic family; system stacks are never a face", () => {
  const stackOf = (css) => fontStack(cssBlocks(`a { ${css} }`, ".css").blocks[0], new Map());
  assert.deepEqual(primaryFamily(stackOf('font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif')), { kind: "system", name: "-apple-system" });
  assert.deepEqual(primaryFamily(stackOf('font-family: "Söhne", Inter, sans-serif')), { kind: "face", name: "söhne" });
  assert.deepEqual(primaryFamily(stackOf("font: 16px/1.5 Arial, sans-serif")), { kind: "face", name: "arial" });
  assert.deepEqual(primaryFamily(stackOf("font: italic 700 15px Inter, sans-serif")), { kind: "face", name: "inter" });
  assert.equal(primaryFamily(stackOf("font-family: ui-sans-serif, Inter, sans-serif")).kind, "system");
  assert.equal(primaryFamily(stackOf('font-family: "SF Pro Text", Inter')).kind, "system");
  assert.equal(primaryFamily(stackOf("font-family: var(--font-body), Inter")).kind, "none", "an unresolved first entry is unknown");
  assert.equal(primaryFamily(stackOf("font-family: var(--f, Inter), sans-serif")).name, "inter", "a var() reads its fallback");
  assert.equal(primaryFamily(stackOf("font-family: sans-serif")).kind, "system");
  assert.equal(primaryFamily([]).kind, "none");
});

// ── parseWaiver ──────────────────────────────────────────────────────────────

test("parseWaiver: the scoped form needs known ids then ` -- `; free text stays line-wide", () => {
  const known = new Set(["gradient-text", "neon-glow"]);
  assert.equal(parseWaiver("<h1 class=\"x\">", known), null);
  assert.deepEqual([...parseWaiver("<!-- anti-slop-allow: gradient-text -- wordmark -->", known).rules], ["gradient-text"]);
  assert.deepEqual([...parseWaiver("/* anti-slop-allow: gradient-text, neon-glow -- brand kit */", known).rules].sort(), ["gradient-text", "neon-glow"]);
  assert.deepEqual(parseWaiver("<!-- anti-slop-allow: the wordmark -->", known), { all: true });
  assert.deepEqual(parseWaiver("/* anti-slop-allow: on-brand gradient */", known), { all: true });
  assert.deepEqual(parseWaiver("// unslop-ignore", known), { all: true });
  const unknown = parseWaiver("<!-- anti-slop-allow: no-such-rule -- x -->", known);
  assert.equal(unknown.rules.size, 0);
  assert.deepEqual(unknown.unknown, ["no-such-rule"]);
  assert.ok(waiverCovers(parseWaiver("// anti-slop-allow", known), "neon-glow"));
  assert.ok(!waiverCovers(parseWaiver("// anti-slop-allow: gradient-text -- x", known), "neon-glow"));
  assert.ok(!waiverCovers(unknown, "gradient-text"));
});

// ── makeContext ──────────────────────────────────────────────────────────────

test("makeContext computes each view once and on first read", () => {
  const ctx = makeContext("<style>body { background: #faf8f5 }</style><div class=\"p-4\"></div>", ".html");
  assert.equal(Object.getOwnPropertyDescriptor(ctx, "css").get !== undefined, true, "css is lazy until read");
  assert.equal(ctx.css, ctx.css);
  assert.deepEqual(ctx.classSets.map((s) => s.tokens), [["p-4"]]);
  assert.equal(toHex(ctx.pageGround), "#faf8f5");
  assert.equal(makeContext("<p>x</p>", ".html").pageGround, null, "an undeclared ground is unknown, not white");
});
