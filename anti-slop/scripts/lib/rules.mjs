// ── Confidence classes ──
// How sure the scanner is that a match is WRONG HERE, which is a different axis from
// how much it would cost if it is (that is `severity`). The two never collapse: a
// hardcoded-credential match is severity "high" and confidence "Pattern smell", because
// a regex cannot prove the string is a live secret; an em-dash cluster is severity "low"
// and still only a smell.
//
// The doctrinal definitions live in ONE place -- skills/anti-slop/references/
// confidence-and-evidence.md. This object is the machine mirror of that file, and
// test/rule-metadata.test.mjs asserts the two carry the same four classes, so the mirror
// cannot drift from the doctrine without failing the suite.
export const CONFIDENCE = Object.freeze({
  HARD: "Hard defect",
  QUALITY: "Quality defect",
  SMELL: "Pattern smell",
  TASTE: "Taste note",
});
export const CONFIDENCE_CLASSES = Object.freeze(Object.values(CONFIDENCE));

// Confidence for the rule families that are not table-driven (they are inlined in
// scan.mjs rather than living in a pattern array).
export const BANNED_WORD_CONFIDENCE = CONFIDENCE.SMELL;
export const BANNED_PHRASE_CONFIDENCE = CONFIDENCE.SMELL;
export const EMDASH_CONFIDENCE = CONFIDENCE.SMELL;
export const EMOJI_CONFIDENCE = CONFIDENCE.QUALITY;

// ── The remediation floor ──
// confidence-and-evidence.md § The remediation floor: "Every finding names its remediation.
// A finding that only names the offence is incomplete, and an incomplete finding gets closed
// by deletion." Every table rule carries a `fix`, and the four families inlined in scan.mjs
// carry theirs here, beside their confidence, for the same reason: a reader who is told only
// what is wrong deletes the line, and deleting the line is how responsive, accessible and
// motion-preference behaviour has been lost twice in this project's history. A fix names what
// to write INSTEAD, in one sentence, and never proposes removing behaviour.
export const BANNED_WORD_FIX =
  "Say the plain thing; a lone hit is the writer's prose and only a cluster is the tell";
export const BANNED_PHRASE_FIX =
  "Delete the phrase or state the point it was standing in for";
export const EMDASH_FIX =
  "Replace the surplus dashes with commas, periods, or parentheses; do not swap every dash for a colon";
export const EMOJI_FIX =
  "Use words for status and an icon component with an accessible name for UI; keep emoji only where the user or the project convention uses them";

// ── Firing modes ──
// "presence": one occurrence is the finding. Reserved for specific, high-signal
//   compositions that read as generated on sight (a verbatim default string, a named
//   component fingerprint).
// "concentration": the finding is the DENSITY, not the instance. Carries `minCount`;
//   below it the rule stays silent. A regex engine fires on presence by default, so any
//   tell whose real signal is repetition needs this or it reports every file that ever
//   used the technique once.
// The floor rule behind it: a lone utility-class hit is not a finding.
export const PRESENCE = "presence";
export const CONCENTRATION = "concentration";

// ── File-scope guards (optional on any table rule) ──
// `suppress` answers "is THIS LINE a correct use?". Some tells can only be judged against
// the whole file: the progressive-enhancement pair `height: 100vh; height: 100dvh;` writes
// its fallback on the NEXT line, and a document that DISCUSSES a tell is not committing it.
// Two additive fields cover both directions, evaluated once per file before the line loop:
//   requires / requiresMinCount -- the file must contain the pattern at least N times
//                                  (default 1) before the rule is allowed to fire
//   unless                      -- the file matching it silences the rule entirely
// A rule that declares neither behaves exactly as before.

