import { test } from "node:test";
import assert from "node:assert/strict";
import { scanContent } from "../lib/scan.mjs";
import { CONTEXT_EXCEPTION_REGEXES } from "../lib/rules.mjs";

// ── The false-positive direction ──────────────────────────────────────────────
// The corpus measures whether a rule FIRES on a planted tell. It says almost nothing about
// whether a rule stays quiet on the legitimate content that resembles one: 31 of 49 rules
// had no negative fixture and no negative unit assertion, which is how a table of rules can
// report 100% precision while several of them break on a one-line realistic input.
//
// Every rule narrowed in 2.1.0 gets BOTH directions here -- the input that used to fire and
// must not, and the input that must still fire, so a narrowing cannot quietly become a
// deletion. The remaining rules are the highest-risk unguarded ones from the same audit.

const names = (content, path) => scanContent(content, path).map((v) => v.name || v.word || v.phrase || v.type);
const fires = (rule, content, path) => names(content, path).includes(rule);

// ── hardcoded-secret: the value must be secret-SHAPED, not merely 8+ characters ──

test("hardcoded-secret: an i18n copy string is not a credential", () => {
  assert.ok(!fires("hardcoded-secret", 'const en = { password: "Please enter your password" };', "i18n/en.ts"));
});

test("hardcoded-secret: a lexer token KIND is not a credential", () => {
  const lexer = 'const t = { token: "punctuation" };\nconst u = { token: "identifier" };';
  assert.ok(!fires("hardcoded-secret", lexer, "src/lexer.ts"));
});

test("hardcoded-secret: a validation message is not a credential", () => {
  assert.ok(!fires("hardcoded-secret", 'password: "must be at least 8 characters"', "src/schema.ts"));
});

test("hardcoded-secret: an env-indirection string is not a credential", () => {
  assert.ok(!fires("hardcoded-secret", 'api_key = "os.environ[API_KEY]"', "src/config.py"));
});

test("hardcoded-secret: real credentials still fire, by every shape the rule accepts", () => {
  assert.ok(fires("hardcoded-secret", 'const API_KEY = "sk-live-9f2a7bd4c1e8";', "src/config.ts"), "vendor prefix");
  assert.ok(fires("hardcoded-secret", 'const apiKey = "sk_live_abcdef123456"', "src/config.ts"), "3+ digits");
  assert.ok(fires("hardcoded-secret", 'fetch({ token: "csrf-tok12xyz" })', "src/api.ts"), "separator joining letters and digits");
  assert.ok(fires("hardcoded-secret", 'const secret = "YWJjZGVmZ2hpamtsbW5vcHFy"', "src/config.ts"), "20+ chars of base64");
});

// ── listicle-scaffold: the tell is a HEADLINE or a list announcement ──

test("listicle-scaffold: ordinary technical prose counting steps or reasons is not a listicle", () => {
  assert.ok(!fires("listicle-scaffold", "The migration runs in 3 steps and takes about ten minutes.", "runbook.md"));
  assert.ok(!fires("listicle-scaffold", "There are 4 reasons the cache misses on cold start.", "notes.md"));
});

test("listicle-scaffold: a headline and an announced list still fire", () => {
  assert.ok(fires("listicle-scaffold", "# 7 Ways to Speed Up Your Build", "post.md"));
  assert.ok(fires("listicle-scaffold", "Here are 5 ways to speed up first response time.", "post.md"));
});

// ── hr-divider: a Setext underline is a heading, not a divider ──

test("hr-divider: a Setext H2 underline is not a divider", () => {
  assert.ok(!fires("hr-divider", "Release process\n---\n\nRun the deploy script.", "doc.md"));
});

test("hr-divider: a real section divider still fires", () => {
  assert.ok(fires("hr-divider", "Some text.\n\n---\n\nMore text.", "doc.md"));
});

// ── narrating-comment: documenting a procedure is not restating the code ──

