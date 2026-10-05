#!/usr/bin/env node
// PostToolUse(Edit|Write): scan the one code file just written and hand the findings to the
// agent as additionalContext. Advisory only: it always exits 0, because fixing is the agent's
// job and a scanner false positive must never block an edit. Taste notes are left out (they
// are style preferences and would repeat on every edit of an older file); every other
// confidence class is reported regardless of severity.
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const CODE_EXTS = new Set([".vb", ".cs", ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".py", ".go", ".rs", ".java", ".html", ".htm", ".vue", ".svelte"]);
const SKIP_CONFIDENCE = "Taste note";
const MAX_LISTED = 12;
const SCANNER = process.env.ANTI_SLOP_SCANNER || path.join(__dirname, "..", "scripts", "slop-scanner.mjs");

// Scanner JSON report -> short message for the agent, or null when nothing is worth saying.
function formatFindings(report, filePath) {
  const violations = (report.files || []).flatMap((f) => f.violations || []);
  const kept = violations.filter((v) => v.confidence !== SKIP_CONFIDENCE);
  if (kept.length === 0) return null;
  const lines = kept.slice(0, MAX_LISTED).map((v) => {
    const rule = v.name || v.word || v.phrase || v.type;
    // One entry per rule: `line` is the first hit, `(Nx)` in desc is the total.
    return `- first at line ${v.line ?? "?"} [${v.severity}] ${rule}: ${v.desc}`;
  });
  if (kept.length > MAX_LISTED) lines.push(`- ... ${kept.length - MAX_LISTED} more`);
  return `[anti-slop] ${path.basename(filePath)}: ${kept.length} finding(s). Fix the ones this edit introduced; pre-existing ones can be left.\n${lines.join("\n")}`;
}

function main() {
  let input;
  try { input = JSON.parse(fs.readFileSync(0, "utf8")); } catch { return; }
  const filePath = input?.tool_input?.file_path;
  if (!filePath || !CODE_EXTS.has(path.extname(filePath).toLowerCase()) || !fs.existsSync(filePath)) return;
  if (!fs.existsSync(SCANNER)) return;
  let out;
  // cwd = the file's folder: fine while CODE_EXTS has no prose files. If prose is ever
  // added, run from the project root so .anti-slop/config.json (prose scope) is found.
  try {
    out = execFileSync(process.execPath, [SCANNER, "scan", "--format", "json", "--fail-on", "none", filePath], {
      encoding: "utf8", timeout: 15000, cwd: path.dirname(filePath),
    });
  } catch { return; }
  let report;
  try { report = JSON.parse(out); } catch { return; }
  const msg = formatFindings(report, filePath);
  if (!msg) return;
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: msg } }));
}

if (require.main === module) {
  try { main(); } catch { /* advisory hook: never block the edit */ }
  process.exit(0);
}

module.exports = { formatFindings, CODE_EXTS };
