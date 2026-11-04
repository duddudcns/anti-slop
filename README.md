# anti-slop

A Claude Code plugin that scans for security vulnerabilities, accessibility failures, performance problems, and generic design defaults in AI-generated output.

## What it does

Loads pattern-matching rules during content generation. The rules target failure modes documented in published research.

On the **writing** side: vocabulary tells (the words whose frequency in published text jumped after 2022, "delve" being the one readers name most often), sycophantic openers, structural cliches, filler phrases. These rules target user-facing prose; internal documents are skipped unless a project opts them in (see Configuration).

On the **code** side: SQL injection, XSS, path traversal, command injection, hardcoded credentials, `eval()`, swallowed errors, premature abstractions, comment slop, N+1 queries, missing timeouts, full library imports, `useEffect` misuse, shallow copy bugs, floating-point money, date/time errors, async race conditions.

On the **frontend** side: the accessibility work a model skips when the prompt does not ask for it, so WCAG failures (unlabeled controls, missing alt text, low contrast, absent focus states), missing states (empty, error, loading), the generic AI aesthetic, CSS z-index escalation, `!important` abuse, missing `prefers-reduced-motion`, hydration mismatches, and demo-ware that only handles the happy path.

On **regressions**: the fix-one-break-another pattern, test manipulation (weakening assertions to make tests pass), silent behavioral changes, and destructive operations.

Rules yield to domain context. Academic writing gets its hedging language. Legal writing keeps "ensure" and "comprehensive." ML code keeps "optimize" and "converge." If a banned word is the precise technical term for what you're doing, use it.

## What's included

| Component | Description |
|-----------|-------------|
| **Skill** (`anti-slop`) | Core rules; activates on user-facing prose, UI work, and AI-pattern reviews |
| **Agent** (`slop-detector`) | Deep semantic review, scored on five dimensions at 10 points each; a dimension the evidence cannot reach is reported NOT ASSESSED and leaves the denominator |
| **Command** (`/slop-check`) | Manual review — point it at a file, directory, diff, or PR |
| **Scanner CLI** (`slop-scanner.mjs`) | Fast deterministic scanner — regex-based pattern matching for banned words, phrases, design tells, native UI tells, code smells, security issues. Every finding carries its rule id, the line it sits on, its confidence class, and a one-sentence fix, in both the text and the JSON output. Four subcommands: `scan`, `history`, `stats`, `dashboard`. Zero runtime dependencies, so it runs from a clone or an installed plugin with no `npm install` |
| **Web Dashboard** | Optional, off by default. Nothing starts on its own; `slop-scanner.mjs dashboard` starts it on demand at a per-project deterministic port, prints the URL, and serves until Ctrl-C. Shows stats about findings the scanner has caught: scan counts, severity breakdown, findings by rule, findings per scan, recent findings |
| **13 reference files** | 55 banned-word tells in two tiers (32 flagged on a single hit, 23 only when they cluster) plus a third tier of plain-word preferences that are never flagged, ~220 banned phrases, plus pattern catalogs for writing, code, design, frontend, native (SwiftUI/UIKit) UI, regressions, density and economy, self-check checklists, empirical rankings, confidence and evidence rules, and choosing-with-intent guidance |

The scanner and the agent serve different purposes. The scanner is fast — it runs regex patterns against file content and returns in milliseconds. The agent is thorough — it reads reference files, understands context, and produces a scored report with specific fixes. The `/slop-check` command runs both whenever the target resolves to files on disk: scanner first for a quick pass, then the agent for semantic analysis. Pointed at the last response, which is not a file, it runs the agent alone and reports one score.

The two also report different scales, on purpose. **Scan score** (`Scan score: N/50`) is the scanner's deterministic deduction count. **Review score** (`Review score: N/M`, where M shrinks when a dimension is NOT ASSESSED) is the `slop-detector` agent's five-dimension judgment call, and neither implies the other.

## The numbers

