#!/usr/bin/env node
// Edit/Write/MultiEdit slop alerts, split into what THIS edit introduced and what was there.
//   pre  (PreToolUse):  save the file's current content (or "did not exist") to a snapshot.
//   post (PostToolUse): scan the snapshot and the new content in-process, compare every
//                       occurrence, report new findings first and pre-existing ones after.
// Advisory only: always exits 0. Taste notes are left out (style preferences that would
// repeat on every edit of an older file); every other confidence class is reported.
// Without a snapshot (pre did not run) findings are reported unattributed, never as "new".
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { pathToFileURL } = require("url");

const CODE_EXTS = new Set([".vb", ".cs", ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".py", ".go", ".rs", ".java", ".html", ".htm", ".vue", ".svelte"]);
const SKIP_CONFIDENCE = "Taste note";
const MAX_LISTED = 12;
const MAX_SNAPSHOT_BYTES = 5 * 1024 * 1024;
const SCAN_LIB = process.env.ANTI_SLOP_SCAN_LIB || path.join(__dirname, "..", "scripts", "lib", "scan.mjs");
const SNAP_DIR = process.env.ANTI_SLOP_SNAP_DIR || path.join(os.tmpdir(), "claude-anti-slop-snapshots");

const ruleKey = (v) => v.name || v.word || v.phrase || v.type;

function snapPath(input, filePath) {
  const id = `${input.session_id || "nosession"}|${path.resolve(filePath).toLowerCase()}`;
  return path.join(SNAP_DIR, crypto.createHash("sha1").update(id).digest("hex") + ".json");
}

// The scanner reads .anti-slop/config.json (allowedWords, prose scope) from its cwd, so run
// it from the project root: a config anywhere up the tree wins over a nearer nested repo,
// else the nearest .git, else the session cwd, else the file's folder. UNC paths skip the walk.
function projectRoot(filePath, sessionCwd) {
  const start = path.dirname(path.resolve(filePath));
  const fallback = sessionCwd && fs.existsSync(sessionCwd) ? sessionCwd : start;
  if (start.startsWith("\\\\")) return fallback;
  const ancestors = [];
  for (let dir = start; ; dir = path.dirname(dir)) {
    ancestors.push(dir);
    if (path.dirname(dir) === dir) break;
  }
  return ancestors.find((d) => fs.existsSync(path.join(d, ".anti-slop", "config.json")))
    || ancestors.find((d) => fs.existsSync(path.join(d, ".git")))
    || fallback;
}

// Occurrence lines -> normalized source text, so a finding that only moved (lines inserted
// above it) still matches its old self.
function occurrenceTexts(v, content) {
  if (!Array.isArray(v.lines)) return null;
  const src = content.split("\n");
  return v.lines.map((n) => (src[n - 1] || "").replace(/\s+/g, " ").trim());
}

// Split the after-scan into { added, kept }. A rule with occurrence lines is compared as a
// multiset of line texts; a rule without them (file-level) by count only.
function classify(after, before, afterText, beforeText) {
  const beforeByKey = new Map(before.map((v) => [ruleKey(v), v]));
  const added = [];
  const kept = [];
  for (const v of after) {
    const b = beforeByKey.get(ruleKey(v));
    if (!b) { added.push({ v, lines: v.lines || [v.line] }); continue; }
    const at = occurrenceTexts(v, afterText);
    const bt = occurrenceTexts(b, beforeText);
    if (at && bt) {
      const pool = new Map();
      for (const t of bt) pool.set(t, (pool.get(t) || 0) + 1);
      const newLines = [];
      const oldLines = [];
      at.forEach((t, i) => {
        if (pool.get(t) > 0) { pool.set(t, pool.get(t) - 1); oldLines.push(v.lines[i]); }
        else newLines.push(v.lines[i]);
      });
      if (newLines.length) added.push({ v, lines: newLines });
      if (oldLines.length) kept.push({ v, lines: oldLines });
    } else if (v.count > b.count) {
      added.push({ v, lines: [v.line], delta: v.count - b.count });
      kept.push({ v, lines: [b.line], count: b.count });
    } else {
      kept.push({ v, lines: [v.line] });
    }
  }
  return { added, kept };
}