test("narrating-comment: a numbered runbook step in a shell script is documentation", () => {
  assert.ok(!fires("narrating-comment", "# Step 1: install the toolchain\nbrew install node", "setup.sh"));
});

test("narrating-comment: an ordered algorithm description in JSDoc is documentation", () => {
  assert.ok(!fires("narrating-comment", "/**\n * First, the parser normalises input.\n */", "src/parse.ts"));
});

test("narrating-comment: a comment that restates the line under it still fires, lead-in or not", () => {
  assert.ok(fires("narrating-comment", "// increment the counter\ni++;", "src/count.ts"));
  assert.ok(fires("narrating-comment", "# first, we loop through the rows\nfor row in rows:", "src/report.py"));
});

// ── boilerplate-marker: RFC 2606 reserves example.com for production use ──

test("boilerplate-marker: example.com in a CORS allowlist is correct, not dummy data", () => {
  assert.ok(!fires("boilerplate-marker", 'const ORIGINS = ["https://app.example.com"];', "src/cors.ts"));
});

test("boilerplate-marker: the precise dummy-data markers still fire", () => {
  assert.ok(fires("boilerplate-marker", 'const k = "sk-xxx-placeholder";', "src/config.ts"));
  assert.ok(fires("boilerplate-marker", "const key = YOUR_API_KEY;", "src/config.ts"));
});

// ── The escape hatch reaches every rule family on every surface ──

test("escape hatch: a banned phrase on a hatched line is suppressed in code as well as prose", () => {
  const line = "// let me walk you through the retry loop  anti-slop-allow: quoting the ticket";
  assert.ok(!fires("let me walk you through", line, "src/retry.ts"));
  assert.ok(!fires("let me walk you through", "Let me walk you through it. <!-- anti-slop-allow: quoting -->", "doc.md"));
});

test("escape hatch: the same phrase without the marker still fires on both surfaces", () => {
  assert.ok(fires("let me walk you through", "// let me walk you through the retry loop", "src/retry.ts"));
  assert.ok(fires("let me walk you through", "Let me walk you through it.", "doc.md"));
});

// Deliberate, and pinned here so it stops being an accident of one ternary: in CODE the
// phrase family scans the WHOLE file, not only comments. Assistant boilerplate leaks into
// UI copy and identifiers as readily as into comments, and a string constant reading
// "Great question" ships to a user. Banned WORDS remain comment-only, because a single
// inflated adjective inside a string is the writer's product copy, not a tell.
test("banned phrases scan code string literals; banned words stay comment-only", () => {
  assert.ok(fires("great question", 'const COPY = { greeting: "Great question" };', "src/copy.ts"));
  assert.ok(!fires("delve", 'const COPY = { intro: "We delve into the details" };', "src/copy.ts"));
  assert.ok(fires("delve", "// we delve into the cache here\nconst n = 1;", "src/cache.ts"));
});

// ── Banned words see trailing comments, but a URL inside a string is not a comment ──

test("banned words: a trailing comment is a comment", () => {
  assert.ok(fires("delve", "const n = 1; // we delve into the cache here", "src/cache.ts"));
});

test("banned words: `//` inside a string literal does not open a comment", () => {
  assert.ok(!fires("delve", 'const url = "http://delve.example"; const y = 1;', "src/net.ts"));
});

// ── CONTEXT_EXCEPTIONS: an over-broad suppressor is a silent recall hole ──
// Common English words that must never be read as domain context. `expiration` is
// deliberately absent -- "expir" is a stem the ephemeral exception is meant to reach.
const DECOYS = [
  "important", "importantly", "support", "supports", "reports", "portion", "portions",
  "deportment", "imported", "exports", "transport", "transported", "settings", "setting",
  "asset", "assets", "subset", "offset", "method", "methods", "whether", "together",
  "register", "registry", "logistics", "mapping", "remapped", "cachet", "seamstress",
];

