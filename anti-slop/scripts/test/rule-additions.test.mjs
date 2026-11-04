import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { scanContent } from "../lib/scan.mjs";
import { countOffScaleSpacing } from "../lib/rules.mjs";
import { CORPUS_DIR } from "../measure.mjs";

// Every rule added in 2.1.0, asserted in BOTH directions: the shape it is meant to catch,
// and the named counter-example it must stay silent on. A one-directional test passes just
// as well on a rule that matches everything, which is the failure mode these guard.

const names = (content, path) => scanContent(content, path).map((v) => v.name || v.type);
const fires = (rule, content, path) => names(content, path).includes(rule);
const corpus = (file) => readFileSync(join(CORPUS_DIR, file), "utf8");

// ── media-control-glyph (design + native): a text glyph standing in for a control ──
// The 2.1.0 incident: a pause/play toggle shipped as the bare text glyph. Since 2.3.1 the
// emoji rule follows Unicode and no longer sees a bare ▶ or ⏸, so the incident gets its
// own tell, scoped to UI surfaces: markup, components, and SwiftUI. In prose a ▶ is a
// symbol in a sentence, and the emoji-presentation form (▶️) is the emoji rule's.

test("media-control-glyph: a bare play/pause glyph in a component or a SwiftUI view is a finding", () => {
  const tsx = '<button onClick={toggle} aria-label="Play">{playing ? "⏸" : "▶"}</button>';
  assert.ok(fires("media-control-glyph", tsx, "Player.tsx"));
  assert.ok(fires("media-control-glyph", 'Text("▶").font(.title)', "PlayerView.swift"));
});

test("media-control-glyph: SF Symbols, an icon component, and prose are NOT findings", () => {
  assert.ok(!fires("media-control-glyph", 'Image(systemName: "play.fill")', "PlayerView.swift"));
  assert.ok(!fires("media-control-glyph", '<PlayIcon aria-hidden="true" />', "Player.tsx"));
  assert.ok(!fires("media-control-glyph", "Press ▶ to start the recording.", "guide.md"));
  // The emoji-presentation form is the emoji rule's finding, not this one's.
  const vs = names('<span>{"▶️"}</span>', "Player.tsx");
  assert.ok(vs.includes("emoji") && !vs.includes("media-control-glyph"), JSON.stringify(vs));
});

// ── Fixed geometry (design, web) ─────────────────────────────────────────────

test("fixed-page-shell: a fixed-pixel content shell is a finding", () => {
  assert.ok(fires("fixed-page-shell", ".shell { width: 1200px; }", "app.css"));
  assert.ok(fires("fixed-page-shell", ".lede { min-width: 960px; }", "app.css"));
});

test("fixed-page-shell: max-width is the correct idiom and is NOT a finding", () => {
  assert.ok(!fires("fixed-page-shell", ".shell { max-width: 1200px; }", "app.css"));
});

test("fixed-page-shell: a width inside a breakpoint is NOT a finding", () => {
  assert.ok(!fires("fixed-page-shell", "@media (min-width: 900px) { .shell { width: 720px; } }", "app.css"));
});

test("fixed-page-shell: a control-sized width is below the shell threshold", () => {
  assert.ok(!fires("fixed-page-shell", ".avatar { width: 44px; } .card { width: 320px; }", "app.css"));
});

test("fixed-grid-tracks: a pixel track list is a finding", () => {
  assert.ok(fires("fixed-grid-tracks", ".board { grid-template-columns: repeat(3, 360px); }", "app.css"));
});

test("fixed-grid-tracks: fractional and auto-fit track lists are NOT findings", () => {
  const css = ".a { grid-template-columns: repeat(2, 1fr); }\n" +
    ".b { grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr)); }\n" +
    ".c { grid-template-columns: repeat(3, minmax(0, 1fr)); }";
  assert.ok(!fires("fixed-grid-tracks", css, "app.css"));
});

test("vh-viewport-shell: a bare 100vh shell is a finding", () => {
  assert.ok(fires("vh-viewport-shell", ".app { min-height: 100vh; }", "app.css"));
});

test("vh-viewport-shell: the progressive-enhancement pair is NOT a finding", () => {
  // The fallback is on the NEXT line, which is why this rule is file-scoped.
  assert.ok(!fires("vh-viewport-shell", ".app {\n  height: 100vh;\n  height: 100dvh;\n}", "app.css"));
  assert.ok(!fires("vh-viewport-shell", ".app {\n  height: 100vh;\n  height: 100svh;\n}", "app.css"));
});

// ── token-drift-spacing: the file-scope guard is the whole rule ───────────────

test("countOffScaleSpacing counts values off the 4px grid and nothing else", () => {
  assert.equal(countOffScaleSpacing("  padding: 11px 17px;"), 2);
  assert.equal(countOffScaleSpacing("  margin-top: 9px;"), 1);
  assert.equal(countOffScaleSpacing("  padding: 16px 24px;"), 0, "on-grid values are not drift");
  assert.equal(countOffScaleSpacing("  border: 1px solid red;"), 0, "border is not a spacing property");
  assert.equal(countOffScaleSpacing("  padding: 1px 2px;"), 0, "hairlines are not spacing decisions");
  assert.equal(countOffScaleSpacing("  gap: var(--space-3);"), 0, "a token is the correct idiom");
  assert.equal(countOffScaleSpacing("  padding: clamp(9px, 2vw, 21px);"), 0);
  assert.equal(countOffScaleSpacing("  margin-inline-start: calc(13px + 2px);"), 0);
});

test("token-drift-spacing: two off-scale values in a file with a scale is a finding", () => {
  const css = ":root { --space-1: 4px; --space-2: 8px; }\n.a { padding: 11px 17px; }\n.b { margin-top: 9px; }";
  assert.ok(fires("token-drift-spacing", css, "app.css"));
});

test("token-drift-spacing: a file with no --space scale is NOT drifting from one", () => {
  const css = ".a { padding: 11px 17px; }\n.b { margin-top: 9px; }\n.c { gap: 13px; }";
  assert.ok(!fires("token-drift-spacing", css, "app.css"));
});

test("token-drift-spacing: one declared token is below the file-scope threshold", () => {
  const css = ":root { --space-1: 4px; }\n.a { padding: 11px 17px; }\n.b { margin-top: 9px; }";
  assert.ok(!fires("token-drift-spacing", css, "app.css"));
});

test("token-drift-spacing: a scale used correctly is NOT a finding", () => {
  const css = ":root { --space-1: 4px; --space-2: 8px; }\n.a { padding: var(--space-2); }\n.b { gap: var(--space-1); }";
  assert.ok(!fires("token-drift-spacing", css, "app.css"));
});

// ── uniform-literal-radius ───────────────────────────────────────────────────

test("uniform-literal-radius: three literal radii with no radius token is a finding", () => {
  const css = ".a { border-radius: 8px; }\n.b { border-radius: 8px; }\n.c { border-radius: 8px; }";
  assert.ok(fires("uniform-literal-radius", css, "app.css"));
});

test("uniform-literal-radius: two literals are below the concentration threshold", () => {
  const css = ".a { border-radius: 8px; }\n.b { border-radius: 12px; }";
  assert.ok(!fires("uniform-literal-radius", css, "app.css"));
});

test("uniform-literal-radius: a file that states a radius identity is silenced", () => {
  // warm-consumer.html is a clean control carrying FIVE literal radii; the file-scope
  // guard is the only thing protecting it, so both guard legs are asserted here.
  const declared = ":root { --radius: 8px; }\n.a { border-radius: 8px; }\n.b { border-radius: 8px; }\n.c { border-radius: 8px; }";
  const referenced = ".a { border-radius: var(--radius); }\n.b { border-radius: 6px; }\n.c { border-radius: 6px; }\n.d { border-radius: 6px; }";
  assert.ok(!fires("uniform-literal-radius", declared, "app.css"));
  assert.ok(!fires("uniform-literal-radius", referenced, "app.css"));
  assert.ok(!fires("uniform-literal-radius", corpus("../fixtures/warm-consumer.html"), "../fixtures/warm-consumer.html"));
});

// ── dead-control ─────────────────────────────────────────────────────────────

test("dead-control: empty and comment-only handlers are findings", () => {
  assert.ok(fires("dead-control", '<button onclick="">Refresh</button>', "page.html"));
  assert.ok(fires("dead-control", '<button onclick="/* TODO: wire refresh */">Refresh</button>', "page.html"));
  assert.ok(fires("dead-control", "<button onClick={() => {}}>Save</button>", "Page.jsx"));
  assert.ok(fires("dead-control", "<button onClick={() => null}>Save</button>", "Page.jsx"));
});

test("dead-control: a wired handler is NOT a finding", () => {
  assert.ok(!fires("dead-control", "<button onClick={handleSave}>Save</button>", "Page.jsx"));
  assert.ok(!fires("dead-control", "<button onClick={() => setOpen(true)}>Open</button>", "Page.jsx"));
});

test("dead-control: a deliberate no-op with a real body is NOT a finding", () => {
  const jsx = "<button onClick={() => {/* deliberately inert, see #221 */ log()}}>Preview</button>";
  assert.ok(!fires("dead-control", jsx, "Page.jsx"));
});

test("dead-control: an ordinary assignment whose name starts with 'on' is NOT a finding", () => {
  // The handler list is explicit rather than /on[a-zA-Z]+/ for exactly this reason.
  assert.ok(!fires("dead-control", 'const only = "";\nlet once = "";', "util.js"));
});

// ── outline-none / missing-alt ───────────────────────────────────────────────

test("outline-none: killing the outline with no focus-visible ring is a finding", () => {
  assert.ok(fires("outline-none", "a:focus { outline: none; }", "app.css"));
  assert.ok(fires("outline-none", "button:focus { outline: 0; }", "app.css"));
});

test("outline-none: a file that defines a :focus-visible ring is silenced", () => {
  const css = "a:focus { outline: none; }\na:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }";
  assert.ok(!fires("outline-none", css, "app.css"));
  assert.ok(!fires("outline-none", 'a:focus { outline: none; }\n.btn { --tw: focus-visible:ring-2; }', "app.css"));
});

test("missing-alt: a missing alt and a placeholder alt are both findings", () => {
  assert.ok(fires("missing-alt", '<img src="/a.jpg" width="4" height="4">', "page.html"));
  assert.ok(fires("missing-alt", '<img src="/a.jpg" alt="image" width="4" height="4">', "page.html"));
  assert.ok(fires("missing-alt", '<img src="/a.jpg" alt="icon" width="4" height="4">', "page.html"));
});

test("missing-alt: a decorative alt=\"\" and real alt text are NOT findings", () => {
  assert.ok(!fires("missing-alt", '<img src="/a.jpg" alt="" width="4" height="4">', "page.html"));
  assert.ok(!fires("missing-alt", '<img src="/a.jpg" alt="Q3 revenue by region" width="4" height="4">', "page.html"));
});

// ── Documented fingerprints ──────────────────────────────────────────────────

test("uppercase-overline: the verbatim three-class run is a finding, in any order", () => {
  assert.ok(fires("uppercase-overline", '<p class="text-xs uppercase tracking-wider">Now in beta</p>', "page.html"));
  assert.ok(fires("uppercase-overline", '<p class="tracking-widest text-slate-500 uppercase text-xs">Beta</p>', "page.html"));
});