const fmtLines = (lines) => {
  const ls = [...new Set(lines.filter((n) => n != null))].sort((a, b) => a - b);
  return ls.length ? `line ${ls.slice(0, 5).join(", ")}${ls.length > 5 ? ` (+${ls.length - 5})` : ""}` : "line ?";
};
const fmtEntry = ({ v, lines, delta }) =>
  `- ${fmtLines(lines)} [${v.severity}] ${ruleKey(v)}: ${v.desc}${delta ? ` (+${delta} vs before)` : ""}`;

function formatReport(fileName, added, kept, attributed) {
  const out = [];
  if (!attributed) {
    if (!kept.length) return null;
    out.push(`[anti-slop] ${fileName}: ${kept.length} finding(s) (no pre-edit snapshot, so new vs pre-existing is unknown).`);
    out.push(...kept.slice(0, MAX_LISTED).map(fmtEntry));
    if (kept.length > MAX_LISTED) out.push(`- ... ${kept.length - MAX_LISTED} more`);
    return out.join("\n");
  }
  if (!added.length && !kept.length) return null;
  if (added.length) {
    out.push(`[anti-slop] ${fileName}: ${added.length} finding(s) introduced by this edit. Fix these now:`);
    out.push(...added.slice(0, MAX_LISTED).map(fmtEntry));
    if (added.length > MAX_LISTED) out.push(`- ... ${added.length - MAX_LISTED} more`);
  }
  if (kept.length) {
    out.push(`${added.length ? "" : `[anti-slop] ${fileName}: `}${kept.length} pre-existing finding(s) in this file. Clean them up in a separate commit (leave other sessions' uncommitted lines alone; large restructures go to the todo list):`);
    const room = Math.max(3, MAX_LISTED - Math.min(added.length, MAX_LISTED));
    out.push(...kept.slice(0, room).map(({ v, lines }) => `- ${fmtLines(lines)} ${ruleKey(v)}`));
    if (kept.length > room) out.push(`- ... ${kept.length - room} more`);
  }
  return out.join("\n");
}

function readInput() {
  try { return JSON.parse(fs.readFileSync(0, "utf8")); } catch { return null; }
}

function targetFile(input) {
  const filePath = input?.tool_input?.file_path;
  if (!filePath || !CODE_EXTS.has(path.extname(filePath).toLowerCase())) return null;
  return filePath;
}

function pre(input) {
  const filePath = targetFile(input);
  if (!filePath) return;
  let snap = { exists: false };
  if (fs.existsSync(filePath)) {
    if (fs.statSync(filePath).size > MAX_SNAPSHOT_BYTES) return;
    snap = { exists: true, content: fs.readFileSync(filePath, "utf8") };
  }
  fs.mkdirSync(SNAP_DIR, { recursive: true });
  fs.writeFileSync(snapPath(input, filePath), JSON.stringify(snap));
}

async function post(input) {
  const filePath = targetFile(input);
  if (!filePath || !fs.existsSync(filePath)) return;
  const sp = snapPath(input, filePath);
  let snap = null;
  try { snap = JSON.parse(fs.readFileSync(sp, "utf8")); fs.unlinkSync(sp); } catch { snap = null; }

  // store.mjs captures process.cwd() at import time, so chdir before importing the scanner.
  process.chdir(projectRoot(filePath, input.cwd));
  const { scanContent } = await import(pathToFileURL(SCAN_LIB).href);
  const visible = (vs) => vs.filter((v) => v.confidence !== SKIP_CONFIDENCE && !v.suppressed);
  const afterText = fs.readFileSync(filePath, "utf8");
  const after = visible(scanContent(afterText, filePath, { allOccurrences: true }));

  let msg;
  if (!snap) {
    msg = formatReport(path.basename(filePath), [], after.map((v) => ({ v, lines: v.lines || [v.line] })), false);
  } else {
    const beforeText = snap.exists ? snap.content : "";
    const before = snap.exists ? visible(scanContent(beforeText, filePath, { allOccurrences: true })) : [];
    const { added, kept } = classify(after, before, afterText, beforeText);
    msg = formatReport(path.basename(filePath), added, kept, true);
  }
  if (!msg) return;
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: msg } }));
}

if (require.main === module) {
  const mode = process.argv[2] === "pre" ? "pre" : "post";
  const input = readInput();
  const done = () => process.exit(0);
  if (!input) done();
  else if (mode === "pre") { try { pre(input); } catch { /* advisory */ } done(); }
  else post(input).catch(() => {}).finally(done);
}

module.exports = { classify, formatReport, projectRoot, snapPath, CODE_EXTS };
