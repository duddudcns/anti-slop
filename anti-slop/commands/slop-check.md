---
name: slop-check
description: Review output, a file, the working diff, or the current PR for AI slop patterns; reports an agent review score, and a deterministic scan score wherever the target resolves to files on disk, each with per-finding fixes.
argument-hint: "[target]"
allowed-tools: Read, Grep, Glob, Agent, Bash(git branch:*), Bash(git diff:*), Bash(gh pr:*), Bash(node:*), Bash(xargs:*)
---

# Slop Check

Review content for AI coding shortcomings and produce a scored report.

## Context

- Current branch: !`git branch --show-current 2>/dev/null || echo "not a git repo"`

## What to Review

Determine the target from $ARGUMENTS. Every target below except "last response" resolves to a list of files, so the scanner runs on all of them.

| $ARGUMENTS | Target | File list for the scanner |
|---|---|---|
| A file path | That file | The path itself |
| A directory or a glob | The matching files | Expand with `Glob`; keep source and markdown files, drop `node_modules`, build output, lockfiles, and binaries; cap at 50 files and tell the user if the cap trimmed the set |
| `diff` or `changes` | Unstaged working changes | `git diff --name-only --diff-filter=d` |
| `pr` or `pull request` | The current branch's PR | `gh pr diff --name-only` for the PR on the branch named in § Context above (`gh` resolves it from that branch; if the branch has no PR, say so and stop) |
| `last response` or empty | The assistant's most recent message, in full | none -- agent review only |
| Anything else | Not a target | Tell the user and list the options above |

"Last response" means the assistant's last message in this conversation, not a tool result and not the last code block inside it. If there is no prior assistant message (a fresh session), say so and ask for a target. This is also the no-argument default, and it is the only path that produces one score rather than two.

If the diff or PR is empty, tell the user that no changes were found.

## Process

1. Identify the content to review and build the file list from the table above.
2. If the file list is non-empty, run the scanner on it for a fast deterministic check (banned words, text constructs, design tells, code patterns, security issues):

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/slop-scanner.mjs" scan <file...>
   ```

   The scanner takes files only: no directory recursion, no glob expansion. Passing a directory is a usage error (exit 2), so pipe a list in for the diff and PR paths:

   ```bash
   git diff --name-only --diff-filter=d | xargs node "${CLAUDE_PLUGIN_ROOT}/scripts/slop-scanner.mjs" scan
   gh pr diff --name-only | xargs node "${CLAUDE_PLUGIN_ROOT}/scripts/slop-scanner.mjs" scan
   ```

   It needs no install: zero runtime dependencies. Exit 0 clean, 1 on findings, 2 on a usage error. Flags: `--format json` for machine output; `--fail-on any|high|medium|low|none` to move the exit-1 threshold (`--fail-on none` always exits 0, so do not read a 0 as clean without checking which flags ran); `--quiet` to suppress the report and leave the exit code as the result (when every file was skipped by prose scope it still prints that one-line hint on stderr); `--record` to log the run for `history` and `stats`. **Do not pass `--record` by default.** It writes to `.anti-slop/` in the user's project, so use it only when the user asks for it or the invocation is a CI gate that wants the trend. The scanner honors the `anti-slop-allow` / `unslop-ignore` escape hatch, on the offending line itself (`anti-slop-allow: <rule-id> -- <reason>` waives one rule). Coverage notes on stderr (the `coverage` array under `--format json`) name what a static scan of each file type cannot see, such as Tailwind utilities on a component; carry them into the report so a clean component scan is not read as a clean component. Prose files (`.md`, `.mdx`, `.txt`, `.rst`) outside the project's `userFacingProse` list print as `skipped (prose scope: user-facing)`. That means the project has not opted the file in, which is the intended default for internal documents: do not scrub or report writing tells on specs, plans, ADRs, evidence, handoffs or changelogs, and never count a skipped file as clean. If a skipped file is plainly user-facing copy (the README of a public project, release notes, store metadata), say so and offer `--prose-scope all` for that file or a `userFacingProse` entry, rather than treating it as reviewed.
3. Dispatch the `slop-detector` agent for the semantic review, on every path, and name the reference library in its prompt: `${CLAUDE_PLUGIN_ROOT}/skills/anti-slop/references`. The agent resolves that same path on its own; naming it is what keeps a copy of the agent running outside a plugin install on the catalogue. The scanner cannot see the structural tells (sentence rhythm, sycophancy, tutorial-shaped or over-engineered code, hallucinated APIs), and those outrank everything it does see. For code, run the build or type-check first and pass its output to the agent; hallucinated APIs are otherwise NOT ASSESSED. Name the skipped prose files in the dispatch as out of scope for the prose checks, so the agent reviews them only for the code they embed.
4. Fall back only on an observed failure, and name the failure to the user. The scanner is unavailable when `node` is missing (`command not found`), when Bash is denied, or when the script path does not exist; exit 2 is a usage error and means the argument list was wrong, so fix the list rather than falling back. If the Agent tool fails, review directly using the rules in the anti-slop skill and label the result as a direct review with no agent score.
5. Present the scored report. When step 2 ran, include both scores, labeled: the scanner's `Scan score: N/50` (deterministic, subtractive) and the agent's `Review score: N/M` (judgment across the dimensions it could assess). They are different scales measuring different things and must not be averaged. When step 2 did not run, say so explicitly -- "no scan; last-response targets are not files" -- rather than printing one number as if it were both. List the prose files the scanner skipped once, as skipped, with no score.
6. Say what neither layer could reach. The scanner has no rule for SQL injection, path traversal, SSRF, open redirect, IDOR, insecure randomness, N+1 queries, missing timeouts, unbounded queries, or race conditions, all of which the catalogue teaches; a clean scan is silent on every one of them. Command injection and unsafe deserialization do have rules (`shell-injection`, `unsafe-deserialize`), but only for the `shell=True` and `pickle` / `yaml.load` shapes, so a clean scan clears neither family. The coverage matrix in `references/empirical-rankings.md` lists the boundary in full.
7. Apply fixes only when the user asks for them. The scored report is the deliverable, so do not close it with an offer to fix: the trailing offer is a closing-message tell (`references/writing-patterns.md` § Agent Closing Messages).
8. The dashboard is optional and off by default. Offer it only if the user asks or it's contextually useful; it is the one command that opens a port, it serves in the foreground until Ctrl-C (so run it in the background, or hand the command to the user for a terminal of their own), and `.anti-slop/config.json` `{"dashboard": false}` disables it:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/slop-scanner.mjs" dashboard
   ```

## Usage Examples

- `/slop-check` (review the last assistant message; agent review only, no scan)
- `/slop-check src/components/Header.tsx` (one file: scan plus agent review)
- `/slop-check src/components/` (expand with Glob, then scan the expansion plus agent review)
- `/slop-check diff` (unstaged working changes: `git diff --name-only --diff-filter=d` piped to the scanner, plus agent review)
- `/slop-check pr` (the current branch's PR: `gh pr diff --name-only` piped to the scanner, plus agent review)
