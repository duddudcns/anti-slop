import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  CONFIDENCE,
  CONFIDENCE_CLASSES,
  PRESENCE,
  CONCENTRATION,
  DESIGN_PATTERNS,
  CODE_PATTERNS,
  TEXT_CONSTRUCTS,
  NATIVE_PATTERNS,
  VB_PATTERNS,
  WEB_SURFACE_EXTENSIONS,
  NATIVE_UI_EXTENSIONS,
  BANNED_WORD_FIX,
  BANNED_PHRASE_FIX,
  EMDASH_FIX,
  EMOJI_FIX,
} from "../lib/rules.mjs";
import { scanContent, fileGuardOk } from "../lib/scan.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DOCTRINE = join(REPO, "skills", "anti-slop", "references", "confidence-and-evidence.md");

const ALL_TABLE_RULES = [...DESIGN_PATTERNS, ...CODE_PATTERNS, ...TEXT_CONSTRUCTS, ...NATIVE_PATTERNS, ...VB_PATTERNS];

// A rule that sits in both UI tables (media-control-glyph since 2.3.1) is safe only while it
// is one object and the two surfaces never share an extension; a file on a shared extension
// would report the same finding twice, once per table, and subtract twice from the score.
test("a rule id shared by the design and native tables is one object on disjoint surfaces", () => {
  const shared = DESIGN_PATTERNS.filter((d) => NATIVE_PATTERNS.some((n) => n.name === d.name));
  assert.ok(shared.length >= 1, "media-control-glyph is expected in both tables");
  for (const d of shared) assert.equal(d, NATIVE_PATTERNS.find((n) => n.name === d.name), `${d.name} must be the same object in both tables`);
  assert.deepEqual([...WEB_SURFACE_EXTENSIONS].filter((e) => NATIVE_UI_EXTENSIONS.has(e)), []);
});

test("the confidence enum carries exactly the four classes", () => {
  assert.deepEqual(CONFIDENCE_CLASSES, [
    "Hard defect",
    "Quality defect",
    "Pattern smell",
    "Taste note",
  ]);
});

// The enum's doctrinal home is the reference file; rules.mjs is its machine mirror. This
// is what keeps "defined in exactly one file" true rather than aspirational -- renaming a
// class in either place without the other fails here.
test("the code enum mirrors the doctrine file, which is its single definition", () => {
  const doctrine = readFileSync(DOCTRINE, "utf8");
  for (const cls of CONFIDENCE_CLASSES) {
    assert.ok(
      doctrine.includes(cls),
      `confidence class "${cls}" is in rules.mjs but not defined in references/confidence-and-evidence.md`,
    );
  }
  // And nothing extra: a class defined in the doc but absent from the enum is the same drift.
  const declared = [...doctrine.matchAll(/^\|\s*\*\*(.+?)\*\*\s*\|/gm)].map((m) => m[1].trim());
  assert.deepEqual(
    declared.filter((d) => CONFIDENCE_CLASSES.includes(d)).sort(),
    [...CONFIDENCE_CLASSES].sort(),
    `doctrine table declares ${JSON.stringify(declared)}, enum carries ${JSON.stringify(CONFIDENCE_CLASSES)}`,
  );
});

test("every table-driven rule declares a valid confidence class", () => {
  for (const rule of ALL_TABLE_RULES) {
    assert.ok(
      CONFIDENCE_CLASSES.includes(rule.confidence),
      `rule "${rule.name}" has confidence ${JSON.stringify(rule.confidence)}, which is not one of the four classes`,
    );
  }
});

// ── The remediation floor (2.4.0) ────────────────────────────────────────────
// references/confidence-and-evidence.md § The remediation floor: a finding that names only
// the offence is incomplete, and an incomplete finding gets closed by deletion. The
// scanner's own output violated that doctrine for every release up to 2.3.2 -- a rule with
// no `fix` prints an offence and nothing a reader can act on except the delete key.
// 160 characters is the ceiling because the fix shares a terminal line with its finding;
// past that it wraps and stops being one sentence anybody reads.
test("every table rule carries a one-sentence fix", () => {
  for (const rule of ALL_TABLE_RULES) {
    assert.equal(typeof rule.fix, "string", `rule "${rule.name}" declares no fix`);
    assert.ok(rule.fix.trim().length > 0, `rule "${rule.name}" declares an empty fix`);
    assert.ok(
      rule.fix.length <= 160,
      `rule "${rule.name}" has a ${rule.fix.length}-character fix; the ceiling is 160`,
    );
  }
});