test("uppercase-overline: a tuned tracking value is a decision and is NOT a finding", () => {
  assert.ok(!fires("uppercase-overline", '<p class="text-xs uppercase tracking-tight">Now in beta</p>', "page.html"));
});

test("uppercase-overline: the tokens must share one class attribute", () => {
  const html = '<p class="text-xs uppercase">Beta</p><p class="tracking-wider">Ships Tuesday</p>';
  assert.ok(!fires("uppercase-overline", html, "page.html"));
});

test("blur-blob: a blurred rounded-full decoration is a finding", () => {
  assert.ok(fires("blur-blob", '<div class="absolute -z-10 h-72 w-72 rounded-full bg-sky-300 blur-3xl"></div>', "page.html"));
});

test("blur-blob: a blur with no rounded-full sibling is NOT a finding", () => {
  assert.ok(!fires("blur-blob", '<div class="absolute -z-10 h-64 w-96 bg-cover blur-3xl"></div>', "page.html"));
});

test("shadcn-stats-magic: the docs literals are findings", () => {
  assert.ok(fires("shadcn-stats-magic", "<p>$45,231.89</p>", "page.html"));
  assert.ok(fires("shadcn-stats-magic", "<p>+20.1% from last month</p>", "page.html"));
});

test("shadcn-stats-magic: any real currency figure is NOT a finding", () => {
  assert.ok(!fires("shadcn-stats-magic", "<p>$12,480.00</p><p>+4.6% from last month</p>", "page.html"));
});

test("generic-microcopy: the recurring literals are findings", () => {
  assert.ok(fires("generic-microcopy", "<p>Welcome back! Here is your dashboard.</p>", "page.html"));
  assert.ok(fires("generic-microcopy", "<p>Join thousands of teams shipping faster.</p>", "page.html"));
});

test("generic-microcopy: product-specific copy is NOT a finding", () => {
  const html = "<p>Your last report ran 3 hours ago.</p><p>Import your first realm to start.</p>";
  assert.ok(!fires("generic-microcopy", html, "page.html"));
});

test("purple-gradient-default: the Tailwind indigo/violet default run is a finding", () => {
  // No test file mentioned this rule before 2.1.0, and no fixture exercised it, so a
  // mutation of its pattern survived every gate. Both directions, plus the boundary.
  assert.ok(fires("purple-gradient-default", '<a class="bg-gradient-to-r from-indigo-500 to-violet-600">Go</a>', "page.html"));
  assert.ok(fires("purple-gradient-default", '<a class="bg-gradient-to-br from-purple-400 to-purple-600">Go</a>', "page.html"));
});

test("purple-gradient-default: a non-purple gradient is NOT a finding", () => {
  assert.ok(!fires("purple-gradient-default", '<a class="bg-gradient-to-r from-emerald-500 to-teal-600">Go</a>', "page.html"));
  assert.ok(!fires("purple-gradient-default", '<a class="bg-gradient-to-r from-indigo-700 to-violet-900">Go</a>', "page.html"));
});

// ── Motion and rhythm ────────────────────────────────────────────────────────

test("transition-all: two occurrences are a finding, one is not", () => {
  assert.ok(fires("transition-all", '<a class="transition-all">A</a>\n<b class="transition-all">B</b>', "page.html"));
  assert.ok(fires("transition-all", ".a { transition: all 200ms ease; }\n.b { transition: all 150ms; }", "app.css"));
  assert.ok(!fires("transition-all", '<a class="transition-all duration-150">A</a>', "page.html"));
});

test("transition-all: named properties are NOT a finding", () => {
  const html = '<a class="transition-colors duration-150">A</a>\n<b class="transition-[transform,opacity]">B</b>';
  assert.ok(!fires("transition-all", html, "page.html"));
});

test("uniform-section-padding: three uniform sections are a finding, two are not", () => {
  const three = '<section class="py-20">a</section>\n<section class="py-20">b</section>\n<section class="py-24">c</section>';
  const varied = '<section class="py-20">a</section>\n<section class="py-12">b</section>\n<section class="py-32">c</section>';
  assert.ok(fires("uniform-section-padding", three, "page.html"));
  assert.ok(!fires("uniform-section-padding", varied, "page.html"));
});

// ── Security / bug class (code) ──────────────────────────────────────────────

test("dangerous-inner-html: the unsanitised React form is a finding", () => {
  assert.ok(fires("dangerous-inner-html", "<div dangerouslySetInnerHTML={{ __html: bio }} />", "Card.jsx"));
});

test("dangerous-inner-html: a sanitiser on the line clears it", () => {
  assert.ok(!fires("dangerous-inner-html", "<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(c) }} />", "Card.jsx"));
  assert.ok(!fires("dangerous-inner-html", "<div dangerouslySetInnerHTML={{ __html: sanitizeHtml(c) }} />", "Card.jsx"));
});

test("shell-injection: shell=True is a finding, an argument list is not", () => {
  assert.ok(fires("shell-injection", "subprocess.run(cmd, shell=True)", "run.py"));
  assert.ok(!fires("shell-injection", 'subprocess.run(["convert", filename, "out.png"])', "run.py"));
});

test("unsafe-deserialize: pickle and a bare yaml.load are findings", () => {
  assert.ok(fires("unsafe-deserialize", "data = pickle.loads(payload)", "io.py"));
  assert.ok(fires("unsafe-deserialize", "cfg = yaml.load(raw)", "io.py"));
});

test("unsafe-deserialize: a Safe loader is NOT a finding", () => {
  assert.ok(!fires("unsafe-deserialize", "cfg = yaml.safe_load(raw)", "io.py"));
  assert.ok(!fires("unsafe-deserialize", "cfg = yaml.load(raw, Loader=yaml.SafeLoader)", "io.py"));
  assert.ok(!fires("unsafe-deserialize", "cfg = json.loads(raw)", "io.py"));
});

test("tailwind-dynamic-class: an interpolated class is a finding", () => {
  assert.ok(fires("tailwind-dynamic-class", "<div className={`bg-${tone}-500 p-4`} />", "Card.jsx"));
});

test("tailwind-dynamic-class: complete class strings are NOT a finding", () => {
  assert.ok(!fires("tailwind-dynamic-class", "<div className={`${base} rounded`} />", "Card.jsx"));
  assert.ok(!fires("tailwind-dynamic-class", "<div className={colorClasses[color]} />", "Card.jsx"));
});

test("suppression-comment: the suppressions that never expire are findings", () => {
  assert.ok(fires("suppression-comment", "// @ts-ignore\nconst x = y.z;", "a.ts"));
  assert.ok(fires("suppression-comment", "// eslint-disable-next-line no-shadow\nconst x = 1;", "a.js"));
  assert.ok(fires("suppression-comment", "value = cast(x)  # type: ignore", "a.py"));
});

test("suppression-comment: @ts-expect-error is deliberately NOT a finding", () => {
  // The compiler verifies it is still needed and errors when it is not, so it expires on
  // its own. That is the property @ts-ignore lacks and the reason the two are graded apart.
  assert.ok(!fires("suppression-comment", "// @ts-expect-error the SDK types lag the runtime (issue #4412)\nconst x = y.z;", "a.ts"));
});

test("deprecated-api: the named removal-path APIs are findings", () => {
  assert.ok(fires("deprecated-api", "stamp = datetime.utcnow()", "a.py"));
  assert.ok(fires("deprecated-api", "componentWillReceiveProps(next) {}", "a.jsx"));
  assert.ok(fires("deprecated-api", "const b = new Buffer(raw);", "a.js"));
});

test("deprecated-api: the replacements are NOT findings", () => {
  assert.ok(!fires("deprecated-api", "stamp = datetime.now(timezone.utc)", "a.py"));
  assert.ok(!fires("deprecated-api", "componentDidMount() {}", "a.jsx"));
  assert.ok(!fires("deprecated-api", "const b = Buffer.from(raw);", "a.js"));
});

test("dead-branch: a bare literal condition is a finding", () => {
  assert.ok(fires("dead-branch", "if (true) { ship(); }", "a.js"));
  assert.ok(fires("dead-branch", "if (false) { ship(); }", "a.js"));
  assert.ok(fires("dead-branch", "while (false) { poll(); }", "a.js"));
  assert.ok(fires("dead-branch", "if False:", "a.py"));
  assert.ok(fires("dead-branch", "elif True:", "a.py"));
  assert.ok(fires("dead-branch", "while False:", "a.py"));
});

test("dead-branch: the event loop and non-literal conditions are NOT findings", () => {
  assert.ok(!fires("dead-branch", "while (true) { const n = q.pop(); if (!n) return; }", "a.js"));
  assert.ok(!fires("dead-branch", "if (isReady === true) { ship(); }", "a.js"));
  assert.ok(!fires("dead-branch", "if (1) { ship(); }", "a.c"));
  assert.ok(!fires("dead-branch", "while True:", "a.py"));
  assert.ok(!fires("dead-branch", "if item is True:", "a.py"));
  assert.ok(!fires("dead-branch", "if (flag) { ship(); }", "a.js"));
});

test("async-foreach: forEach(async) is a finding, map(async) is not", () => {
  assert.ok(fires("async-foreach", "items.forEach(async (x) => { await go(x); });", "a.js"));
  assert.ok(!fires("async-foreach", "await Promise.all(items.map(async (x) => go(x)));", "a.js"));
  assert.ok(!fires("async-foreach", "items.forEach((x) => void go(x));", "a.js"));
  assert.ok(!fires("async-foreach", "for (const x of items) { await go(x); }", "a.js"));
});

test("catch-any: catch (e: any) is a finding, catch (e: unknown) is not", () => {
  assert.ok(fires("catch-any", "try { await sync(); } catch (e: any) { toast(e.message); }", "a.ts"));
  assert.ok(!fires("catch-any", "try { await sync(); } catch (e: unknown) { toast(String(e)); }", "a.ts"));
  assert.ok(!fires("catch-any", "try { await sync(); } catch (e) { toast(String(e)); }", "a.js"));
});

// ── Comment slop ─────────────────────────────────────────────────────────────

test("model-tooling-artifact: vendor tooling tokens are findings in code AND prose", () => {
  const token = "The timeout defaults to 30 seconds :contentReference[oaicite:3]{index=3}.";
  assert.ok(fires("model-tooling-artifact", `// ${token}`, "a.js"), "code surface");
  assert.ok(fires("model-tooling-artifact", token, "post.md"), "prose surface");
  assert.ok(fires("model-tooling-artifact", "See turn0search2 for the source.", "post.md"));
  assert.ok(fires("model-tooling-artifact", "Reported widely [cite: 12].", "post.md"));
});

test("model-tooling-artifact: ordinary markup that looks similar is NOT a finding", () => {
  assert.ok(!fires("model-tooling-artifact", "const citation = { id: 1 };", "a.js"));
  assert.ok(!fires("model-tooling-artifact", "let attributedString = render(x);", "a.js"));
  assert.ok(!fires("model-tooling-artifact", "See [1] and [2] for the derivation.", "post.md"));
  assert.ok(!fires("model-tooling-artifact", ":::note\nThe cache is warm.\n:::", "post.md"));
});

test("apologetic-comment: a comment apologising for the code is a finding", () => {
  assert.ok(fires("apologetic-comment", "# Note: this is a simplified implementation.", "a.py"));
  assert.ok(fires("apologetic-comment", "// Written for demonstration purposes only.", "a.js"));
  assert.ok(fires("apologetic-comment", "// This may need to be hardened for production.", "a.js"));
});