test("no context exception matches a common English word it was never meant to excuse", () => {
  const collisions = [];
  for (const [word, regexes] of CONTEXT_EXCEPTION_REGEXES) {
    for (const re of regexes) {
      for (const decoy of DECOYS) {
        if (re.test(decoy)) collisions.push(`${word}: /${re.source}/ matches "${decoy}"`);
      }
    }
  }
  assert.deepEqual(
    collisions,
    [],
    "an exception entry that matches ordinary English silently disables the banned word it " +
      "guards in almost every document. Anchor the entry, add it to WHOLE_WORD_EXCEPTIONS, " +
      "or reword it -- never widen the decoy list to make this pass.",
  );
});

test("context exceptions still excuse their real domain word, stems and plurals included", () => {
  const twice = "Welcome to the realm. In this realm, everything is possible.";
  assert.ok(fires("realm", twice, "a.md"), "clustered realm flags without domain context");
  assert.ok(!fires("realm", `${twice} The servers handle each request.`, "a.md"), "plural 'servers'");
  const eph = "The value is ephemeral. Everything here is ephemeral.";
  assert.ok(fires("ephemeral", eph, "a.md"));
  assert.ok(!fires("ephemeral", `${eph} Its expiration is 30 seconds.`, "a.md"), "stem 'expir' -> 'expiration'");
  assert.ok(!fires("ephemeral", `${eph} Bind an ephemeral port on startup.`, "a.md"), "whole word 'port'");
  assert.ok(fires("ephemeral", `${eph} This is important, and exports matter.`, "a.md"), "'important' is not a port");
});

// ── Highest-risk previously unguarded rules ──────────────────────────────────

test("img-no-dimensions: an <img> carrying width and height is not a CLS defect", () => {
  assert.ok(!fires("img-no-dimensions", '<img src="/hero.png" width="800" height="400" alt="Q3 revenue">', "page.html"));
  assert.ok(fires("img-no-dimensions", '<img src="/hero.png" alt="Q3 revenue">', "page.html"));
});

test("generic-naming: a real domain function name is not a placeholder", () => {
  assert.ok(!fires("generic-naming", "function processInvoiceBatch(rows) {}", "src/billing.ts"));
  assert.ok(!fires("generic-naming", "def process_payment(order):\n    pass", "src/billing.py"));
  assert.ok(fires("generic-naming", "function processData(rows) {}", "src/billing.ts"));
});

test("z-index-escalation: an ordinary stacking value is not escalation", () => {
  assert.ok(!fires("z-index-escalation", ".modal { z-index: 40; }", "app.css"));
  assert.ok(!fires("z-index-escalation", "const s = { zIndex: 10 };", "Modal.tsx"));
  assert.ok(fires("z-index-escalation", ".modal { z-index: 9999; }", "app.css"));
  assert.ok(fires("z-index-escalation", "const s = { zIndex: 9999 };", "Modal.tsx"));
});

test("neon-glow: a normal offset shadow is not a neon glow", () => {
  assert.ok(!fires("neon-glow", ".card { box-shadow: 0 1px 3px rgba(0,0,0,.12); }", "app.css"));
  assert.ok(fires("neon-glow", ".card { box-shadow: 0 0 24px var(--accent); }", "app.css"));
});

// ── The three class-attribute fingerprints ───────────────────────────────────
// Both documented orders must fire, and a fingerprint SPLIT ACROSS TWO ELEMENTS must not:
// attribute scoping is the whole reason these are token-set rules rather than a line-wide
// AND. The firing strings are copied from references/design-patterns.md verbatim.

test("frosted-glass-nav: the catalogue's canonical string and the reverse order both fire", () => {
  assert.ok(fires("frosted-glass-nav", '<nav class="bg-white/80 backdrop-blur-md border-b sticky top-0 z-50">', "nav.html"));
  assert.ok(fires("frosted-glass-nav", '<nav class="backdrop-blur-md bg-white/80 border-b sticky top-0">', "nav.html"));
});

