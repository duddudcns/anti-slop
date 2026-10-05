import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { measure, loadLabels, expectedIds, ruleName, CORPUS_DIR } from "../measure.mjs";
import { scanContent } from "../lib/scan.mjs";
import {
  DESIGN_PATTERNS,
  CODE_PATTERNS,
  TEXT_CONSTRUCTS,
  NATIVE_PATTERNS,
  VB_PATTERNS,
  BANNED_WORDS,
  BANNED_PHRASES,
  CONFIDENCE_CLASSES,
} from "../lib/rules.mjs";

const labels = loadLabels();
const ROLES = new Set(["positive", "clean-control", "coverage-boundary"]);

const VALID_RULE_IDS = new Set([
  ...[...DESIGN_PATTERNS, ...CODE_PATTERNS, ...TEXT_CONSTRUCTS, ...NATIVE_PATTERNS, ...VB_PATTERNS].map((r) => r.name),
  ...BANNED_WORDS,
  ...BANNED_PHRASES,
  "emoji",
  "em-dash-density",
]);

// Prose scope `all`, as in measure.mjs: the corpus labels the rules, not a project's policy.
const scan = (entry) =>
  scanContent(readFileSync(join(CORPUS_DIR, entry.file), "utf8"), entry.file, { proseScope: "all" });

// ── Corpus shape ─────────────────────────────────────────────────────────────

test("every labeled fixture exists on disk", () => {
  for (const entry of labels.fixtures) {
    assert.ok(existsSync(join(CORPUS_DIR, entry.file)), `${entry.file} is labeled but missing`);
  }
});

// A typo in a label is invisible without this: the id never fires, so it is scored as a
// false negative forever and reads as a scanner weakness rather than a corpus bug.
test("every expected id is a real rule id", () => {
  for (const entry of labels.fixtures) {
    for (const id of expectedIds(entry)) {
      assert.ok(VALID_RULE_IDS.has(id), `${entry.file} expects "${id}", which is not a rule this scanner has`);
    }
  }
});

test("every fixture declares a valid role, and the role matches its labels", () => {
  for (const entry of labels.fixtures) {
    assert.ok(ROLES.has(entry.role), `${entry.file} has role ${JSON.stringify(entry.role)}`);
    if (entry.role === "positive") {
      assert.ok(expectedIds(entry).length > 0, `positive fixture ${entry.file} expects nothing`);
    } else {
      assert.equal(expectedIds(entry).length, 0, `${entry.role} fixture ${entry.file} must expect nothing`);
      assert.ok(
        Number.isInteger(entry.maxIncidentalFindings),
        `${entry.role} fixture ${entry.file} needs a maxIncidentalFindings tolerance`,
      );
    }
  }
});

// ── The clean-control contract (item 5) ──────────────────────────────────────
// The tolerance is declared per fixture and enforced, not assumed -- and since 2.1.0 it is
// 0 everywhere, because 0 is what the suite has always enforced. Any finding on a negative
// fixture is a false positive by construction, so the precision gate in corpus.test.mjs
// (design tp=49 at 2.1.0, tolerance 0.02, i.e. fp must be 0) fails on the first one. A declared
// tolerance of 1 could therefore never be the failing assertion: it was strictly dominated
// slack that read like real slack, on all 24 negative fixtures.

test("no negative fixture declares a tolerance the precision gate would not allow", () => {
  for (const entry of labels.fixtures) {
    if (entry.role === "positive") continue;
    assert.equal(
      entry.maxIncidentalFindings, 0,
      `${entry.role} ${entry.file} declares a tolerance of ${entry.maxIncidentalFindings}, which the ` +
        "sibling precision gate would fail on first. Either set it to 0, or exclude tolerated " +
        "fixtures from the precision computation so the declared slack is real.",
    );
  }
});

test("clean controls stay within their incidental-findings tolerance", () => {
  for (const entry of labels.fixtures) {
    if (entry.role === "positive") continue;
    const found = scan(entry);
    assert.ok(
      found.length <= entry.maxIncidentalFindings,
      `${entry.role} ${entry.file} produced ${found.length} findings ` +
        `(tolerance ${entry.maxIncidentalFindings}): ${JSON.stringify(found.map(ruleName))}`,
    );
  }
});

