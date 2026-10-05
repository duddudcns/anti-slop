import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// The PostToolUse slop-scan hook shipped in hooks/: advisory, one file, Taste notes left out.
const here = dirname(fileURLToPath(import.meta.url));
const HOOK = join(here, "..", "..", "hooks", "slop-scan-hook.cjs");
const { formatFindings, projectRoot } = createRequire(import.meta.url)(HOOK);

const runHook = (input) =>
  spawnSync(process.execPath, [HOOK], { input: typeof input === "string" ? input : JSON.stringify(input), encoding: "utf8" });
const tmpFile = (name, content) => {
  const p = join(mkdtempSync(join(tmpdir(), "slophook-")), name);
  writeFileSync(p, content);
  return p;
};

test("hooks.json registers the hook on Edit/Write via CLAUDE_PLUGIN_ROOT", () => {
  const cfg = JSON.parse(readFileSync(join(here, "..", "..", "hooks", "hooks.json"), "utf8"));
  const entry = cfg.hooks.PostToolUse[0];
  assert.match(entry.matcher, /Edit/);
  assert.match(entry.hooks[0].command, /\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/slop-scan-hook\.cjs/);
});

test("formatFindings drops Taste notes and keeps low-severity quality findings", () => {
  const report = { files: [{ violations: [
    { name: "banner-comment", confidence: "Taste note", severity: "low", line: 1, desc: "banner" },
    { name: "vb-bool-return-branch", confidence: "Quality defect", severity: "low", line: 3, desc: "bool" },
  ] }] };
  const msg = formatFindings(report, "M.vb");
  assert.match(msg, /vb-bool-return-branch/);
  assert.doesNotMatch(msg, /banner-comment/);
  assert.equal(formatFindings({ files: [{ violations: [report.files[0].violations[0]] }] }, "M.vb"), null);
});

test("hook reports a VB empty Catch as additionalContext and exits 0", () => {
  const r = runHook({ tool_name: "Write", tool_input: { file_path: tmpFile("M.vb", "Sub F()\r\nTry\r\nX()\r\nCatch ex As Exception\r\nEnd Try\r\nEnd Sub\r\n") } });
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.equal(out.hookSpecificOutput.hookEventName, "PostToolUse");
  assert.match(out.hookSpecificOutput.additionalContext, /vb-empty-catch/);
});

test("projectRoot walks up to the folder holding .anti-slop/ (so its config is read)", () => {
  const root = mkdtempSync(join(tmpdir(), "sloproot-"));
  mkdirSync(join(root, ".anti-slop"));
  writeFileSync(join(root, ".anti-slop", "config.json"), "{}");
  mkdirSync(join(root, "src", "deep", ".anti-slop"), { recursive: true }); // registry-style folder, no config
  const file = join(root, "src", "deep", "M.vb");
  writeFileSync(file, "x");
  assert.equal(projectRoot(file), root);
  // A nested repo below the config root does not hide the config.
  mkdirSync(join(root, "src", ".git"));
  assert.equal(projectRoot(file), root);
});

test("projectRoot falls back to the nearest .git, then the session cwd", () => {
  const root = mkdtempSync(join(tmpdir(), "sloprepo-"));
  mkdirSync(join(root, ".git"));
  mkdirSync(join(root, "a"));
  const file = join(root, "a", "M.vb");
  writeFileSync(file, "x");
  assert.equal(projectRoot(file), root);
});

test("hook stays silent on clean code, non-code files, and bad input", () => {
  assert.equal(runHook({ tool_input: { file_path: tmpFile("M.vb", "Sub F()\r\nX()\r\nEnd Sub\r\n") } }).stdout, "");
  assert.equal(runHook({ tool_input: { file_path: tmpFile("notes.md", "we delve into the tapestry\n") } }).stdout, "");
  const r = runHook("not json");
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "");
});