test("frosted-glass-nav: an opaque nav and a split-across-elements near-miss stay silent", () => {
  assert.ok(!fires("frosted-glass-nav", '<nav class="bg-white border-b sticky top-0">', "nav.html"));
  assert.ok(!fires("frosted-glass-nav", '<div class="backdrop-blur-md"></div><nav class="bg-white/80 border-b"></nav>', "nav.html"));
});

// Since 2.5.0 the trio fires as the surface's card treatment (three cards, or every card of
// a two-card surface), so the order-free match is asserted across two cards.
test("shadow-border-rounded-combo: Strongest-10 entry 1 fires in either order", () => {
  assert.ok(fires("shadow-border-rounded-combo", '<div class="rounded-xl shadow-sm border p-6">a</div>\n<div class="shadow-sm border rounded-xl p-6">b</div>', "card.html"));
});

test("shadow-border-rounded-combo: two of the three tokens, or a cross-element split, stay silent", () => {
  assert.ok(!fires("shadow-border-rounded-combo", '<div class="rounded-xl border p-6">', "card.html"));
  assert.ok(!fires("shadow-border-rounded-combo", '<div class="rounded-xl"></div><div class="shadow-sm border"></div>', "card.html"));
});

test("icon-in-colored-circle: the catalogue's documented order fires; a plain avatar does not", () => {
  assert.ok(fires("icon-in-colored-circle", '<div class="bg-indigo-100 rounded-full p-3">', "card.html"));
  assert.ok(fires("icon-in-colored-circle", '<div class="rounded-full bg-indigo-100 p-3">', "card.html"));
  assert.ok(!fires("icon-in-colored-circle", '<span class="rounded-full h-8 w-8 bg-slate-200"></span>', "card.html"));
  assert.ok(!fires("icon-in-colored-circle", '<div class="rounded-full p-3"></div><div class="bg-indigo-100"></div>', "card.html"));
});

// ── Emoji ────────────────────────────────────────────────────────────────────

test("emoji: a prose file that DISCUSSES emoji is documenting the tell, not committing it", () => {
  const doc = "The emoji tell: a status shipped as \u{1F680} is a WCAG 1.4.1 problem too.";
  assert.ok(!fires("emoji", doc, "references/writing-patterns.md"));
  assert.ok(fires("emoji", "A status shipped as \u{1F680} is a problem.", "references/other.md"));
});

test("emoji: naming a CSS class or a constant `emoji` does not silence a source file", () => {
  assert.ok(fires("emoji", '<span class="emoji">\u{1F680}</span>', "page.html"));
  assert.ok(fires("emoji", 'const EMOJI_MAP = { rocket: "\u{1F680}" };', "src/icons.ts"));
});

// ── bootstrap-default-blue: the gray leg only counts once the blue is present ──
// The rule reads "two or more of Bootstrap's compiled literals together", and minCount
// counts matches rather than distinct alternatives, so before the requires-blue gate a
// hand-rolled sheet reusing ONE chosen border gray reached the threshold on its own. That
// is a tokenised decision reported as an unthemed framework: the inverse of the claim.

test("bootstrap-default-blue: one chosen border gray used consistently is NOT a finding", () => {
  const twice = ".card { border: 1px solid #dee2e6; }\n.divider { border-top: 1px solid #dee2e6; }\n.brand { color: #7a2e1d; }";
  assert.ok(!fires("bootstrap-default-blue", twice, "site.css"));
  const thrice = ".a { border-color: #dee2e6 }\n.b { border-color: #dee2e6 }\n.c { border-color: #dee2e6 }\n.brand { background: #7a2e1d; color: #f5e9dc }";
  assert.ok(!fires("bootstrap-default-blue", thrice, "site.css"));
});

test("bootstrap-default-blue: the gray still counts alongside the blue it borders", () => {
  const pair = ".card { border: 1px solid #dee2e6; }\na { color: #0d6efd; }";
  assert.ok(fires("bootstrap-default-blue", pair, "site.css"));
});