test("apologetic-comment: an ordinary comment using the same words is NOT a finding", () => {
  assert.ok(!fires("apologetic-comment", "# Minimal repro for issue 88; the full path lives in worker.py", "a.py"));
  assert.ok(!fires("apologetic-comment", "// Production build uses esbuild.", "a.js"));
});

test("deferral-comment: unfinished work signed off in prose is a finding", () => {
  assert.ok(fires("deferral-comment", "const rate = 0.08; // for now, hardcode the tax rate", "a.js"));
  assert.ok(fires("deferral-comment", "// temporary workaround until the pricing service lands", "a.js"));
  assert.ok(fires("deferral-comment", "// in a real implementation you would validate the signature", "a.js"));
  assert.ok(fires("deferral-comment", "// should work for most cases", "a.js"));
});

test("deferral-comment: a tracked deferral and a NOW identifier are NOT findings", () => {
  assert.ok(!fires("deferral-comment", "const rate = 0.08; // tax rate is fixed until PRICING-214 lands", "a.js"));
  assert.ok(!fires("deferral-comment", "const now = Date.now(); // wall clock", "a.js"));
  assert.ok(!fires("deferral-comment", "// works for NOW_UTC and LATER_UTC enums", "a.js"));
});

test("deferral-comment and apologetic-comment never double-report one comment", () => {
  // The apologetic rule owns "simplified implementation"; the deferral rule takes only
  // the noun form. Overlapping legs would report the same comment twice.
  const found = names("# Note: this is a simplified implementation.", "a.py");
  assert.ok(found.includes("apologetic-comment"));
  assert.ok(!found.includes("deferral-comment"));
});

test("banner-comment: two ASCII rules are a finding, one is not", () => {
  const two = "# ============================================\n# UTILITIES\n# ============================================\ndef go(): pass";
  const one = "// ==========================================\nfunction go() {}";
  assert.ok(fires("banner-comment", two, "a.py"));
  assert.ok(!fires("banner-comment", one, "a.js"));
});

test("banner-comment: a divider carrying real content is NOT a finding", () => {
  const withContent = "// ---- see RFC 9110 for the status ladder ----\n// ---- and RFC 9111 for caching ----\nfunction go() {}";
  assert.ok(!fires("banner-comment", withContent, "a.js"));
});

// ── Native (Apple) ───────────────────────────────────────────────────────────

test("fixed-font-size: a hardcoded point size is a finding", () => {
  assert.ok(fires("fixed-font-size", "Text(name).font(.system(size: 28, weight: .semibold))", "V.swift"));
});

test("fixed-font-size: relativeTo: and @ScaledMetric clear it", () => {
  assert.ok(!fires("fixed-font-size", "Text(name).font(.system(size: 17, relativeTo: .body))", "V.swift"));
  assert.ok(!fires("fixed-font-size", "@ScaledMetric var s = 24\nText(n).font(.system(size: s))", "V.swift"));
  assert.ok(!fires("fixed-font-size", "Text(name).font(.title2)", "V.swift"));
});

test("dispatch-main-async-spam: three hops are a finding, one bridge is not", () => {
  const three = "DispatchQueue.main.async { a() }\nDispatchQueue.main.async { b() }\nDispatchQueue.main.async { c() }";
  const one = "DispatchQueue.main.async { self.label.text = name }";
  assert.ok(fires("dispatch-main-async-spam", three, "M.swift"));
  assert.ok(!fires("dispatch-main-async-spam", one, "M.swift"));
});

// ── Prose ────────────────────────────────────────────────────────────────────

test("plain-aiism-collocation: two collocations are a finding, one is not", () => {
  const two = "They have been quietly building a second habit. Decisions compound, and the cost lands later.";
  const one = "Decisions compound, and the cost lands later than anyone budgets for.";
  assert.ok(fires("plain-aiism-collocation", two, "post.md"));
  assert.ok(!fires("plain-aiism-collocation", one, "post.md"));
});

test("plain-aiism-collocation: the literal uses of the same words are NOT findings", () => {
  const literal = "Interest compounds annually. He held the space open for the crane. " +
    "The signal that the sensor emits is a current loop. This matters to me.";
  assert.ok(!fires("plain-aiism-collocation", literal, "post.md"));
});

test("plain-aiism-collocation: the bare words stay out of the banned-word list", () => {
  // A word-level rule on real, shape, signal, hold, pull or land would be a
  // false-positive catastrophe; the whole rule exists to avoid exactly that.
  const plain = "The real shape of the signal is what we hold on to when the numbers land.";
  assert.equal(scanContent(plain, "post.md").length, 0);
});

// ── Widened rules ────────────────────────────────────────────────────────────

test("antithesis: the 'not about X, it's about Y' reframe is now caught", () => {
  assert.ok(fires("antithesis-not-just-x-y", "It's not about money, it's about trust.", "post.md"));
  assert.ok(fires("antithesis-not-just-x-y", "It's not really speed, it's the feedback loop.", "post.md"));
  assert.ok(fires("antithesis-not-just-x-y", "It's not just faster, it's cheaper.", "post.md"), "the original leg still fires");
});

test("antithesis: a single clause is still NOT a finding", () => {
  assert.ok(!fires("antithesis-not-just-x-y", "It's not about money.", "post.md"));
  assert.ok(!fires("antithesis-not-just-x-y", "This is not the file you edited; check the other one.", "post.md"));
});

test("generic-font: the 2026 successors are findings and a real face is not", () => {
  for (const face of ["Inter", "Geist", "Roboto", "Space Grotesk", "Manrope", "Plus Jakarta Sans", "Outfit", "DM Sans"]) {
    assert.ok(fires("generic-font", `body { font-family: '${face}', sans-serif; }`, "app.css"), face);
  }
  assert.ok(!fires("generic-font", "body { font-family: 'Söhne', system-ui; }", "app.css"));
  assert.ok(!fires("generic-font", "body { font-family: ui-serif, Georgia, serif; }", "app.css"));
});

test("generic-font: Poppins is deliberately absent from the family list", () => {
  // The evidence for Poppins is one self-published page calling it overused, and the
  // fleet's own font doctrine uses it as a deliberate accent face. Omitting it costs
  // the rule nothing; including it would fire on a stated design decision.
  assert.ok(!fires("generic-font", "body { font-family: 'Poppins', sans-serif; }", "app.css"));
});

// Resolved 2026-10-26: the rusty-orange accent completes the combination beside the serif
// display only. Cream with a brick accent and no serif is a common human palette, and the
// accent hues prescribed to replace AI purple sit in that band.
test("cream-serif-default: the rusty-orange accent is a leg beside the serif display, not beside cream alone", () => {
  assert.ok(fires("cream-serif-default", '<h1 class="text-orange-700" style="font-family: Fraunces, serif">Field notes</h1>', "page.html"), "serif + clay");
  assert.ok(fires("cream-serif-default", 'h1 { font-family: "Fraunces", serif } .cta { color: #c2410c }', "page.css"), "serif + clay in CSS");
  assert.ok(!fires("cream-serif-default", '<h1 class="bg-stone-50 text-orange-700">Field notes</h1>', "page.html"), "cream + clay alone");
  assert.ok(!fires("cream-serif-default", "body { background: #faf8f5 } .cta { background: #c2410c }", "page.css"), "cream + clay alone in CSS");
});

test("cream-serif-default: one accent leg alone is below the concentration threshold", () => {
  assert.ok(!fires("cream-serif-default", '<div class="border-orange-700">Heads up</div>', "page.html"));
  assert.ok(!fires("cream-serif-default", '<div class="bg-amber-50">Heads up</div>', "page.html"));
});

test("cream-serif-default: red error states and the 200 band are excluded", () => {
  const errors = '<div class="text-red-700 border-l-4 border-red-700">Failed</div>\n<div class="border-orange-200">x</div>';
  assert.ok(!fires("cream-serif-default", errors, "page.html"));
});

// ── Corpus fixtures for the suppressed-capture path (design + code) ───────────
// The capture path is ~110 lines of scan.mjs across four rule families and two
// suppression sources, and no corpus fixture reached it before 2.1.0: measure() calls the
// two-argument form, so the whole branch was dark under the harness.

test("suppressed capture: the design escape-hatch fixture is silent, and reports why", () => {
  const file = "design/hatched-wordmark.html";
  const content = corpus(file);
  assert.deepEqual(scanContent(content, file), [], "the hatched line must not produce an active finding");
  const suppressed = scanContent(content, file, { collectSuppressed: true });
  assert.deepEqual(
    suppressed.map((v) => [v.name, v.suppressedBy]),
    [["gradient-text", "escape-hatch"]],
  );
  assert.ok(suppressed.every((v) => v.suppressed === true));
});

test("suppressed capture: the code escape-hatch fixture covers three rule families", () => {
  const file = "code/hatched-onboarding.js";
  const content = corpus(file);
  assert.deepEqual(scanContent(content, file), [], "no active finding on a fully hatched file");
  const suppressed = scanContent(content, file, { collectSuppressed: true });
  assert.deepEqual(
    suppressed.map((v) => v.type).sort(),
    ["banned-phrase", "banned-word", "code-pattern"],
    "word, phrase and code-pattern capture all have to work on the code surface",
  );
  assert.ok(suppressed.every((v) => v.suppressedBy === "escape-hatch"));
});

test("suppressed capture: removing the markers restores exactly those findings", () => {
  // Without this the two tests above would pass on a file that had nothing to find.
  const strip = (text) => text.split("\n").map((l) => l.replace(/anti-slop-allow.*$/, "")).join("\n");
  const design = names(strip(corpus("design/hatched-wordmark.html")), "design/hatched-wordmark.html");
  assert.deepEqual(design, ["gradient-text"]);
  const code = names(strip(corpus("code/hatched-onboarding.js")), "code/hatched-onboarding.js");
  assert.ok(code.includes("innerhtml-usage"), `expected innerhtml-usage once unhatched, got ${JSON.stringify(code)}`);
});

// ── 2.2.0 additions (VibeCurb-derived, heuristic provenance) ─────────────────

test("bootstrap-default-blue: two Bootstrap compiled literals are a finding", () => {
  assert.ok(fires("bootstrap-default-blue", ".btn { background: #0d6efd; } .btn:hover { background: #0b5ed7; }", "app.css"));
  assert.ok(fires("bootstrap-default-blue", ".card { border: 1px solid #dee2e6; } a { color: #0d6efd; }", "app.css"));
});

test("bootstrap-default-blue: one literal is below the concentration floor", () => {
  assert.ok(!fires("bootstrap-default-blue", ".btn { background: #0d6efd; }", "app.css"));
});

test("bootstrap-default-blue: a themed blue is NOT a finding", () => {
  assert.ok(!fires("bootstrap-default-blue", ".btn { background: #1a56db; } .btn:hover { background: #1648b8; } .card { border: 1px solid #d8d2c4; }", "app.css"));
});

test("bootstrap-default-blue: design rules stay off native surfaces", () => {
  assert.ok(!fires("bootstrap-default-blue", "// #0d6efd #0b5ed7 in a comment", "View.swift"));
});