// The reason clean controls exist at all. A control that carries no prescribed construct
// cannot catch a scanner that has learned to match constructs instead of defects.
test("the responsive clean controls actually exercise the constructs they defend", () => {
  const web = readFileSync(join(CORPUS_DIR, "design/responsive-type-clean.html"), "utf8");
  for (const construct of ["clamp(", "min(100%", "auto-fit", "prefers-reduced-motion", "!important"]) {
    assert.ok(web.includes(construct), `responsive-type-clean.html no longer contains ${construct}`);
  }
  const native = readFileSync(join(CORPUS_DIR, "native/AdaptiveShell.swift"), "utf8");
  for (const construct of [".adaptive(minimum:", "ViewThatFits", "horizontalSizeClass", "maxWidth:"]) {
    assert.ok(native.includes(construct), `AdaptiveShell.swift no longer contains ${construct}`);
  }
});

// ── Label/scanner grading drift ──────────────────────────────────────────────

test("declared severity and confidence still match what the scanner emits", () => {
  for (const entry of labels.fixtures) {
    const byName = new Map(scan(entry).map((v) => [ruleName(v), v]));
    for (const e of entry.expected) {
      if (typeof e === "string" || e.severity === undefined) continue;
      const actual = byName.get(e.id);
      if (!actual) continue; // scored as a false negative by measure(); not this test's job
      assert.equal(actual.severity, e.severity, `${entry.file}: ${e.id} severity drifted`);
      assert.equal(actual.confidence, e.confidence, `${entry.file}: ${e.id} confidence drifted`);
      assert.ok(CONFIDENCE_CLASSES.includes(e.confidence), `${entry.file}: ${e.id} has an unknown confidence`);
    }
  }
});

// ── Scorer selftest (item 9) ─────────────────────────────────────────────────
// A gate nobody tests can silently pass everything. These run measure() over synthetic
// labels pointing at real corpus files, so the arithmetic is checked independently of
// whatever the scanner currently reports on the real label set.

test("scorer: a fixture whose every expected rule fires scores 1.0/1.0", () => {
  const result = measure({
    fixtures: [{ file: "design/hero-triplet-verbatim.html", modality: "design", role: "positive", expected: [{ id: "tailwind-hero-triplet" }] }],
  });
  assert.equal(result.overall.tp, 1);
  assert.equal(result.overall.fp, 0);
  assert.equal(result.overall.fn, 0);
  assert.equal(result.overall.precision, 1);
  assert.equal(result.overall.recall, 1);
});

test("scorer: one finding cannot satisfy two labels", () => {
  // The file fires tailwind-hero-triplet once. Labelling the same span twice must show up
  // as one hit plus one miss, never as two hits.
  const result = measure({
    fixtures: [{
      file: "design/hero-triplet-verbatim.html", modality: "design", role: "positive",
      expected: [{ id: "tailwind-hero-triplet" }, { id: "generic-font" }],
    }],
  });
  assert.equal(result.overall.tp, 1);
  assert.equal(result.overall.fn, 1);
  assert.equal(result.overall.recall, 0.5);
});

test("scorer: an unlabeled finding is counted as a false positive", () => {
  const result = measure({
    fixtures: [{ file: "design/hero-triplet-verbatim.html", modality: "design", role: "positive", expected: [] }],
  });
  assert.equal(result.overall.tp, 0);
  assert.equal(result.overall.fp, 1);
  assert.equal(result.overall.precision, 0);
});

test("scorer: a clean control that fires is a false positive, not a silent pass", () => {
  const result = measure({
    fixtures: [{ file: "design/uniform-control-radius.html", modality: "design", role: "clean-control", expected: [], maxIncidentalFindings: 1 }],
  });
  assert.ok(result.overall.fp > 0, "a firing clean control must register against precision");
  assert.equal(result.misses.length, 1);
});

test("scorer: an empty label set on a clean file is a vacuous 1.0, not a division by zero", () => {
  const result = measure({
    fixtures: [{ file: "design/fluid-adaptive-clean.html", modality: "design", role: "clean-control", expected: [], maxIncidentalFindings: 1 }],
  });
  assert.equal(result.overall.precision, 1);
  assert.equal(result.overall.recall, 1);
  assert.equal(result.misses.length, 0);
});

test("scorer: per-modality accounting keeps modalities separate", () => {
  const result = measure({
    fixtures: [
      { file: "design/hero-triplet-verbatim.html", modality: "design", role: "positive", expected: [{ id: "tailwind-hero-triplet" }] },
      { file: "native/AdaptiveShell.swift", modality: "native", role: "clean-control", expected: [], maxIncidentalFindings: 1 },
    ],
  });
  const byModality = new Map(result.modalities.map((m) => [m.modality, m]));
  assert.equal(byModality.get("design").tp, 1);
  assert.equal(byModality.get("native").tp, 0);
  assert.equal(byModality.get("native").fp, 0);
});