test("bootstrap-default-blue: the unthemed blue pair still fires on its own", () => {
  const unthemed = ".btn { background: #0d6efd; }\n.btn:hover { background: #0b5ed7; }";
  assert.ok(fires("bootstrap-default-blue", unthemed, "site.css"));
  const repeated = ".btn { background: #0d6efd; }\n.link { color: #0d6efd; }";
  assert.ok(fires("bootstrap-default-blue", repeated, "site.css"));
});

// ── hero-scroll-hint: an accessible name is not hero microcopy ──
// The remediation is "let the layout invite scrolling", i.e. remove the hint. Applied to a
// control's accessible name that would delete screen-reader output, which the remediation
// floor forbids -- so the rule never sees those lines.

test("hero-scroll-hint: an aria-label carrying the phrase is NOT a finding", () => {
  const labelled = '<button aria-label="Scroll to explore the gallery" onClick={next}>Next</button>';
  assert.ok(!fires("hero-scroll-hint", labelled, "Gallery.tsx"));
  assert.ok(!fires("generic-microcopy", labelled, "Gallery.tsx"));
});

test("hero-scroll-hint: an alt text carrying the phrase is NOT a finding", () => {
  assert.ok(!fires("hero-scroll-hint", '<img src="/hint.svg" alt="Scroll to explore the map">', "Hero.tsx"));
});

test("hero-scroll-hint: the visible hero label still fires beside a suppressed line", () => {
  const mixed = '<button aria-label="Scroll to explore the gallery">Next</button>\n<span class="hint">Scroll to explore</span>';
  assert.ok(fires("hero-scroll-hint", mixed, "Hero.tsx"));
});

// ── hardcoded-secret: the key may be the last segment of a snake_case or SCREAMING name ──
// Through 2.2.1 the key needed a \b, and an underscore is a word character, so the
// commonest real-world shapes (`OPENAI_API_KEY`, `client_secret`, Django's `SECRET_KEY`)
// scanned clean while `apiKey` on the next line fired. Both directions, so the widening
// cannot creep: a name that continues past the credential noun is still not a credential.

test("hardcoded-secret: snake_case, SCREAMING_CASE and *_KEY credential names fire", () => {
  assert.ok(fires("hardcoded-secret", 'OPENAI_API_KEY = "sk-proj-9f8e7d6c5b4a3928170615f4e3d2c1b0"', "settings.py"), "OPENAI_API_KEY");
  assert.ok(fires("hardcoded-secret", 'SECRET_KEY = "django-insecure-k3v8x2q9m4n7p1r5t6y0w2z8a4c6e8g0"', "settings.py"), "Django SECRET_KEY");
  assert.ok(fires("hardcoded-secret", 'const client_secret = "9f8e7d6c5b4a39281706f5e4d3c2b1a0";', "src/oauth.ts"), "client_secret");
  assert.ok(fires("hardcoded-secret", 'access_token = "ya29.a0AfH6SMBx1234567890abcdefghijklmnop"', "src/gcal.py"), "access_token");
  assert.ok(fires("hardcoded-secret", 'AWS_SECRET_ACCESS_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"', "deploy.py"), "AWS_SECRET_ACCESS_KEY");
  assert.ok(fires("hardcoded-secret", 'const secretKey = "billing-9f2a7bd4c1e8-restricted-2026";', "src/billing.ts"), "camelCase secretKey");
  assert.ok(fires("hardcoded-secret", 'db_password = "hunter2hunter2hunter22"', "src/db.py"), "db_password");
});

test("hardcoded-secret: a name that continues past the credential noun is not a credential", () => {
  // Every value here is secret-SHAPED on purpose, so only the key logic keeps the line clean.
  for (const [line, why] of [
    ['PASSWORD_MIN_LENGTH = "12chars-minimum-2026"', "a length setting"],
    ['API_KEY_HEADER = "x-api-key-v2-2026"', "a header name"],
    ['TOKEN_ENDPOINT = "v2-token-endpoint-2024"', "an endpoint name"],
    ['ACCESS_KEY_FIELD = "access_key_id_2024_v1"', "a field name"],
    ['MAX_TOKENS = "4096-per-request-2026"', "a plural noun"],
    ['csrf_token_name = "csrftoken-v2-2026-abc"', "a cookie name"],
  ]) {
    assert.ok(!fires("hardcoded-secret", line, "src/config.py"), why);
  }
});