// ── 2.2.1 recalibration ──────────────────────────────────────────────────────
// The literal moved out of generic-microcopy into hero-scroll-hint, and
// bootstrap-default-blue gained the requires-blue file gate. Both directions of each are
// asserted here; the false-positive shapes that forced the change are in
// rule-false-positives.test.mjs, next to the rest of the negative direction.

test("hero-scroll-hint: the hero scroll literal is a finding, and it is no longer generic-microcopy", () => {
  const found = names('<span class="hint">Scroll to explore</span>', "Hero.tsx");
  assert.ok(found.includes("hero-scroll-hint"), `expected hero-scroll-hint, got ${JSON.stringify(found)}`);
  assert.ok(!found.includes("generic-microcopy"), "the literal must not fire the host rule it was split out of");
});

test("hero-scroll-hint: product-specific scroll copy is NOT a finding", () => {
  assert.ok(!fires("hero-scroll-hint", '<span class="hint">Scroll for the 2019-2026 price history</span>', "Hero.tsx"));
});

test("hero-scroll-hint: it is graded as a smell, not as the host rule's Quality defect", () => {
  const [violation] = scanContent('<span class="hint">Scroll to explore</span>', "Hero.tsx");
  assert.equal(violation.name, "hero-scroll-hint");
  assert.equal(violation.confidence, "Pattern smell");
});

test("generic-microcopy: the rest of the family still fires without the scroll literal", () => {
  assert.ok(fires("generic-microcopy", '<h1>Welcome back!</h1>', "Dashboard.tsx"));
  assert.ok(fires("generic-microcopy", '<p>Join thousands of happy people</p>', "Landing.tsx"));
});

// ── 2.4.0 additions ──────────────────────────────────────────────────────────
// Two accessibility defects and one type-safety defect that generated code ships often
// and no rule reached. Each is asserted in both directions, and the negative direction
// carries the CORRECT form of the same construct rather than an unrelated clean file:
// that is what catches a rule which has learned to match the construct, not the defect.

test("viewport-zoom-lock: a viewport meta that blocks pinch zoom is a finding", () => {
  const scalable = '<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">';
  const zero = '<meta name="viewport" content="width=device-width, user-scalable=0">';
  const capped = '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">';
  const cappedFloat = '<meta name="viewport" content="width=device-width, maximum-scale=1.0">';
  for (const html of [scalable, zero, capped, cappedFloat]) {
    assert.ok(fires("viewport-zoom-lock", html, "index.html"), `expected a finding on: ${html}`);
  }
});

test("viewport-zoom-lock: either attribute order fires, and the word viewport in prose does not", () => {
  assert.ok(fires("viewport-zoom-lock", '<meta content="width=device-width, user-scalable=no" name="viewport">', "index.html"));
  assert.ok(fires("viewport-zoom-lock", "<meta name='viewport' content='width=device-width, maximum-scale=1'>", "index.html"));
  // A reference line about the tag is documentation: 2.5.0 fired on it.
  assert.ok(!fires("viewport-zoom-lock", "Grep the viewport meta for `user-scalable=no` and `maximum-scale=1`; delete both.", "docs/notes.html"));
  assert.ok(!fires("viewport-zoom-lock", '<meta name="description" content="viewport tips: user-scalable=no is wrong">', "index.html"));
});

test("viewport-zoom-lock: the correct viewport meta and a usable zoom cap are NOT findings", () => {
  assert.ok(!fires("viewport-zoom-lock", '<meta name="viewport" content="width=device-width, initial-scale=1">', "index.html"));
  // A cap of 5 still leaves the user a range; 1 is the one that removes the control.
  assert.ok(!fires("viewport-zoom-lock", '<meta name="viewport" content="width=device-width, maximum-scale=5">', "index.html"));
  assert.ok(!fires("viewport-zoom-lock", '<meta name="viewport" content="width=device-width, maximum-scale=1.5">', "index.html"));
  // maximum-scale=10 must not match through the "1" that starts it.
  assert.ok(!fires("viewport-zoom-lock", '<meta name="viewport" content="width=device-width, maximum-scale=10">', "index.html"));
  // The attributes without the viewport meta around them are some other API's options.
  assert.ok(!fires("viewport-zoom-lock", "const opts = { userScalable: false };", "map.js"));
});

test("positive-tabindex: a hand-numbered focus order is a finding, in markup and in JSX", () => {
  assert.ok(fires("positive-tabindex", '<input id="q" tabindex="3">', "search.html"));
  assert.ok(fires("positive-tabindex", '<input id="q" tabIndex={2} />', "Search.tsx"));
  assert.ok(fires("positive-tabindex", "<input id='q' tabindex='1'>", "search.html"));
});

test("positive-tabindex: 0 and -1 are the two correct values and stay clean", () => {
  assert.ok(!fires("positive-tabindex", '<input id="q" tabindex="0">', "search.html"));
  assert.ok(!fires("positive-tabindex", '<div role="region" tabindex="-1">Results</div>', "search.html"));
  assert.ok(!fires("positive-tabindex", "<div ref={panel} tabIndex={-1} />", "Search.tsx"));
  assert.ok(!fires("positive-tabindex", "<div ref={panel} tabIndex={0} />", "Search.tsx"));
});

test("cast-to-any: a TypeScript escape cast is a finding", () => {
  assert.ok(fires("cast-to-any", "const invoice = raw as any;", "src/ledger.ts"));
  assert.ok(fires("cast-to-any", "total += (row as any).cents;", "src/ledger.ts"));
});

test("cast-to-any: unknown, a longer identifier, and Swift/Kotlin `as Any` are NOT findings", () => {
  assert.ok(!fires("cast-to-any", "const raw = payload as unknown;", "src/ledger.ts"));
  assert.ok(!fires("cast-to-any", "const v = input as anyValue;", "src/ledger.ts"));
  // Case-sensitive on purpose: the existential cast is the correct idiom on both platforms.
  assert.ok(!fires("cast-to-any", "let boxed = value as Any", "Model.swift"));
  assert.ok(!fires("cast-to-any", "val boxed = value as Any", "Model.kt"));
});

test("cast-to-any and catch-any never double-report the same line", () => {
  const found = names("try { go(); } catch (e: any) { log(e); }", "src/ledger.ts");
  assert.ok(found.includes("catch-any"), `expected catch-any, got ${JSON.stringify(found)}`);
  assert.ok(!found.includes("cast-to-any"), "a catch binding is catch-any's finding, not a cast");
});

test("cast-to-any: the corpus pair fires on the positive and stays silent on the control", () => {
  assert.ok(fires("cast-to-any", corpus("code/cast-to-any.ts"), "code/cast-to-any.ts"));
  assert.deepEqual(names(corpus("code/typed-narrowing.ts"), "code/typed-narrowing.ts"), []);
});

test("the 2.4.0 accessibility pair fires on the corpus positive and stays silent on the control", () => {
  const found = names(corpus("design/zoom-lock-tabindex.html"), "design/zoom-lock-tabindex.html");
  assert.deepEqual(found.sort(), ["positive-tabindex", "viewport-zoom-lock"]);
  assert.deepEqual(names(corpus("design/viewport-clean.html"), "design/viewport-clean.html"), []);
});

// ── The remediation floor, end to end (2.4.0) ────────────────────────────────
// The rule tables are checked for a `fix` in rule-metadata.test.mjs. This is the other
// half: that the fix and the line actually reach the emitted violation, for a family from
// each of the four tables and for the four families inlined in scan.mjs.

test("every emitted violation carries a fix and the line it was found on", () => {
  const samples = [
    ["Great question! We delve into the tapestry here.\n\nIn conclusion \u{1F680}.\n", "post.md"],
    ["const a = 1;\nelement.innerHTML = userInput;\n", "src/render.js"],
    ["h1 { background-clip: text; color: transparent; }\n", "page.css"],
    ["let w = UIScreen.main.bounds.width\n", "View.swift"],
  ];
  for (const [content, path] of samples) {
    const violations = scanContent(content, path, { proseScope: "all" });
    assert.ok(violations.length > 0, `expected findings for ${path}`);
    for (const v of violations) {
      assert.ok(typeof v.fix === "string" && v.fix.length > 0, `${path} finding has no fix: ${JSON.stringify(v)}`);
      assert.ok(Number.isInteger(v.line) && v.line >= 1, `${path} finding has no line: ${JSON.stringify(v)}`);
    }
  }
});

test("the reported line is the line the tell is actually on", () => {
  const js = ["const a = 1;", "const b = 2;", "// a naive implementation, for now", "eval(input);"].join("\n");
  const found = scanContent(js, "src/run.js");
  assert.equal(found.find((v) => v.name === "eval-usage").line, 4);
  // A comment tell on a code surface is scanned through extractComments, which preserves
  // the line count precisely so this number is the file's line and not the comment's index.
  assert.equal(found.find((v) => v.name === "apologetic-comment").line, 3);
});

// ── low-contrast / low-contrast-near-bar (2.5.0) ─────────────────────────────
// WCAG 1.4.3 arithmetic on surfaces the file declares. Every exemption below has its
// should-flag twin beside it: an exemption that swallows the case next to it is the
// failure these pairs exist to catch.

const page = (css, body = "<p>x</p>") => `<!doctype html><html lang="en"><head><style>${css}</style></head><body>${body}</body></html>`;
const contrast = (content, path = "page.html") => scanContent(content, path).filter((v) => v.name === "low-contrast" || v.name === "low-contrast-near-bar");

test("low-contrast: the corpus pairs fire on the positives and stay silent on their partners", () => {
  const pairs = names(corpus("design/contrast-pairs.html"), "design/contrast-pairs.html");
  assert.ok(pairs.includes("low-contrast") && pairs.includes("low-contrast-near-bar"), JSON.stringify(pairs));
  assert.ok(names(corpus("design/contrast-ground.html"), "design/contrast-ground.html").includes("low-contrast"));
  assert.deepEqual(contrast(corpus("design/contrast-clean.html")), []);
  assert.deepEqual(contrast(corpus("design/contrast-ground-clean.html")), []);
});