// The four families inlined in scan.mjs have no rule object to hang a fix on, so theirs
// live beside their confidence constants. Without this they are the one way a finding can
// still reach a reader with no remediation, and nothing above would notice.
test("the four non-table rule families declare a fix too", () => {
  const familyFixes = {
    BANNED_WORD_FIX, BANNED_PHRASE_FIX, EMDASH_FIX, EMOJI_FIX,
  };
  for (const [name, fix] of Object.entries(familyFixes)) {
    assert.equal(typeof fix, "string", `${name} is not a string`);
    assert.ok(fix.trim().length > 0, `${name} is empty`);
    assert.ok(fix.length <= 160, `${name} is ${fix.length} characters; the ceiling is 160`);
  }
});

test("every design and native tell declares presence or concentration", () => {
  for (const rule of [...DESIGN_PATTERNS, ...NATIVE_PATTERNS]) {
    assert.ok(
      rule.mode === PRESENCE || rule.mode === CONCENTRATION,
      `tell "${rule.name}" declares mode ${JSON.stringify(rule.mode)}; expected "presence" or "concentration"`,
    );
    if (rule.mode === CONCENTRATION) {
      assert.ok(
        Number.isInteger(rule.minCount) && rule.minCount >= 2,
        `concentration tell "${rule.name}" needs an integer minCount >= 2, got ${JSON.stringify(rule.minCount)}`,
      );
    } else {
      assert.equal(rule.minCount, undefined, `presence tell "${rule.name}" must not carry a minCount`);
    }
  }
});

// Severity and confidence are independent axes. If every high-severity rule were also a
// Hard defect the enum would be a second name for severity and would carry no information.
// Both diagonals are asserted: one direction alone leaves the axes free to collapse
// everywhere else and still pass.
test("severity and confidence are independent axes", () => {
  const grade = (r) => (typeof r.severity === "function" ? r.severity(1) : r.severity);
  const highSmell = ALL_TABLE_RULES.filter((r) => grade(r) === "high" && r.confidence === CONFIDENCE.SMELL);
  assert.ok(
    highSmell.length > 0,
    "expected at least one high-severity Pattern smell (a costly finding the scanner cannot prove)",
  );
  // The other diagonal, stated as the property rather than as one hand-picked rule:
  // neither axis may determine the other. So some severity must carry more than one
  // confidence class, AND some confidence class must carry more than one severity.
  const byGrade = new Map();
  const byConfidence = new Map();
  for (const rule of ALL_TABLE_RULES) {
    if (!byGrade.has(grade(rule))) byGrade.set(grade(rule), new Set());
    byGrade.get(grade(rule)).add(rule.confidence);
    if (!byConfidence.has(rule.confidence)) byConfidence.set(rule.confidence, new Set());
    byConfidence.get(rule.confidence).add(grade(rule));
  }
  assert.ok(
    [...byGrade.values()].some((s) => s.size > 1),
    `severity determines confidence: ${JSON.stringify([...byGrade].map(([k, v]) => [k, [...v]]))}`,
  );
  assert.ok(
    [...byConfidence.values()].some((s) => s.size > 1),
    `confidence determines severity: ${JSON.stringify([...byConfidence].map(([k, v]) => [k, [...v]]))}`,
  );
});