// ── Off-scale spacing (the `count` predicate for token-drift-spacing) ──
// Some tells need arithmetic a regex cannot state. "Off the 4px grid" is one: 13px is
// drift and 16px is not, and encoding "divisible by four" as an alternation of two-digit
// endings is write-only. A rule may therefore carry `count(line) -> number` instead of a
// `pattern`, and the scanner calls it once per line exactly where it would have counted
// regex matches. 1px and 2px are on-scale by construction: hairline borders and 2px
// offsets are not spacing decisions.
const SPACING_DECLARATION =
  /\b(?:padding|margin|gap|row-gap|column-gap|inset)(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?\s*:\s*([^;{}]*)/gi;

export function countOffScaleSpacing(line) {
  const declarations = new RegExp(SPACING_DECLARATION.source, SPACING_DECLARATION.flags);
  let hits = 0;
  let declaration;
  while ((declaration = declarations.exec(line)) !== null) {
    const value = declaration[1];
    // A value routed through the design system -- var(--space-3), clamp(), calc() on a
    // token -- is the correct idiom and is what the rule wants people to write.
    if (/var\(|clamp\(|calc\(/i.test(value)) continue;
    for (const px of value.matchAll(/(\d+(?:\.\d+)?)px/g)) {
      const n = Number(px[1]);
      if (n > 2 && n % 4 !== 0) hits += 1;
    }
  }
  return hits;
}

// ── Emoji ──
// Unicode's definition, not a block list: a character with default emoji presentation, a
// pictograph forced to emoji presentation by U+FE0F, a keycap sequence, or a flag; an
// attached skin-tone modifier rides along so a toned hand counts once. From 2.1.0 to 2.3.0
// this matched whole blocks (Arrows, Miscellaneous Technical, Geometric Shapes) after a
// pause/play toggle shipped as a text glyph, and on one fleet that flagged 232 code files
// in two weeks, 187 of them for a plain right arrow. The bare media-control glyph used as
// a control is now the `media-control-glyph` design/native tell. Shared by EMOJI_REGEX and
// the console-log-emoji code rule so the two can never drift; both need the `u` flag, and
// as an atom rather than a character class it composes with `(?:...)`, never `[...]`.
// A ZWJ sequence (a family, a technologist, a rainbow flag) is one emoji: the tail consumes
// each U+200D join and the pictograph after it, so the count and the severity escalation
// see one glyph rather than two or three.
const EMOJI_ATOM =
  "(?:(?:\\p{Regional_Indicator}{2}|[0-9#*]\\uFE0F?\\u20E3|\\p{Extended_Pictographic}\\uFE0F|\\p{Emoji_Presentation})\\p{Emoji_Modifier}?)" +
  "(?:\\u200D(?:\\p{Extended_Pictographic}\\uFE0F?|\\p{Emoji_Presentation})\\p{Emoji_Modifier}?)*";

// ── Banned Words (top 50 highest-signal, prose-only) ──
export const BANNED_WORDS = [
  "delve", "delving", "leverage", "leveraging", "utilize", "utilizing",
  "harness", "harnessing", "streamline", "foster", "fostering",
  "cultivate", "elevate", "empower", "empowering", "embark",
  "unveil", "unveiling", "showcase", "showcasing", "spearhead",
  "orchestrate", "synergize", "galvanize", "transcend",
  "pivotal", "seamless", "cutting-edge", "groundbreaking",
  "transformative", "unprecedented", "unparalleled", "multifaceted",
  "vibrant", "bustling", "captivating", "enchanting",
  "landscape", "tapestry", "realm", "synergy", "testament",
  "interplay", "paradigm", "intersection",
  "gossamer", "iridescent", "luminous", "ephemeral", "ethereal", "enigmatic",
  // Inflated/low-confidence words: kept in the list but flagged only on clustering
  // (count >= 2) at low severity, via LOW_CONFIDENCE_WORDS below.
  "comprehensive", "robust", "navigate", "nuanced", "meticulous", "facilitate",
  "holistic", "myriad", "plethora", "paramount", "intricate", "profound",
];

// ── Precompiled per-word regexes (word boundary, case-insensitive, global). Built once at
// module load instead of per-scan; String.prototype.match() with the g flag resets lastIndex
// on every call, so a single shared RegExp per word is safe to reuse across scans. ──
export const BANNED_WORD_REGEXES = new Map(
  BANNED_WORDS.map((word) => [word, new RegExp(`\\b${word}\\b`, "gi")]),
);

// ── Low-confidence words: high keyword-match but rarely cited as a real tell ──
// (Reddit corpus, see references/empirical-rankings.md). Flagged only when they
// CLUSTER (count >= 2), at "low" severity. A lone hit is treated as clean.
export const LOW_CONFIDENCE_WORDS = new Set([
  "utilize", "utilizing", "comprehensive", "robust", "navigate", "nuanced",
  "meticulous", "harness", "harnessing", "seamless", "foster", "fostering",
  "facilitate", "streamline", "leverage", "leveraging", "realm", "holistic",
  "myriad", "plethora", "paramount", "intricate", "vibrant", "captivating",
  "profound", "empower", "empowering", "cultivate",
]);

// ── Escape hatch: a line carrying this marker is a deliberate choice; skip it. ──
export const ESCAPE_HATCH = /(?:anti-slop-allow|unslop-ignore)\b/i;

// ── Em dash density (prose): the #1 cited writing tell. Flag on concentration, ──
// not a single legitimate dash. Counts only after prose noise-stripping.
export const EMDASH_MIN_COUNT = 5;     // ignore a handful of legitimate dashes
export const EMDASH_MIN_DENSITY = 4;   // per 1000 words before it counts

// ── Banned Phrases (top 40 highest-signal) ──
export const BANNED_PHRASES = [
  "great question", "that's a great question", "absolutely!",
  "certainly!", "you're absolutely right", "i'd be happy to help", "i'd be happy to assist",
  "hope this helps", "feel free to", "let me know if you have",
  "does that make sense", "here's the thing", "let me walk you through",
  "let me break this down", "let's dive in", "let's unpack this",
  "it's worth noting", "it's important to note", "at the end of the day",
  "in today's", "in a world where", "at its core",
  "in conclusion", "to sum up", "in summary",
  "game-changer", "paradigm shift", "deep dive",
  "the implications are significant", "the stakes are high",
  "embark on a journey", "navigate the complexities",
  "pave the way", "watershed moment", "a beacon of",
  "a tapestry of", "a testament to", "ever-evolving",
  "key takeaways", "without further ado",
];

// ── A text glyph standing in for a control (design + native) ──
// The 2.1.0 incident: a pause/play toggle shipped as the bare text glyph. The emoji rule
// follows Unicode (2.3.1), so a bare play or pause sign is typography to it, and the
// incident gets its own tell on UI surfaces. Text-presentation glyphs only: the default
// emoji among the transport symbols (fast forward, rewind, alarm clock, hourglass) stay
// with the emoji rule, and a glyph followed by U+FE0F is an emoji too.
const MEDIA_CONTROL_GLYPH = {
  name: "media-control-glyph", severity: "low", confidence: CONFIDENCE.SMELL, mode: PRESENCE,
  pattern: /[\u{23CF}\u{23ED}-\u{23EF}\u{23F8}-\u{23FA}\u{25B6}\u{25C0}](?!️)/gu,
  fix: "Use an icon component from the project's set with an accessible name, or a word: a labelled status reads better than a bare glyph.", desc: "Media-control text glyph used as a control (an icon belongs here)",
};

// ── UI Design Patterns (WEB surfaces only -- see WEB_SURFACE_EXTENSIONS) ──
// Ordered roughly by empirical signal where a corpus ranking exists. Severity reflects that
// ranking: shadcn-default / purple / gradients are the strongest; the rest are lighter.
// Rules whose own comment marks them heuristic are grouped with their nearest analogue and
// are NOT ranked -- position claims nothing about their signal.
//
// Every rule declares:
//   severity    -- what it costs if real (may be a function of the match count)
//   confidence  -- how sure we are it is wrong HERE (the four-class enum above)
//   mode        -- PRESENCE (one hit is the finding) or CONCENTRATION (+ minCount)
//   fix         -- one sentence naming what to write INSTEAD (the remediation floor)
//   suppress    -- optional per-line guard: a line matching it is a correct use
//
// A tell with no remediation is a tell that gets "fixed" by deletion, so every rule here
// carries its `fix` and the long form is in skills/anti-slop/references/design-patterns.md.
// The scanner prints the fix with the finding: before it did, a reader had the offence and
// nothing else, which is the shortest path to a deletion. Where the cheapest way to clear a
// match is to remove responsive, accessible, or motion-preference behaviour, the match is
// too wide -- narrow it instead (see `tailwind-hero-triplet` and the `important-overuse`
// suppress guard, both of which exist for exactly that reason), and no `fix` may propose it.
export const DESIGN_PATTERNS = [
  MEDIA_CONTROL_GLYPH,
  { name: "purple-gradient-default", severity: "medium", confidence: CONFIDENCE.SMELL, mode: PRESENCE, pattern: /from-(indigo|purple|violet)-[45]00\s.*to-(indigo|purple|violet)-[56]00/i, fix: "Pick the ramp from the project's own palette, or use one flat surface colour; a restaurant site does not need tech-purple.", desc: "Purple/indigo gradient (Tailwind AI default)" },
  { name: "purple-blue-gradient", severity: "medium", confidence: CONFIDENCE.SMELL, mode: PRESENCE, pattern: /from-(purple|violet|indigo|fuchsia)-\d+\s+(via-[a-z]+-\d+\s+)?to-(blue|indigo|pink|cyan|sky)-\d+|linear-gradient\([^)]*#(6366f1|7c3aed|8b5cf6|a855f7)[^)]*\)/i, fix: "Choose the gradient from the brand's palette, or carry the section with one flat accent instead of the ramp nobody chose.", desc: "Purple-to-blue/pink gradient" },
  // Hex and utility-class purple are property-level: the tell is "indigo IS the palette",
  // which one stray declaration does not establish.
  { name: "ai-purple-hex", severity: "low", confidence: CONFIDENCE.SMELL, mode: CONCENTRATION, minCount: 2, pattern: /#(6366f1|4f46e5|818cf8|7c3aed|6d28d9|8b5cf6|a855f7|9333ea|7e22ce|c026d3|d946ef)\b/i, fix: "Replace the indigo/violet hexes with the project's brand tokens, chosen for what the product is rather than the framework default.", desc: "AI purple (indigo/violet hex as brand color)" },
  { name: "ai-purple-class", severity: "medium", confidence: CONFIDENCE.SMELL, mode: CONCENTRATION, minCount: 2, pattern: /\b(bg|text|from|via|to|border|ring|fill|stroke|decoration|outline)-(indigo|violet|purple|fuchsia)-(400|500|600|700|800)\b/i, fix: "Name the primary in the project's own palette and use its token class; indigo-500 is the colour nobody chose.", desc: "AI purple as primary (Tailwind indigo/violet/purple class)" },
  // Same "unchosen palette" logic, different framework: these three hexes are Bootstrap 5's
  // COMPILED literals ($primary #0d6efd, its hover darken #0b5ed7, $gray-300 border
  // #dee2e6). They reach shipped CSS only by leaving Bootstrap unthemed, and two of them
  // together is a framework default wearing a product's clothes. Adapted from VibeCurb
  // (github.com/Yu-369/VibeCurb, MIT) and graded to this repo's classes: heuristic
  // provenance, not corpus-ranked, hence smell + concentration.
  // `requires` is what makes "two together" true. minCount counts MATCHES, not distinct
  // alternatives, so without the gate one chosen border gray reused across a sheet -- a
  // tokenised decision, the inverse of the tell -- reached the threshold by itself. The
  // blue is the leg only an unthemed build emits, so it has to be in the file before the
  // gray counts for anything. The recall cost is deliberate and stated in the 2.2.1
  // changelog: a file that themed the blue and kept #dee2e6 is now invisible, which is the
  // right trade for a lone borrowed gray sitting below the signal floor.
  { name: "bootstrap-default-blue", severity: "low", confidence: CONFIDENCE.SMELL, mode: CONCENTRATION, minCount: 2, requires: /#(0d6efd|0b5ed7)\b/i, pattern: /#(0d6efd|0b5ed7|dee2e6)\b/i, fix: "Theme the framework: set $primary, the border colour and the radius and shadow scales to project values, or adopt the project's own tokens.", desc: "Unthemed Bootstrap compiled defaults (primary blue / gray-300 border)" },
  { name: "gradient-text", severity: "medium", confidence: CONFIDENCE.SMELL, mode: PRESENCE, pattern: /bg-clip-text\s[^"]*text-transparent|text-transparent\s[^"]*bg-clip-text|-webkit-background-clip\s*:\s*text|\bbackground-clip\s*:\s*text/i, fix: "Carry the headline with size, weight, or one flat accent colour on a single word, and let the typography itself be the design.", desc: "Gradient text on heading (strong AI tell)" },
  // design-patterns.md has always said "the signal is the combination -- any two of
  // {cream background, serif display, sage green}. One alone may be a real decision."
  // minCount 2 is that sentence, enforced: a lone Fraunces heading is a choice.
  // The accent leg is the rusty-orange/terracotta one, not sage. Two independent 2026
  // sources and this repo's own 2026-07 spot-check record the drift, and the rule carried
  // no accent leg at all in either colour. Red is deliberately excluded: it would collide
  // with every error state on the web. The 200-level band is excluded for the same reason
  // one amber warning banner is not a palette.
  { name: "cream-serif-default", severity: "low", confidence: CONFIDENCE.SMELL, mode: CONCENTRATION, minCount: 2, pattern: /#(faf8f5|f5f1e8|f3eee3|fdfbf7|f7f3ec|faf6ef|f6f1e7|fbf7f0|f4efe4)\b|\bbg-(stone|amber|orange)-(50|100)\b|\b(Instrument\s*Serif|Fraunces|Playfair\s*Display|Cormorant|Spectral|DM\s*Serif)\b|\b(text|bg|border|ring|decoration)-(orange|amber)-(600|700|800)\b|#(b7410e|c2410c|9a3412|a0522d)\b/i, fix: "Anchor colour and type to the real brand or a named reference; where the combination is a stated decision, mark the line anti-slop-allow with the reason.", desc: "Cream/serif 'tasteful default' (the 2026 tell -- two or more legs of the combination)" },
  { name: "shadcn-default-card", severity: "low", confidence: CONFIDENCE.SMELL, mode: PRESENCE, pattern: /rounded-lg\s+border\s+bg-card\s+text-card-foreground\s+shadow-sm|"baseColor"\s*:\s*"(slate|zinc|gray|neutral|stone)"|--radius\s*:\s*0\.5rem/i, fix: "Theme the kit: set the border colour, radius, shadow and transition to project values so the surface stops looking like the library's own docs.", desc: "shadcn/ui card classes left at the library default (unthemed kit)" },
  // The next three are class-attribute FINGERPRINTS, and utility-class order inside a
  // `class=` attribute is arbitrary. Encoded as ordered `A\s[^"]*B\s[^"]*C` sequences they
  // were silent on the exact strings design-patterns.md documents -- including Strongest-10
  // entry 1 -- and fired only on the order some fixture happened to use. `classAll` matches
  // the token SET within one attribute value instead, which is order-free and still
  // attribute-scoped, so it can never span two sibling elements.
  { name: "icon-in-colored-circle", severity: "medium", confidence: CONFIDENCE.SMELL, mode: PRESENCE, classAll: ["rounded-full", /^bg-[a-z]+-100$/, "p-3"], fix: "Drop the decorative circle where the icon reads on its own, or vary the treatment per card; the icon should explain the feature, not decorate it.", desc: "Icon in colored circle background" },
  { name: "frosted-glass-nav", severity: "medium", confidence: CONFIDENCE.SMELL, mode: PRESENCE, classAll: [/^backdrop-blur(-[a-z0-9]+)?$/, /^bg-white\/\d+$/, "border-b"], fix: "Vary the nav height and keep the blur only where the layered transparency serves the hierarchy; a solid bar or a sidebar is often the better nav.", desc: "Frosted glass navigation bar" },
  { name: "shadow-border-rounded-combo", severity: "medium", confidence: CONFIDENCE.SMELL, mode: PRESENCE, classAll: ["shadow-sm", /^border(-[a-z]+-\d+)?$/, "rounded-xl"], fix: "Theme the card: set the border colour, radius and shadow to project tokens instead of shipping the library's default trio on every surface.", desc: "shadow-sm + border + rounded-xl AI card combo" },
  { name: "neon-glow", severity: "low", confidence: CONFIDENCE.SMELL, mode: PRESENCE, pattern: /shadow-\[0_0_|drop-shadow-\[0_0_|box-shadow\s*:[^;]*\b0\s+0\s+\d{2,}px/i, fix: "Carry elevation the way the platform does, with a lighter surface and a real shadow scale: `background: var(--surface-2)` plus a 1px shadow.", desc: "Unprompted neon glow (dark-mode tell)" },
  // "Maximal rounding on EVERYTHING": the tell is the uniform treatment across a surface,
  // not any single rounded corner. Below three the floor rule applies -- a lone
  // `rounded-full` on an icon wrapper is not "the same radius on every control".
  { name: "rounded-everything", severity: "low", confidence: CONFIDENCE.QUALITY, mode: CONCENTRATION, minCount: 3, pattern: /\brounded-(2xl|3xl|full)\b|border-radius\s*:\s*(999\d*px|9999px)/i, suppress: /\b[hw]-(\d|10|11|12|14|16)(\.5)?\b/i, fix: "State the radius as a token (`--radius: 8px`) and reference it, or vary it deliberately by control class; never remove the rounding.", desc: "Maximal rounding on every control (uncommitted radius)" },
  // The family list is the one two independent 2026 sources converge on, MINUS Poppins:
  // the evidence for Poppins is a single self-published page calling it "overused", and
  // omitting it costs the rule nothing. `font-family: 'Inter Tight'` matches on \bInter\b
  // -- same family, accepted. Only the `font-family:` declaration and the next/font
  // constructor call are matched, so the word "Outfit" in body copy stays clean.
  { name: "generic-font", severity: "low", confidence: CONFIDENCE.SMELL, mode: PRESENCE, pattern: /font-family\s*:\s*['"]?(Inter|Geist|Roboto|Space\s*Grotesk|Manrope|Plus\s*Jakarta\s*Sans|Outfit|DM\s*Sans)\b|\b(Inter|Geist|Geist_Mono|Roboto|Space_Grotesk|Manrope|Plus_Jakarta_Sans|Outfit|DM_Sans)\s*\(/i, fix: "Choose a face with a source: the brand's own, or a display-plus-body pairing, and state the reason for it.", desc: "Generic default font (Inter/Geist/Roboto and the 2026 successors)" },
  { name: "hype-copy", severity: "low", confidence: CONFIDENCE.QUALITY, mode: PRESENCE, pattern: /\bTransform your\b|\bSupercharge\b|\bUnleash\b|\bEffortlessly\b|take your [^.]{0,30}to the next level/i, fix: "Say what the control does: `Connect your GitHub account`, not `Seamlessly integrate with GitHub`.", desc: "Marketing hype copy in UI" },
  { name: "stock-illustration", severity: "low", confidence: CONFIDENCE.SMELL, mode: PRESENCE, pattern: /\b(undraw|storyset|drawkit)\b/i, fix: "Replace the illustration with the thing it stands in for: a screenshot of the real screen, or a diagram drawn for this system.", desc: "Generic stock illustration (undraw/storyset)" },
  // The JS style-object form (`zIndex: 9999`) is the dominant one on .jsx/.tsx, which are
  // web surfaces this rule already runs on -- the CSS-only pattern could not see it.
  { name: "z-index-escalation", severity: "medium", confidence: CONFIDENCE.QUALITY, mode: PRESENCE, pattern: /z-(?:index:\s*|\[)(?:999|9999|99999)|\bzIndex\s*:\s*['"]?(?:999|9999|99999)\b/i, fix: "Use a named scale (`--z-dropdown: 100`, `--z-modal: 200`), or move the element in the tree so it stacks without a magic number.", desc: "z-index escalation (999+)" },
  // The rule is named *overuse*. One pragmatic override against a third-party widget is
  // not it, and `* { transition: none !important }` inside a prefers-reduced-motion block
  // is the canonical WCAG 2.3.3 implementation -- flagging it invites a "fix" that deletes
  // motion-preference handling, which is the failure mode this whole release exists to stop.
  { name: "important-overuse", severity: (c) => (c > 3 ? "high" : "medium"), confidence: CONFIDENCE.QUALITY, mode: CONCENTRATION, minCount: 2, pattern: /!important/gi, suppress: /(transition|animation|scroll-behavior)\s*:\s*[^;]*!important|prefers-reduced-motion/i, fix: "Fix the specificity chain instead; leave `!important` on reduced-motion, transition and scroll-behavior lines, which is the correct WCAG idiom.", desc: "!important overuse (specificity not fixed)" },
  // Item 1. NOT a rule against responsive typography: it matches only the verbatim
  // unmodified Tailwind hero run, which is a genericness fingerprint. A scale on other
  // steps, a tuned tracking, or a fluid clamp() ramp is a different string and stays clean.
  // The remediation is a fluid ramp, never a fixed size (design-patterns.md).
  { name: "tailwind-hero-triplet", severity: "low", confidence: CONFIDENCE.SMELL, mode: PRESENCE, pattern: /\btext-4xl\s+sm:text-5xl\s+lg:text-6xl\s+font-bold\s+tracking-tight\b/, fix: "Use a fluid ramp: `font-size: clamp(2rem, 1.2rem + 3.2vw, 4.5rem)` with a tuned tracking; never a single fixed size", desc: "Verbatim Tailwind default hero type run (genericness signal, not a responsive-type finding)" },

  // ── Fixed geometry: the web mirror of the native fixed-frame family ──
  // Each answers a question about available space with a number, so the layout survives
  // exactly the window it was authored against. Every remediation ADDS adaptive behaviour
  // (min(), auto-fit, dvh) and removes none, which is the test any geometry rule has to
  // pass before it ships. Remediations: references/design-patterns.md § Fixed Geometry.
  //
  // The lookbehind is the whole precision story for the shell rule: `max-width: 1200px`
  // is the CORRECT idiom (a cap, not a floor) and must never match. >= 600px means a
  // content shell rather than a control, mirroring the native rule's >= 100pt threshold.
  { name: "fixed-page-shell", severity: "medium", confidence: CONFIDENCE.QUALITY, mode: PRESENCE, pattern: /(?<![\w-])(?:width|min-width)\s*:\s*(?:[6-9]\d{2}|\d{4,})px/gi, suppress: /@media|@container/i, fix: "Give the container a maximum and no floor: `width: min(100%, 75rem); margin-inline: auto`.", desc: "Fixed-pixel page shell (survives one window width)" },
  { name: "fixed-grid-tracks", severity: "medium", confidence: CONFIDENCE.QUALITY, mode: PRESENCE, pattern: /grid-template-(?:columns|rows)\s*:[^;{}]*\brepeat\(\s*\d+\s*,\s*\d*\.?\d+px\s*\)/gi, fix: "Let the track list respond: `grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr))` gains columns with no breakpoint.", desc: "Fixed grid track list (gains no columns as the window grows)" },
  // File-scoped, not line-scoped: the progressive-enhancement idiom writes its fallback on
  // the NEXT line (`height: 100vh; height: 100dvh;`), which a per-line suppress cannot see.
  { name: "vh-viewport-shell", severity: "low", confidence: CONFIDENCE.QUALITY, mode: PRESENCE, pattern: /\b(?:height|min-height)\s*:\s*100vh\b/gi, unless: /100dvh|100svh/i, fix: "Use `100dvh` (or `100svh`), and pad the last row with `max(0.75rem, env(safe-area-inset-bottom))`.", desc: "100vh app shell (the mobile URL bar clips the last row)" },
  // Only fires where there IS a scale to drift from. Ungated, an off-4px-grid rule fires
  // 20-25 times on every clean control in the corpus; gated on the file declaring two or
  // more --space tokens it fires on exactly one file. There is no drift without a scale.
  { name: "token-drift-spacing", severity: "low", confidence: CONFIDENCE.QUALITY, mode: CONCENTRATION, minCount: 2, requires: /--space[-_a-z0-9]*\s*:/i, requiresMinCount: 2, count: countOffScaleSpacing, fix: "Use the nearest existing --space token, or add and name a token where the value is genuinely new; never delete the spacing.", desc: "Raw spacing values bypassing the file's own --space token scale" },
  // Complements rounded-everything (Tailwind classes and 999px pills) rather than
  // overlapping it: this one is about literal `border-radius` values in a file that names
  // no radius identity to vary from. A file that defines --radius is silenced outright --
  // one clean control carries five literal radii and is protected by that guard alone.
  { name: "uniform-literal-radius", severity: "low", confidence: CONFIDENCE.QUALITY, mode: CONCENTRATION, minCount: 3, unless: /border-radius\s*:\s*var\(|--radius[-_a-z0-9]*\s*:/i, pattern: /border-radius\s*:\s*\d+(?:\.\d+)?(?:px|rem)\b/gi, fix: "State a radius identity (`--radius`) and reference it, or vary the radius deliberately by control class.", desc: "Repeated literal radius with no stated radius identity (uncommitted default)" },

  // ── Controls and accessibility ──
  // A visible affordance that does not act is wrong on any reading, which is why this is a
  // Hard defect and not a taste call. The handler name list is explicit rather than
  // `on[a-zA-Z]+` so that an ordinary `only = ""` cannot match. A handler with a real body
  // and a comment explaining a deliberate no-op has content after the comment and stays clean.
  { name: "dead-control", severity: "medium", confidence: CONFIDENCE.HARD, mode: PRESENCE, pattern: /\bon(?:click|dblclick|change|input|submit|reset|focus|blur|key(?:down|up|press)|mouse(?:down|up|over|out|enter|leave|move)|touch(?:start|end|move)|pointer(?:down|up)|drag(?:start|end)?|drop|scroll|toggle|select|wheel|contextmenu|copy|paste|cut)\s*=\s*(?:"(?:\s|\/\*[^*]*(?:\*(?!\/)[^*]*)*\*\/|\/\/[^"]*)*"|'(?:\s|\/\*[^*]*(?:\*(?!\/)[^*]*)*\*\/)*'|\{\s*\(\s*\)\s*=>\s*(?:null|undefined|void 0|\{\s*(?:\/\/[^\n}]*|\/\*[^*]*(?:\*(?!\/)[^*]*)*\*\/)?\s*\})\s*\})/gi, fix: "Wire the handler, or remove the control until it works; a real body with a comment saying why it is inert is a decision and stays clean.", desc: "Control with an empty or comment-only handler (renders, does nothing)" },
  // Both rules below are file-scoped or value-scoped so their remediation can only ADD
  // accessible behaviour. Replace the ring, never remove it (WCAG 2.4.7); write what the
  // image conveys. `alt=""` on a decorative image is correct and deliberately unmatched.
  { name: "outline-none", severity: "medium", confidence: CONFIDENCE.QUALITY, mode: PRESENCE, pattern: /\boutline\s*:\s*(?:none|0)\b/gi, unless: /:focus-visible|focus-visible:/, fix: "Replace the ring, never remove it: `:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px }`", desc: "outline: none in a file that defines no :focus-visible ring" },
  { name: "missing-alt", severity: "medium", confidence: CONFIDENCE.HARD, mode: PRESENCE, pattern: /<img\s(?![^>]*\balt\s*=)[^>]*>|\balt\s*=\s*["'](?:image|photo|picture|icon|graphic|img)["']/gi, fix: "Write what the image conveys where it sits; `alt=\"\"` is correct for a decorative image, and deleting the element never is.", desc: "<img> with no alt, or a placeholder alt value" },
  // A Hard defect because it is one: WCAG 1.4.4 requires text to scale to 200%, and a
  // viewport that blocks pinch zoom removes the only control a low-vision user has on a
  // phone. The remediation only ever DELETES the two attributes -- the viewport meta a
  // responsive page needs is `width=device-width, initial-scale=1` and nothing else -- so
  // there is no reading of this rule under which clearing it costs adaptive behaviour.
  // `maximum-scale=1` is matched exactly (1, 1.0, 1.00): a cap of 5 still leaves the user
  // a usable range and stays clean, which is why the lookahead refuses a further digit.
  { name: "viewport-zoom-lock", severity: "medium", confidence: CONFIDENCE.HARD, mode: PRESENCE, pattern: /\bviewport\b[^\n]*?(?:user-scalable\s*=\s*(?:no|0)\b|maximum-scale\s*=\s*1(?:\.0+)?(?![\d.]))/gi, fix: "Delete user-scalable and maximum-scale; `width=device-width, initial-scale=1` is the whole viewport meta", desc: "Viewport meta blocks pinch zoom (user-scalable=no / maximum-scale=1); fails WCAG 1.4.4" },
  // A Quality defect rather than Hard: a positive tabindex is reachable, so nothing is
  // unreachable by keyboard, but it jumps the whole document ahead of every natural stop
  // and the order it produces is invisible to the author who wrote it. `0` (join the
  // natural order) and `-1` (focusable by script only) are the two correct values and are
  // both outside the character class. The fix is DOM order, never dropping the attribute
  // from a control that needs to be focusable.
  { name: "positive-tabindex", severity: "medium", confidence: CONFIDENCE.QUALITY, mode: PRESENCE, pattern: /\btabindex\s*=\s*[{"']*\s*[1-9]\d*\b/gi, fix: "Use tabindex=\"0\" or none, and fix the DOM order so focus follows the reading order", desc: "Positive tabindex (overrides the natural focus order)" },

  // ── Documented fingerprints that had no rule ──
  // The first two are class-attribute compositions, so they use the unordered token-set
  // form for the same reason the three fingerprints above do: utility-class order inside a
  // class attribute is arbitrary, and an ordered regex validates itself against whichever
  // order the fixture happened to use.
  // Tailwind's tracking scale is tighter/tight/normal/wide/wider/widest, so the two
  // tracked-OUT steps are `tracking-wider` and `tracking-widest` -- not `wider` plus an
  // `est` suffix, which is not a class Tailwind emits.
  { name: "uppercase-overline", severity: "low", confidence: CONFIDENCE.SMELL, mode: PRESENCE, classAll: ["text-xs", "uppercase", /^tracking-wid(?:er|est)$/], fix: "Set the overline in the project's own type scale: a distinct size, weight or colour marks a label as subordinate in the product's voice.", desc: "text-xs uppercase tracking-wider overline left at the Tailwind default" },
  { name: "blur-blob", severity: "low", confidence: CONFIDENCE.SMELL, mode: PRESENCE, classAll: [/^blur-(?:2xl|3xl)$/, "rounded-full"], fix: "Use a solid block between sections, a 2-5% grain, real photography, or white space; let any background interest relate to the content.", desc: "Decorative blur blob (blur-2xl/3xl on the same element as rounded-full)" },
  // Quality defect rather than smell: a documentation placeholder rendering as a
  // user-facing figure is wrong regardless of how it looks. Near-100% precision -- those
  // exact strings come from one shadcn example and reach product UI only by copy-paste.
  { name: "shadcn-stats-magic", severity: "medium", confidence: CONFIDENCE.QUALITY, mode: PRESENCE, pattern: /\$45,?231\.89|\+20\.1%\s+from last month/gi, fix: "Wire the real figure, or show the empty state until there is one; any real currency value is clean.", desc: "shadcn dashboard example literals shipping as product figures" },
  { name: "generic-microcopy", severity: "low", confidence: CONFIDENCE.QUALITY, mode: PRESENCE, pattern: /\bWelcome back!|\bGet started today\b|\bJoin thousands of\b|\bStay in the loop\b|\bWe['’]re here to help\b/gi, fix: "Write the line the reader arrived for: `Your last report ran 3 hours ago` beats `Welcome back!`.", desc: "Generic microcopy literal (says nothing about the product)" },
  // Its own rule rather than a sixth alternative inside generic-microcopy, because
  // appending a literal inherits the host's confidence class and the host's remediation.
  // The host is a Quality defect on the grounds that its strings say nothing about the
  // product, so replacing them costs the interface nothing; a scroll hint asserts something
  // true about the page, which is Pattern smell, and its remediation is structural (let the
  // layout show there is more) rather than a copy rewrite. The suppress guard keeps it off
  // an accessible name, where the stated remediation would delete screen-reader output.
  { name: "hero-scroll-hint", severity: "low", confidence: CONFIDENCE.SMELL, mode: PRESENCE, pattern: /\bScroll to explore\b/gi, suppress: /aria-label|alt\s*=/i, fix: "Let the layout invite the scroll: content visibly cut at the fold says there is more better than a label does.", desc: "Hero scroll-indicator microcopy (the poster-hero tell)" },

  // ── Motion and rhythm defaults ──
  // transition-all animates every animatable property, layout ones included, which
  // frontend-patterns.md § Animation Performance already forbids by hand. The fix is
  // naming the properties, so nothing about prefers-reduced-motion handling is touched.
  { name: "transition-all", severity: "low", confidence: CONFIDENCE.QUALITY, mode: CONCENTRATION, minCount: 2, pattern: /\btransition-all\b|transition\s*:\s*all[\s;]/gi, fix: "Name the properties: `transition-[background-color,box-shadow] duration-150` animates the same thing and removes no motion.", desc: "transition-all (animates every property, layout ones included)" },
  // A deliberate uniform 5rem rhythm is a real design decision, which is why this is low
  // severity at three hits: one py-20 beside a py-12 and a py-32 is a rhythm, not a default.
  { name: "uniform-section-padding", severity: "low", confidence: CONFIDENCE.SMELL, mode: CONCENTRATION, minCount: 3, pattern: /\bpy-(?:20|24)\b/gi, fix: "Vary the vertical rhythm by what each section holds; a dense table does not want the same air as a hero.", desc: "Same section padding on every section (uncommitted vertical rhythm)" },
];

// ── Native UI Patterns (APPLE surfaces only -- see NATIVE_UI_EXTENSIONS) ──
// Kept in a separate table from the web tells on purpose: a rule that fires `.frame(width:`
// on a stylesheet, or `text-4xl` on a Swift file, is worse than no rule.
//
// The through-line is the same one the web tells have: a layout that answers the parent's
// size proposal with a number survives exactly one context. Remediations are in
// skills/anti-slop/references/native-ui-patterns.md, and none of them is "make it fixed".
export const NATIVE_PATTERNS = [
  MEDIA_CONTROL_GLYPH,
  { name: "uiscreen-bounds", severity: "medium", confidence: CONFIDENCE.HARD, mode: PRESENCE, pattern: /\bUIScreen\.main\.bounds\b/g, fix: "Read the size from the container: `GeometryReader` for the geometry itself, `containerRelativeFrame` for a fraction of the window.", desc: "UIScreen.main.bounds for layout (the window is not the screen)" },
  // 3+ digits means >= 100pt: a content shell, not an icon or a control. `.frame(width: 44)`
  // on an SF Symbol is correct and must stay clean.
  { name: "fixed-content-frame", severity: "medium", confidence: CONFIDENCE.QUALITY, mode: PRESENCE, pattern: /\.frame\(\s*(?:width|height):\s*\d{3,}/g, fix: "Use `.frame(maxWidth:)` with an honest maximum, or let the content stay intrinsic; a 44pt SF Symbol frame is already correct.", desc: "Fixed content frame (survives one window width)" },
  { name: "device-idiom-branch", severity: "medium", confidence: CONFIDENCE.QUALITY, mode: PRESENCE, pattern: /\bUIDevice\.current\.userInterfaceIdiom\b/g, fix: "Branch on `@Environment(\\.horizontalSizeClass)`, which changes live under Split View and Stage Manager; the idiom never does.", desc: "Branching on the device idiom instead of the size class" },
  { name: "fixed-grid-columns", severity: "low", confidence: CONFIDENCE.QUALITY, mode: PRESENCE, pattern: /GridItem\(\s*\.fixed\(/g, fix: "Use `GridItem(.adaptive(minimum:maximum:))`, which gains columns as the window grows without a single breakpoint.", desc: "Fixed GridItem array (gains no columns as the window grows)" },
  { name: "repeating-symbol-effect", severity: "medium", confidence: CONFIDENCE.QUALITY, mode: PRESENCE, pattern: /\.symbolEffect\([^)]*options:\s*\.repeating/g, fix: "Gate the loop on `@Environment(\\.accessibilityReduceMotion)`, or drop the repeat; symbol effects are never auto-gated.", desc: "Looping symbol effect (never auto-gated for Reduce Motion)" },
  // The type mirror of fixed-content-frame: a hardcoded point size where a negotiation
  // belongs, so the text stops growing at the accessibility sizes. The remediation
  // (.font(.body), or relativeTo: where a specific size genuinely matters) INCREASES
  // Dynamic Type support, which is the remediation floor this table is held to.
  { name: "fixed-font-size", severity: "medium", confidence: CONFIDENCE.QUALITY, mode: PRESENCE, pattern: /\.font\(\s*\.system\(\s*size:\s*\d+/g, suppress: /relativeTo:|@ScaledMetric/, fix: "Use `.font(.body)`, or `.font(.system(size: 17, relativeTo: .body))` where a specific size matters; never drop the text style.", desc: "Hardcoded point size instead of Dynamic Type" },
  // Concentration, and three rather than two: legacy UIKit-era files legitimately carry a
  // couple of hops. Three is where it stops being a bridge and starts being the strategy.
  { name: "dispatch-main-async-spam", severity: "low", confidence: CONFIDENCE.QUALITY, mode: CONCENTRATION, minCount: 3, pattern: /\bDispatchQueue\.main\.async\b/g, fix: "Annotate the type or the method `@MainActor` and delete the hops; use `await MainActor.run { }` for a genuine one-off.", desc: "DispatchQueue.main.async as a blanket concurrency fix (prefer @MainActor)" },
];

// ── Model tooling tokens ──
// Shared by the CODE_PATTERNS and TEXT_CONSTRUCTS entries of `model-tooling-artifact` so
// the two surfaces can never drift, the same way EMOJI_ATOM is shared. `.match()` with
// the g flag resets lastIndex on every call, so one shared RegExp is safe for both tables.
export const MODEL_TOOLING_ARTIFACT =
  /\b(?:oai_?citation|contentReference|attributableIndex|turn\d+(?:search|view|news|image)\d+|grok_(?:card|render_citation_card_json)|ppl-ai-file-upload)\b|\[cite:\s*\d+\]|\[span_\d+\]\(start_span\)|:::writing\b/g;

// A line that IS a comment is prose: nothing on it executes, so an executable-defect rule
// that opts in through `suppress` skips it. The test is "entirely prose", never "begins like
// prose" (2.3.2, from the independent review): a `/* ... */` that closes on the line with code
// after it executes that code, and a leading `*` is a JSDoc continuation only before
// whitespace, a slash or the end of the line (`*gen() {` is a generator method). A trailing
// comment on a code line is still scanned with that line. Known gap: a line that closes a
// block comment and then executes (`*/ eval(x)`) stays suppressed, since no comment state is
// carried across lines.
const COMMENT_LINE = /^\s*(?:\/\/|#|--|<!--|\*(?:\s|$|\/))|^\s*\/\*(?![^\n]*\*\/[^\n]*\S)/;

// ── Code Patterns (severity per rule) ──
export const CODE_PATTERNS = [
  { name: "full-lodash-import", severity: "medium", confidence: CONFIDENCE.QUALITY, pattern: /import\s+_\s+from\s+['"]lodash['"]/g, fix: "Cherry-pick what the file uses (`import debounce from \"lodash/debounce\"`), or write the one helper it needs.", desc: "Full lodash import (use cherry-picked imports)" },
  { name: "full-moment-import", severity: "medium", confidence: CONFIDENCE.QUALITY, pattern: /import\s+moment\s+from\s+['"]moment['"]/g, fix: "Move to dayjs or date-fns and import only the functions used; moment ships its whole locale set into the bundle.", desc: "moment.js import (use dayjs or date-fns)" },
  // `(?<![\w$])`: Playwright's `page.$eval(` / `$$eval(` are not eval(); `suppress` keeps the
  // noun out of doc comments ("once per body eval (#787)", "a parent re-eval (nil = ...)"). A
  // dot or a minus is allowed before the name, so `window.eval(` and `-eval(` still match.
  { name: "eval-usage", severity: "high", confidence: CONFIDENCE.HARD, suppress: COMMENT_LINE, pattern: /(?<![\w$])eval\s*\(/g, fix: "Parse instead of executing: a purpose-built expression parser for arithmetic, `ast.literal_eval` for Python literals only.", desc: "eval() call (executes code from a string)" },
  { name: "innerhtml-usage", severity: "high", confidence: CONFIDENCE.HARD, skipInTests: true, pattern: /\.innerHTML\s*=/g, fix: "Assign `element.textContent` instead; where HTML is genuinely needed, sanitise on the way in rather than at render time.", desc: "innerHTML assignment (XSS if the value is untrusted)" },
  // The key is a credential noun standing alone or as the LAST segment of a snake_case /
  // SCREAMING_CASE name: `(?:\b|(?<=_))` lets `OPENAI_API_KEY`, `client_secret`,
  // `access_token` and Django's `SECRET_KEY` match, which a bare \b silently refused
  // through 2.2.1 (the underscore is a word character, so `_API_KEY` had no boundary and
  // the commonest real-world secret shape scanned clean). camelCase compounds
  // (colorToken, currentPassword) stay unmatched on purpose, and a name that CONTINUES past
  // the noun (PASSWORD_LABEL, API_KEY_HEADER, TOKEN_ENDPOINT) never reaches the `[:=]`.
  // The value lookahead excludes URLs/paths/CSS vars/hex that are never secrets.
  // Test/fixture files are skipped (fake creds live there). "Possible", not definite: a
  // candidate for a human read, not a confirmed leak.
  // severity high, confidence Pattern smell: if it IS a live credential it is the worst
  // finding in the file, but a regex cannot prove the string is one -- it may be a fixture,
  // a variable name, or a placeholder. This pairing is why the two axes stay separate.
  // The value must also be secret-SHAPED, not merely long: "any 8+ characters" is most
  // English sentences, and this is the loudest rule in the report. A credential has no
  // interior spaces AND at least one of {>=3 digits, a -/_ separator joining letters and
  // digits, a known vendor prefix, >=20 chars of base64/hex}. That keeps every real key
  // while dropping i18n copy ("Please enter your password"), lexer token kinds
  // (token: "punctuation"), validation messages, and env-indirection strings.
  { name: "hardcoded-secret", severity: "high", confidence: CONFIDENCE.SMELL, skipInTests: true, pattern: /(?:\b|(?<=_))(?:(?:api|secret|access|private)[_-]?key(?:[_-]?(?:id|base))?|password|passwd|secret|token)(?:\s+As\s+String)?\s*[:=]\s*['"](?!\/|https?:|\.\.?\/|var\(|--|#[0-9a-fA-F])(?=[^'"\s]{8,}['"])(?:(?=(?:[^'"]*[0-9]){3})|(?=[^'"]*[-_])(?=[^'"]*[A-Za-z])(?=[^'"]*[0-9])|(?=(?:sk-|pk-|ghp_|xox))|(?=[A-Za-z0-9+/=]{20,}['"]))[^'"\s]{8,}['"]/gi, fix: "Read it from the environment or a secrets manager, and rotate any value that reached a commit", desc: "Possible hardcoded credential" },
  { name: "console-log-emoji", severity: "medium", confidence: CONFIDENCE.QUALITY, pattern: new RegExp(`console\\.log\\s*\\(\\s*['"][^\\n]*${EMOJI_ATOM}`, "gu"), fix: "Use a word for the status (`PASS`, `FAIL`, `WARNING`); a glyph in a log line outlives the session that printed it.", desc: "Emoji inside a console.log string (breaks log parsers, reads as generated)" },
  { name: "img-no-dimensions", severity: "medium", confidence: CONFIDENCE.HARD, pattern: /<img\s(?![^>]*(?:width|height))[^>]*>/gi, fix: "Give the image its intrinsic `width` and `height` (or an `aspect-ratio`) so the browser reserves the box before it loads.", desc: "<img> without width/height (causes CLS)" },
  { name: "useeffect-setstate", severity: "medium", confidence: CONFIDENCE.SMELL, pattern: /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{[^}]*set[A-Z]\w*\s*\(/g, fix: "Derive the value during render instead of storing it; keep the effect for work that genuinely reaches outside React.", desc: "useEffect setting state (likely derived state)" },
  // AI-tell code patterns from the corpus study (high precision when present)
  { name: "chat-artifact", severity: "high", confidence: CONFIDENCE.HARD, pattern: /\bhere'?s the (updated|complete|full|fixed|revised|new) (code|version|implementation|file)\b|\bas an? (ai|a\.i\.) (language )?model\b|\b(good|great) catch!|\byou'?re absolutely right\b|\bi hope this helps\b/gi, fix: "Delete every line that is the assistant talking, both the preamble and the closing offer.", desc: "Leftover chat artifact (assistant voice in code)" },
  { name: "placeholder-comment", severity: "high", confidence: CONFIDENCE.HARD, pattern: /(\/\/|#|\/\*|\*|--|<!--)\s*\.{2,}\s*(rest|the rest|your|remaining|existing|previous|other)\b|(\/\/|#|\/\*|\*|--|<!--)\s*(rest|remainder) of (your |the |my )?(code|implementation|logic|function|file)\b|(\/\/|#|\/\*|\*|--|<!--)\s*(your|the) (code|logic|implementation|stuff) (goes )?here\b|(\/\/|#|\/\*|\*|--|<!--)\s*(add|insert|implement|put) (your )?(code|logic|implementation) here\b|(\/\/|#|\/\*|\*|--|<!--)\s*(implementation|code|logic) (goes|go) here\b|(\/\/|#|\/\*|\*|--|<!--)\s*existing code (here|unchanged|stays|remains)\b|(\/\/|#|\/\*|\*|--|<!--)\s*TODO:?\s*(implement|add|fill in|finish)\b/gi, fix: "Write the actual code the comment stands in for.", desc: "Placeholder-comment stub (file unfinished -- a bug)" },
  // The ordinal-adverb leg ("Step 1:", "First,", "Then,") was dropped: a numbered runbook
  // step in a .sh setup script and an ordered algorithm description in a JSDoc block are
  // both correct documentation, and the reference catalogue only ever documented the
  // restates-the-code legs kept below. Those legs now tolerate a short word-only lead-in
  // ("# first, we loop through the rows"), which is the same finding with a preamble --
  // the lead-in accepts letters, commas, apostrophes and spaces only, so "# Step 1:" and
  // "// TODO: get the config" still cannot reach a keyword.
  { name: "narrating-comment", severity: "low", confidence: CONFIDENCE.QUALITY, pattern: /(\/\/|#|\/\*|\*|--)\s*(?:[A-Za-z,' ]{0,24})?\b(increment|decrement|initialize|declare|instantiate|loop (over|through)|iterate over|return the|set the|get the|call the)\b|(\/\/|#|\/\*|\*|--)\s*this (function|method|line|loop|variable|class|block) (does|handles|returns|creates)\b|(\/\/|#|\/\*|\*|--)\s*(import|importing) (the |required )?(libraries|modules|dependencies)\b/gi, fix: "Delete the comment and let the code say it; a comment earns its place by explaining why, not by restating what.", desc: "Narrating comment (restates the code)" },
  { name: "swallowed-error", severity: "medium", confidence: CONFIDENCE.HARD, pattern: /^\s*except\s*:|^\s*except\s+(Exception|BaseException)\s*:\s*(pass|\.\.\.)\s*$|\bcatch\s*\([^)]*\)\s*\{\s*\}|\bcatch\s*\{\s*\}|\bcatch\s*\([^)]*\)\s*\{\s*\/\/[^\n]*\}|\bif\s+err\s*!=\s*nil\s*\{\s*\}|\bif\s+err\s*!=\s*nil\s*\{\s*\/\/[^\n]*\}/g, fix: "Let it raise, or catch the specific exception and re-raise a wrapped error (`raise ProcessingError(...) from e`).", desc: "Swallowed error (bare except / empty catch / empty Go err block) -- a bug" },
  { name: "generic-naming", severity: "low", confidence: CONFIDENCE.QUALITY, pattern: /\b(def|function|func|fn|fun|sub)\s+(process_?[Dd]ata|handle_?[Dd]ata|do_?[Ss]tuff|do_?[Ss]omething|my_?[Ff]unction|process_?[Ii]tem|process_?[Ii]nput|main_?[Ff]unction)\b/g, fix: "Name the function after what it does to what (`normalise_invoice_rows`), so a caller can tell from the name alone.", desc: "Generic function name (process_data, doStuff) that says nothing about what it does" },
  // `example.com` was dropped: RFC 2606 reserves it precisely so production CORS
  // allowlists, .env.example files and email-validation code can use it, and the remaining
  // legs (YOUR_API_KEY / lorem ipsum / sk-xxx) are far more precise.
  { name: "boilerplate-marker", severity: "low", confidence: CONFIDENCE.SMELL, skipInTests: true, pattern: /\blorem ipsum\b|\bYOUR_API_KEY\b|\b(your|my)[-_]?api[-_]?key\b|\b(John|Jane) (Doe|Smith)\b|['"]sk-(xxx|your|placeholder|123)/gi, fix: "Replace the dummy value with the real one, or move it into a fixture file, where the scanner already skips it.", desc: "Tutorial/boilerplate marker (dummy data)" },

  // ── Security / bug class ──
  // The React sibling of innerhtml-usage. Sanitised HTML is the legitimate use, so a
  // DOMPurify/sanitize/xss call on the same line clears it. Preference order in the
  // remediation is textContent or JSX children first, a sanitiser second, never a
  // sanitiser bolted on at render time to whatever arrives.
  { name: "dangerous-inner-html", severity: "high", confidence: CONFIDENCE.HARD, pattern: /dangerouslySetInnerHTML\s*=\s*\{\{/g, suppress: /\b(?:DOMPurify\.)?sanitize(?:Html)?\s*\(|\bxss\s*\(/i, fix: "Prefer JSX children or `textContent`; where HTML is truly needed, sanitise on the way in (`DOMPurify.sanitize`).", desc: "dangerouslySetInnerHTML (XSS risk)" },
  // Fires whether or not the command string is interpolated, deliberately: a literal
  // command with shell=True today is an interpolated one after the next edit.
  { name: "shell-injection", severity: "high", confidence: CONFIDENCE.HARD, pattern: /\bshell\s*=\s*True\b/g, fix: "Pass the argv as a list and drop `shell=True`: `subprocess.run([\"convert\", filename, \"out.png\"])`.", desc: "subprocess shell=True (command injection risk)" },
  // yaml.safe_load and an explicit SafeLoader are both cleared by the lookahead; there is
  // no safe way to pickle.loads an attacker-controlled byte string, so that leg is absolute.
  { name: "unsafe-deserialize", severity: "high", confidence: CONFIDENCE.HARD, pattern: /\bpickle\.loads?\s*\(|\byaml\.load\s*\((?![^)]*[Ss]afe)/g, fix: "Use JSON for data you own, `yaml.safe_load` for configuration, and a signed envelope where an object graph must cross a boundary.", desc: "Unsafe deserialization (pickle / yaml.load without a Safe loader)" },
  // A defect rather than a smell because the failure is total and invisible in review:
  // Tailwind scans source text for COMPLETE class names at build time, so an interpolated
  // one never enters the stylesheet and the element silently renders unstyled.
  { name: "tailwind-dynamic-class", severity: "medium", confidence: CONFIDENCE.HARD, pattern: /(?:class|className)\s*=\s*[{]?[`"'][^`"']*\b(?:bg|text|border|from|via|to|ring|fill|w|h|p|m|grid-cols)-\$\{/g, fix: "Write the complete class names and pick between them with a lookup map, so Tailwind's build-time scan can see each one.", desc: "Interpolated Tailwind class (never reaches the stylesheet)" },
  // @ts-expect-error is deliberately NOT matched: the compiler verifies it is still needed
  // and errors when it is not, so it expires on its own -- the property @ts-ignore lacks.
  { name: "suppression-comment", severity: "medium", confidence: CONFIDENCE.QUALITY, pattern: /@ts-ignore\b|@ts-nocheck\b|eslint-disable(?:-next-line|-line)?\b|#\s*type:\s*ignore\b|@SuppressWarnings\b/g, fix: "Fix the type or lint error; where a suppression is genuinely right, use `@ts-expect-error`, which expires when the error does.", desc: "Type/lint suppression instead of a fix" },
  // Deliberately narrow, and only the ones that actually appear: a general deprecation
  // checker needs a package registry and a version resolver, which is a build-time job.
  { name: "deprecated-api", severity: "low", confidence: CONFIDENCE.QUALITY, pattern: /\bdatetime\.utcnow\s*\(\)|\bcomponentWill(?:Mount|ReceiveProps|Update)\b|\bnew Buffer\s*\(/g, fix: "Move to the supported call: `datetime.now(timezone.utc)`, a function component, `Buffer.from()`.", desc: "Deprecated API on a removal path" },
  // A literal condition is a switch someone flipped and never removed: dead code with the
  // shape of live code. `while (true)` is the idiomatic event loop and is excluded; so are
  // `if (isReady === true)` and `if (1)`, neither of which is a bare literal condition.
  { name: "dead-branch", severity: "medium", confidence: CONFIDENCE.HARD, skipInTests: true, pattern: /\bif\s*\(\s*(?:true|false)\s*\)|\bwhile\s*\(\s*false\s*\)|\b(?:if|elif)\s+(?:True|False)\s*:|\bwhile\s+False\s*:/g, fix: "Delete the branch that cannot run and the code inside it; where the flip must stay switchable, make it a named flag with a default.", desc: "Dead branch scaffolding (if (true) / if (false) / Python if False:)" },
  // forEach ignores its callback's return value, so the promises are never awaited, errors
  // surface as unhandled rejections, and the line after the loop runs first. `.map` with an
  // async callback is deliberately NOT matched: that is the correct idiom.
  { name: "async-foreach", severity: "medium", confidence: CONFIDENCE.HARD, pattern: /\.forEach\s*\(\s*async\b/g, fix: "Use `await Promise.all(items.map(save))` for parallel work, or a `for...of` loop with `await` where order or back-pressure matters.", desc: "async callback passed to forEach (the promises are dropped)" },
  // The other end of the same failure swallowed-error covers: a catch block that does not
  // engage with what it caught. `catch (e: unknown)` is the correct form and stays clean.
  { name: "catch-any", severity: "medium", confidence: CONFIDENCE.QUALITY, pattern: /\bcatch\s*\(\s*\w+\s*:\s*any\s*\)/g, fix: "Type the binding `unknown` and narrow before use (`e instanceof ApiError ? e.body.message : fallback`).", desc: "catch (e: any) -- the compiler stops helping where it is needed most" },
  // The general form of the same surrender, and the commonest way a generated file gets
  // past tsc. Deliberately CASE-SENSITIVE: Swift and Kotlin spell their legitimate
  // existential cast `as Any`, and a rule that fired on those would be wrong on every
  // Apple and Android file it saw. `\bany\b` also refuses `as anyValue` and `as anything`,
  // and `as unknown` -- the correct first half of a two-step narrowing -- is a different
  // word. `catch (e: any)` is catch-any's finding and has no `as`, so the two never
  // double-report. skipInTests for the same reason innerhtml-usage carries it: a test
  // reaching past a type to build a partial fixture is not the defect this rule is about.
  { name: "cast-to-any", severity: "medium", confidence: CONFIDENCE.QUALITY, skipInTests: true, pattern: /\bas\s+any\b/g, fix: "Narrow with a type guard or type the value; if the types genuinely disagree, say why in a comment beside the cast", desc: "Cast to any (type checking stops at this expression)" },

  // ── Comment slop ──
  // Vendor-internal citation markup a person could not have typed, so one of them in a
  // source file is proof the file was pasted rather than written. Registered in both the
  // code table and TEXT_CONSTRUCTS, mirroring how chat-artifact and assistant-boilerplate
  // divide the same class across the two surfaces. Ordinary markup that looks similar
  // ([1] footnotes, :::note admonitions, attributedString) does not match.
  { name: "model-tooling-artifact", severity: "high", confidence: CONFIDENCE.HARD, pattern: MODEL_TOOLING_ARTIFACT, fix: "Delete the token; where it stood in for a real citation, write the citation.", desc: "Model tooling/citation artifact leaked into the output" },
  { name: "apologetic-comment", severity: "low", confidence: CONFIDENCE.QUALITY, pattern: /(?:\/\/|#|\/\*|\*|--)[^\n]{0,40}?\b(?:(?:this is a )?(?:simplified|basic|naive|minimal) (?:implementation|version|example)|for (?:demonstration|illustration) purposes|(?:may|might|would) need (?:to be )?(?:enhanced|improved|expanded|hardened) (?:for|in) production)/gi, fix: "Write the production version, or open a tracked issue and link it by number; the comment is doing neither.", desc: "Apologetic comment (the code apologizes for itself)" },
  // The sibling of the apologetic comment and more common: unfinished work signed off in
  // prose. The "simplified implementation" wording belongs to apologetic-comment, so this
  // rule takes only the noun form ("a simplification") and the two never double-report.
  { name: "deferral-comment", severity: "medium", confidence: CONFIDENCE.QUALITY, pattern: /(?:\/\/|#|\/\*|\*|--|<!--)\s*[^\n]{0,60}\b(?:for now\b(?![-\w])|for the time being|temporar(?:y|ily) (?:fix|workaround|solution|hack)|this is (?:a )?simplification|in (?:a )?(?:real|production|actual) (?:implementation|app|system|environment|scenario|setting)|may need to be (?:enhanced|expanded|improved|adjusted)|should (?:work|be fine|be enough)|not production[- ]ready|good enough for now)\b/gi, fix: "Do the work, reference a tracked issue by number (`// fixed until PRICING-214 lands`), or delete the speculative path.", desc: "Deferral/hedging comment (unfinished work signed off in prose)" },
  // A Taste note at two or more: one ASCII rule is somebody's habit, a file divided by
  // them is 1990s formatting. A divider carrying real content is a comment, not a banner.
  { name: "banner-comment", severity: "low", confidence: CONFIDENCE.TASTE, mode: CONCENTRATION, minCount: 2, pattern: /^\s*(?:\/\/|#|\*|--)\s*[=\-*_~#]{10,}\s*$/gm, fix: "Delete the dividers; a file that needs them to stay navigable is a file asking to be split.", desc: "ASCII banner/divider comment" },
];

// ── VB.NET patterns (.vb only) ──
// Matched against the WHOLE file rather than per line (`scope: "file"`), because the
// defining VB tell -- an empty Catch -- spans lines: `Catch ex As Exception` and
// `End Try` are separate statements. The scanner runs them over a code view of the file
// with `'`/REM comments and escape-hatched lines blanked (line count preserved), so a
// commented-out `' If x = True Then` is not a finding. These are slop rules (code that is
// noisier or emptier than it needs to be), not correctness or security checks. A comment-only Catch body
// counts as empty, the same call upstream `swallowed-error` makes for `catch {}` + `//`.
export const VB_PATTERNS = [
  { name: "vb-empty-catch", scope: "file", severity: "medium", confidence: CONFIDENCE.HARD, pattern: /^[ \t]*Catch\b[^:\n]*\n(?:[ \t]*\n)*?(?=[ \t]*(?:End[ \t]+Try|Finally|Catch)\b)|\bCatch\b[^:\n]*:[ \t]*End[ \t]+Try\b/gim, fix: "Handle it, log it, or rethrow with `Throw`; a Catch that does nothing hides the failure from everyone downstream.", desc: "Empty VB Catch block (error swallowed)" },
  // `If x = True Then` reads the boolean twice; `= False` / `<> True` hide a Not behind a
  // comparison. Assignments (`done = True`) are not conditions and do not match, and the
  // match stops at `Then` so a single-line If body (`If ok Then x.Visible = True`) is not one.
  // WPF `ShowDialog()` and `IsChecked` are Boolean? (Nothing on close / indeterminate),
  // where `= True` is the idiom. A Boolean? local still matches: a known limitation. The
  // scan also stops at `:`, so `While run : done = True` is not read as a comparison.
  { name: "vb-bool-literal-compare", scope: "file", severity: "low", confidence: CONFIDENCE.TASTE, pattern: /\b(?:If(?!\()|ElseIf|While|Until|AndAlso|OrElse)\b(?:(?!\bThen\b)(?:[^\n:{}]|:(?==)))*?(?<!\b(?:ShowDialog\((?:[^()\n]|\([^()\n]*\))*\)|IsChecked)[ \t]*)(?:<>|(?<!:)=|\bIs(?:Not)?\b)[ \t]*(?:True|False)\b/gi, fix: "Test the boolean directly: `If done Then`, `If Not done Then`.", desc: "Boolean compared to a True/False literal" },
  // The branch the condition already is: return the condition.
  { name: "vb-bool-return-branch", scope: "file", severity: "low", confidence: CONFIDENCE.QUALITY, pattern: /^[ \t]*If\b[^\n]*\bThen[ \t]*\n(?:[ \t]*\n)*[ \t]*Return[ \t]+(?:True|False)[ \t]*\n(?:[ \t]*\n)*[ \t]*Else[ \t]*\n(?:[ \t]*\n)*[ \t]*Return[ \t]+(?:True|False)[ \t]*\n(?:[ \t]*\n)*[ \t]*End[ \t]+If\b/gim, fix: "Return the condition itself (`Return x > 0`), with Not if the branches are reversed, or the literal if both agree.", desc: "If/Else that only returns True/False" },
  // A Catch whose whole body is a rethrow does nothing but cost a stack frame, and
  // `Throw ex` additionally resets the stack trace to this line. Only the last handler is
  // judged: a rethrow-only Catch followed by a broader Catch is selective (it keeps, say,
  // cancellation out of a fallback handler) and stays clean. The boundaries are lookaheads
  // so adjacent handlers each count. Continued lines are joined first (scan.mjs vbCodeView).
  { name: "vb-rethrow-only-catch", scope: "file", severity: "medium", confidence: CONFIDENCE.QUALITY, pattern: /^[ \t]*Catch\b(?:[ \t]+(\w+)[ \t]+As[ \t]+[\w.]+)?[ \t]*\n(?:[ \t]*\n)*?[ \t]*Throw(?:[ \t]+\1)?[ \t]*\n(?:[ \t]*\n)*?(?=[ \t]*(?:End[ \t]+Try|Finally)\b)/gim, fix: "Delete the Catch and let the exception propagate; if you must catch, add context and keep the stack with a bare `Throw`.", desc: "Catch that only rethrows" },
  // VB twins of shared rules whose patterns only know C-family/Python syntax, so C# and VB
  // get the same coverage: dead-branch (`if (true)`), generic-naming (`function doStuff`),
  // suppression-comment (`eslint-disable`, `@SuppressWarnings`).
  { name: "vb-dead-branch", scope: "file", skipInTests: true, severity: "medium", confidence: CONFIDENCE.HARD, pattern: /^[ \t]*(?:#?(?:If|ElseIf)[ \t]+(?:True|False)[ \t]+Then\b|(?:Do[ \t]+)?While[ \t]+False[ \t]*(?:$|:)|Do[ \t]+Until[ \t]+True[ \t]*(?:$|:))/gim, fix: "Delete the branch that cannot run and the code inside it; where the flip must stay switchable, make it a named flag with a default.", desc: "Dead branch scaffolding (If True Then / If False Then / #If False)" },
  { name: "vb-generic-naming", scope: "file", severity: "low", confidence: CONFIDENCE.QUALITY, pattern: /\b(?:Sub|Function)[ \t]+(?:Process_?Data|Handle_?Data|Do_?Stuff|Do_?Something|My_?Function|Process_?Item|Process_?Input|Main_?Function)\b/gi, fix: "Name it for what it does to what (`ApplyCalibration`, `LoadRecipe`), the way a caller would search for it.", desc: "Generic Sub/Function name (DoStuff, ProcessData) that says nothing" },
  // Boolean busywork: a value that is already True/False, turned into True/False again.
  // (A bare `x = False` test is vb-bool-literal-compare, a Taste note; these are not.)
  // A call's parentheses are not grouping (`Validate(n > 0) = True` is a function result),
  // and `If (` with a space only counts as the ternary where an expression goes (after
  // `=`, `(`, `,` or Return); at a statement start it is the If statement. `If(chk.IsChecked, True,
  // False)` converts Boolean? to Boolean, which Option Strict On needs, so it stays clean.
  { name: "vb-compare-of-comparison", scope: "file", severity: "low", confidence: CONFIDENCE.QUALITY, pattern: /(?<![\w.)\]])\([^()\n]*?(?:<>|>=|<=|[<>]|(?<![<>:])=|\bIs(?:Not)?\b|\bAndAlso\b|\bOrElse\b)[^()\n]*\)[ \t]*(?:=|<>)[ \t]*(?:True|False)\b|(?:=|<>)[ \t]*(?:True|False)[ \t]*(?:=|<>)[ \t]*(?:True|False)\b/gi, fix: "Use the comparison itself: `If count > 0 Then`, not `If (count > 0) = True Then`.", desc: "Comparison result compared to True/False again" },
  { name: "vb-bool-ternary", scope: "file", severity: "low", confidence: CONFIDENCE.QUALITY, pattern: /(?:\b(?:If|IIf)|(?<=(?:[=(,]|\bReturn)[ \t]*)\b(?:If|IIf)[ \t]+)\((?!(?:[^(),\n]|\([^()\n]*\))*\b(?:IsChecked|ShowDialog)\b)(?:[^(),\n]|\([^()\n]*\))*,[ \t]*(?:True|False)[ \t]*,[ \t]*(?:True|False)[ \t]*\)/gi, fix: "Use the condition directly (`ok = count > 0`), with Not if the branches are reversed.", desc: "If(cond, True, False) / IIf(cond, True, False)" },
  { name: "vb-bool-assign-branch", scope: "file", severity: "low", confidence: CONFIDENCE.QUALITY, pattern: /^[ \t]*If\b(?![^\n]*\b(?:IsChecked|ShowDialog)\b[^\n]*\bThen\b)[^\n]*\bThen[ \t]*\n(?:[ \t]*\n)*[ \t]*([\w.]+)[ \t]*=[ \t]*(?:True|False)[ \t]*\n(?:[ \t]*\n)*[ \t]*Else[ \t]*\n(?:[ \t]*\n)*[ \t]*\1[ \t]*=[ \t]*(?:True|False)[ \t]*\n(?:[ \t]*\n)*[ \t]*End[ \t]+If\b|^[ \t]*If\b(?![^\n]*\b(?:IsChecked|ShowDialog)\b[^\n]*\bThen\b)[^\n]*\bThen[ \t]+([\w.]+)[ \t]*=[ \t]*(?:True|False)[ \t]+Else[ \t]+\2[ \t]*=[ \t]*(?:True|False)[ \t]*$/gim, fix: "Assign the condition itself (`ok = File.Exists(p)`), with Not if the branches are reversed.", desc: "If/Else that only assigns True/False to one variable" },
  { name: "vb-double-negation", scope: "file", severity: "low", confidence: CONFIDENCE.QUALITY, pattern: /\bNot[ \t]+Not\b|\bNot[ \t]*\([ \t]*[\w.]+(?:\([^()\n]*\))?[ \t]*(?:=[ \t]*False|<>[ \t]*True)[ \t]*\)/gi, fix: "Drop both negations: `If done Then`.", desc: "Double negation (Not Not x / Not (x = False))" },
  // Narrating comments in the shapes VB code tends to get (the shared narrating-comment
  // covers initialize / loop through / return the / set the / call the). Section labels
  // (`' Constructor`, `' Properties`) are left alone: they label, they do not restate.
  // A "Check if the ..." comment only counts when it ends soon after (no clause carrying a
  // reason), and `''' Gets the X.` is the .NET property-doc convention, so it is not hit. Runs on comment
  // text only (`scope: "comment"`); English phrasing only, so a Korean comment is never hit.
  { name: "vb-narrating-comment", scope: "comment", severity: "low", confidence: CONFIDENCE.TASTE, pattern: /^[ \t]*'(?!')[ \t]*(?:Checks? (?:if|whether) the|Re-?throws? the exception|Creates? (?:a |the )?new instance|Reads? all (?:the )?lines|Increments? the|Decrements? the)\b[^\n,;\u0080-￿]{0,30}$|^[ \t]*'''[ \t]*<summary>[ \t]*(?:Processes|Handles|Checks|Creates|Initializes) the \w+\.?[ \t]*<\/summary>[ \t]*$|^[ \t]*'''[ \t]*(?:Processes|Handles|Checks|Creates|Initializes) the \w+\.?[ \t]*$/gim, fix: "Delete it, or say why the code does this rather than what it does.", desc: "Narrating VB comment (restates the code or the member name)" },
  { name: "vb-warning-suppression", scope: "file", severity: "medium", confidence: CONFIDENCE.QUALITY, pattern: /^[ \t]*#Disable[ \t]+Warning\b/gim, fix: "Fix the warning; where a suppression is genuinely right, say why on the line and re-enable it right after.", desc: "#Disable Warning instead of a fix" },
];

// ── Text constructs (prose only): regex-detectable sentence/format tells ──
// Severity follows the corpus ranking. Emitted only after prose noise-stripping
// (code fences, quotes, blockquotes, frontmatter, and escape-hatch lines blanked).
export const TEXT_CONSTRUCTS = [
  // "about" and "really" are the 2026 reframe ("it's not about money, it's about trust"),
  // named verbatim by two independent sources and missed entirely by the qualifier set.
  // The two-clause shape is what carries the signal and is unchanged: a single clause
  // ("It's not about money.") still has nothing to match the trailing "it's".
  { name: "antithesis-not-just-x-y", severity: "medium", confidence: CONFIDENCE.SMELL, pattern: /\b(it'?s|its|it is|that'?s|this is|they'?re)\s+not\s+(just|only|merely|simply|about|really)\b[^.?!\n]{0,60}\bit'?s\b/gi, fix: "If Y is the point, say Y: `It changes how the team works` rather than `it's not just a feature, it's a new way of working`.", desc: '"It\'s not just X, it\'s Y" antithesis (#1 sentence tell)' },
  { name: "antithesis-not-only-but", severity: "low", confidence: CONFIDENCE.SMELL, pattern: /\bnot\s+(just|only|merely|simply)\s+(a |an |the )?[\w-]+,?\s+but\b/gi, fix: "Join the two claims plainly: `It's faster and more reliable`, not `not only faster, but also more reliable`.", desc: '"not only X, but Y" antithesis' },
  // The sole single-instance prose tell, at high severity, so every leg has to be the
  // ASSISTANT speaking about itself and nothing a person writes. Through 2.2.1 four legs
  // were wider than that and fired on ordinary English: "I can't help but notice", "I
  // cannot help thinking", a document stating the model's knowledge cutoff in the third
  // person, and "I don't have access to the staging box". The refusal leg now excludes the
  // idioms after `help` and needs a request object after `fulfill` / `comply` / `provide`;
  // the cutoff legs need `my`; the access leg needs the things an assistant lacks.
  { name: "assistant-boilerplate", severity: "high", confidence: CONFIDENCE.HARD, pattern: /\bas an? (ai|a\.i\.) (language )?model\b|\bas a large language model\b|\b(?:i (?:cannot|can'?t|am unable to)|i'?m unable to) (?:assist|help(?!\s+(?:but|it|myself|\w+ing)\b)|(?:fulfil|fulfill|comply with) (?:that|this|your|the) request|provide (?:that|this|any|assistance|information))\b|\bas of my (?:last |latest )?(?:knowledge|training) (?:update|data|cut[- ]?off)\b|\bmy (?:knowledge|training) cut[- ]?off\b|\bi (?:do not|don'?t) have (?:personal (?:opinions|feelings|experiences|preferences)|the ability to (?:access|browse|search|execute|run|view|see|open)|access to (?:real[- ]?time|the internet|live|external|your)|feelings|opinions)\b/gi, fix: "Delete every line that is the assistant talking about itself; the answer starts at the content.", desc: "Leftover assistant boilerplate (as-an-AI / refusal / cutoff)" },
  { name: "assistant-offer", severity: "medium", confidence: CONFIDENCE.QUALITY, pattern: /\bwould you like me to\b|\bis there anything else i can\b|\bi hope this (helps|email finds you well)\b/gi, fix: "Delete the closing offer and stop at the last piece of content the reader needed.", desc: "Trailing assistant offer / sign-off" },
  { name: "dive-in", severity: "low", confidence: CONFIDENCE.SMELL, pattern: /\b(deep dive|dive in(to)?|let'?s dive|diving in|dive deep)\b/gi, fix: "Open on the subject itself; the first sentence should carry information rather than announce that information follows.", desc: '"dive in" / "deep dive" opener' },
  // Two legs, both anchored: a HEADLINE (line start, optionally a heading or bullet), or
  // an in-sentence announcement of a list ("here are 5 ways TO speed up"). Unanchored, the
  // rule fired on "the migration runs in 3 steps" and "there are 4 reasons the cache
  // misses on cold start", which are ordinary technical sentences -- neither announces a
  // list, and neither reaches the infinitive that a scaffolded listicle always does.
  { name: "listicle-scaffold", severity: "low", confidence: CONFIDENCE.SMELL, pattern: /^\s{0,3}(?:[-*+]\s+)?#{0,4}\s*\d+\s+(ways|tips|signs|reasons|things|steps|tricks|secrets|lessons|mistakes|rules)\b|\b\d+\s+(ways|tips|signs|tricks|secrets|lessons|mistakes)\s+to\s+\w/gim, fix: "Drop the `N ways to` framing and write the paragraph; keep bullets for genuinely list-like content.", desc: 'Listicle scaffolding ("N ways to...")' },
  { name: "fast-paced-opener", severity: "low", confidence: CONFIDENCE.SMELL, pattern: /\bin today'?s\s+(fast[- ]?paced|digital|ever[- ]?changing|modern|competitive)?\s*(world|age|landscape|era|society|market)\b|\bin (the|this) (modern|digital) (world|age|era)\b/gi, fix: "Start at the specific claim the piece is about; the scene-setting first line can be deleted without loss.", desc: '"In today\'s fast-paced world" opener' },
  { name: "unlock-potential", severity: "low", confidence: CONFIDENCE.SMELL, pattern: /\b(unlock|unleash|tap into)\w*\s+(the\s+|your\s+|its\s+|their\s+|full\s+)*(power|potential|capabilities|secrets)\b/gi, fix: "Name the concrete capability and who gets it, rather than the potential being unlocked.", desc: '"unlock the potential" hype' },
  { name: "in-conclusion", severity: "low", confidence: CONFIDENCE.SMELL, pattern: /\bin (conclusion|summary)\b|\bto (summari[sz]e|conclude|wrap (this |it )?up)\b|\bin closing\b/gi, fix: "Stop when the content is done; write a closer only where it adds something the reader has not already seen.", desc: '"In conclusion / In summary" closer' },
  { name: "honestly-opener", severity: "low", confidence: CONFIDENCE.SMELL, pattern: /(^|\n)\s*honestly,\s|\blet'?s be (honest|real)\b/gi, fix: "Delete the opener and start on the claim; the sentence reads the same without it.", desc: '"Honestly," / "Let\'s be real" opener' },
  // A rule needs a BLANK line above it. `Title` followed by `---` is a Setext H2 -- a
  // heading, not a divider -- and flagging it asks the author to break their own document
  // structure. Requiring the blank line keeps every real `\n\n---\n\n` divider.
  { name: "hr-divider", severity: "low", confidence: CONFIDENCE.TASTE, pattern: /\n[ \t]*\n[ \t]{0,3}(?:---+|\*\*\*+|___+)[ \t]*(?=\n|$)/g, fix: "Use a paragraph break, and reserve the rule for a real section boundary in a long document.", desc: "Horizontal-rule divider between sections" },
  { name: "hype-marketing", severity: "low", confidence: CONFIDENCE.QUALITY, pattern: /\brevolution(ary|i[sz]e)\b|\btransform your (life|business|workflow)\b|\bto the next level\b|\bsupercharge\b|\bsay goodbye to\b|\blook no further\b|\bbuckle up\b|\bwithout further ado\b/gi, fix: "State the mechanism and the outcome: `scan now accepts multiple files and exits 1 on any finding`.", desc: "Marketing hype (revolutionary / supercharge)" },
  // The prose half of the code table's entry of the same name: same rule, same severity,
  // reached on .md the way chat-artifact is reached on .js.
  { name: "model-tooling-artifact", severity: "high", confidence: CONFIDENCE.HARD, mode: PRESENCE, pattern: MODEL_TOOLING_ARTIFACT, fix: "Delete the token; where it stood in for a real citation, write the citation.", desc: "Model tooling/citation artifact leaked into the output" },
  // The 2026 register is the mirror image of the 2024 one: short plain Anglo-Saxon words
  // used metaphorically to manufacture weight, rather than inflated words standing in for
  // plain ones. NONE of the bare words belongs in BANNED_WORDS -- `real`, `shape`, `signal`,
  // `hold`, `pull` and `land` are core English and a word-level rule would be a false-
  // positive catastrophe. The tell is the metaphorical COLLOCATION, and only in bulk:
  // "Interest compounds annually" and "He held the space open" both stay clean, and a
  // single collocation is the writer's own prose.
  { name: "plain-aiism-collocation", severity: "low", confidence: CONFIDENCE.SMELL, mode: CONCENTRATION, minCount: 2, pattern: /\bquietly\s+(?:building|becoming|dominat\w*|transform\w*|reshap\w*|chang\w*|eating)\b|\b(?:this|that)\s+matters\s+because\b|\bwhy\s+(?:this|that|it)\s+matters\b|\bearn(?:s|ed|ing)?\s+the\s+right\s+to\b|\b(?:decisions?|actions?|benefits?|effects?|gains?|habits?)\s+compound\b|\bbuilt\s+different\b|\bthe\s+pull\s+of\b|\bhold(?:s|ing)?\s+space\b|\bsends?\s+(?:a|the)\s+signal\s+that\b|\bdo\s+the\s+work\b/gi, fix: "Say the literal thing the metaphor stands in for; a single collocation is the writer's own prose, and only a cluster is the tell.", desc: "Plain-word metaphor cluster ('quietly building', 'why this matters', 'decisions compound')" },
];

// ── Context Exceptions ──
// If any of these domain words appear in the file, the banned word is likely legitimate
export const CONTEXT_EXCEPTIONS = {
  "realm": ["server", "wow", "warcraft", "mmo", "game", "character", "guild", "blizzard", "horde", "alliance", "dungeon", "raid", "player", "azeroth"],
  "enchanting": ["enchant", "wow", "warcraft", "spell", "magic", "item", "gear", "weapon", "profession", "disenchant"],
  "landscape": ["terrain", "geography", "map", "topograph", "satellite", "gis", "orientation", "portrait"],
  "tapestry": ["fabric", "weave", "textile", "cloth", "thread", "loom"],
  "luminous": ["light", "lumen", "brightness", "display", "hdr", "backlight", "nit", "candela", "shader"],
  "ethereal": ["ethereum", "eth", "blockchain", "crypto", "network", "protocol", "web3"],
  "ephemeral": ["container", "storage", "port", "cache", "session", "kubernetes", "docker", "k8s", "ttl", "expir"],
  "paradigm": ["programming", "oop", "functional", "declarative", "design pattern", "methodology"],
  "intersection": ["set", "array", "math", "geometry", "road", "traffic", "union", "typescript", "venn"],
  "synergy": ["damage", "buff", "skill", "ability", "combo", "stat", "bonus", "perk"],
  "vibrant": ["color", "saturation", "hue", "display", "gamut", "profile", "palette"],
  "captivating": ["audience", "player", "viewer", "retention", "analytics"],
  "testament": ["bible", "scripture", "religious", "church", "covenant"],
  "gossamer": ["fabric", "silk", "textile", "material", "spider"],
  "iridescent": ["material", "shader", "surface", "coating", "finish", "pearl", "holographic"],
  "enigmatic": ["puzzle", "cipher", "mystery", "riddle", "cryptograph"],
  "orchestrate": ["orchestra", "music", "conductor", "symphony", "instrument", "kubernetes", "k8s", "workflow engine"],
  "bustling": ["city", "market", "port", "town", "npc", "merchant"],
  "pivotal": ["pivot table", "pivot point", "agile", "sprint"],
  "seamless": ["seam", "stitch", "texture", "tile", "tilemap"],
  "harness": ["test harness", "wiring harness", "cable harness", "playwright", "cypress", "webdriver", "e2e"],
};

// Exception entries are matched as STEMS anchored at a word START, never as raw
// substrings. The unanchored `includes()` this replaces meant "port" inside "important",
// "set" inside "settings", "eth" inside "method" and "gis" inside "register" silently
// disabled five banned words in nearly every real document -- an over-broad suppressor is
// a silent recall hole, which is worse than a noisy false positive because nothing
// surfaces it. The leading \b keeps stemming working ("expir" still excuses "expires" and
// "expiration"). A few short stems still collide with common English AT a word start
// ("port" -> "portion", "set" -> "settings", "cache" -> "cachet"); those are matched as
// whole words, with the common inflections still allowed, instead.
// test/rule-false-positives.test.mjs fails on any newly substring-collidable entry.
export const WHOLE_WORD_EXCEPTIONS = new Set(["port", "set", "map", "cache", "seam"]);
const INFLECTIONS = "(?:s|es|d|ed|ing)?\\b";

function escapeRegExp(source) {
  return source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const CONTEXT_EXCEPTION_REGEXES = new Map(
  Object.entries(CONTEXT_EXCEPTIONS).map(([word, entries]) => [
    word,
    entries.map((entry) =>
      new RegExp(`\\b${escapeRegExp(entry)}${WHOLE_WORD_EXCEPTIONS.has(entry) ? INFLECTIONS : ""}`, "i"),
    ),
  ]),
);

// ── Emoji detection (EMOJI_ATOM above holds the definition) ──
export const EMOJI_REGEX = new RegExp(EMOJI_ATOM, "gu");
// A file that DISCUSSES emoji (this plugin's own writing-patterns.md reference, a design
// system's icon guidance) is documenting the tell, not committing it. Same file-scope
// guard schema the table rules use.
export const EMOJI_FILE_GUARD = Object.freeze({ unless: /\bemoji\b/i });
// One stray glyph is not the same finding as a decorated README, so the emoji count
// escalates the same way em-dash density does.
export const EMOJI_ESCALATE_COUNT = 5;

// ── File type detection ──
export const PROSE_EXTENSIONS = new Set([".md", ".mdx", ".txt", ".rst"]);

// ── Prose scope ──
// The writing rules govern user-facing prose: UI copy, notifications, marketing and store
// copy, release notes, public documentation. Internal documents (specs, plans, ADRs,
// evidence, handoffs, changelogs, CLAUDE.md) are most of the markdown in a working
// repository, and scanning them for em-dash density and vocabulary produced findings
// nobody acted on except to explain them away in the pull request. Under "user-facing"
// (the default since 2.3.0) a prose file is skipped unless the project lists it under
// `userFacingProse` in .anti-slop/config.json; "all" is the pre-2.3.0 behaviour. Code
// files keep their comment rules under either scope. Resolution order and the glob
// dialect live in scan.mjs (proseScopeFor).
export const PROSE_SCOPES = Object.freeze(["user-facing", "all"]);
export const DEFAULT_PROSE_SCOPE = "user-facing";
export const CODE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".py", ".rb", ".go", ".rs", ".java", ".cs", ".php", ".c", ".h", ".cpp", ".cc", ".hpp", ".kt", ".kts", ".swift", ".scala", ".m", ".mm", ".sh", ".bash", ".lua", ".dart", ".sql", ".r", ".vb"]);
export const VB_EXTENSIONS = new Set([".vb"]);
export const STYLE_EXTENSIONS = new Set([".css", ".scss", ".less", ".html", ".htm", ".jsx", ".tsx", ".vue", ".svelte"]);

// Which surface each UI rule table is allowed to see. Design tells are Tailwind/CSS/DOM
// vocabulary and native tells are SwiftUI vocabulary; running either table over the other's
// files produces findings that cannot be true, which costs more trust than the rule earns.
// Web surfaces include JS/TS because Tailwind class strings live in components, not just
// markup. Everything else (.py, .go, .rs, .java, .sh, ...) gets code rules only.
export const WEB_SURFACE_EXTENSIONS = new Set([
  ...STYLE_EXTENSIONS, ".js", ".ts", ".mjs", ".cjs", ".astro",
]);
export const NATIVE_UI_EXTENSIONS = new Set([".swift", ".m", ".mm"]);

// Which surfaces the CODE rule family runs on. Markup-with-script formats carry real code
// in <script> blocks: before they were routed here an .html, .vue or .svelte file with
// eval(), an innerHTML assignment and a hardcoded key scanned completely clean, and
// img-no-dimensions -- a CLS rule whose entire target syntax is <img> -- was structurally
// unable to fire on plain HTML. Kept as a separate set rather than widening
// CODE_EXTENSIONS, which also feeds the prose/style sibling logic.
export const CODE_SURFACE_EXTENSIONS = new Set([
  ...CODE_EXTENSIONS, ".html", ".htm", ".vue", ".svelte", ".astro",
]);