test("hardcoded-secret: a snake_case credential name with a non-secret value stays clean", () => {
  assert.ok(!fires("hardcoded-secret", 'access_token = "REPLACE_ME"', "src/config.py"), "placeholder");
  assert.ok(!fires("hardcoded-secret", 'session_token = "{{ session_token }}"', "src/config.py"), "template");
  assert.ok(!fires("hardcoded-secret", 'SECRET_KEY = os.environ["SECRET_KEY"]', "settings.py"), "env indirection");
  assert.ok(!fires("hardcoded-secret", 'const currentPassword = "a-fresh-strong-passphrase-12345";', "src/form.ts"), "camelCase compound stays unmatched");
});

// ── assistant-boilerplate: the assistant speaking about itself, never a person's idiom ──
// High severity and the sole single-instance prose tell, so a false positive here costs
// more than anywhere else: through 2.2.1 "I can't help but notice" and a document stating
// a model's knowledge cutoff in the third person were reported as leftover boilerplate.

test("assistant-boilerplate: first-person idioms and third-person facts about a model do not fire", () => {
  for (const line of [
    "I can't help but notice the retry never fires.",
    "I cannot help thinking the timeout is wrong.",
    "I can't help it, the old name stuck.",
    "The model's knowledge cutoff is June 2026, so ask it about nothing newer.",
    "As of my last update to this post the migration was still running.",
    "I don't have access to the staging box, so Priya ran it.",
    "I can't provide the raw logs until the incident closes.",
    "We cannot comply with the retention policy until legal signs off.",
  ]) {
    assert.ok(!fires("assistant-boilerplate", line, "notes.md"), line);
  }
});

test("assistant-boilerplate: the assistant's own refusals, cutoff lines and disclaimers still fire", () => {
  for (const line of [
    "As an AI language model, I cannot help with these requests.",
    "I can't help with that request.",
    "I cannot assist with that.",
    "I'm unable to fulfill this request.",
    "As of my last knowledge update, the API had no v2 endpoint.",
    "My knowledge cutoff is April 2024, so I cannot verify this.",
    "I don't have access to real-time data.",
    "I don't have the ability to browse the web.",
    "I don't have personal opinions on this.",
  ]) {
    assert.ok(fires("assistant-boilerplate", line, "notes.md"), line);
  }
});

// ── Comments are not the page (2.5.0) ────────────────────────────────────────
// Design, native and markup-defect rules read comment-blanked text; the escape hatch is
// still read from the raw line, where its marker lives.

test("design rules never match inside a CSS comment", () => {
  const commented = "/* old radii, kept for reference:\n   border-radius: 8px;\n   border-radius: 8px;\n   border-radius: 8px; */\n.a { color: red; }";
  assert.ok(!scanContent(commented, "commented.css").some((v) => v.name === "uniform-literal-radius"));
  const live = ".a { border-radius: 8px; }\n.b { border-radius: 8px; }\n.c { border-radius: 8px; }";
  assert.ok(scanContent(live, "live.css").some((v) => v.name === "uniform-literal-radius"), "the same radii uncommented");
});

test("markup-defect rules never match inside an HTML comment", () => {
  const html = '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>\n<!-- TODO: swap in <img src="hero.png"> once the asset lands -->\n<p>Hi</p>\n</body></html>';
  const got = scanContent(html, "commented.html").map((v) => v.name || v.type);
  assert.ok(!got.includes("missing-alt") && !got.includes("img-no-dimensions"), JSON.stringify(got));
  const live = '<!doctype html><html><body>\n<img src="hero.png">\n</body></html>';
  const twin = scanContent(live, "live.html").map((v) => v.name || v.type);
  assert.ok(twin.includes("missing-alt") && twin.includes("img-no-dimensions"), JSON.stringify(twin));
});