test("low-contrast: each tier reports its ratio, its colours and where the surface came from", () => {
  const [v] = contrast(corpus("design/contrast-pairs.html")).filter((x) => x.name === "low-contrast");
  assert.equal(v.count, 3);
  assert.equal(v.line, 11);
  assert.match(v.evidence, /^\.btn 2\.9:1 \(need 4\.5:1\), text #ffffff on #ca8a10 \(block\)$/);
  const ground = contrast(corpus("design/contrast-ground.html"))[0];
  assert.match(ground.evidence, /3\.5:1 .*\(page ground\)/);
});

test("low-contrast: a hairline miss is near-bar at low severity, a real miss is high", () => {
  const hairline = contrast(page("body { background: #fff } .t { background: #f1f5f9; color: #6b7280 }"));
  assert.deepEqual(hairline.map((v) => [v.name, v.severity]), [["low-contrast-near-bar", "low"]]);
  const real = contrast(page("body { background: #fff } .t { background: #f1f5f9; color: #9ca3af }"));
  assert.deepEqual(real.map((v) => [v.name, v.severity]), [["low-contrast", "high"]]);
});

test("low-contrast: a disabled control is exempt, and the same colours enabled are not", () => {
  assert.deepEqual(contrast(page("button:disabled { background: #fff; color: #9ca3af }")), []);
  assert.equal(contrast(page("button { background: #fff; color: #9ca3af }")).length, 1);
});

test("low-contrast: a gradient or image surface is not measured, a solid one is", () => {
  assert.deepEqual(contrast(page(".hero { background: linear-gradient(#fff, #eee); color: #9ca3af }")), []);
  assert.deepEqual(contrast(page(".hero { background: #fff url(x.png); color: #9ca3af }")), []);
  assert.equal(contrast(page(".hero { background: #ffffff; color: #9ca3af }")).length, 1);
});

test("low-contrast: the page ground holds only when nothing else in the file paints a surface", () => {
  // The BEM shape: .hero__sub sits on .hero's navy, which no selector chain says.
  const bem = "body { background: #fff } .hero { background: #0f172a; color: #fff } .hero__sub { color: #9ca3af }";
  assert.deepEqual(contrast(page(bem)), [], "a second painted surface switches the page-ground tier off");
  const twin = "body { background: #fff } .hero { color: #111 } .hero__sub { color: #9ca3af }";
  assert.equal(contrast(page(twin)).length, 1, "with the page ground the only surface, the pair is measured");
  assert.deepEqual(contrast(page(".note { color: #9ca3af }")), [], "an undeclared ground is unknown, not white");
});

test("low-contrast: the large-text bar is 3:1, and the same colour at body size fails", () => {
  assert.deepEqual(contrast(page("body { background: #fff } .d { font-size: 28px; font-weight: 700; color: #8f8f8f }")), []);
  assert.deepEqual(contrast(page("body { background: #fff } .d { font-size: 19px; font-weight: bold; color: #8f8f8f }")), []);
  assert.equal(contrast(page("body { background: #fff } .d { font-size: 16px; color: #8f8f8f }")).length, 1);
});

test("low-contrast: placeholder text is measured, near-bar when the field is labelled", () => {
  const css = "input { background: #fff; color: #111 } input::placeholder { color: #9ca3af }";
  const labelled = contrast(page(css, '<label for="a">Name</label><input id="a" placeholder="Ada">'));
  assert.deepEqual(labelled.map((v) => v.name), ["low-contrast-near-bar"]);
  const bare = contrast(page(css, '<input placeholder="Ada">'));
  assert.deepEqual(bare.map((v) => v.name), ["low-contrast"]);
});

test("low-contrast: gradient text, dark-scheme overrides and unresolved tokens are not measured", () => {
  assert.deepEqual(contrast(page("body { background: #fff } h1 { background-clip: text; color: #eee }")), []);
  assert.equal(contrast(page("body { background: #fff } h1 { color: #eee }")).length, 1);
  assert.deepEqual(contrast(page("body { background: #fff } @media (prefers-color-scheme: dark) { .n { color: #eee } }")), []);
  assert.deepEqual(contrast(page(".n { background: #fff; color: var(--ink) }")), []);
  assert.equal(contrast(page(":root { --ink: #eee } .n { background: #fff; color: var(--ink) }")).length, 1);
});

test("low-contrast: inline styles and JSX style objects are measured as blocks", () => {
  assert.equal(contrast('<p style="background: #fff; color: #aaa">x</p>').length, 1);
  assert.equal(contrast('export const N = () => <p style={{ background: "#fff", color: "#aaa" }}>x</p>;', "N.tsx").length, 1);
});

test("low-contrast: one finding per colour pair, and a waived line drops its hit", () => {
  const twice = contrast(page("body { background: #fff } .a { background: #fff; color: #aaa } .b { background: #fff; color: #aaa }"));
  assert.equal(twice[0].count, 1);
  const hatched = page("body { background: #fff }\n.a { background: #fff; color: #aaa } /* anti-slop-allow: brand grey */");
  assert.deepEqual(contrast(hatched), []);
});

// ── side-stripe-accent (2.5.0) ───────────────────────────────────────────────

const stripe = (content, path = "page.html") => scanContent(content, path).filter((v) => v.name === "side-stripe-accent");

test("side-stripe-accent: every producer in the positive fires, and the partner is silent", () => {
  const [v] = stripe(corpus("design/side-stripe-cards.html"));
  assert.equal(v.count, 5);
  assert.deepEqual(v.lines, [11, 12, 14, 15, 25]);
  assert.deepEqual(stripe(corpus("design/side-stripe-clean.html")), []);
});

test("side-stripe-accent: exempt subjects and states, each beside the twin it must not swallow", () => {
  const css = (rule) => page(rule);
  assert.deepEqual(stripe(css(".timeline li { border-left: 3px solid #0f766e }")), [], "a list item");
  assert.equal(stripe(css(".timeline div { border-left: 3px solid #0f766e }")).length, 1, "the same rule on a div");
  assert.deepEqual(stripe(css('.tabs [aria-selected="true"] { border-left: 3px solid #0f766e }')), [], "a selected tab");
  assert.equal(stripe(css(".tabs .item { border-left: 3px solid #0f766e }")).length, 1, "the same edge with no selection state");
  assert.deepEqual(stripe(css('[role="alert"] { border-left: 4px solid #b91c1c }')), [], "a live region");
  assert.equal(stripe(css(".alert { border-left: 4px solid #b91c1c }")).length, 1, "a class named alert is not a live region");
  assert.deepEqual(stripe('<button class="border-l-4 border-teal-600">x</button>'), [], "a control");
  assert.equal(stripe('<div class="border-l-4 border-teal-600">x</div>').length, 1, "the same classes on a div");
});

test("side-stripe-accent: neutral, hairline and evenly framed borders are not stripes", () => {
  assert.deepEqual(stripe(page(".a { border-left: 4px solid #d4d4d8 }")), [], "neutral grey");
  assert.equal(stripe(page(".a { border-left: 4px solid #0f766e }")).length, 1, "chromatic");
  assert.deepEqual(stripe(page(".a { border-left: 1px solid #0f766e }")), [], "a 1px rule");
  assert.deepEqual(stripe(page(".a { border: 2px solid #0f766e; border-left-width: 3px }")), [], "not dominant over the other sides");
  assert.equal(stripe(page(".a { border: 1px solid #e5e7eb; border-left: 4px solid #0f766e }")).length, 1, "a hairline frame with a thick coloured side");
  assert.equal(stripe(page(".a { border-left: 4px solid var(--accent) }")).length, 1, "an unknown colour keeps the finding");
});

test("side-stripe-accent: a square box needs 3px, a rounded or unknown radius 2px", () => {
  assert.deepEqual(stripe(page(".a { border-radius: 0; border-left: 2px solid #0f766e }")), []);
  assert.equal(stripe(page(".a { border-radius: 0; border-left: 3px solid #0f766e }")).length, 1);
  assert.equal(stripe(page(".a { border-radius: 8px; border-left: 2px solid #0f766e }")).length, 1);
  assert.equal(stripe(page(".a { border-left: 2px solid #0f766e }")).length, 1, "no radius is unknown, not square");
});

test("side-stripe-accent: pseudo bars, inset shadows, style objects and border-l-N", () => {
  const bar = ".f { position: relative } .f::before { content: \"\"; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: #0f766e }";
  assert.equal(stripe(page(bar)).length, 1);
  assert.deepEqual(stripe(page(bar.replace("width: 4px", "width: 24px"))), [], "a wide block is not a bar");
  assert.deepEqual(stripe(page("pre::before { content: \"\"; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: #0f766e }")), [], "a code block's gutter");
  assert.equal(stripe(page(".p { box-shadow: inset 4px 0 0 #0f766e }")).length, 1);
  assert.deepEqual(stripe(page(".p { box-shadow: inset 0 4px 0 #0f766e }")), [], "a top band is not a side stripe");
  assert.deepEqual(stripe(page(".p { width: 32px; box-shadow: inset 4px 0 0 #0f766e }")), [], "a small control");
  assert.equal(stripe('export const C = () => <div style={{ borderLeft: "4px solid #0f766e", borderRadius: 12 }}>x</div>;', "C.tsx").length, 1);
  assert.deepEqual(stripe('<div class="border-l-2 border-teal-600">x</div>'), [], "border-l-2 on a square box");
  assert.equal(stripe('<div class="rounded-lg border-l-2 border-teal-600">x</div>').length, 1, "border-l-2 on a rounded card");
  assert.deepEqual(stripe('<div class="border-l-4 border-slate-300">x</div>'), [], "a neutral Tailwind border");
  assert.deepEqual(stripe('<div class="hover:border-l-4 border-teal-600">x</div>'), [], "a hover-only stripe is state");
});

// ── text-size-floor (2.5.0) ──────────────────────────────────────────────────

const floor = (content, path = "page.css") => scanContent(content, path).filter((v) => v.name === "text-size-floor");

test("text-size-floor: the corpus positive fires on all three floors' cases, the partner is silent", () => {
  const [v] = floor(corpus("design/type-floors.html"), "design/type-floors.html");
  assert.equal(v.count, 3);
  assert.match(v.evidence, /^\.article p: font-size 11px \(running text, floor 12px\)$/);
  assert.deepEqual(floor(corpus("design/type-floors-clean.html"), "design/type-floors-clean.html"), []);
});

test("text-size-floor: running text has a 12px floor, functional text 11px", () => {
  assert.equal(floor(".article p { font-size: 11px }").length, 1);
  assert.deepEqual(floor(".price { font-size: 11px }"), [], "11px functional text is at its floor");
  assert.equal(floor(".price { font-size: 10.9px }").length, 1, "the 0.1px tolerance, not a rounding");
  assert.deepEqual(floor(".price { font-size: 10.95px }"), []);
});

test("text-size-floor: a label-like word makes a reading selector functional, and its twin still reads", () => {
  assert.deepEqual(floor(".post-meta { font-size: 11px }"), []);
  assert.equal(floor(".post-body { font-size: 11px }").length, 1);
});

test("text-size-floor: caps take the functional floor, mixed case the reading one", () => {
  assert.deepEqual(floor(".lede { font-size: 11px; text-transform: uppercase }"), []);
  assert.equal(floor(".lede { font-size: 11px }").length, 1);
});

test("text-size-floor: small print has a 10px floor, and footnote is a whole class word", () => {
  assert.deepEqual(floor(".legal small { font-size: 10px }"), []);
  assert.equal(floor(".legal small { font-size: 9.5px }").length, 1);
  assert.deepEqual(floor(".footnote { font-size: 10px }"), []);
  assert.equal(floor(".text-footnote { font-size: 10px }").length, 1, "Apple's text-footnote style is not small print");
  assert.equal(floor(".terms p { font-size: 11px }").length, 1, "terms is not a small-print word");
});

test("text-size-floor: footnote markers, code and hidden text are exempt; svg labels are not", () => {
  assert.deepEqual(floor("sup.fn { font-size: 9px }"), []);
  assert.equal(floor("span.fn { font-size: 9px }").length, 1);
  assert.deepEqual(floor("code { font-size: 10px }"), []);
  assert.deepEqual(floor('[aria-hidden="true"] { font-size: 9px }'), []);
  assert.equal(floor("svg text { font-size: 9px }").length, 1, "diagram labels are read, and the exemption was measured and rejected");
});

test("text-size-floor: only px, rem and the font shorthand are judged", () => {
  assert.deepEqual(floor(".a p { font-size: 0.6em }"), []);
  assert.deepEqual(floor(".a p { font-size: 60% }"), []);
  assert.deepEqual(floor(".a p { font-size: clamp(9px, 1vw, 12px) }"), []);
  assert.equal(floor(".a p { font: 11px/1.5 system-ui, sans-serif }").length, 1);
  assert.equal(floor(".a p { font-size: 0.6875rem }").length, 1);
});

// ── Reading mechanics (2.5.0): tight-leading, wide-tracking, justified-narrow-column,
// crushed-tracking ──

const fired = (rule, content, path = "page.css") => scanContent(content, path).filter((v) => v.name === rule);

test("reading mechanics: the shared positive plants one construct per rule, the partner none", () => {
  const got = names(corpus("design/reading-mechanics.html"), "design/reading-mechanics.html");
  for (const r of ["tight-leading", "wide-tracking", "justified-narrow-column", "crushed-tracking"]) assert.ok(got.includes(r), `${r}: ${JSON.stringify(got)}`);
  assert.deepEqual(names(corpus("design/reading-mechanics-clean.html"), "design/reading-mechanics-clean.html"), []);
});

test("tight-leading: body text under 1.3 fires; headings, lead text, bold titles, code and furniture keep their setting", () => {
  assert.equal(fired("tight-leading", ".article p { font-size: 16px; line-height: 1.15 }").length, 1);
  assert.equal(fired("tight-leading", ".article p { font-size: 16px; line-height: 18px }").length, 1, "px leading divides by the size");
  assert.deepEqual(fired("tight-leading", ".article p { font-size: 16px; line-height: 1.3 }"), []);
  assert.deepEqual(fired("tight-leading", "h2 { font-size: 20px; line-height: 1.1 }"), []);
  assert.equal(fired("tight-leading", "p { font-size: 20px; line-height: 1.1 }").length, 1, "the same leading on a paragraph");
  assert.deepEqual(fired("tight-leading", ".lede { font-size: 22px; line-height: 1.2 }"), [], "lead text at 1.15 or more");
  assert.equal(fired("tight-leading", ".lede { font-size: 18px; line-height: 1.2 }").length, 1, "below 20px it is body text");
  assert.deepEqual(fired("tight-leading", ".x { font-size: 16px; font-weight: 600; line-height: 1.1 }"), []);
  assert.deepEqual(fired("tight-leading", "pre { font-size: 14px; line-height: 1.2 }"), []);
  assert.deepEqual(fired("tight-leading", ".badge { font-size: 12px; line-height: 1 }"), []);
  assert.deepEqual(fired("tight-leading", ".x { font-size: 16px; line-height: normal }"), [], "normal is not judged");
  assert.deepEqual(fired("tight-leading", ".x { font-size: 32px; line-height: 1 }"), [], "display sizes");
});

test("wide-tracking: running text over 0.05em fires; caps, labels, controls and CJK are exempt", () => {
  assert.equal(fired("wide-tracking", ".note p { letter-spacing: 0.12em }").length, 1);
  assert.deepEqual(fired("wide-tracking", ".note p { letter-spacing: 0.05em }"), []);
  assert.equal(fired("wide-tracking", ".note p { font-size: 16px; letter-spacing: 2px }").length, 1, "px tracking divides by the size");
  assert.deepEqual(fired("wide-tracking", ".note p { letter-spacing: 2px }"), [], "px tracking with no size is not judged");
  assert.deepEqual(fired("wide-tracking", ".eyebrow { text-transform: uppercase; letter-spacing: 0.12em }"), []);
  assert.equal(fired("wide-tracking", ".intro { letter-spacing: 0.12em }").length, 1, "the same tracking in mixed case");
  assert.deepEqual(fired("wide-tracking", ".s { font-variant-caps: all-small-caps; letter-spacing: 0.06em }"), []);
  assert.deepEqual(fired("wide-tracking", ":lang(ja) p { letter-spacing: 0.08em }"), []);
  assert.deepEqual(fired("wide-tracking", ".btn { letter-spacing: 0.06em }"), []);
});

test("wide-tracking: a class whose every element holds a short label is a label, not running text", () => {
  const html = (text) => `<style>.entry-no { letter-spacing: 0.1em }</style><p class="entry-no">${text}</p>`;
  assert.deepEqual(fired("wide-tracking", html("No. 01"), "page.html"), []);
  assert.equal(fired("wide-tracking", html("The ferry leaves at eleven and reaches the island after midnight."), "page.html").length, 1);
});

test("justified-narrow-column: a justified measure of 45 characters or less fires unless it hyphenates", () => {
  assert.equal(fired("justified-narrow-column", ".s { width: 22ch; text-align: justify }").length, 1);
  assert.deepEqual(fired("justified-narrow-column", ".s { max-width: 65ch; text-align: justify }"), []);
  assert.deepEqual(fired("justified-narrow-column", ".s { width: 22ch; text-align: justify; hyphens: auto }"), []);
  assert.deepEqual(fired("justified-narrow-column", ".col { hyphens: auto } .col p { width: 22ch; text-align: justify }"), [], "an ancestor's hyphens");
  assert.equal(fired("justified-narrow-column", ".s { width: 18rem; text-align: justify }").length, 1, "18rem with no size reads as 36 characters");
  assert.deepEqual(fired("justified-narrow-column", ".s { text-align: justify }"), [], "no declared measure is not judged");
  assert.deepEqual(fired("justified-narrow-column", ".s { width: 20ch; text-align: center }"), []);
  assert.deepEqual(fired("justified-narrow-column", ":lang(ar) .s { width: 22ch; text-align: justify }"), []);
});

test("crushed-tracking: tighter than -0.07em fires, -0.09em at display sizes; wordmarks are exempt", () => {
  assert.equal(fired("crushed-tracking", ".hero h1 { font-size: 32px; letter-spacing: -0.1em }").length, 1);
  assert.deepEqual(fired("crushed-tracking", ".hero h1 { font-size: 32px; letter-spacing: -0.05em }"), []);
  assert.deepEqual(fired("crushed-tracking", ".display { font-size: 56px; letter-spacing: -0.08em }"), [], "the display bar is -0.09em");
  assert.equal(fired("crushed-tracking", ".display { font-size: 56px; letter-spacing: -0.1em }").length, 1);
  assert.deepEqual(fired("crushed-tracking", ".wordmark { font-size: 28px; letter-spacing: -0.08em }"), []);
  assert.equal(fired("crushed-tracking", ".headline-mark { font-size: 28px; letter-spacing: -0.08em }").length, 1, "the same tracking on a non-wordmark");
  assert.equal(fired("crushed-tracking", ".x { letter-spacing: -0.08em }").length, 1, "an unknown size takes the body bar");
});

// ── bounce-easing and pulsing-dot (2.5.0) ────────────────────────────────────

test("bounce-easing: the corpus positive fires on all three forms, and springs stay clean", () => {
  const [v] = fired("bounce-easing", corpus("design/motion-bounce.html"), "design/motion-bounce.html");
  assert.equal(v.count, 3);
  assert.deepEqual(fired("bounce-easing", corpus("design/motion-spring-clean.html"), "design/motion-spring-clean.html"), []);
});

test("bounce-easing: anticipation plus overshoot fires; a single overshoot settles like a spring", () => {
  assert.equal(fired("bounce-easing", ".m { transition: transform 400ms cubic-bezier(0.68, -0.55, 0.265, 1.55) }").length, 1);
  assert.deepEqual(fired("bounce-easing", ".m { transition: transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1) }"), []);
  assert.deepEqual(fired("bounce-easing", ".m { transition: transform 300ms linear(0, 0.42 12%, 0.99 31%, 1.09 42%, 1) }"), []);
});

test("bounce-easing: a curve token counts only when something reads it", () => {
  const token = ":root { --ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55) }";
  assert.deepEqual(fired("bounce-easing", token), []);
  assert.equal(fired("bounce-easing", `${token} .m { transition: transform 300ms var(--ease-bounce) }`).length, 1);
});

test("bounce-easing: a bounce-named animation that only pulses is SpinKit's loader, not a bounce", () => {
  const pulse = "@keyframes bounce-soft { 0%, 100% { opacity: .5; transform: scale(.98) } 50% { opacity: 1; transform: scale(1) } } .s { animation: bounce-soft 1s infinite }";
  assert.deepEqual(fired("bounce-easing", pulse), []);
  const moves = "@keyframes bounce-soft { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-10px) } } .s { animation: bounce-soft 1s infinite }";
  assert.equal(fired("bounce-easing", moves).length, 1, "the same name with movement in it");
  assert.equal(fired("bounce-easing", ".s { animation: wobble 1s }").length, 1, "keyframes outside the file keep the name's verdict");
});

test("bounce-easing: keyframes that reverse twice are a bounce; rise-and-settle is not", () => {
  const twice = "@keyframes drop { 0% { transform: translateY(0) } 30% { transform: translateY(-24px) } 50% { transform: translateY(0) } 70% { transform: translateY(-10px) } 100% { transform: translateY(0) } } .t { animation: drop 600ms }";
  assert.equal(fired("bounce-easing", twice).length, 1);
  const once = "@keyframes rise { 0% { transform: translateY(8px) } 60% { transform: translateY(-2px) } 80% { transform: translateY(0) } 100% { transform: translateY(0) } } .t { animation: rise 300ms }";
  assert.deepEqual(fired("bounce-easing", once), []);
});

test("bounce-easing: animate-bounce fires with or without a variant; reduced-motion blocks are skipped", () => {
  assert.equal(fired("bounce-easing", '<svg class="animate-bounce"></svg>', "a.html").length, 1);
  assert.equal(fired("bounce-easing", '<svg class="motion-safe:animate-bounce"></svg>', "a.html").length, 1);
  assert.deepEqual(fired("bounce-easing", "@media (prefers-reduced-motion: reduce) { .m { transition-timing-function: cubic-bezier(0.68, -0.55, 0.265, 1.55) } }"), []);
});

test("pulsing-dot: the corpus positive fires on the CSS and Tailwind forms, the partner is silent", () => {
  const [v] = fired("pulsing-dot", corpus("design/live-dot.html"), "design/live-dot.html");
  assert.equal(v.count, 2);
  assert.deepEqual(fired("pulsing-dot", corpus("design/live-dot-clean.html"), "design/live-dot-clean.html"), []);
});

test("pulsing-dot: each gate beside its twin (forever, small, round, pulsing in place)", () => {
  const kf = "@keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: .4 } }";
  const dot = (decls) => `${kf} .d { width: 8px; height: 8px; border-radius: 50%; ${decls} }`;
  assert.equal(fired("pulsing-dot", dot("animation: pulse 1.6s infinite")).length, 1);
  assert.deepEqual(fired("pulsing-dot", dot("animation: pulse 1.6s 1")), [], "finite");
  assert.deepEqual(fired("pulsing-dot", dot("animation: pulse 1.6s infinite").replace("width: 8px; height: 8px", "width: 24px; height: 24px")), [], "over 16px");
  assert.deepEqual(fired("pulsing-dot", dot("animation: pulse 1.6s infinite").replace("border-radius: 50%", "border-radius: 1px")), [], "square");
  const float = "@keyframes float { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-8px) } } .d { width: 8px; height: 8px; border-radius: 50%; animation: float 3s infinite }";
  assert.deepEqual(fired("pulsing-dot", float), [], "a dot that moves");
  assert.equal(fired("pulsing-dot", ".d { width: 8px; height: 8px; border-radius: 50%; animation: ping 1s infinite }").length, 1, "keyframes outside the file: the name decides");
  assert.deepEqual(fired("pulsing-dot", "@media (prefers-reduced-motion: reduce) { .d { width: 8px; height: 8px; border-radius: 50%; animation: ping 1s infinite } }"), []);
});

test("pulsing-dot: the Tailwind form needs a dot-sized box", () => {
  assert.equal(fired("pulsing-dot", '<span class="h-2 w-2 rounded-full animate-ping"></span>', "a.html").length, 1);
  assert.deepEqual(fired("pulsing-dot", '<span class="h-10 w-10 rounded-full animate-pulse"></span>', "a.html"), [], "a skeleton avatar");
  assert.deepEqual(fired("pulsing-dot", '<span class="h-2 w-2 rounded animate-ping"></span>', "a.html"), [], "not round");
});

test("pulsing-dot: an approved live badge is one marker away", () => {
  const badge = '<span class="h-2 w-2 rounded-full animate-ping"></span> <!-- anti-slop-allow: the brief asks for a live badge -->';
  assert.deepEqual(fired("pulsing-dot", badge, "a.html"), []);
});

// ── classAll reads every class source (2.5.0) ────────────────────────────────

test("classAll: cn(), multi-line class attributes and ternary arms", () => {
  const count = (content, path) => (scanContent(content, path).find((v) => v.name === "icon-in-colored-circle") || { count: 0 }).count;
  assert.equal(count('<div className={cn("rounded-full bg-blue-100 p-3", active && "ring-2")} />', "A.tsx"), 1);
  assert.equal(count('<div\n  class="rounded-full\n   bg-blue-100 p-3">x</div>', "a.html"), 1);
  assert.equal(count('<div className={on ? "rounded-full bg-blue-100" : "p-3"} />', "A.tsx"), 0, "exclusive arms never pair");
  assert.equal(count('<div className={cn("rounded-full p-3", on ? "bg-blue-100" : "bg-white")} />', "A.tsx"), 1, "the arm that completes the set");
  assert.equal(count('<div className={cn("rounded-full bg-blue-100 p-3", on ? "a" : "b")} />', "A.tsx"), 1, "a complete base counts once, not once per arm");
  assert.equal(count('<span class="rounded-full">a</span><span class="bg-blue-100 p-3">b</span>', "a.html"), 0, "sibling elements never pair");
});

test("classAll: a multi-line set is reported, and waived, on the line where it starts", () => {
  const circles = (html) => scanContent(html, "a.html").filter((v) => v.name === "icon-in-colored-circle");
  assert.equal(circles('<div class="rounded-full\n bg-blue-100 p-3">x</div>')[0].line, 1);
  assert.deepEqual(circles('<div data-note="anti-slop-allow: brand circle" class="rounded-full\n bg-blue-100 p-3">x</div>'), []);
  assert.equal(circles('<div class="rounded-full\n bg-blue-100 p-3" data-note="anti-slop-allow: brand circle">x</div>').length, 1,
    "a marker on a later line of the attribute is not on the set's line");
});

// ── Tailwind outline-none and the h-screen shell (2.5.0) ─────────────────────

test("outline-none: a Tailwind outline kill with no focus replacement in its set fires", () => {
  assert.ok(fires("outline-none", '<button class="focus:outline-none px-3">Save</button>', "a.html"));
  assert.ok(fires("outline-none", '<button class="outline-hidden px-3">Save</button>', "a.html"));
  assert.ok(!fires("outline-none", '<button class="focus:outline-none px-3">Save</button>\n<a class="focus-visible:ring-2">x</a>', "a.html"),
    "a focus-visible utility anywhere in the file clears it");
});

test("outline-none: the canonical focus:ring replacement is not a removed indicator", () => {
  assert.ok(!fires("outline-none", '<button class="focus:outline-none focus:ring-2 focus:ring-teal-500">Save</button>', "a.html"));
  assert.ok(fires("outline-none", '<button class="focus:outline-none focus:ring-teal-500">Save</button>', "a.html"), "a ring colour with no width draws nothing");
  assert.ok(!fires("outline-none", '<button class="focus-visible:outline-none focus-visible:ring-2">Save</button>', "a.html"));
});

test("vh-viewport-shell: h-screen and min-h-screen are the 100vh shell; a dvh fallback clears them", () => {
  assert.ok(fires("vh-viewport-shell", '<main class="min-h-screen">x</main>', "a.html"));
  assert.ok(fires("vh-viewport-shell", '<main class="h-screen">x</main>', "a.html"));
  assert.ok(!fires("vh-viewport-shell", '<main class="min-h-screen min-h-dvh">x</main>', "a.html"));
  assert.ok(!fires("vh-viewport-shell", '<main class="h-screen h-svh">x</main>', "a.html"));
});

test("positive-tabindex: a data attribute that ends in tabindex is not the attribute", () => {
  assert.ok(!fires("positive-tabindex", '<div data-tabindex="3">x</div>', "a.html"));
  assert.ok(fires("positive-tabindex", '<div tabindex="3">x</div>', "a.html"));
});

// ── generic-font reads the primary face (2.5.0) ──────────────────────────────

test("generic-font: the font shorthand's family is read, and only the first non-generic family counts", () => {
  assert.ok(fires("generic-font", 'body { font: 15px/1.4 "Inter", sans-serif }', "a.css"));
  assert.ok(!fires("generic-font", 'body { font-family: "Söhne", Inter, sans-serif }', "a.css"), "Inter as a fallback");
  assert.ok(!fires("generic-font", 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif }', "a.css"), "a system stack");
  assert.ok(!fires("generic-font", 'body { font-family: "Inter Display", sans-serif }', "a.css"), "whole names: Inter Display is not Inter");
  assert.ok(fires("generic-font", 'body { font-family: "Inter Tight", sans-serif }', "a.css"));
  assert.ok(fires("generic-font", "export const A = () => <p style={{ fontFamily: 'Geist, sans-serif' }}>x</p>;", "A.tsx"));
  assert.ok(fires("generic-font", "const inter = Inter({ subsets: ['latin'] });", "layout.tsx"), "the next/font constructor");
});

test("generic-font: a reflex face on a control is the label fallback when content has its own face", () => {
  const withContent = 'body { font-family: "Instrument Serif", serif } .btn { font-family: Inter, sans-serif }';
  assert.ok(!fires("generic-font", withContent, "a.css"));
  assert.ok(fires("generic-font", ".btn { font-family: Inter, sans-serif }", "a.css"), "no other face: the control's face is the page's face");
  assert.ok(fires("generic-font", 'body { font-family: "Instrument Serif", serif } .lede { font-family: Inter, sans-serif }', "a.css"), "Inter on content copy");
  assert.ok(!fires("generic-font", "@font-face { font-family: 'Inter'; src: url(inter.woff2) }", "a.css"), "declaring a face is not setting it");
});

test("generic-font: a listed face matches however it is spelled, and only a listed face", () => {
  assert.ok(fires("generic-font", "body { font: 16px/24px GeistSans, sans-serif }", "a.css"));
  assert.ok(fires("generic-font", '.m { font-family: "Geist Sans", sans-serif }', "a.css"));
  assert.ok(fires("generic-font", '.m { font-family: "Plus-Jakarta-Sans", sans-serif }', "a.css"));
  assert.ok(!fires("generic-font", '.m { font-family: "Roboto Slab", serif }', "a.css"), "a different family that shares a word");
});

// ── marquee (2.5.0, P2) ──────────────────────────────────────────────────────

test("marquee: an infinite sideways loop fires; a one-shot slide, a vertical slide and a scroll rail do not", () => {
  assert.equal(fired("marquee", corpus("design/marquee-logos.html"), "design/marquee-logos.html").length, 1);
  assert.deepEqual(fired("marquee", corpus("design/marquee-clean.html"), "design/marquee-clean.html"), []);
  const loop = "@keyframes scroll { from { transform: translateX(0) } to { transform: translateX(-50%) } }";
  assert.equal(fired("marquee", `${loop} .t { animation: scroll 30s linear infinite }`).length, 1);
  assert.deepEqual(fired("marquee", `${loop} .t { animation: scroll 30s linear 1 }`), [], "finite");
  assert.deepEqual(fired("marquee", "@keyframes nudge { from { transform: translateX(0) } to { transform: translateX(-10%) } } .t { animation: nudge 2s infinite }"), [], "under a fifth of the row");
  assert.deepEqual(fired("marquee", "@keyframes pop { 50% { transform: translateX(-30%) scale(1.1); opacity: .5 } } .t { animation: pop 2s infinite }"), [], "a one-step body that also scales or fades");
  assert.deepEqual(fired("marquee", `@media (prefers-reduced-motion: reduce) { ${loop} .t { animation: scroll 30s linear infinite } }`), []);
  assert.equal(fired("marquee", "<marquee>Sale ends Friday</marquee>", "a.html").length, 1);
});

// ── background-pattern (2.5.0, P2) ───────────────────────────────────────────

test("background-pattern: grids, dot fields and stripes fire; a rule, a one-pass band and a plain gradient do not", () => {
  const [v] = fired("background-pattern", corpus("design/pattern-backgrounds.html"), "design/pattern-backgrounds.html");
  assert.equal(v.count, 3);
  assert.deepEqual(fired("background-pattern", corpus("design/pattern-backgrounds-clean.html"), "design/pattern-backgrounds-clean.html"), []);
  const grid = ".g { background-image: linear-gradient(#ddd 1px, transparent 1px), linear-gradient(90deg, #ddd 1px, transparent 1px);";
  assert.equal(fired("background-pattern", `${grid} background-size: 24px 24px }`).length, 1);
  assert.deepEqual(fired("background-pattern", `${grid} }`), [], "no tile: not a repeating grid");
  assert.deepEqual(fired("background-pattern", ".g { background-image: linear-gradient(#ddd 1px, transparent 1px); background-size: 24px 24px }"), [], "one hairline is a rule");
  assert.deepEqual(fired("background-pattern", ".d { background: radial-gradient(circle, #ccc 6px, transparent 6px) 0 0 / 16px 16px }"), [], "a 6px stop is a spot, not a dot field");
  assert.deepEqual(fired("background-pattern", ".s { background: repeating-linear-gradient(90deg, #eee 0, #ddd) }"), [], "an unpositioned last stop");
});

test("background-pattern: a stated surface is waived by name and the rest of the line still reads", () => {
  const css = ".g { background-image: linear-gradient(#ddd 1px, transparent 1px), linear-gradient(90deg, #ddd 1px, transparent 1px); background-size: 24px 24px } /* anti-slop-allow: background-pattern -- the brand grid */";
  assert.deepEqual(fired("background-pattern", css), []);
  assert.deepEqual(names(corpus("../fixtures/technical-mono.html"), "../fixtures/technical-mono.html"), []);
});

// ── radial-halo (2.5.0, P2) ──────────────────────────────────────────────────

test("radial-halo: a saturated halo on a dark page fires; a light page, a wash and a spot do not", () => {
  assert.equal(fired("radial-halo", corpus("design/radial-halo.html"), "design/radial-halo.html").length, 1);
  assert.deepEqual(fired("radial-halo", corpus("design/radial-halo-clean.html"), "design/radial-halo-clean.html"), []);
  const halo = ".hero { background: radial-gradient(circle at 50% 0%, rgba(34, 211, 238, 0.8), transparent 70%) }";
  assert.equal(fired("radial-halo", `body { background: #0b0b10 } ${halo}`).length, 1);
  assert.deepEqual(fired("radial-halo", `body { background: #ffffff } ${halo}`), [], "the same halo on a light page");
  assert.deepEqual(fired("radial-halo", halo), [], "no declared page ground");
  assert.deepEqual(fired("radial-halo", "body { background: #0b0b10 } .h { background: radial-gradient(circle, rgba(148, 148, 148, 0.9), transparent 70%) }"), [], "a neutral glow");
  assert.deepEqual(fired("radial-halo", "body { background: #0b0b10 } .h { background: repeating-radial-gradient(circle, rgba(34, 211, 238, 0.8), transparent 70%) }"), [], "a repeating gradient is a pattern");
});

// ── gray-on-color (2.5.0, P2) ────────────────────────────────────────────────

test("gray-on-color: grey ink on a colour fires in both forms; tints, states, siblings and arms do not", () => {
  const [v] = fired("gray-on-color", corpus("design/gray-on-color.html"), "design/gray-on-color.html");
  assert.equal(v.count, 2);
  assert.deepEqual(fired("gray-on-color", corpus("design/gray-on-color-clean.html"), "design/gray-on-color-clean.html"), []);
  assert.equal(fired("gray-on-color", '<p class="bg-blue-800 text-slate-500">x</p>', "a.html").length, 1);
  assert.deepEqual(fired("gray-on-color", '<p class="bg-blue-800 text-gray-200">x</p>', "a.html"), [], "near-white ink is not mid-grey");
  assert.deepEqual(fired("gray-on-color", '<p class="bg-blue-100 text-gray-500">x</p>', "a.html"), [], "a pale tint is not a colour surface");
  assert.deepEqual(fired("gray-on-color", '<p class="hover:bg-blue-800 text-gray-500">x</p>', "a.html"), [], "a hover surface is a state");
  assert.equal(fired("gray-on-color", ".p { background: #1e40af; color: #9ca3af }").length, 1);
  assert.deepEqual(fired("gray-on-color", ".p { background: #1e40af; color: #e5e7eb }"), [], "off-white ink");
  assert.deepEqual(fired("gray-on-color", ".p { background: #f3f4f6; color: #6b7280 }"), [], "grey on grey");
});

// ── skipped-heading (2.5.0, P2) ──────────────────────────────────────────────

test("skipped-heading: a jump of more than one level fires; going up, the first heading and a footer's start do not", () => {
  assert.equal(fired("skipped-heading", corpus("design/skipped-heading.html"), "design/skipped-heading.html").length, 1);
  assert.deepEqual(fired("skipped-heading", corpus("design/skipped-heading-clean.html"), "design/skipped-heading-clean.html"), []);
  const doc = (body) => `<!doctype html><html lang="en"><body>${body}</body></html>`;
  assert.equal(fired("skipped-heading", doc("<h1>a</h1><h3>b</h3>"), "a.html").length, 1);
  assert.deepEqual(fired("skipped-heading", doc("<h3>a</h3><h4>b</h4>"), "a.html"), [], "the first heading sets no level to skip from");
  assert.deepEqual(fired("skipped-heading", doc("<h1>a</h1><h2>b</h2><h3>c</h3><h2>d</h2>"), "a.html"), [], "going back up");
  assert.deepEqual(fired("skipped-heading", doc('<h1>a</h1><h2>b</h2><div role="contentinfo"><h4>c</h4></div>'), "a.html"), []);
  assert.equal(fired("skipped-heading", doc("<h1>a</h1><h2>b</h2><footer><h4>c</h4><h6>d</h6></footer>"), "a.html").length, 1, "only the footer's first heading may start lower");
  assert.deepEqual(fired("skipped-heading", "<h1>a</h1><h3>b</h3>", "fragment.html"), [], "a fragment is not a full document");
  assert.deepEqual(fired("skipped-heading", doc("<h1>a</h1><pre>&lt;h3&gt;</pre><code><h3>x</h3></code>"), "a.html"), [], "markup quoted in code is not the outline");
});

// ── theater-slop-phrase (2.5.0, P2) ──────────────────────────────────────────

test("theater-slop-phrase: the dismissive framing fires in both spellings; names and literal theaters do not", () => {
  const theater = (text) => scanContent(text, "post.md").filter((v) => v.name === "theater-slop-phrase");
  assert.equal(theater(corpus("prose/theater-framing.md"))[0].count, 2);
  assert.deepEqual(theater(corpus("prose/theater-literal.md")), []);
  assert.equal(theater("Security theater again.").length, 1, "a capitalised head word at a sentence start");
  assert.deepEqual(theater("Seattle Kindness Theater presents a show."), [], "a Title Case name");
  assert.deepEqual(theater("Security theaters across the region."), [], "the plural is a different noun");
});

// ── DESIGN.md: the palette exemption and design-system-font (2.5.0, P2) ──────

import { mkdtempSync, writeFileSync as writeFile, mkdirSync, rmSync as rmDir } from "node:fs";
import { tmpdir } from "node:os";
import { findDesignMd, readDesignSystem, parseFrontmatter } from "../lib/design-detect.mjs";

const DESIGN_MD = '---\ncolors:\n  violet: oklch(0.55 0.2 295)\n  ink: "#1f2937" # body text\ntypography:\n  body:\n    fontFamily: "Söhne, system-ui, sans-serif"\n---\n# System\n';

function withDesignSystem(fn, designMd = DESIGN_MD) {
  const root = mkdtempSync(join(tmpdir(), "anti-slop-ds-"));
  try {
    writeFile(join(root, "package.json"), "{}");
    if (designMd !== null) writeFile(join(root, "DESIGN.md"), designMd);
    mkdirSync(join(root, "src"));
    return fn(root, readDesignSystem(findDesignMd(join(root, "src", "page.html"))));
  } finally {
    rmDir(root, { recursive: true, force: true });
  }
}

test("DESIGN.md: the reader finds the nearest file, stops at the project root, and reads the frontmatter", () => {
  const fm = parseFrontmatter(DESIGN_MD);
  assert.equal(fm.colors.violet, "oklch(0.55 0.2 295)");
  assert.equal(fm.colors.ink, "#1f2937", "a quoted value with a trailing comment");
  assert.equal(fm.typography.body.fontFamily, "Söhne, system-ui, sans-serif");
  withDesignSystem((root, ds) => {
    assert.equal(ds.path, join(root, "DESIGN.md"));
    assert.deepEqual(ds.purpleArc.map((c) => [c.name, c.hex, Math.round(c.H)]), [["violet", "#7e4ed7", 295]], "ink is off the arc");
    assert.ok(ds.fonts.has("söhne") && !ds.fonts.has("system-ui"));
  });
  withDesignSystem((root, ds) => assert.equal(ds, null, "no DESIGN.md inside the project"), null);
});

// The purple exemption is per match: a match is the palette only near a declared hue.
const designMd = (hex) => `---\ncolors:\n  brand: "${hex}"\n---\n`;
const hexPage = (hex) => `.a { color: ${hex} } .b { border-color: ${hex} }`;
const purpleHex = (css, ds) => scanContent(css, "a.css", { designSystem: ds }).filter((v) => v.name === "ai-purple-hex");

test("DESIGN.md: a declared colour exempts purple only within 15 degrees of its own hue", () => {
  withDesignSystem((root, ds) => {
    assert.deepEqual(purpleHex(hexPage("#2563eb"), ds), [], "declared blue-600, page using blue-600");
    assert.equal(purpleHex(hexPage("#7c3aed"), ds).length, 1, "declared blue-600 (hue about 263) leaves #7c3aed (about 293) a tell");
  }, designMd("#2563eb"));
  withDesignSystem((root, ds) => {
    assert.deepEqual(purpleHex(hexPage("#7c3aed"), ds), [], "declared #7c3aed, page using #7c3aed");
    assert.deepEqual(purpleHex(hexPage("#6d28d9"), ds), [], "violet-700 sits at the declared hue");
    assert.equal(purpleHex(hexPage("#6366f1"), ds).length, 1, "indigo (about 277) is 16 degrees from the declared violet");
  }, designMd("#7c3aed"));
  assert.equal(purpleHex(hexPage("#7c3aed"), null).length, 1, "no DESIGN.md");
});

test("DESIGN.md: class matches and gradients are judged by their own colours, and a mixed match still fires", () => {
  const page = '<a class="bg-violet-600 text-white">Go</a><div class="bg-gradient-to-r from-violet-500 to-violet-600"></div><p class="text-violet-700">x</p>';
  const on = names(page, "page.html");
  assert.ok(on.includes("ai-purple-class") && on.includes("purple-gradient-default"), JSON.stringify(on));
  withDesignSystem((root, ds) => {
    const off = scanContent(page, "page.html", { designSystem: ds }).map((v) => v.name);
    assert.ok(!off.includes("ai-purple-class") && !off.includes("purple-gradient-default"), JSON.stringify(off));
    const indigo = '<a class="bg-indigo-600">Go</a><p class="text-indigo-500">x</p>';
    assert.ok(scanContent(indigo, "page.html", { designSystem: ds }).some((v) => v.name === "ai-purple-class"), "indigo beside a declared violet still fires");
    const mixed = '<div class="bg-gradient-to-r from-violet-500 to-indigo-600"></div>';
    assert.ok(scanContent(mixed, "page.html", { designSystem: ds }).some((v) => v.name === "purple-gradient-default"), "one undeclared stop keeps the gradient a tell");
  });
  withDesignSystem((root, ds) => {
    assert.deepEqual(ds.purpleArc, []);
    assert.ok(scanContent(page, "page.html", { designSystem: ds }).some((v) => v.name === "ai-purple-class"), "a brand off the purple arc exempts nothing");
  }, designMd("#0f766e"));
});

test("DESIGN.md: a literal within 6 per channel of any declared colour is the palette", () => {
  withDesignSystem((root, ds) => {
    assert.deepEqual(purpleHex(hexPage("#7c3aed"), ds), [], "#7d3bec declared, #7c3aed used");
  }, '---\ncolors:\n  accent: "#7d3bec"\n---\n');
});

test("design-system-font: a face outside the declared typography fires; the declared face and system stacks do not", () => {
  withDesignSystem((root, ds) => {
    const font = (css) => scanContent(css, "a.css", { designSystem: ds }).filter((v) => v.name === "design-system-font");
    assert.equal(font('.hero { font-family: "Lobster", cursive }').length, 1);
    assert.deepEqual(font('.hero { font-family: "Söhne", sans-serif }'), []);
    assert.deepEqual(font(".hero { font-family: system-ui, sans-serif }"), []);
    assert.deepEqual(scanContent('.hero { font-family: "Lobster", cursive }', "a.css").filter((v) => v.name === "design-system-font"), [], "no DESIGN.md, no drift");
    assert.deepEqual(scanContent('.hero { font-family: "Lobster", cursive }', "tests/fixtures/a.css", { designSystem: ds }).filter((v) => v.name === "design-system-font"), [],
      "a fixture file is off-system on purpose, and the product's DESIGN.md does not describe it");
  });
  assert.equal(fired("design-system-font", corpus("design/design-system/drift.css"), "design/design-system/drift.css").length, 0,
    "the corpus harness and the CLI resolve DESIGN.md; a bare scanContent call does not");
});
