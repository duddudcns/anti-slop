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
const SNAPSHOT_TTL_MS = 10 * 60 * 1000;
const SCAN_LIB = process.env.ANTI_SLOP_SCAN_LIB || path.join(__dirname, "..", "scripts", "lib", "scan.mjs");
const SNAP_DIR = process.env.ANTI_SLOP_SNAP_DIR || path.join(os.tmpdir(), "claude-anti-slop-snapshots");

const ruleKey = (v) => v.name || v.word || v.phrase || v.type;

// One snapshot per tool call when the harness sends tool_use_id (pre and post of the same
// call share it), so overlapping edits to one file cannot take each other's baseline.
// Paths fold case only on Windows, where A.vb and a.vb are the same file.
function snapPath(input, filePath) {
  const abs = path.resolve(filePath);
  const file = process.platform === "win32" ? abs.toLowerCase() : abs;
  const id = input.tool_use_id || `${input.session_id || "nosession"}|${file}`;
  return path.join(SNAP_DIR, crypto.createHash("sha1").update(id).digest("hex") + ".json");
}

// The "pre-existing list already shown" marker is per session and file, not per call.
function listedMarkPath(input, filePath) {
  const abs = path.resolve(filePath);
  const file = process.platform === "win32" ? abs.toLowerCase() : abs;
  return path.join(SNAP_DIR, crypto.createHash("sha1").update(`${input.session_id || "nosession"}|${file}`).digest("hex") + ".listed");
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
// Line mapping from the unchanged head and tail of the file (common prefix / suffix lines).
function lineMap(afterText, beforeText) {
  const A = afterText.split("\n");
  const B = beforeText.split("\n");
  let p = 0;
  while (p < A.length && p < B.length && A[p] === B[p]) p++;
  let s = 0;
  while (s < A.length - p && s < B.length - p && A[A.length - 1 - s] === B[B.length - 1 - s]) s++;
  return {
    // after line (1-based) -> before line, or null when it lies in the edited region
    toBefore: (n) => (n <= p ? n : n > A.length - s ? n - (A.length - B.length) : null),
    inRegionBefore: (n) => n > p && n <= B.length - s,
  };
}

function classify(after, before, afterText, beforeText) {
  const map = lineMap(afterText, beforeText);
  const beforeByKey = new Map(before.map((v) => [ruleKey(v), v]));
  const added = [];
  const kept = [];
  for (const v of after) {
    const b = beforeByKey.get(ruleKey(v));
    if (!b) { added.push({ v, lines: v.lines || [v.line] }); continue; }
    const at = occurrenceTexts(v, afterText);
    const bt = occurrenceTexts(b, beforeText);
    if (at && bt) {
      // Outside the edited region a line maps straight back to its old number, so an
      // occurrence there is pre-existing exactly when the old line had one. Inside the region
      // positions shift unpredictably, so it falls back to matching line text against the old
      // region's occurrences. This tells a new empty Catch from an old one that was fixed when
      // the two sit in different places (one contiguous edit, as Edit makes).
      const oldAt = new Set(b.lines);
      const pool = new Map();
      b.lines.forEach((n, i) => { if (map.inRegionBefore(n)) pool.set(bt[i], (pool.get(bt[i]) || 0) + 1); });
      const newLines = [];
      const oldLines = [];
      at.forEach((t, i) => {
        const n = v.lines[i];
        const m = map.toBefore(n);
        if (m !== null) { (oldAt.has(m) ? oldLines : newLines).push(n); return; }
        if (pool.get(t) > 0) { pool.set(t, pool.get(t) - 1); oldLines.push(n); }
        else newLines.push(n);
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

// `keptListed`: the pre-existing list was already shown for this file in this session, so it
// shrinks to one line instead of repeating on every edit.
function formatReport(fileName, addedEntries, keptEntries, attributed, keptListed = false) {
  const out = [];
  // Counts are occurrences, not rule groups: 14 empty Catches read as 14.
  const total = (es) => es.reduce((n, e) => n + (e.delta || e.count || e.lines.filter((l) => l != null).length || 1), 0);
  const added = addedEntries;
  const kept = keptEntries;
  const nAdded = total(added);
  const nKept = total(kept);
  if (!attributed) {
    if (!kept.length) return null;
    out.push(`[anti-slop] ${fileName}: ${nKept} finding(s) (no pre-edit snapshot, so new vs pre-existing is unknown).`);
    out.push(...kept.slice(0, MAX_LISTED).map(fmtEntry));
    if (kept.length > MAX_LISTED) out.push(`- ... ${kept.length - MAX_LISTED} more`);
    return out.join("\n");
  }
  if (!added.length && !kept.length) return null;
  if (added.length) {
    out.push(`[anti-slop] ${fileName}: ${nAdded} finding(s) introduced by this edit. Fix these now:`);
    out.push(...added.slice(0, MAX_LISTED).map(fmtEntry));
    if (added.length > MAX_LISTED) out.push(`- ... ${added.length - MAX_LISTED} more`);
  }
  if (kept.length && keptListed) {
    out.push(`${added.length ? "" : `[anti-slop] ${fileName}: `}${nKept} pre-existing finding(s) in this file (listed earlier this session).`);
  } else if (kept.length) {
    out.push(`${added.length ? "" : `[anti-slop] ${fileName}: `}${nKept} pre-existing finding(s) in this file. Clean them up in a separate commit (leave other sessions' uncommitted lines alone; large restructures go to the todo list):`);
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
  const sp = snapPath(input, filePath);
  // Drop any older snapshot first, so an early return below can never leave a stale one
  // for the next post to compare against.
  try { fs.unlinkSync(sp); } catch { /* none */ }
  let snap = { exists: false, t: Date.now() };
  if (fs.existsSync(filePath)) {
    if (fs.statSync(filePath).size > MAX_SNAPSHOT_BYTES) return;
    snap = { exists: true, content: fs.readFileSync(filePath, "utf8"), t: Date.now() };
  }
  fs.mkdirSync(SNAP_DIR, { recursive: true });
  // Write then rename, so a concurrent post never reads half a snapshot.
  const tmp = `${sp}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(snap));
  fs.renameSync(tmp, sp);
}

async function post(input) {
  const filePath = targetFile(input);
  if (!filePath) return;
  const sp = snapPath(input, filePath);
  let snap = null;
  try { snap = JSON.parse(fs.readFileSync(sp, "utf8")); } catch { snap = null; }
  try { fs.unlinkSync(sp); } catch { /* none */ }
  // A snapshot older than this belongs to some earlier, failed edit: not this one's baseline.
  if (snap && !(Date.now() - (snap.t || 0) < SNAPSHOT_TTL_MS)) snap = null;
  if (!fs.existsSync(filePath)) return;

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
    const listedMark = listedMarkPath(input, filePath);
    msg = formatReport(path.basename(filePath), added, kept, true, fs.existsSync(listedMark));
    if (kept.length) { try { fs.writeFileSync(listedMark, ""); } catch { /* advisory */ } }
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