test("a file guard reads blanked text: tokens named only in a comment are not a scale", () => {
  const tsx = "// --space-1: 4px; --space-2: 8px;\nexport const A = () => <div style={{ padding: '13px', margin: '13px' }} />;\n";
  assert.ok(!scanContent(tsx, "A.tsx").some((v) => v.name === "token-drift-spacing"));
});

test("native rules never match inside a Swift comment", () => {
  assert.ok(!scanContent("// let w = UIScreen.main.bounds.width\nlet x = 1\n", "View.swift").some((v) => v.name === "uiscreen-bounds"));
  assert.ok(scanContent("let w = UIScreen.main.bounds.width\n", "View.swift").some((v) => v.name === "uiscreen-bounds"));
});

test("the escape hatch inside a comment still reaches the tell on its line", () => {
  const html = '<h1 class="bg-clip-text text-transparent bg-gradient-to-r from-sky-400 to-cyan-500"><!-- anti-slop-allow: registered wordmark -->Halcyon</h1>';
  assert.deepEqual(scanContent(html, "a.html").filter((v) => v.name === "gradient-text"), []);
  const suppressed = scanContent(html, "a.html", { collectSuppressed: true }).filter((v) => v.suppressed);
  assert.deepEqual(suppressed.map((v) => v.name), ["gradient-text"]);
});

// ── Banned phrases match whole words (2.5.0) ─────────────────────────────────

test("banned phrases: a phrase inside a longer word is not the phrase", () => {
  const phrases = (text) => scanContent(text, "post.md").filter((v) => v.type === "banned-phrase").map((v) => v.phrase);
  assert.deepEqual(phrases("Results come back within today's window."), []);
  assert.deepEqual(phrases("In today's market, prices move."), ["in today's"]);
  assert.deepEqual(phrases("The rule is a beacon of nothing."), ["a beacon of"]);
  assert.deepEqual(phrases("Absolutely! It works."), ["absolutely!"], "a phrase ending in punctuation keeps its leading boundary only");
});

test("banned phrases: plurals still match, as the substring search did", () => {
  const phrases = (text) => scanContent(text, "post.md").filter((v) => v.type === "banned-phrase").map((v) => v.phrase);
  assert.deepEqual(phrases("These game-changers matter."), ["game-changer"]);
  assert.deepEqual(phrases("Two deep dives later."), ["deep dive"]);
  assert.deepEqual(phrases("A deep diver surfaced."), [], "a longer word is still not the phrase");
});

// CSS or markup quoted as text inside <code> or <pre> is an example, not the page.
test("design rules never match CSS quoted in <code> or <pre> on an HTML page", () => {
  const html = '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>\n' +
    "<p>The default looks like <code>background: linear-gradient(135deg, #6366f1, #8b5cf6)</code> with <code>-webkit-background-clip: text</code>.</p>\n" +
    "<pre>.a { border-radius: 8px; }\n.b { border-radius: 8px; }\n.c { border-radius: 8px; }</pre>\n</body></html>";
  assert.deepEqual(scanContent(html, "css-in-prose.html").filter((v) => v.type === "design-tell"), []);
  const live = "<style>.a { border-radius: 8px; } .b { border-radius: 8px; } .c { border-radius: 8px; } h1 { -webkit-background-clip: text; }</style>";
  const twin = scanContent(live, "live.html").map((v) => v.name);
  assert.ok(twin.includes("uniform-literal-radius") && twin.includes("gradient-text"), JSON.stringify(twin));
});

// ── Narrowings found on real files (2.5.0) ───────────────────────────────────
// Each exemption beside the twin it must not swallow.

const ruleHits = (rule, content, path) => scanContent(content, path).filter((v) => v.name === rule);

