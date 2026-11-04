import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { scanContent, calculateScore } from "../lib/scan.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = dirname(HERE);
const ENTRY_PATH = join(SCRIPTS_DIR, "slop-scanner.mjs");

const SLOP_MD = 'This is delve. This is delve. This is delve.\n';
const SECRET_JS = 'const config = { password: "hunter2-not-a-real-value" };\n';

// Every child runs with its own scratch cwd so .anti-slop/ never touches the repo's own data,
// and each gets a fresh temp dir per test to keep --record assertions isolated.
function scratchDir() {
  return mkdtempSync(join(tmpdir(), "anti-slop-cli-"));
}

function runCli(args, cwd) {
  return spawnSync(process.execPath, [ENTRY_PATH, "scan", ...args], { cwd, encoding: "utf8" });
}

// The same entry point without the implicit `scan`, for the subcommand and help paths.
function runRaw(args, cwd) {
  return spawnSync(process.execPath, [ENTRY_PATH, ...args], { cwd, encoding: "utf8" });
}

// ── A2: text report on a slop file ──

test("A2: scan on a slop file exits 1 with a readable 'Scan score: N/50' report", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, "slop.md"), SLOP_MD);
    const result = runCli(["slop.md"], dir);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /Scan score: \d+\/50/);
    assert.match(result.stdout, /delve/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── The text report is the surface a model reads (2.4.0) ─────────────────────
// Through 2.3.2 a text finding was `[SEVERITY] desc` and nothing else: no rule id to look
// up, no line to open, no confidence class to weigh it against, and no remediation. That
// is the incomplete finding references/confidence-and-evidence.md says gets closed by
// deletion, and it is why every finding now prints its context line and an indented fix.
test("a text finding names its rule, line, confidence and fix", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, "app.js"), "const a = 1;\nelement.innerHTML = userInput;\n");
    const result = runCli(["app.js"], dir);
    assert.equal(result.status, 1);
    const finding = result.stdout.split("\n").find((l) => l.startsWith("[HIGH]"));
    assert.ok(finding, `no finding line in:\n${result.stdout}`);
    assert.match(finding, /\(innerhtml-usage, line 2, Hard defect\)$/);
    assert.match(result.stdout, /^ {2}fix: \S.*$/m, `no indented fix line in:\n${result.stdout}`);
    // The fix must follow its own finding, not float at the end of the report.
    const lines = result.stdout.split("\n");
    assert.match(lines[lines.indexOf(finding) + 1], /^ {2}fix: /);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// The header is quoted verbatim by commands/slop-check.md and the README walkthrough, so
// it is pinned separately from the finding lines that now sit under it.
test("the scan header line is unchanged by the finding format", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, "slop.md"), SLOP_MD);
    const result = runCli(["slop.md"], dir);
    assert.match(result.stdout, /^Scan score: \d+\/50 \| [A-Z]+ \| \d+ violation\(s\)$/m);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── A2: --format json shape, nothing else on stdout ──