// ── File-scope guards (2.1.0) ────────────────────────────────────────────────
// `requires` / `requiresMinCount` / `unless` are evaluated once per file, before the line
// loop. They are optional, so the only thing to pin is the shape: a guard declared as a
// string would silently never match, and a requiresMinCount without a requires is a
// declaration that does nothing.
test("file-scope guards, where declared, carry the right types", () => {
  for (const rule of ALL_TABLE_RULES) {
    if (rule.requires !== undefined) {
      assert.ok(rule.requires instanceof RegExp, `rule "${rule.name}" declares a non-RegExp requires`);
    }
    if (rule.unless !== undefined) {
      assert.ok(rule.unless instanceof RegExp, `rule "${rule.name}" declares a non-RegExp unless`);
    }
    if (rule.requiresMinCount !== undefined) {
      assert.ok(
        Number.isInteger(rule.requiresMinCount) && rule.requiresMinCount >= 1,
        `rule "${rule.name}" needs an integer requiresMinCount >= 1, got ${JSON.stringify(rule.requiresMinCount)}`,
      );
      assert.ok(rule.requires, `rule "${rule.name}" sets requiresMinCount with no requires to count`);
    }
  }
});

test("a file-scope guard silences the whole rule, and its absence leaves it firing", () => {
  const guarded = { name: "probe", pattern: /needle/g, unless: /haystack/i };
  const requiring = { name: "probe", pattern: /needle/g, requires: /token/gi, requiresMinCount: 2 };
  assert.equal(fileGuardOk(guarded, "a needle here"), true);
  assert.equal(fileGuardOk(guarded, "a needle in a haystack"), false, "unless must silence the rule file-wide");
  assert.equal(fileGuardOk(requiring, "needle, token"), false, "one occurrence is below requiresMinCount");
  assert.equal(fileGuardOk(requiring, "needle, token, token"), true);
  assert.equal(fileGuardOk({ name: "probe", pattern: /needle/g }, "a needle"), true, "no guard means always allowed");
});

// End to end through scanContent, not just against the guard function: the point of the
// schema is that a guarded rule never reaches the line loop for a file it does not apply
// to. The probe rule is appended to the live table and removed again in a finally.
test("a guarded rule is skipped end to end by scanContent", () => {
  const probe = {
    name: "guard-probe", severity: "low", confidence: CONFIDENCE.TASTE, mode: PRESENCE,
    pattern: /height\s*:\s*100vh/gi, unless: /100dvh/i,
    desc: "probe rule for the file-scope guard",
  };
  DESIGN_PATTERNS.push(probe);
  try {
    const fired = (css) => scanContent(css, "app.css").some((v) => v.name === "guard-probe");
    assert.equal(fired(".app { height: 100vh; }"), true, "unguarded content must still fire");
    assert.equal(
      fired(".app { height: 100vh;\n         height: 100dvh; }"), false,
      "the progressive-enhancement fallback on the NEXT line must silence the rule, which a per-line suppress cannot see",
    );
  } finally {
    DESIGN_PATTERNS.pop();
  }
});

// ── Counting shapes and the concentration gate (2.1.0) ───────────────────────
// A rule counts by `pattern`, by `classAll`, or by a `count(line)` predicate, and exactly
// one of the three has to be present or the rule silently counts nothing.
test("every table rule declares exactly one way of counting a line", () => {
  for (const rule of ALL_TABLE_RULES) {
    const shapes = [rule.pattern, rule.classAll, rule.count].filter((s) => s !== undefined);
    assert.equal(
      shapes.length, 1,
      `rule "${rule.name}" declares ${shapes.length} counting shapes; expected exactly one of pattern/classAll/count`,
    );
    if (rule.pattern !== undefined) assert.ok(rule.pattern instanceof RegExp, `rule "${rule.name}" has a non-RegExp pattern`);
    if (rule.classAll !== undefined) assert.ok(Array.isArray(rule.classAll) && rule.classAll.length >= 2, `rule "${rule.name}" needs >= 2 classAll tokens`);
    if (rule.count !== undefined) assert.equal(typeof rule.count, "function", `rule "${rule.name}" has a non-function count`);
  }
});