test("tight-leading: a close or dismiss control keeps its one-line leading; a body block does not", () => {
  assert.deepEqual(ruleHits("tight-leading", ".tab-close { font-size: 14px; line-height: 1 }", "a.css"), []);
  assert.equal(ruleHits("tight-leading", ".tab-body { font-size: 14px; line-height: 1 }", "a.css").length, 1);
});

test("the file's markup tells a class or attribute selector which element it styles", () => {
  const dismiss = (el) => `<style>[data-dismiss] { font-size: 14px; line-height: 1 }</style>${el}`;
  assert.deepEqual(ruleHits("tight-leading", dismiss('<button data-dismiss type="button">Close</button>'), "a.html"), [], "a button");
  assert.equal(ruleHits("tight-leading", dismiss("<p data-dismiss>The ferry leaves at eleven and reaches the island a little after midnight, every night of the week.</p>"), "a.html").length, 1);
  const stripe = (el) => `<style>.history-item { border-left: 3px solid #0f766e; border-radius: 10px }</style>${el}`;
  assert.deepEqual(ruleHits("side-stripe-accent", stripe('<ul><li class="history-item">x</li></ul>'), "a.html"), [], "list items");
  assert.equal(ruleHits("side-stripe-accent", stripe('<div class="history-item">x</div>'), "a.html").length, 1, "the same class on a div");
});

test("side-stripe-accent: an invalid field's edge is state, and a control is a control", () => {
  assert.deepEqual(ruleHits("side-stripe-accent", '.field[aria-invalid="true"] { border-left: 3px solid #b91c1c }', "a.css"), []);
  assert.deepEqual(ruleHits("side-stripe-accent", ".input { border-left: 3px solid #b91c1c }", "a.css"), []);
  assert.equal(ruleHits("side-stripe-accent", ".note { border-left: 3px solid #b91c1c }", "a.css").length, 1);
  assert.equal(ruleHits("side-stripe-accent", ".inset { border-left: 3px solid #b91c1c }", "a.css").length, 1, "a word that only starts like input");
});

test("text-size-floor: a utility class name is a style, not running text", () => {
  assert.deepEqual(ruleHits("text-size-floor", ".text-xs { font-size: 11px }", "a.css"), []);
  assert.equal(ruleHits("text-size-floor", ".body-text { font-size: 11px }", "a.css").length, 1);
});

// A device-code readout from a real page: a furniture word in the selector outranks the
// element the markup names, and a tabular or select-all block is a readout, not running text.
test("wide-tracking: a code readout is a label, and running text tracked the same still fires", () => {
  const readout = ".code { font-family: var(--display); font-size: var(--t-code); font-weight: 600; letter-spacing: 0.22em; padding-inline-end: 0.22em; font-variant-numeric: tabular-nums lining-nums; line-height: 1.2; color: var(--ink); -webkit-user-select: all; user-select: all; word-break: break-word; }";
  assert.deepEqual(ruleHits("wide-tracking", readout, "login.css"), []);
  assert.deepEqual(ruleHits("wide-tracking", `<style>${readout}</style><p class="code">The code below signs this device in for the next hour of use.</p>`, "login.html"), [],
    "the class word wins over the markup-derived subject");
  assert.equal(ruleHits("wide-tracking", ".intro p { letter-spacing: 0.2em }", "a.css").length, 1, "the twin");
  assert.deepEqual(ruleHits("wide-tracking", ".digits { letter-spacing: 0.2em; font-variant-numeric: tabular-nums }", "a.css"), [], "a tabular readout");
  assert.deepEqual(ruleHits("wide-tracking", ".token { letter-spacing: 0.2em; user-select: all }", "a.css"), [], "text set to copy whole");
  assert.equal(ruleHits("wide-tracking", ".digits { letter-spacing: 0.2em }", "a.css").length, 1, "the same selector with no readout declaration");
  assert.deepEqual(ruleHits("tight-leading", ".total { font-size: 16px; line-height: 1.1; font-variant-numeric: tabular-nums }", "a.css"), [], "a readout keeps its leading too");
});