- Across 470 open-source pull requests, the AI-authored ones carried **10.83 issues each against 6.45** for human-only PRs, with security issues up to **2.74x** higher, logic and correctness errors **75%** more common, and readability issues more than **3x** more frequent ([CodeRabbit](https://www.coderabbit.ai/blog/state-of-ai-vs-human-code-generation-report)).
- A scan of deployed applications built by AI coding platforms found **2,038 critical vulnerabilities**, 400+ leaked secrets, and 175 exposures of personal data, every one of them live in production ([Escape](https://escape.tech/state-of-security-of-vibe-coded-apps)).
- Refactoring fell from **25% of changed lines in 2021 to under 10% in 2024** as assistants wrote more of the code ([GitClear](https://www.gitclear.com/ai_assistant_code_quality_2025_research)).
- Adam Wathan (Tailwind creator) apologized for `bg-indigo-500` being the demo default that trained every model.

## Installation

Inside Claude Code:

```bash
# Add the marketplace (the owner/repo shorthand and the full URL both work):
/plugin marketplace add TheMizeGuy/anti-slop

# Install:
/plugin install anti-slop@anti-slop
```

From a shell, the same two steps are `claude plugin marketplace add TheMizeGuy/anti-slop` and `claude plugin install anti-slop@anti-slop`.

For development, point Claude Code at the plugin directory, which sits one level below the repo root:

```bash
claude --plugin-dir /path/to/anti-slop/anti-slop
```

Point it at the repo root instead and it loads successfully with nothing in it: the root carries a `.claude-plugin/plugin.json` of its own for version parity, but no skill, agent, or command sits beside it, and a plugin that registers nothing raises no error.

### Without Claude Code

The scanner is a plain Node script with zero dependencies, so it also runs straight from a clone:

```bash
git clone https://github.com/TheMizeGuy/anti-slop
node anti-slop/anti-slop/scripts/slop-scanner.mjs scan path/to/your/file.ts
```

Node 22 or newer, nothing to install, nothing to build.

## Usage

The skill activates when you write or revise user-facing prose (UI copy, release notes, public docs), design or build UI, or ask for an AI-pattern review. For manual review:

```
/slop-check                              # review last output
/slop-check src/components/Header.tsx    # review specific file
/slop-check src/components/              # review a directory (expanded, capped at 50 files)
/slop-check diff                         # review uncommitted changes
/slop-check pr                           # review current PR
```

The dashboard is optional and never starts on its own. Run `node scripts/slop-scanner.mjs dashboard` to start it on demand; it opens at a per-project deterministic port, prints the URL, and serves in the foreground until Ctrl-C. It is the only command that opens a port. It shows stats about findings the scanner has caught: scan counts, severity breakdown, findings by rule, findings per scan, and recent findings. Scan and finding data persist in `.anti-slop/` in your project directory (`scan-log.json` for findings, `scores.json` for per-scan records), and scans leave no trace there unless you opt in with `--record`. If you're working across multiple projects, the dashboard shows tabs for all active projects; that index lives in a single `~/.anti-slop/registry.json` outside any project, written only by the `dashboard` command (it registers the project on start, prunes dead entries while it serves, and unregisters on exit) and never by a scan, and `ANTI_SLOP_REGISTRY_DIR` points it somewhere else.

### CI usage

The scanner is a plain Node CLI with no dependencies, so pre-commit hooks and CI gates can call it directly (paths below are relative to the plugin root; from a clone of this repo, prefix with `anti-slop/`):

```bash
node scripts/slop-scanner.mjs scan [options] <file...>

# Typical CI usage: scan only what changed (--diff-filter=d skips deleted files,
# which would otherwise abort the scan as unreadable)
git diff --name-only --diff-filter=d origin/main... | xargs -r node scripts/slop-scanner.mjs scan --fail-on high
```

Options:

- `--format text|json`: output format (default `text`)
- `--fail-on any|high|medium|low|none`: minimum severity that triggers a nonzero exit (default `any`)
- `--record`: write findings to `.anti-slop/scan-log.json` and `scores.json`, which is what `history` and `stats` read back. Default is off; a CI scan leaves no trace in your project directory unless you opt in
- `--quiet`: suppress stdout, exit code only. The one exception is a run that scanned nothing because prose scope skipped every file given: the skip hint still goes to stderr, so a run that read no files cannot pass silently
- `--prose-scope user-facing|all`: whether prose files (`.md`, `.mdx`, `.txt`, `.rst`) are scanned. The default, `user-facing`, scans only the files listed under `userFacingProse` in `.anti-slop/config.json` and reports the rest as `skipped`; `all` scans every prose file. A skipped file is never reported as clean, is never recorded, and never affects the exit code. `ANTI_SLOP_PROSE_SCOPE` and the config key `proseScope` set the same thing; the flag outranks both
- `-h`, `--help`: print the usage block, including this option list and the exit codes

Exit codes: `0` clean or below the `--fail-on` threshold, `1` findings at or above the threshold, `2` usage error or unreadable file. The CLI takes files only, with no glob or directory recursion, so compose it with your own file list as in the `git diff` example above.

Output: the report goes to stdout, as text or as one JSON object with `--format json`, so it pipes cleanly. Coverage notes go to stderr in text mode and into the JSON `coverage` array (`[{ "note", "files" }]`). A note names what a static scan of that file type cannot see: on a component file (`.tsx`, `.vue` and kin) the contrast and type rules read declared CSS, inline styles and CSS-in-JS only, so Tailwind utilities and stylesheets in other files are not resolved; on a stylesheet the markup rules do not apply; on a non-UI code file the design rules do not run. `--quiet` drops the notes along with the report.

For a CI gate, `--fail-on medium` keeps the lowest tier (near-bar contrast, the reading-mechanics rules, bounce easing) in the report without failing the build. The default stays `any`, so an existing gate keeps its behaviour.

What a green scan does and does not mean: the scanner runs the part of the catalog a regex can decide, and that is a strict subset. Reachable SQL injection, N+1 queries, missing timeouts, sentence rhythm, and over-engineering are all in the reference catalogs and none of them are scanner rules, so a passing `scan` is a floor rather than a security review. A skipped prose file is not a scanned one: under the default prose scope, markdown and text files outside `userFacingProse` are reported as skipped and contribute nothing. The skill and the `slop-detector` agent read the full catalogs; the coverage matrix in `anti-slop/skills/anti-slop/references/empirical-rankings.md` records which rules sit in which layer.

#### Deliberate exceptions

A line marked `anti-slop-allow: <reason>` (or `unslop-ignore`) is exempt from every rule. The marker goes on the same line as the finding, in whatever comment syntax the file already uses:

```js
const DEMO_KEY = "sk-test-0000"; // anti-slop-allow: fixture for the auth test
```

To waive one rule and keep the others reading the line, name it before ` -- ` and the reason:

```html
<h1 class="bg-clip-text text-transparent bg-gradient-to-r from-amber-600 to-red-700"><!-- anti-slop-allow: gradient-text -- wordmark from the identity guide -->Halcyon</h1>
```

Every id before the ` -- ` must be a real rule id; a waiver that names an unknown one suppresses nothing, and the CLI prints a note on stderr naming the id. The prose rules (banned words and phrases, text constructs, em-dash density, emoji) treat any marker as line-wide.

The regex accepts the marker with or without a reason. Write one anyway: the marker outlives the person who added it, and the reason is what tells the next reader whether it still holds. Exempt lines are not invisible either, since `slop-scanner.mjs stats` reports per-rule active versus suppressed counts, so a gate that is quietly being argued out of firing still shows up.

### Configuration

Drop a `.anti-slop/config.json` in your project to adjust scanner and dashboard behavior:

```json
{
  "allowedWords": ["leverage", "ecosystem"],
  "proseScope": "user-facing",
  "userFacingProse": ["docs/release-notes/**", "README.md"],
  "dashboard": false
}
```

`allowedWords` exempts specific banned words (including hyphenated ones like `cutting-edge`) the scanner would otherwise flag; it does not cover banned phrases. `dashboard` set to `false` disables the web dashboard entirely; omit it (or set it to `true`) to leave the dashboard available on demand.

`proseScope` decides whether prose files (`.md`, `.mdx`, `.txt`, `.rst`) are scanned at all. The writing rules target user-facing prose, and most markdown in a working repository is not that: specs, plans, decision logs, evidence, handoffs, changelogs. Under `user-facing` (the default since 2.3.0) the scanner skips every prose file except those matching a glob in `userFacingProse`, and prints them as `skipped (prose scope: user-facing)` rather than clean. The globs are relative to the directory the scanner runs in, which is also where it reads `.anti-slop/config.json`, so run it from the project root. They ignore case and support `**` (crosses directories), `*` and `?` (within one path segment): `docs/release-notes/**` opts in a directory, `**/*.md` opts in every markdown file, `README.md` opts in the root README only. `all` restores the pre-2.3.0 behaviour and scans every prose file. Precedence: `--prose-scope`, then the `ANTI_SLOP_PROSE_SCOPE` environment variable, then this key, then the default. Code files are not affected by any of this; their comment rules run under either scope.

## Walkthrough

A worked example, start to finish:

1. Install the plugin (see Installation above) and open Claude Code in a project.
2. Ask Claude to write UI copy, a README, or a UI component. The `anti-slop` skill activates for that user-facing work; no command is needed for this pass.
3. Run a manual review on a specific file: `/slop-check src/components/Header.tsx`.
4. Claude Code first runs the deterministic scanner (`slop-scanner.mjs scan`). A finding-bearing file returns output shaped like:

   ```
   src/components/Header.tsx
   Scan score: 40/50 | SOME | 4 violation(s)

   [LOW] Banned AI-tell word "leverage" found 2x  (leverage, line 8, Pattern smell)
     fix: Say the plain thing; a lone hit is the writer's prose and only a cluster is the tell
   [MEDIUM] z-index escalation (999+) (1x)  (z-index-escalation, line 12, Quality defect)
     fix: Use a named scale (`--z-dropdown: 100`, `--z-modal: 200`), or move the element in the tree so it stacks without a magic number.
   [HIGH] Possible hardcoded credential (1x)  (hardcoded-secret, line 3, Pattern smell)
     fix: Read it from the environment or a secrets manager, and rotate any value that reached a commit
   [MEDIUM] useEffect setting state (likely derived state) (1x)  (useeffect-setstate, line 9, Pattern smell)
     fix: Derive the value during render instead of storing it; keep the effect for work that genuinely reaches outside React.
   ```

   Each finding takes two lines: the offence, then the rule id, the line, the confidence class, and the remediation. A clean file reports `src/components/Header.tsx: clean` and exits 0.
5. Claude then dispatches the `slop-detector` agent for the semantic pass the scanner cannot do (sentence rhythm, sycophancy, tutorial-shaped code, hallucinated APIs). The agent replies with its own `Review score: N/M` on the five judgment dimensions (directness, specificity, authenticity, economy, soundness) plus concrete fixes per finding.
6. Claude presents both scores together, labeled (`Scan score` and `Review score` measure different things and are not comparable), and applies fixes only when you ask for them.
7. Optional: run `slop-scanner.mjs stats` for per-rule active vs suppressed counts, `history` for recent scores, or `dashboard` for the same over time in a browser.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `/slop-check` runs but no scan output appears | The command could not run `node`, or the plugin path is wrong | Confirm `node` is on PATH and that `scripts/slop-scanner.mjs` exists in the installed plugin directory; the scanner needs no install step of its own |
| Every file scans clean even when it clearly has banned words | A `.anti-slop/config.json` in the project lists the word under `allowedWords`, or the lines carry `anti-slop-allow: <reason>` / `unslop-ignore` (see Deliberate exceptions above) | Check the project's `.anti-slop/config.json` and the inline markers; both are intentional per-project overrides, not bugs. `slop-scanner.mjs stats` lists what is being suppressed |
| A markdown or text file prints `skipped (prose scope: user-facing)` | Prose files are scanned only when opted in (since 2.3.0; see Configuration) | List the file under `userFacingProse` in `.anti-slop/config.json`, set `proseScope` to `all`, or pass `--prose-scope all` for one run |
| `dashboard` prints "Dashboard is disabled" | `.anti-slop/config.json` has `"dashboard": false` | Remove the key or set it to `true`, then run the command again |
| `dashboard` reports "could not be started (no available port)" | No free port in the dashboard's deterministic per-project range | Free up local ports or retry; the dashboard is optional and scan/review still work without it |
| CI scan exits 2 | A path in the file list is unreadable (often a deleted file from a diff) | Use `--diff-filter=d` on `git diff` before piping into `slop-scanner.mjs scan`, as shown in the CI usage example |
| `npm test` fails with import errors from files you never wrote | The bare `node --test` runner was used instead of `npm test` | Always run `npm test` from `anti-slop/scripts` — `test/corpus/` intentionally contains samples with broken imports that only the project's own test runner knows to skip |

## Scope

Tuned for web-centric code (Python, TypeScript, JavaScript, CSS) and English prose, plus a layout and adaptation rule set for Apple platforms (`anti-slop/skills/anti-slop/references/native-ui-patterns.md`) that runs on `.swift`, `.m`, and `.mm` files. Design tells run on web extensions only and native tells on Apple extensions only, so neither vocabulary is matched against the other's files. Limited coverage for systems languages (Rust, Go, C/C++), Jetpack Compose, ML pipelines, and non-English text: there, apply the underlying principles (specificity, economy, correctness) rather than the word lists.

## Third-party notices

Impeccable (https://github.com/pbakaus/impeccable), Copyright 2025 Paul Bakaus, Apache-2.0; detection thresholds and exemptions re-expressed, no code copied. Several scanner rules restate impeccable's detection rules as of commit 3671d50f0 in this repository's own code: the contrast, side-stripe, type-floor, reading-mechanics, bounce-easing, pulsing-dot, marquee, background-pattern, radial-halo, gray-on-color, skipped-heading, glow and card-trio detectors and the DESIGN.md reader with its design-system-font rule, with its lessons on comment blanking, class-set scope, unknown values and rule-scoped waivers. The header of `anti-slop/scripts/lib/design-detect.mjs` names the rules re-expressed. The Apache License, Version 2.0 is at http://www.apache.org/licenses/LICENSE-2.0.

## License

MIT