// The gate used to live only on the design and native loops. A concentration rule in the
// code or text table would have fired on its first hit -- reading as implemented while
// ignoring its own threshold, which is the quietest kind of wrong.
test("the concentration gate applies to the code and text tables too", () => {
  const codeRule = CODE_PATTERNS.find((r) => r.mode === CONCENTRATION);
  const textRule = TEXT_CONSTRUCTS.find((r) => r.mode === CONCENTRATION);
  assert.ok(codeRule, "expected at least one concentration rule in CODE_PATTERNS");
  assert.ok(textRule, "expected at least one concentration rule in TEXT_CONSTRUCTS");

  const oneBanner = "// ==========================================\nfunction go() {}";
  const twoBanners = "// ==========================================\nfunction go() {}\n// ==========================================";
  assert.ok(!scanContent(oneBanner, "a.js").some((v) => v.name === codeRule.name), "one hit is below minCount");
  assert.ok(scanContent(twoBanners, "a.js").some((v) => v.name === codeRule.name), "minCount hits fire");

  const onePlain = "Decisions compound, and the cost lands later.";
  const twoPlain = "They are quietly building it. Decisions compound, and the cost lands later.";
  assert.ok(!scanContent(onePlain, "post.md").some((v) => v.name === textRule.name), "one hit is below minCount");
  assert.ok(scanContent(twoPlain, "post.md").some((v) => v.name === textRule.name), "minCount hits fire");
});

test("a count() predicate drives the same gate a pattern does, end to end", () => {
  const probe = {
    name: "count-probe", severity: "low", confidence: CONFIDENCE.TASTE,
    mode: CONCENTRATION, minCount: 2,
    count: (line) => (line.includes("odd") ? 1 : 0),
    desc: "probe rule for the count predicate",
  };
  DESIGN_PATTERNS.push(probe);
  try {
    const fired = (css) => scanContent(css, "app.css").some((v) => v.name === "count-probe");
    assert.equal(fired(".a { /* odd */ }"), false, "one hit is below minCount");
    assert.equal(fired(".a { /* odd */ }\n.b { /* odd */ }"), true);
    assert.equal(fired(".a { /* odd */ } // anti-slop-allow: opted out\n.b { /* odd */ }"), false,
      "the escape hatch must reach a count() rule the same way it reaches a pattern rule");
  } finally {
    DESIGN_PATTERNS.pop();
  }
});

test("every emitted violation carries a confidence class", () => {
  const samples = [
    ["Let's dive in. In today's fast-paced world, we delve into the tapestry.", "post.md"],
    ["const password = \"hunter2hunter2\";\neval(userInput);\n", "src/auth.js"],
    ['<div class="bg-gradient-to-r from-purple-500 to-blue-500 bg-clip-text text-transparent">Hi</div>', "page.html"],
    [".frame(width: 320)\nlet w = UIScreen.main.bounds.width\n", "View.swift"],
  ];
  for (const [content, path] of samples) {
    const violations = scanContent(content, path);
    assert.ok(violations.length > 0, `expected findings for ${path}`);
    for (const v of violations) {
      assert.ok(
        CONFIDENCE_CLASSES.includes(v.confidence),
        `violation ${JSON.stringify(v)} from ${path} is missing a valid confidence`,
      );
    }
  }
});

// A rule firing on the wrong platform is worse than no rule: it teaches the user the
// scanner does not understand their file.
test("web design tells never fire on native sources", () => {
  const swift = `
    Text("Build Better Faster")
      .font(.system(size: 34))
      .background(Color(hex: "#6366f1"))
    // text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight
  `;
  const names = scanContent(swift, "HeroView.swift").map((v) => v.name);
  for (const design of DESIGN_PATTERNS) {
    assert.ok(!names.includes(design.name), `web tell "${design.name}" fired on a .swift file`);
  }
});

test("native tells never fire on web sources", () => {
  const html = `
    <div style="width: 320px">.frame(width: 320) UIScreen.main.bounds</div>
  `;
  const names = scanContent(html, "page.html").map((v) => v.name);
  for (const native of NATIVE_PATTERNS) {
    assert.ok(!names.includes(native.name), `native tell "${native.name}" fired on an .html file`);
  }
});
