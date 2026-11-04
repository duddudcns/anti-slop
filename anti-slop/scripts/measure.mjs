#!/usr/bin/env node
// Precision/recall measurement harness for the labeled corpus in test/corpus/.
//
// For each labeled file, scanContent runs and the set of FIRED rule names is compared
// against the file's LABELED expected set (ground truth, hand-authored -- see
// test/corpus/README.md):
//   expected AND fired      -> true positive  (TP)
//   fired NOT IN expected   -> false positive (FP)
//   expected NOT IN fired   -> false negative (FN)
//
// This is a MEASUREMENT, not a gate: it always exits 0. test/corpus.test.mjs is the
// gate that compares a fresh measurement against the committed baseline.
//
// Usage:
//   node measure.mjs               human-readable table
//   node measure.mjs --format json machine-readable {rules, modalities, overall, misses}

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { scanContent } from "./lib/scan.mjs";
import { findDesignMd, readDesignSystem } from "./lib/design-detect.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const CORPUS_DIR = join(__dirname, "test", "corpus");
export const LABELS_PATH = join(CORPUS_DIR, "labels.json");

// Same rule-key convention as lib/dashboard.html's ruleName(): which field identifies
// the rule varies by violation type (banned words use `word`, phrases use `phrase`,
// everything else uses `name`, and emoji/misc fall back to `type`).
export function ruleName(v) {
  return v.name || v.word || v.phrase || v.type || "unknown";
}

export function loadLabels(labelsPath = LABELS_PATH) {
  return JSON.parse(readFileSync(labelsPath, "utf8"));
}

// An `expected` entry is either a bare rule id or `{ id, severity?, confidence? }`. The
// harness matches on id alone; severity and confidence ride along so a change in how a
// rule GRADES a finding shows up in review (and in corpus-contract.test.mjs) instead of
// passing silently because the rule still fires.
export function expectedIds(entry) {
  return (entry.expected || []).map((e) => (typeof e === "string" ? e : e.id));
}

// ── Compare one labeled file's actual scan against its expected set ──
function scanLabeled(entry, corpusDir) {
  const absPath = join(corpusDir, entry.file);
  const content = readFileSync(absPath, "utf8");
  // Pass the LABELED path (not the resolved absolute path) as the scan's filePath: this
  // is what decides extension-based modality detection and the isTestFile skipInTests
  // gate, so a corpus author's choice of path in labels.json is what actually governs
  // scanner behavior for that sample -- exactly like a real project file would. The
  // prose fixtures are labeled tells, so they are scanned under prose scope `all`: the
  // measurement is of the rules, and the user-facing default is a project policy.
  // A fixture under a directory with its own DESIGN.md is scanned with it, as the CLI would.
  const designSystem = readDesignSystem(findDesignMd(absPath));
  const violations = scanContent(content, entry.file, { proseScope: "all", designSystem });
  const fired = new Set(violations.map(ruleName));
  const expected = new Set(expectedIds(entry));
  const tp = [...fired].filter((r) => expected.has(r));
  const fp = [...fired].filter((r) => !expected.has(r));
  const fn = [...expected].filter((r) => !fired.has(r));
  return { tp, fp, fn };
}

function precisionRecall(tp, fp, fn) {
  // No fired/expected rules at all is a vacuous 100% (nothing to get wrong), matching
  // the usual convention for precision/recall on an empty prediction/label set.
  const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
  return { precision, recall };
}

function bump(map, key, field, n) {
  const cur = map.get(key) || { tp: 0, fp: 0, fn: 0 };
  cur[field] += n;
  map.set(key, cur);
}

export function measure(labels = loadLabels(), corpusDir = CORPUS_DIR) {
  const perRule = new Map();
  const perModality = new Map();
  const overall = { tp: 0, fp: 0, fn: 0 };
  const misses = [];

  for (const entry of labels.fixtures) {
    const { tp, fp, fn } = scanLabeled(entry, corpusDir);
    for (const r of tp) bump(perRule, r, "tp", 1);
    for (const r of fp) bump(perRule, r, "fp", 1);
    for (const r of fn) bump(perRule, r, "fn", 1);
    bump(perModality, entry.modality, "tp", tp.length);
    bump(perModality, entry.modality, "fp", fp.length);
    bump(perModality, entry.modality, "fn", fn.length);
    overall.tp += tp.length;
    overall.fp += fp.length;
    overall.fn += fn.length;
    if (fp.length || fn.length) misses.push({ file: entry.file, modality: entry.modality, fp, fn });
  }

  const rules = [...perRule.entries()]
    .map(([rule, c]) => ({ rule, ...c, ...precisionRecall(c.tp, c.fp, c.fn) }))
    .sort((a, b) => a.rule.localeCompare(b.rule));
  const modalities = [...perModality.entries()]
    .map(([modality, c]) => ({ modality, ...c, ...precisionRecall(c.tp, c.fp, c.fn) }))
    .sort((a, b) => a.modality.localeCompare(b.modality));
  const overallResult = { ...overall, ...precisionRecall(overall.tp, overall.fp, overall.fn) };

  return { rules, modalities, overall: overallResult, misses };
}

function pct(n) {
  return (n * 100).toFixed(1) + "%";
}

function row(cells, widths) {
  return cells.map((c, i) => String(c).padEnd(widths[i])).join("").trimEnd();
}

function formatTable(result) {
  const lines = [];
  lines.push("Per-rule:");
  const ruleWidths = [34, 5, 5, 5, 11, 9];
  lines.push(row(["rule", "tp", "fp", "fn", "precision", "recall"], ruleWidths));
  for (const r of result.rules) {
    lines.push(row([r.rule, r.tp, r.fp, r.fn, pct(r.precision), pct(r.recall)], ruleWidths));
  }
  lines.push("");
  lines.push("Per-modality:");
  const modWidths = [14, 5, 5, 5, 11, 9];
  lines.push(row(["modality", "tp", "fp", "fn", "precision", "recall"], modWidths));
  for (const m of result.modalities) {
    lines.push(row([m.modality, m.tp, m.fp, m.fn, pct(m.precision), pct(m.recall)], modWidths));
  }
  lines.push("");
  lines.push(
    row(
      ["Overall", result.overall.tp, result.overall.fp, result.overall.fn, pct(result.overall.precision), pct(result.overall.recall)],
      modWidths,
    ),
  );
  if (result.misses.length) {
    lines.push("");
    lines.push("Misses (FP/FN) by file:");
    for (const m of result.misses) {
      const parts = [];
      if (m.fp.length) parts.push(`FP: ${m.fp.join(", ")}`);
      if (m.fn.length) parts.push(`FN: ${m.fn.join(", ")}`);
      lines.push(`  ${m.file} [${m.modality}] -- ${parts.join(" | ")}`);
    }
  }
  return lines.join("\n");
}

function parseArgs(argv) {
  const idx = argv.indexOf("--format");
  return { format: idx === -1 ? "text" : argv[idx + 1] };
}

function main() {
  const { format } = parseArgs(process.argv.slice(2));
  const result = measure();
  console.log(format === "json" ? JSON.stringify(result, null, 2) : formatTable(result));
  process.exit(0);
}

// Only auto-run when executed directly (`node measure.mjs`), not when imported by tests.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