test("A2: --format json emits the D5 JSON shape and nothing else on stdout", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, "slop.md"), SLOP_MD);
    const result = runCli(["--format", "json", "slop.md"], dir);
    assert.equal(result.status, 1);
    const parsed = JSON.parse(result.stdout);
    assert.ok(Array.isArray(parsed.files) && parsed.files.length === 1);
    const [file] = parsed.files;
    assert.equal(file.file, "slop.md");
    assert.ok(Number.isInteger(file.score));
    assert.equal(typeof file.verdict, "string");
    assert.ok(Array.isArray(file.violations) && file.violations.length > 0);
    assert.deepEqual(Object.keys(parsed.totals).sort(), ["bySeverity", "files", "violations"]);
    assert.equal(parsed.totals.files, 1);
    assert.equal(parsed.totals.violations, file.violations.length);
    assert.deepEqual(Object.keys(parsed.totals.bySeverity).sort(), ["high", "low", "medium"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── A2: --fail-on thresholds ──

test("A2: --fail-on high exits 0 when only low/medium findings exist", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, "slop.md"), SLOP_MD);
    // Sanity check the fixture actually has no high-severity findings before trusting the exit code.
    const violations = scanContent(SLOP_MD, "slop.md");
    assert.ok(violations.length > 0 && violations.every((v) => v.severity !== "high"));

    const result = runCli(["--fail-on", "high", "slop.md"], dir);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("A2: --fail-on none always exits 0, even with findings", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, "slop.md"), SLOP_MD);
    const result = runCli(["--fail-on", "none", "slop.md"], dir);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("A2: --fail-on high exits 1 when a high-severity finding exists", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, "secret.js"), SECRET_JS);
    const violations = scanContent(SECRET_JS, "secret.js");
    assert.ok(violations.some((v) => v.severity === "high"), "fixture must contain a high-severity finding");

    const result = runCli(["--fail-on", "high", "secret.js"], dir);
    assert.equal(result.status, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── A2: usage errors exit 2 ──

test("A2: an unreadable file exits 2 with a usage message on stderr", () => {
  const dir = scratchDir();
  try {
    const result = runCli(["missing.md"], dir);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Cannot read file/);
    assert.match(result.stderr, /Usage:/);
    assert.equal(result.stdout, "");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("A2: an unknown flag exits 2 with a usage message on stderr", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, "slop.md"), SLOP_MD);
    const result = runCli(["--bogus", "slop.md"], dir);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Unknown option: --bogus/);
    assert.match(result.stderr, /Usage:/);
    assert.equal(result.stdout, "");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("A2: no file arguments exits 2 with a usage message on stderr", () => {
  const dir = scratchDir();
  try {
    const result = runCli([], dir);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Usage:/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── A2: --quiet suppresses output but keeps the exit code ──

test("A2: --quiet prints nothing on either stream and still sets the exit code", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, "slop.md"), SLOP_MD);
    const result = runCli(["--quiet", "slop.md"], dir);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, "");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── A3: no side effects by default ──

test("A3: without --record, a CLI scan leaves no .anti-slop directory behind", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, "slop.md"), SLOP_MD);
    const result = runCli(["slop.md"], dir);
    assert.equal(result.status, 1);
    assert.equal(existsSync(join(dir, ".anti-slop")), false, "a plain CLI scan must not create .anti-slop/");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("A3: --record writes scores.json and scan-log.json", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, "slop.md"), SLOP_MD);
    const result = runCli(["--record", "slop.md"], dir);
    assert.equal(result.status, 1);

    const expectedAll = scanContent(SLOP_MD, "slop.md", { collectSuppressed: true });
    const expectedActive = expectedAll.filter((v) => !v.suppressed);
    const expectedScore = calculateScore(expectedActive);

    const scores = JSON.parse(readFileSync(join(dir, ".anti-slop", "scores.json"), "utf8"));
    assert.equal(scores.length, 1);
    assert.equal(scores[0].score, expectedScore);
    assert.equal(scores[0].file, "slop.md");
    assert.equal(scores[0].violations, expectedActive.length);
    assert.match(scores[0].timestamp, /^\d{4}-\d{2}-\d{2}T/);

    const log = JSON.parse(readFileSync(join(dir, ".anti-slop", "scan-log.json"), "utf8"));
    assert.equal(log.length, expectedAll.length);
    log.forEach((entry, i) => {
      const { timestamp, ...rest } = entry;
      assert.deepEqual(rest, { ...expectedAll[i], file: "slop.md" });
      assert.match(timestamp, /^\d{4}-\d{2}-\d{2}T/);
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("A3: --record on a clean file still logs a score entry but no scan-log entries", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, "clean.md"), "The migration ran cleanly against the staging copy.\n");
    const result = runCli(["--record", "clean.md"], dir);
    assert.equal(result.status, 0, result.stderr);

    const scores = JSON.parse(readFileSync(join(dir, ".anti-slop", "scores.json"), "utf8"));
    assert.equal(scores.length, 1);
    assert.equal(scores[0].violations, 0);
    assert.equal(existsSync(join(dir, ".anti-slop", "scan-log.json")), false, "no findings means no scan-log.json write");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("A3: --record logs suppressed escape-hatched findings without affecting output or exit code", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, "hatched.md"), "This is a game-changer. <!-- anti-slop-allow: deliberate hype -->\nThe migration ran cleanly against the staging copy.\n");
    const result = runCli(["--record", "--format", "json", "hatched.md"], dir);
    assert.equal(result.status, 0, `suppressed findings must not affect the exit code: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.totals.violations, 0, "suppressed findings must not appear in JSON output");

    const log = JSON.parse(readFileSync(join(dir, ".anti-slop", "scan-log.json"), "utf8"));
    assert.ok(log.length >= 1, "the suppressed finding must still be logged for rule stats");
    assert.ok(log.every((e) => e.suppressed === true && e.suppressedBy === "escape-hatch"), JSON.stringify(log));
    const scores = JSON.parse(readFileSync(join(dir, ".anti-slop", "scores.json"), "utf8"));
    assert.equal(scores[0].violations, 0, "the score entry counts active findings only");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("A3: an unreadable file aborts before anything is recorded", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, "ok.md"), SLOP_MD);
    const result = runCli(["--record", "ok.md", "missing.md"], dir);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Cannot read file: missing\.md/);
    assert.equal(existsSync(join(dir, ".anti-slop")), false, "exit-2 abort must leave no partial --record side effects");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Zero-arg invocation used to start the MCP stdio server and stay alive. Since 2.0.0 it
// prints usage and exits 2; that is asserted in no-mcp.test.mjs.

// ── D5: the JSON violation object is the CI integration surface ──────────────
// The top-level shape was pinned; the violation objects inside it were not, so renaming
// `desc`, dropping `confidence` or changing `count` to `hits` kept the suite green and
// broke every downstream consumer of --format json.

// `fix` and `line` joined every shape in 2.4.0: a finding that names only the offence is
// incomplete under the remediation floor, and a consumer of --format json now gets the
// remediation and the location without re-deriving either. The UI tells gained `evidence`
// (the first hit's matched text) and `lines` (every contributing line) in 2.5.0; code
// patterns carry no evidence, because the matched text of a credential rule is the secret.
const VIOLATION_KEYS = {
  "banned-word": ["confidence", "count", "desc", "fix", "line", "severity", "type", "word"],
  "banned-phrase": ["confidence", "count", "desc", "fix", "line", "phrase", "severity", "type"],
  "text-construct": ["confidence", "count", "desc", "fix", "line", "name", "severity", "type"],
  "emoji": ["confidence", "count", "desc", "fix", "line", "severity", "type"],
  "design-tell": ["confidence", "count", "desc", "evidence", "fix", "line", "lines", "mode", "name", "severity", "type"],
  "native-tell": ["confidence", "count", "desc", "evidence", "fix", "line", "lines", "mode", "name", "severity", "type"],
  "code-pattern": ["confidence", "count", "desc", "fix", "line", "lines", "name", "severity", "type"],
};

test("D5: every violation type in --format json carries its exact documented key set", () => {
  const dir = scratchDir();
  try {
    // One file per violation type, so all seven shapes are exercised in one invocation.
    writeFileSync(join(dir, "post.md"), "Great question! We delve into it.\n\n---\n\nIn conclusion \u{1F680}.\n");
    writeFileSync(join(dir, "app.ts"), "eval(userInput);\n");
    writeFileSync(join(dir, "page.css"), "h1 { background-clip: text; color: transparent; }\n");
    writeFileSync(join(dir, "View.swift"), "let w = UIScreen.main.bounds.width\n");
    const result = runCli(["--format", "json", "post.md", "app.ts", "page.css", "View.swift"], dir);
    assert.equal(result.status, 1);
    const parsed = JSON.parse(result.stdout);
    const seen = new Set();
    for (const file of parsed.files) {
      for (const v of file.violations) {
        const expected = VIOLATION_KEYS[v.type];
        assert.ok(expected, `unknown violation type "${v.type}" in JSON output: ${JSON.stringify(v)}`);
        assert.deepEqual(Object.keys(v).sort(), expected, `${v.type} key set drifted: ${JSON.stringify(v)}`);
        assert.equal(typeof v.desc, "string");
        assert.ok(typeof v.fix === "string" && v.fix.length > 0, `${v.type} carries no fix: ${JSON.stringify(v)}`);
        assert.ok(Number.isInteger(v.line) && v.line >= 1, `${v.type} carries no line: ${JSON.stringify(v)}`);
        assert.ok(Number.isInteger(v.count));
        assert.ok(["high", "medium", "low"].includes(v.severity));
        seen.add(v.type);
      }
    }
    assert.deepEqual(
      [...seen].sort(),
      ["banned-phrase", "banned-word", "code-pattern", "design-tell", "emoji", "native-tell", "text-construct"],
      "the fixtures must exercise every violation type, or the key sets are only half checked",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("D5: a suppressed entry never reaches JSON output, and carries its own two extra keys in the log", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, "hatched.md"), "This is a game-changer. <!-- anti-slop-allow: deliberate hype -->\n");
    const result = runCli(["--record", "--format", "json", "hatched.md"], dir);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).files[0].violations.length, 0);
    const [entry] = JSON.parse(readFileSync(join(dir, ".anti-slop", "scan-log.json"), "utf8"));
    assert.deepEqual(
      Object.keys(entry).sort(),
      ["confidence", "count", "desc", "file", "fix", "line", "phrase", "severity", "suppressed", "suppressedBy", "timestamp", "type"],
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── --record batches to one load/save cycle per INVOCATION (2.1.0) ───────────
// Recording per file did 2N read-modify-write round trips over the whole log, and -- since
// both retention caps count entries rather than runs -- a CI-sized scan evicted its own
// rows before it finished. Scores are now one aggregate row per invocation, which is what
// `history`'s "Last N scans" always claimed to show.

test("A3: --record writes ONE aggregate score row per invocation, not one per file", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, "a.md"), SLOP_MD);
    writeFileSync(join(dir, "b.md"), SLOP_MD);
    writeFileSync(join(dir, "c.md"), "The migration ran cleanly against the staging copy.\n");
    const result = runCli(["--record", "--quiet", "a.md", "b.md", "c.md"], dir);
    assert.equal(result.status, 1);

    const scores = JSON.parse(readFileSync(join(dir, ".anti-slop", "scores.json"), "utf8"));
    assert.equal(scores.length, 1, "three files, one invocation, one score row");
    assert.equal(scores[0].file, "3 files");

    const worstFile = calculateScore(scanContent(SLOP_MD, "a.md"));
    assert.equal(scores[0].score, worstFile, "the aggregate reports the WORST file's score");
    const perFile = ["a.md", "b.md", "c.md"].map((f) => scanContent(f === "c.md" ? "The migration ran cleanly against the staging copy.\n" : SLOP_MD, f).length);
    assert.equal(scores[0].violations, perFile.reduce((a, b) => a + b, 0), "and the run's total active findings");

    // The log still carries one row per finding, attributed to the file it came from.
    const log = JSON.parse(readFileSync(join(dir, ".anti-slop", "scan-log.json"), "utf8"));
    assert.deepEqual([...new Set(log.map((e) => e.file))].sort(), ["a.md", "b.md"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("A3: a single-file --record still records that file's own path and score", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, "slop.md"), SLOP_MD);
    runCli(["--record", "--quiet", "slop.md"], dir);
    const scores = JSON.parse(readFileSync(join(dir, ".anti-slop", "scores.json"), "utf8"));
    assert.equal(scores.length, 1);
    assert.equal(scores[0].file, "slop.md", "one file names itself rather than reporting '1 files'");
    assert.equal(scores[0].score, calculateScore(scanContent(SLOP_MD, "slop.md")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a duplicate file argument is scanned, reported and recorded once", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, "slop.md"), SLOP_MD);
    const result = runCli(["--record", "--format", "json", "slop.md", "slop.md"], dir);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.files.length, 1);
    assert.equal(parsed.totals.files, 1);
    const log = JSON.parse(readFileSync(join(dir, ".anti-slop", "scan-log.json"), "utf8"));
    assert.equal(log.length, scanContent(SLOP_MD, "slop.md", { collectSuppressed: true }).length);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── Argument-surface gaps ────────────────────────────────────────────────────

test("both help paths print usage on stdout and exit 0", () => {
  const dir = scratchDir();
  try {
    for (const args of [["-h"], ["--help"]]) {
      const result = runRaw(args, dir);
      assert.equal(result.status, 0, `${args[0]}: ${result.stderr}`);
      assert.match(result.stdout, /Usage: slop-scanner/);
      assert.equal(result.stderr, "");
    }
    // --help wins over the files it was given: nothing is scanned.
    writeFileSync(join(dir, "slop.md"), SLOP_MD);
    const withFile = runCli(["--help", "slop.md"], dir);
    assert.equal(withFile.status, 0, withFile.stderr);
    assert.match(withFile.stdout, /Usage: slop-scanner/);
    assert.ok(!withFile.stdout.includes("Scan score"), "--help must not also scan the file");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a flag given without its value is a usage error naming the flag", () => {
  const dir = scratchDir();
  try {
    const format = runCli(["--format"], dir);
    assert.equal(format.status, 2);
    assert.match(format.stderr, /--format must be "text" or "json" \(got nothing\)/);

    const failOn = runCli(["--fail-on"], dir);
    assert.equal(failOn.status, 2);
    assert.match(failOn.stderr, /--fail-on must be one of any\|high\|medium\|low\|none \(got nothing\)/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("--fail-on low and --fail-on medium gate on their own threshold", () => {
  const dir = scratchDir();
  try {
    // A low-only file: one emoji, nothing else.
    writeFileSync(join(dir, "low.md"), "Ship it \u{1F680}\n");
    const lowOnly = scanContent("Ship it \u{1F680}\n", "low.md");
    assert.ok(lowOnly.length > 0 && lowOnly.every((v) => v.severity === "low"), JSON.stringify(lowOnly));
    assert.equal(runCli(["--fail-on", "low", "low.md"], dir).status, 1);
    assert.equal(runCli(["--fail-on", "medium", "low.md"], dir).status, 0);

    // A medium file: a clustered banned word.
    writeFileSync(join(dir, "med.md"), SLOP_MD);
    assert.equal(runCli(["--fail-on", "medium", "med.md"], dir).status, 1);
    assert.equal(runCli(["--fail-on", "high", "med.md"], dir).status, 0);

    // A high file clears every threshold below it.
    writeFileSync(join(dir, "high.js"), SECRET_JS);
    for (const level of ["low", "medium", "high"]) {
      assert.equal(runCli(["--fail-on", level, "high.js"], dir).status, 1, `--fail-on ${level}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a multi-file success run reports every file and a totals line", () => {
  const dir = scratchDir();
  try {
    const clean = "The migration ran cleanly against the staging copy.\n";
    for (const f of ["a.md", "b.md", "c.md"]) writeFileSync(join(dir, f), clean);
    const json = runCli(["--format", "json", "a.md", "b.md", "c.md"], dir);
    assert.equal(json.status, 0, json.stderr);
    const parsed = JSON.parse(json.stdout);
    assert.equal(parsed.totals.files, 3);
    assert.equal(parsed.totals.violations, 0);
    assert.deepEqual(parsed.files.map((f) => f.file), ["a.md", "b.md", "c.md"]);

    // Text mode used to compute the aggregate and then discard it.
    const text = runCli(["--format", "text", "a.md", "b.md", "c.md"], dir);
    assert.equal(text.status, 0, text.stderr);
    assert.match(text.stdout, /^Total: 0 violation\(s\) across 3 files \(0 high, 0 medium, 0 low\)$/m);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the text totals line counts findings by severity across the run", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, "slop.md"), SLOP_MD);
    writeFileSync(join(dir, "secret.js"), SECRET_JS);
    const result = runCli(["slop.md", "secret.js"], dir);
    const totals = result.stdout.match(/^Total: (\d+) violation\(s\) across (\d+) files \((\d+) high, (\d+) medium, (\d+) low\)$/m);
    assert.ok(totals, `no totals line in:\n${result.stdout}`);
    const expected = [...scanContent(SLOP_MD, "slop.md"), ...scanContent(SECRET_JS, "secret.js")];
    assert.equal(Number(totals[1]), expected.length);
    assert.equal(Number(totals[2]), 2);
    assert.equal(Number(totals[3]), expected.filter((v) => v.severity === "high").length);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a single-file scan prints no totals line (it would only restate itself)", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, "slop.md"), SLOP_MD);
    assert.ok(!runCli(["slop.md"], dir).stdout.includes("Total:"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("--quiet with --format json still prints nothing and still sets the exit code", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, "slop.md"), SLOP_MD);
    const result = runCli(["--quiet", "--format", "json", "slop.md"], dir);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, "");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an empty file is clean, and a directory argument is a usage error", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, "empty.md"), "");
    const empty = runCli(["empty.md"], dir);
    assert.equal(empty.status, 0, empty.stderr);
    assert.match(empty.stdout, /^empty\.md: clean$/m);

    const asDir = runCli(["."], dir);
    assert.equal(asDir.status, 2);
    assert.match(asDir.stderr, /Cannot read file: \./);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── history and stats ────────────────────────────────────────────────────────

test("history shows the last 10 scans, newest last", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, "slop.md"), SLOP_MD);
    for (let i = 0; i < 12; i++) runCli(["--record", "--quiet", "slop.md"], dir);
    const scores = JSON.parse(readFileSync(join(dir, ".anti-slop", "scores.json"), "utf8"));
    assert.equal(scores.length, 12, "one aggregate row per invocation");

    const history = runRaw(["history"], dir);
    assert.equal(history.status, 0, history.stderr);
    assert.match(history.stdout, /^Last 10 scans:$/m);
    assert.equal(history.stdout.match(/Scan score: \d+\/50/g).length, 10);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("stats prints a totals header line distinct from its per-rule lines", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, "slop.md"), SLOP_MD);
    runCli(["--record", "--quiet", "slop.md"], dir);
    const stats = runRaw(["stats"], dir);
    assert.equal(stats.status, 0, stats.stderr);
    assert.match(stats.stdout, /^\d+ active \/ \d+ suppressed across \d+ rules$/m);
    assert.match(stats.stdout, /^delve: \d+ active, \d+ suppressed, worst=\w+, last=/m);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("stats reports a config-allowed word as suppressed rather than active", () => {
  const dir = scratchDir();
  try {
    mkdirSync(join(dir, ".anti-slop"), { recursive: true });
    writeFileSync(join(dir, ".anti-slop", "config.json"), JSON.stringify({ allowedWords: ["delve"] }));
    writeFileSync(join(dir, "slop.md"), SLOP_MD);
    const scan = runCli(["--record", "--quiet", "slop.md"], dir);
    assert.equal(scan.status, 0, "an allowed word must not fail the scan");
    const stats = runRaw(["stats"], dir);
    assert.equal(stats.status, 0, stats.stderr);
    assert.match(stats.stdout, /^delve: 0 active, 1 suppressed/m);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("history, stats and dashboard reject arguments instead of ignoring them", () => {
  const dir = scratchDir();
  try {
    for (const args of [["history", "--format", "json"], ["stats", "--quiet"], ["dashboard", "extra"]]) {
      const result = runRaw(args, dir);
      assert.equal(result.status, 2, `${args.join(" ")} exited ${result.status}`);
      assert.match(result.stderr, new RegExp(`^${args[0]} takes no arguments`));
      assert.equal(result.stdout, "");
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("history and stats on an untouched project create no .anti-slop directory", () => {
  const dir = scratchDir();
  try {
    for (const cmd of ["history", "stats"]) {
      const result = runRaw([cmd], dir);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /No (scores|findings) recorded yet/);
      assert.equal(
        existsSync(join(dir, ".anti-slop")), false,
        `${cmd} is a read: it must leave no trace in a project that never opted in with --record`,
      );
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a scoped waiver naming an unknown rule id is reported on stderr, never on stdout", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, "page.css"), "h1 { background-clip: text; } /* anti-slop-allow: no-such-rule -- brand */\n");
    const result = runCli(["--format", "json", "page.css"], dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /page\.css:1: anti-slop-allow names unknown rule id\(s\) no-such-rule; the waiver suppresses nothing/);
    assert.ok(JSON.parse(result.stdout).files[0].violations.some((v) => v.name === "gradient-text"));
    const quiet = runCli(["--quiet", "page.css"], dir);
    assert.equal(quiet.stderr, "");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── Coverage notes (2.5.0) ───────────────────────────────────────────────────
// The report stays on stdout, which callers pipe; what a static scan cannot see goes to
// stderr in text mode and into a `coverage` array in JSON.

test("coverage: a component scan names its blind spot on stderr and adds nothing to stdout", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, "Card.tsx"), "export const Card = () => <div className=\"p-4\">x</div>;\n");
    const text = runCli(["Card.tsx"], dir);
    assert.equal(text.status, 0, text.stderr);
    assert.equal(text.stdout, "Card.tsx: clean\n");
    assert.match(text.stderr, /^coverage: contrast and type metrics read declared CSS, inline styles and CSS-in-JS only; Tailwind utilities and cross-file cascades are not resolved \(1 file\)\n/);
    assert.match(text.stderr, /A clean result is a floor: this is a static scan of declared source, not a rendered page\.\n$/);
    const json = runCli(["--format", "json", "Card.tsx"], dir);
    const parsed = JSON.parse(json.stdout);
    assert.ok(Array.isArray(parsed.coverage));
    assert.deepEqual(parsed.coverage.map((c) => c.files), [["Card.tsx"]]);
    assert.equal(json.stderr, "", "JSON carries the notes in the object, not on stderr");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("coverage: an HTML-only run that scans fully prints nothing on stderr", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, "page.html"), "<!doctype html><html lang=\"en\"><body><p>Hi</p></body></html>\n");
    const result = runCli(["page.html"], dir);
    assert.equal(result.stderr, "");
    assert.deepEqual(JSON.parse(runCli(["--format", "json", "page.html"], dir).stdout).coverage, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("coverage: one line per distinct note with its file count, and --quiet drops them", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, "a.css"), ".a { color: red; }\n");
    writeFileSync(join(dir, "b.css"), ".b { color: red; }\n");
    writeFileSync(join(dir, "job.py"), "x = 1\n");
    const result = runCli(["a.css", "b.css", "job.py"], dir);
    assert.match(result.stderr, /coverage: markup rules \(missing-alt, classAll fingerprints\) do not apply \(2 files\)/);
    assert.match(result.stderr, /coverage: design tells not run \(not a UI surface\) \(1 file\)/);
    assert.equal((result.stderr.match(/A clean result is a floor/g) || []).length, 1);
    assert.equal(runCli(["--quiet", "a.css", "job.py"], dir).stderr, "");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("coverage: a declared purple in DESIGN.md is named with the hue window it exempts", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, "package.json"), "{}");
    writeFileSync(join(dir, "DESIGN.md"), "---\ncolors:\n  violet: oklch(0.55 0.2 295)\n---\n");
    writeFileSync(join(dir, "page.html"), '<a class="bg-violet-600 text-violet-700">Go</a>\n');
    const result = runCli(["page.html"], dir);
    assert.equal(result.stdout, "page.html: clean\n");
    assert.match(result.stderr, /coverage: purple palette: DESIGN\.md declares violet \(#7e4ed7\); purple within 15 degrees of its hue is the palette \(1 file\)/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a text finding that spans several lines names each of them", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, "a.css"), ".a { color: #7c3aed }\n.b { padding: 4px }\n.c { border-color: #6d28d9 }\n");
    const result = runCli(["a.css"], dir);
    assert.match(result.stdout, /\(ai-purple-hex, lines 1, 3, Pattern smell\)/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
