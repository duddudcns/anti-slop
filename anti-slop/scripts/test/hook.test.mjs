import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// The Edit/Write slop hook shipped in hooks/: a PreToolUse snapshot plus a PostToolUse scan
// that splits findings into "introduced by this edit" and "pre-existing". Advisory only.
const here = dirname(fileURLToPath(import.meta.url));
const HOOK = join(here, "..", "..", "hooks", "slop-scan-hook.cjs");
const { classify, projectRoot } = createRequire(import.meta.url)(HOOK);
const SNAP_DIR = mkdtempSync(join(tmpdir(), "slopsnap-"));

const run = (mode, filePath, session = "s1") =>
  spawnSync(process.execPath, [HOOK, mode], {
    input: JSON.stringify({ session_id: session, tool_name: "Edit", tool_input: { file_path: filePath } }),
    encoding: "utf8",
    env: { ...process.env, ANTI_SLOP_SNAP_DIR: SNAP_DIR },
  });
const report = (r) => (r.stdout ? JSON.parse(r.stdout).hookSpecificOutput.additionalContext : "");
const tmpFile = (name, content) => {
  const p = join(mkdtempSync(join(tmpdir(), "slophook-")), name);
  if (content !== undefined) writeFileSync(p, content);
  return p;
};
const crlf = (...l) => l.join("\r\n") + "\r\n";
const EMPTY_CATCH = ["Try", "X()", "Catch ex As Exception", "End Try"];

test("hooks.json registers pre on PreToolUse and post on PostToolUse via CLAUDE_PLUGIN_ROOT", () => {
  const cfg = JSON.parse(readFileSync(join(here, "..", "..", "hooks", "hooks.json"), "utf8"));
  assert.match(cfg.hooks.PreToolUse[0].hooks[0].command, /slop-scan-hook\.cjs" pre/);
  assert.match(cfg.hooks.PostToolUse[0].hooks[0].command, /slop-scan-hook\.cjs" post/);
  for (const ev of ["PreToolUse", "PostToolUse"]) assert.match(cfg.hooks[ev][0].matcher, /Edit/);
});

test("a finding added by the edit is 'introduced'; one already there is 'pre-existing'", () => {
  const f = tmpFile("M.vb", crlf("Sub A()", ...EMPTY_CATCH, "End Sub"));
  assert.equal(run("pre", f).status, 0);
  writeFileSync(f, crlf("Sub A()", ...EMPTY_CATCH, "End Sub", "Sub B()", ...EMPTY_CATCH, "End Sub"));
  const r = run("post", f);
  assert.equal(r.status, 0);
  const msg = report(r);
  assert.match(msg, /1 finding\(s\) introduced by this edit/);
  assert.match(msg, /line 10 .*vb-empty-catch/);
  assert.match(msg, /pre-existing[\s\S]*line 4 vb-empty-catch/);
  assert.match(msg, /1 pre-existing finding\(s\)/);
});

test("lines inserted above an old finding do not make it look new", () => {
  const f = tmpFile("M.vb", crlf("Sub A()", ...EMPTY_CATCH, "End Sub"));
  run("pre", f);
  writeFileSync(f, crlf("' header", "Imports System", "Sub A()", ...EMPTY_CATCH, "End Sub"));
  const msg = report(run("post", f));
  assert.doesNotMatch(msg, /introduced by this edit/);
  assert.match(msg, /1 pre-existing finding\(s\)/);
});

test("a brand-new file reports everything as introduced; the snapshot is removed afterwards", () => {
  const f = tmpFile("New.vb");
  run("pre", f);
  writeFileSync(f, crlf("Sub A()", ...EMPTY_CATCH, "End Sub"));
  assert.match(report(run("post", f)), /introduced by this edit/);
  assert.equal(readdirSync(SNAP_DIR).length, 0);
});

test("without a snapshot findings are unattributed, never called new", () => {
  const f = tmpFile("M.vb", crlf("Sub A()", ...EMPTY_CATCH, "End Sub"));
  const msg = report(run("post", f, "other-session"));
  assert.match(msg, /new vs pre-existing is unknown/);
  assert.doesNotMatch(msg, /introduced by this edit/);
});

test("fixing a finding while adding a different one counts the new one as introduced", () => {
  const before = { v: { name: "vb-empty-catch", count: 1, line: 3, lines: [3] } };
  const after = [{ name: "vb-empty-catch", count: 1, line: 7, lines: [7], severity: "medium", desc: "d" }];
  const { added, kept } = classify(after, [before.v], "a\nb\nCatch ex As IOException\n\n\n\nCatch ex As Exception\n", "a\nb\nCatch ex As IOException\n");
  assert.equal(added.length, 1);
  assert.equal(kept.length, 0);
});

test("projectRoot walks up to the folder holding .anti-slop/config.json, over a nested .git", () => {
  const root = mkdtempSync(join(tmpdir(), "sloproot-"));
  mkdirSync(join(root, ".anti-slop"));
  writeFileSync(join(root, ".anti-slop", "config.json"), "{}");
  mkdirSync(join(root, "src", "deep", ".anti-slop"), { recursive: true });
  mkdirSync(join(root, "src", ".git"));
  const file = join(root, "src", "deep", "M.vb");
  writeFileSync(file, "x");
  assert.equal(projectRoot(file), root);
});

test("clean code, non-code files and bad input stay silent with exit 0", () => {
  const clean = tmpFile("M.vb", crlf("Sub F()", "X()", "End Sub"));
  run("pre", clean);
  assert.equal(run("post", clean).stdout, "");
  const md = tmpFile("notes.md", "we delve into the tapestry\n");
  assert.equal(run("post", md).stdout, "");
  for (const mode of ["pre", "post"]) {
    const r = spawnSync(process.execPath, [HOOK, mode], { input: "not json", encoding: "utf8" });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, "");
  }
  assert.ok(!existsSync(join(SNAP_DIR, "missing")));
});
