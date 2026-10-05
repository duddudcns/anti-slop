# Changelog

All notable changes to the anti-slop plugin. Versions match `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `anti-slop/.claude-plugin/plugin.json`, the SKILL.md frontmatter, and `anti-slop/scripts/package.json` — all five are bumped together. (It was five, then four when 2.0.0 removed the MCP Server constructor, then five again when 2.2.1 brought the scanner's package.json under the same gate.)

## 2.4.1-vb.1 (fork)

- VB.NET (`.vb`) is a code surface. A string-aware splitter separates `'`/REM comments from
  code (multi-line strings, inline `: REM`, `#Region` and date literals), so banned words and
  the shared comment-slop rules reach VB comments, and markers inside strings do not.
- New cross-line VB slop rules: `vb-empty-catch`, `vb-bool-literal-compare`,
  `vb-bool-return-branch`, `vb-rethrow-only-catch`. `ShowDialog()`/`IsChecked` (Boolean?)
  comparisons, `:=` named arguments and selective rethrows before a broader Catch stay clean.
- `hardcoded-secret` accepts VB `Name As String = "..."`; `*.Tests` projects and `*Tests.vb`
  count as test files. Known gaps: line continuations, Boolean? locals.

## Unreleased

- `/slop-check` applies fixes only when asked and does not close its report with an offer to
  fix, which `writing-patterns.md` § Agent Closing Messages names a closing-message tell. The
  README walkthrough says the same.
- `slop-detector`'s description states its contract (read-only tools, a labeled Review score,
  and location, rule, severity, confidence class and fix for each finding) in place of three
  example dialogues. On large inputs it caps reading at about 25 files and reports a repeated
  class of finding once with its count and locations, instead of stopping at 40 findings.
- SKILL.md's instruction-documents exception no longer reads as putting CLAUDE.md under the
  vocabulary and structure rules: § Prose scope decides, and a public README stays under them.
  `banned-words.md` states the plain-word non-tells (`validate`, `optimize` and the rest) as
  the current rule instead of as a note on what earlier versions listed.
- A single `delve` is a finding, as the scanner scores it. SKILL.md, `banned-words.md`,
  `writing-patterns.md` and `empirical-rankings.md` used a lone `delve` as their example of a
  word that is not a tell; the example is `utilize`, a cluster-tier word. `empirical-rankings.md`
  stops calling the diction cluster low-confidence only and assistant boilerplate the sole
  single-instance tell, and `writing-patterns.md` names the single-hit words beside it.
- The skill no longer fires on every write. Its description scopes it to user-facing prose,
  UI design and code, and explicit AI-pattern reviews, and the Quick Self-Check applies to
  that in-scope output instead of "any output". The catalogue and fixes are unchanged.
- SKILL.md § Regression Prevention still loads `regression-patterns.md` § The Cardinal Rules
  when existing code changes and keeps both exceptions inline, without the added "read it
  rather than working from a summary" emphasis.
- `regression-patterns.md` Cardinal Rule 5 asks for the tests that cover the change before a
  fix counts as complete, not a full-suite run after every edit.
- `slop-detector` drops `model: inherit` from its frontmatter (the dispatching session picks
  the model) and one restated "none of them is optional" mandate.

## 2.4.0 - 2026-09-22

A calibrated-judgment audit of every surface the plugin puts in front of a model, and the
fixes it produced. TypeSafe's Jev model (typed yes/no and scored judgments with
probabilities; it never generates text) scored every heading-delimited section of SKILL.md,
the agent, the command and the thirteen references on eleven conditions (forbids a
legitimate choice, worse if followed literally, names no alternative, unclear boundary, no
reason given, internal conflict, padding, a cosmetic pattern graded as a defect, needs an
input it does not supply, an absolute rule with an unstated exception, gives a method) and
a three-level action score; every banned word and phrase on whether it is ordinary English
and whether the replacement loses meaning; every scanner rule on whether its description
names a fix and whether a reader would understand it; sixteen doctrine pairs across files
on whether they conflict; and forty-five failures of agentic development on whether the
catalogue covers them. The harness is `tools/jev-audit/` at the repo root (a maintainer
tool, outside the shipped tree), and every flagged item was read by hand before it became
an edit. Before and after, on the same model (`jev-1.13.0`) with unchanged sections served
from cache so the comparison isolates the edits:

| Measure | Before | After |
|---|--:|--:|
| Mean action score over all sections (0 leave, 1 edit, 2 rewrite) | 0.67 | 0.59 |
| Sections at edit or above / at rewrite | 130 / 3 | 100 / 1 |
| Doctrine pairs read as conflicting (0.65 or above) | 2 | 0 |
| Banned-word entries read as ordinary English or the precise term | 155 of 223 | 28 of the 55 that stay banned; the 84 plain-word preferences are no longer bans |
| Scanner rules whose description names a fix (mean probability) | 0.16 | 0.78 |
| Scanner rules a reader understands from the description alone (mean probability) | 0.40 | 0.63 |
| Gap candidates uncovered and in scope (of 45) | 29 | 5 |

**Every scanner finding now carries its fix.** The doctrine in
`confidence-and-evidence.md` § The remediation floor has said since 1.7.0 that a finding
which only names the offence gets closed by deletion, and the scanner's own text output
printed exactly that: `[SEVERITY] desc`, with no rule id, no line, no confidence class and
no remediation. Every rule in `rules.mjs` now declares a `fix` (the four inlined families,
banned words, banned phrases, em-dash density and emoji, carry one each as constants), every
violation object carries `fix` and `line`, and the text report prints
`[SEVERITY] desc  (rule-id, line N, Confidence class)` followed by an indented `fix:` line.
`test/rule-metadata.test.mjs` fails on a rule without one. Descriptions that leaned on
internal jargon or overstated certainty were reworded (`uppercase-overline` no longer cites
"Strongest-10 #4"; `innerhtml-usage` reads "XSS if the value is untrusted").

**Three new scanner rules**, each an accessibility or type-safety defect generated code
commonly ships and no rule caught, each with a positive fixture and a clean control in the
corpus: `viewport-zoom-lock` (a viewport meta with `user-scalable=no`, `user-scalable=0`
or `maximum-scale=1`, WCAG 1.4.4; Hard defect, medium), `positive-tabindex` (`tabindex` or
JSX `tabIndex` set to a positive integer, WCAG 2.4.3; Quality defect, medium; `0` and `-1`
stay clean) and `cast-to-any` (a TypeScript `as any` cast; Quality defect, medium, skipped
in test files, case-sensitive so Kotlin and Swift `as Any` never match). `node measure.mjs` before and after: precision 100% both, recall 99.2% both (117 and 120 true positives; the one known false negative is unchanged), baseline regenerated with exactly three new rows.

**The banned-words list is three tiers, and the third is not a ban.** Jev read 155 of the
223 entries as ordinary English or the precise term, and the file's own framing ("avoid
these in general prose") contradicted the concentration doctrine three paragraphs down.
`banned-words.md` now states the split the scanner and `self-check.md` already used:
single-hit tells (the 32 stems `BANNED_WORDS` flags on sight), cluster tells (the 23 stems
`LOW_CONFIDENCE_WORDS` flags at two or more) and plain-word preferences, which are never a
finding and never reported. Thirty-one entries with no inflated sense and a meaning-changing
replacement (`validate`, `optimize`, `mitigate`, `aggregate`, `interpret`, `differentiate`,
`correlate`, `quantify`, `benchmark`, `align`, `reconcile`, `elaborate`, `deliberate`,
`formulate`, `ascertain`, `tailor`, `framework` and the rest) are deleted outright; the
scanner lists are unchanged. `banned-phrases.md` no longer opens with "never use any of
these": it sorts its sections into single-occurrence tells, position tells (the reflexive
first or last sentence) and plain-word preferences, and eight sections gain a "not a tell
when" line (a transition that does its job once, an attribution followed by a citation, a
declarative followed by the specifics). SKILL.md § Vocabulary and the agent's check list
carry the same tiers.

**Doctrine conflicts, resolved at the weaker side.** Two pairs Jev read as conflicting
above the flag line, one more in the review band, and a hand read confirmed all three: the self-check asked for active voice "throughout" while
SKILL.md allows the passive when the agent is unknown; the self-check banned bold in running
prose while the pedagogical exception allows a key term; `writing-patterns.md` told every
writer to use contractions while the register table says a formal spec takes none. Each
checklist item or fix now carries its exception. Two more were softened below the flag
line: `design-patterns.md` recommended "warm colors" and "serif fonts" two sections after
naming cream-and-warm-accent and the fashionable serif as the current default, and both
"Instead" lines now say anchor on the brand or a stated reason instead.

**Rules that forbade a legitimate choice, or gave no alternative.** Every file's "avoid
all of these" preamble is replaced by how to apply the file (class, presence versus
concentration, register, the escape hatch). Exceptions added where a rule was absolute:
passive voice, binary contrasts that correct an assumption, fragments in a casual register,
recapping an ambiguous question in one clause, elegant variation between things that
differ, a helper used once that is complex enough to deserve a name, a `!important` against
a third-party widget, a bold key term in a tutorial, exclamation marks in dialogue, a
feature flag removed because the task is its retirement, a log line removed with its code
path, a default changed because the request asked. Alternatives added where a pattern had
none: testing the mock and trivial tests gain GOOD examples, race conditions gain the
cache-the-promise form, the strongest-ten list points at each entry's remediation. Two
sections pushed toward worse output and are rewritten: `design-patterns.md` § Over-Engineering
Simple Layouts used `repeat(auto-fit, minmax(300px, 1fr))` as its BAD example, the exact
form § Fixed Geometry recommends; and § Identical Testimonial Cards advised mixing star
ratings "for authenticity", which is fabrication. Pricing psychology advice ("$27, $147")
is gone; the pricing, CTA, dashboard, footer, skeleton and 404 entries now give a test
instead of a second set of defaults. `writing-patterns.md` § Temporal Flatness says never to
invent a citation to satisfy it, and § Emoji Abuse no longer describes the block-list
coverage 2.3.1 removed.

**Gaps closed in the catalogue** (doc entries; the coverage matrix in
`empirical-rankings.md` records which have a rule): resource leaks, blocking calls in async
code, catastrophic regex backtracking (with the plugin's own 2.3.2 glob as the example),
multi-step writes without a transaction, log levels, hardcoded environment values,
module-level mutable state, open redirects, shell scripts without `set -euo pipefail`,
unpinned dependencies and `latest` tags, expand-migrate-contract for schema changes,
comments addressed to the user, physical CSS properties where logical ones belong (RTL),
hardcoded user-visible strings, inputs without a matching `type` or `inputmode`, infinite
scroll with no exit, the invented "Trusted by" logo bar, and a new `writing-patterns.md`
§ Agent Closing Messages (verification claimed but not shown, a next-steps list that hands
back work the request covered, a recap of tool output the reader saw, the trailing offer),
which the `slop-detector` agent now checks on a `last response` target. SKILL.md
§ Error Handling defines what "swallows" means and names the fire-and-forget exception,
§ Rhythm and Structure carries the countable form of its rules and scopes them to
expository prose, and § Design and UI Rules opens with the anchor rule before the list of
tells. `confidence-and-evidence.md` reconciles the two definitions of severity the doctrine
carried (functional cost for a defect, strength of the unchosen pattern for a smell).

Of the five candidates the gap battery still reads as uncovered, four are covered by a
sentence inside a larger section (the invented logo bar, a new endpoint's auth and rate
limit, verification claimed but not run, dependency pinning) that the battery's
first-sentence summary of each section does not reach, and one, print stylesheets, is a
decision not to add.

Not changed, by decision: the scanner's word lists, severities and confidence classes,
which the corpus baseline measures and which the audit read on descriptions alone; print
stylesheets and terminal-UI conventions, which Jev placed outside the stated scope; and the
`Authenticity` review dimension, which the audit did not read as conflicting with the
plugin's stated goal.

## 2.3.2 - 2026-09-16

Fixes from an independent review of 2.3.0 and 2.3.1 (a second reviewer with the diff, the
tests and a real repository), applied the same day.

**`eval-usage` no longer goes quiet on code that follows a closed comment.** The 2.3.1 comment
suppress tested whether a line starts like a comment, not whether it is one: `/* setup */
eval(payload);` and the generator method `*gen() { eval(x); }` scanned clean, and the hyphen
in the lookbehind swallowed `return -eval(expr)`. A line is prose only when its comment never
closes on it, a leading `*` is a continuation only before whitespace, a slash or the end of
the line, and the hyphen is gone; the doc-comment noun ("re-eval (") stays silent because it
sits on a comment line. Known gap, recorded rather than hidden: a line that closes a block
comment and then executes (`*/ eval(x)`) is still suppressed, because the scanner carries no
comment state across lines.

**Prose-scope globs no longer hang on repeated `**/`, and they ignore case.** Consecutive
`**/` segments compiled to a chain of optional greedy groups that backtracked exponentially on
a non-match (twelve segments: nine seconds); they now collapse to one, and a segment run
compiles to whole segments. Matching is case-insensitive, so `README.md` opts in `Readme.md`
on the filesystems that fold case.

**A skipped prose file is never opened.** Scope is decided before any file is read, so a
deleted or unreadable document in a diff list cannot abort the run with exit 2; a file the
scan would open still does. Under `--quiet`, a run that scanned nothing at all says so on
stderr in one line, because a docs-only CI change used to pass green with empty output having
read zero files. `--format json` skipped rows now carry the `scope` that was in effect.

**Binary is never scanned.** The emoji rule was the one family with no surface gate, and a PNG
read as UTF-8 reported an emoji; content carrying a NUL byte now matches no rule on any
surface.

**A ZWJ sequence counts once.** A family emoji counted three, and two of them escalated a
finding that six rockets would not; the atom now consumes the join.

**Wording.** `/slop-check` and the `slop-detector` agent no longer read "skipped" as
"internal": a skipped file is one the project has not opted in, and when it is plainly
user-facing copy (the README of a public project, release notes, store metadata) the reviewer
says so and offers `--prose-scope all` or a `userFacingProse` entry instead of treating it as
reviewed. README, SKILL.md and CLAUDE.md now say the globs are relative to the directory the
scanner runs in, which is where it reads `.anti-slop/config.json`; the 2.3.0 and 2.3.1 entries
below quote the measurements as recorded (22 projects; 12 repositories, 232 code files); and
CLAUDE.md notes that the Unicode property escapes resolve against the running Node's tables,
so emoji newer than the interpreter are not matched.

Not changed, by decision: the default prose scope stays `user-facing` with no shipped default
list (an unconfigured project scans no prose), and the 97 text-presentation pictographs
(⚠ ✔ ❤ ➡ and kin) stay text; a companion tell in the style of `media-control-glyph` is the
shape if that changes.

## 2.3.1 - 2026-09-16

Two scanner rules measured against a working fleet and narrowed to what they were for.

**Emoji: Unicode's definition, not a block list.** Since 2.1.0 the emoji rule matched whole
code-point blocks (Arrows, Miscellaneous Technical, Geometric Shapes), added after a
pause/play toggle shipped as a text glyph. Over two weeks of changes in 12 active repositories,
232 code files carried an emoji finding, 187 of them for a plain right arrow and most of the
rest for the command-key symbol in shortcut hints and small triangles as disclosure markers. An emoji is
now what Unicode renders as one: a character with default emoji presentation, a pictograph
forced to emoji presentation by U+FE0F, a keycap sequence, or a flag, with a skin-tone
modifier attached to its emoji so a toned hand counts once. Arrows, the command key, heavy
check marks, copyright and trademark signs, stars and music notes are text and are no longer
findings; a check-mark button, a rocket, sparkles, a star, and a play sign followed by U+FE0F
still are. `console-log-emoji` shares the definition.

**`media-control-glyph`, a design and native tell.** The pause/play incident that justified
the wide ranges gets its own rule on UI surfaces (markup, components, SwiftUI): a bare
media-control text glyph used as a control is a low-severity Pattern smell. The
default-emoji transport symbols stay with the emoji rule, prose is not a UI surface, and the
U+FE0F forms are emoji. Corpus fixture: `design/media-control-glyph.tsx`.

**`eval-usage` no longer fires on Playwright or on the noun "eval".** Every Swift hit on the
fleet was a doc comment ("once per message per body eval (#787)", "a pure parent re-eval"),
and every JavaScript hit under the audit scripts was `page.$eval(` or `page.$$eval(`. The
rule now refuses a `$`, a word character or a hyphen before `eval` and skips comment-only
lines; `eval(x)`, `eval (x)` and `window.eval(x)` on a code line still fire at high
severity.

`npm run measure` after the change: precision 100%, recall 99.2% (117 true positives; the one
known false negative is unchanged), with the new fixture recorded in the baseline.

## 2.3.0 - 2026-09-16

**Prose scope: the writing rules now cover user-facing prose, and internal documents are
skipped.** Measured across the 22 projects of one working fleet that had recorded scans, 81%
of the scanner's recorded findings sat in markdown and 56% were em-dash density, nearly all of it in specs,
plans, decision logs, evidence reports and handoffs that never ship to a reader; the usual
follow-up was a paragraph in the pull request explaining the finding away, present in
roughly one PR in eight. Those documents were never what the writing rules were written
for. The scanner now skips `.md`, `.mdx`, `.txt` and `.rst` files unless the project lists
them under `userFacingProse` in `.anti-slop/config.json` (globs relative to the project
root: `docs/release-notes/**`, `**/*.md`, `README.md`) or sets `proseScope` to `all`;
`--prose-scope all` and `ANTI_SLOP_PROSE_SCOPE=all` do the same for one run, and the flag
outranks the variable, which outranks the config. A skipped file prints as
`skipped (prose scope: user-facing)`, sits under `skipped` in `--format json` (the `files`
and `totals` shapes are unchanged), is never recorded, and never affects the exit code,
so a run that skips everything exits 0 and writes nothing. Code files are untouched: their
comment rules run under either scope. The skill, the `/slop-check` command and the
`slop-detector` agent carry the same boundary, so an internal document is neither scrubbed
for em dashes nor reported for them. CI gates that relied on the old default keep it with
`proseScope: "all"` in the project config or `--prose-scope all` on the command line.

The plugin's own suite runs under `all` through a preload (`test/env.mjs`), because its
fixtures are prose tells by construction; `test/prose-scope.test.mjs` clears the variable
to test the default, and the corpus, measurement and dogfood paths pass the scope
explicitly. `npm run measure` reports the same precision and recall as 2.2.2.

## 2.2.2 - 2026-09-01

A functioning-and-harm review of the whole plugin, run from one question: does any
surface of this reduce output quality or reasoning? Three defects in the scanner and CLI,
one in the agent, two instruction-surface rules that could push a model into worse output,
a doctrine correction, and a handful of documentation corrections.

**Fixed: the `dashboard` subcommand exited before serving.** Since 2.0.0 turned the MCP
tool into a CLI, `slop-scanner.mjs dashboard` printed a URL and returned, the entry point
turned that return into `process.exit`, and the listener died with the process: the port
answered nothing and the registry entry was removed in the same tick. The command now
holds the process open while it serves and prints `Serving until Ctrl-C.`; SIGINT and
SIGTERM unregister the project and exit 0. A dashboard already serving from another
session still prints its URL and returns at once. `test/no-mcp.test.mjs` spawns the
command, fetches from the URL it printed, sends SIGINT, and checks the registry is empty
afterwards.

**Fixed: the `slop-detector` agent could not find its reference library.** The 2.1.0 agent
located the catalogue with a `Glob` for `**/skills/anti-slop/references/*.md`, described
as finding the installed plugin cache. `Glob` searches the project directory, the plugin
cache is not under it, and the agent's own instruction was to stop and report the library
unreachable when the search came back empty, so in every project except a clone of this
repo the deep review refused to run. The agent now reads from
`${CLAUDE_PLUGIN_ROOT}/skills/anti-slop/references/`, which Claude Code substitutes in
agent and skill content, with the dispatcher-supplied directory and the project-relative
`Glob` as fallbacks. `/slop-check` and the skill's routing table name the directory in the
dispatch prompt. When nothing resolves, the agent no longer refuses: it says so on the
evidence line, reviews against the rules its own body carries, and marks
catalogue-dependent findings NOT ASSESSED.

**Scanner: `hardcoded-secret` reaches snake_case, SCREAMING_CASE and `*_KEY` names.** The
key needed a word boundary, an underscore is a word character, and so `OPENAI_API_KEY`,
`BILLING_SECRET_KEY`, `client_secret`, `access_token`, `db_password` and Django's
`SECRET_KEY` all scanned clean while `apiKey` on the next line fired. The key may now
stand alone or end a snake_case name, and `secret_key`, `access_key` and `private_key`
(with an optional `_id` or `_base`) join `api_key`. A name that continues past the noun
(`PASSWORD_LABEL`, `API_KEY_HEADER`, `TOKEN_ENDPOINT`) still does not match, camelCase
compounds (`currentPassword`, `colorToken`) stay unmatched on purpose, and the value must
still be secret-shaped. Corpus: `site-settings.py` (positive) and `config-labels.py`
(clean control), both authored here.

**Scanner: `assistant-boilerplate` fires only when the assistant speaks about itself.**
The sole single-instance prose tell, at high severity, was matching ordinary English:
"I can't help but notice", "I cannot help thinking", a document stating a model's
knowledge cutoff in the third person, and "I don't have access to the staging box" were
all reported as leftover boilerplate. The refusal leg now excludes the idioms after
`help` and needs a request object after `fulfill`, `comply with` and `provide`; the cutoff
legs need `my`; the access leg needs the things an assistant lacks (real-time data, the
internet, "your files"); and `I'm unable to` joins `I am unable to`. Every form the corpus
and the unit tests already pinned still fires. Corpus: `first-person-idioms-clean.md`
(clean control).

**Instruction surface: two rules that could push a model into worse output.** `SKILL.md`
§ Trust and Directness said "no softening, justification, or hand-holding" and "no
recapping at the end" with no counterweight on the always-loaded surface. It now states
that calibrated uncertainty is not softening (say what was not verified and what could
still fail; false confidence is the mirror tell), and that the closing message of an
agentic session, whose reader may have seen none of the tool output, is the deliverable
rather than a recap. The Quick Self-Check gains the uncertainty item and its recap item
carries the same distinction; `self-check.md` and `writing-patterns.md` § Summary at the
End say the same in their own places. § Architecture's flat "no helper functions used
once" now matches the catalogue: a function earns its name by a second caller or by
being complex enough to deserve one.

**Doctrine correction.** `empirical-rankings.md` and `banned-phrases.md` said assistant
boilerplate fires "even inside quotes". The scanner has always stripped quoted spans and
blockquotes before matching, its own clean control (`quoted-and-fenced-noise.md`) carries
a blockquoted "As an AI language model" that must stay silent, and a document that quotes
the phrase to discuss it is not committing it. Both files now say so.

**Smaller corrections.** `/slop-check` described `--quiet` as printing the summary only;
it suppresses all output and leaves the exit code, as the CLI and README already said.
The command's `allowed-tools` gains `Bash(git branch:*)` for the branch line it runs at
load, and its dashboard step says the command serves in the foreground. `README.md`
stops promising a `/50` review score (the agent has reported `N/M` with a NOT ASSESSED
denominator since 1.7.0) and says the dashboard serves until Ctrl-C. `CONTRIBUTING.md`
said a version bump touches four places; it is five. `code-patterns.md` § Hardcoded
Credentials documents what the rule matches and what it refuses, like the other rules
with a scanner leg. `anti-slop/scripts/package-lock.json` had said `1.0.0` and `ISC` since
the first release while the package beside it said otherwise; npm regenerated it.

Measure: precision holds at 100% on 72 fixtures; recall 99.1%, with the one known false
negative (`user-profile-widget.jsx`, `useeffect-setstate`) unchanged. `baseline.json`
regenerated: code true positives 31 to 32.

## 2.2.1 - 2026-08-24

Calibration and record-keeping pass over the 2.2.0 additions, from an adversarial
review of that release. No new tells; two rules are narrowed and one is re-housed.

`bootstrap-default-blue` now requires the compiled primary blue (`#0d6efd` or
`#0b5ed7`) to be present in the file before any of its hexes count. The threshold
sums matches rather than distinct alternatives, so the rule was reaching two on
repeats of a single literal: a hand-rolled sheet reusing one chosen `#dee2e6`
border gray, which is a token decision, was being reported as an unthemed
framework. **This is a deliberate recall loss**, and it is the point of the
change: a file that themed the blue and kept the Bootstrap gray is now invisible
to the scanner. A lone borrowed neutral sits below this repo's signal floor, and
the tell remains the agent's to catch from the catalogue.

The "Scroll to explore" literal moves out of `generic-microcopy` into its own
`hero-scroll-hint` rule. Appending it in 2.2.0 made it inherit a Quality-defect
class justified by "these strings say nothing about the product" and a
copy-rewrite remediation, neither of which fits a hint that asserts something
true about the page; it is now a Pattern smell with the structural remediation its
own catalogue entry states. The new rule carries a `suppress` guard for
`aria-label` and `alt`, where removing the hint would delete screen-reader output.
`generic-microcopy` returns to its 2.1.1 pattern.

Corpus: three fixtures close the gap that made "corpus precision holds at 100%"
uninformative for the 2.2.0 additions, which had no labels at all. A positive for
the genuine unthemed Bootstrap pair, a clean control carrying a consistently
reused non-Bootstrap border gray, and a positive for the hero scroll hint that
also plants the suppressed `aria-label` shape. `baseline.json` regenerated:
design true positives 49 to 51, precision unchanged at 100%.

Documentation: the scanner-coverage table splits the Bootstrap fingerprint into
its three honest rows (hexes covered, 4px radius partly, default shadow and zebra
striping not at all) rather than one unqualified Yes for a five-leg fingerprint;
the concentration-threshold table lists all ten design rules instead of five; the
zebra remediation replaces striping with row rules plus a `:hover` and
`:focus-visible` highlight, so the row boundary survives touch and keyboard rather
than becoming pointer-only; the Bootstrap remediation names the escape hatch for
mid-migration token sheets; `## Logo and Brand Mark Tells` moves below
`### The "Logo Swap Test"`, which is a page-identity diagnostic and was silently
re-parented under it; and the `DESIGN_PATTERNS` header states that heuristic rules
are grouped with their nearest analogue rather than ranked by signal.
`empirical-rankings.md` § Coverage matrix gains the Bootstrap and microcopy
families, and both it and `confidence-and-evidence.md` are re-stamped to 2.2.1.
`docs/rankings-refresh.md` records that the 2.2.x UI tells were authored in
parallel in ui-craft from the same MIT upstream rather than propagated by the
downstream-sync procedure, and that anti-slop remains the owner of the tells.

Packaging: `anti-slop/scripts/package.json` was still declaring 2.1.1. It ships
inside the plugin and prints its version on every `npm run measure`, so it is now
the fifth version spot and `test/dashboard.test.mjs` A9 enforces it.

## 2.2.0 - 2026-08-24

Design-tell additions adapted from [VibeCurb](https://github.com/Yu-369/VibeCurb)
(MIT, Copyright (c) 2026 Yu-369), deduplicated against the existing catalogue and
graded to this repo's confidence classes (heuristic provenance, not corpus-ranked,
so everything lands as Pattern smell or agent judgment).

New scanner rule: `bootstrap-default-blue` -- Bootstrap 5's compiled literals
(`#0d6efd`, `#0b5ed7`, `#dee2e6`) as a concentration rule from two occurrences,
the Bootstrap twin of `ai-purple-hex`. `generic-microcopy` gains the
"Scroll to explore" hero literal. Both carry bidirectional tests; corpus
precision holds at 100% with no new misses.

New catalogue entries in `design-patterns.md`: the Bootstrap Fingerprint
(incl. zebra-striped tables), scroll indicators in the hero, cards-inside-cards
nesting, the unchosen-easing / scale(0)-entrance motion defaults (deliberately
scanner-less -- keyword easings are ubiquitous in human CSS), and a new
Logo and Brand Mark Tells section (brain-neuron marks, globe-swoosh,
shield-wings, chrome 3D, gradient-dependent marks) with reduction-based
remediation (3-primitive cap, favicon test, one-sentence geometry, inversion
test). Scanner-coverage and concentration-threshold tables updated to match.

## 2.1.1 - 2026-08-24

`dead-branch` now matches Python's colon forms (`if False:`, `elif True:`,
`while False:`) alongside the parenthesised shapes it shipped with. `while True:`
stays excluded as the idiomatic event loop, and `if item is True:` still does not
match. The 2.1.0 rule was JS/TS-shaped only, a scoping recorded at release and closed
here on request. One corpus fixture gains the Python dead branch, the clean control
gains a `while True:` near-miss loop, and the reference entry documents both shapes.

## 2.1.0 - 2026-08-23

The largest detection expansion since 1.4.0, driven by a five-way audit of the whole
plugin (scanner engine, corpus and tests, instruction surface, docs and packaging, and
current-source research on 2026-era tells). Thirty rules are new, seven existing rules
were broken by realistic one-line inputs and are fixed, and the plugin's own reference
library now scans clean under its own scanner.

**Scanner: 30 new rules.** The tables grow from 49 to 79 distinct rules.

- *Design (14, web surfaces):* fixed pixel page shells and grid tracks, `100vh` app
  shells, spacing values that bypass the file's own token scale, repeated literal radii
  with no stated radius identity, dead controls (empty or TODO-only handlers),
  `outline: none` with no `:focus-visible` replacement, missing or generic `alt` text,
  the tracked-out uppercase overline, decorative blur blobs, the shadcn stats-row
  example figures shipping as content, generic microcopy, `transition-all`, and uniform
  section padding.
- *Code (13):* `dangerouslySetInnerHTML` without sanitization, `shell=True` command
  injection, unsafe deserialization (`pickle.loads` / bare `yaml.load`), Tailwind
  dynamic class construction, suppression comments (`@ts-ignore` / `eslint-disable`;
  `@ts-expect-error` deliberately exempt), deprecated APIs, dead branches
  (`if (true)` / `if (false)`), `forEach(async ...)`, `catch (e: any)`, leaked model
  tooling tokens (`oaicite`, `turn0search`, `[cite: N]` and kin — also active on
  prose), and the comment-slop family: banner, apologetic, and deferral/hedging
  comments.
- *Native (2, Apple surfaces):* `.font(.system(size:))` without `relativeTo:` or
  `@ScaledMetric` (Dynamic Type stops scaling), and `DispatchQueue.main.async` piled up
  as a blanket concurrency fix.
- *Prose (1):* the 2026 plain-word register, matched as collocations only
  (`quietly building`, `decisions compound`, `earn the right to`) — the bare words
  stay unbannable by design, and a test enforces that.
- *Updated:* the cream-serif tell gains its drifted warm accent leg (rusty orange and
  terracotta alongside sage), `generic-font` covers the current default set (Space
  Grotesk, Manrope, Plus Jakarta Sans, Outfit, DM Sans), the antithesis rule catches
  the "it's not about X, it's Y" reframe, and `z-index-escalation` sees the JS object
  form (`zIndex: 9999`).

**Fixed: seven rules that failed on realistic input.**

- `.html`, `.htm`, `.vue`, `.svelte`, and `.astro` files now run the code rules too.
  Previously a `<script>` block containing `eval()`, an `innerHTML` assignment, and a
  hardcoded key scanned clean on the most common surface for each.
- The escape hatch (`anti-slop-allow` / `unslop-ignore`) now works for banned phrases
  in code files. It silently did not.
- Context exceptions are word-anchored. The substring test had quietly disabled five
  banned words in almost any real file ("port" inside "important" disabled
  `ephemeral`).
- `hardcoded-secret` requires a secret-shaped value, so i18n strings
  (`password: "Please enter your password"`), lexer token kinds, and validation
  messages stop firing at high severity.
- Three class-fingerprint rules matched only one utility-class order and were silent on
  the exact canonical strings the reference catalog documents. They now match the
  tokens unordered, scoped to a single class attribute.
- The emoji ranges cover arrows, media controls, and geometric shapes (U+2190-21FF,
  U+2300-23FF, U+25A0-25FF) — the pause/play glyph family previously slipped through
  bare. Severity escalates above five emoji, and a prose file that discusses emoji is
  no longer flagged for its own examples.
- `listicle-scaffold`, `hr-divider`, `narrating-comment`, and `boilerplate-marker` are
  narrowed: "the migration runs in 3 steps", Markdown setext underlines, runbook
  `# Step 1:` comments, and RFC-2606 `example.com` in real config no longer fire.

**Engine.** Rules can declare file-scope guards (`requires` / `unless`), a numeric
`count` predicate joins `pattern` for rules whose test is arithmetic, and concentration
thresholds now apply on every table. `--record` batches to one write per invocation
(about 7x faster on large runs) and stores one aggregate score row per scan instead of
evicting its own results; `history` and `stats` no longer create an empty `.anti-slop/`
directory just by being asked.

**Verification.** The suite grows from 131 to 302 tests: a per-rule corpus regression
gate (a rule regression can no longer hide inside aggregate precision), a dedicated
false-positive suite, store and CLI coverage, a cross-module drift check, and a dogfood
snapshot gate that scans every shipped markdown file and pins the finding counts — it
caught a real defect in the dashboard's own stylesheet on its first run. The corpus
grows from 48 to 66 fixtures, including the first raw-CSS fixtures and near-miss clean
controls for every narrowed rule. Corpus accuracy: precision 100.0%, recall 99.1%.

**Instruction surface.** SKILL.md finally routes to the plugin's own executable: a
"How to run this" section states when to self-check inline, when to run the scanner,
and when to dispatch the `slop-detector` agent. The agent locates its reference library
by discovery instead of unresolvable relative paths, its findings carry an explicit
Severity alongside the confidence class, and dimensions its evidence cannot reach are
reported `NOT ASSESSED` instead of forcing a number. `/slop-check` runs the
deterministic scan on `diff` and `pr` targets via `git diff --name-only | xargs`. A
coverage matrix in `references/empirical-rankings.md` states, per tell family, whether
a scanner rule exists, whether the agent can reach it, and what needs a runtime or a
build — and `references/confidence-and-evidence.md` names the families that remain
judgment-only.

**Docs and packaging.** An internal maintainer work order is no longer shipped in the
plugin, the README's worked example and agent dimension names match the code, research
claims carry links only where the source was verified, the dev-install command points
at the actual plugin directory, and SECURITY.md and CONTRIBUTING.md exist. Both
`plugin.json` files are byte-identical and version parity remains four spots.

## 2.0.0 - 2026-07-27

**Breaking: the MCP server is gone.** The plugin no longer registers
`anti-slop-scanner`, ships no `.mcp.json`, and exposes no MCP tools. Anything calling
`scan_file`, `get_dashboard_url`, `get_score_history`, or `get_rule_stats` must move to the
CLI, which does the same work without a resident server, an SDK, or a tool round-trip.

The protocol was buying nothing. Every tool was a thin wrapper over a synchronous function,
delivered through a stdio server that had to be running, discovered, and kept alive to
return output a subprocess hands back directly. It also made the scanner unusable outside
Claude Code without reimplementing the transport.

No capability was dropped. All four tools have a subcommand:

| Was | Now |
|---|---|
| `scan_file` | `slop-scanner.mjs scan [options] <file...>` |
| `get_score_history` | `slop-scanner.mjs history` |
| `get_rule_stats` | `slop-scanner.mjs stats` |
| `get_dashboard_url` | `slop-scanner.mjs dashboard` |

- **Zero runtime dependencies.** `@modelcontextprotocol/sdk` was the only one, and the
  lockfile is now empty of packages. The scanner runs from a fresh clone or an installed
  plugin with no `npm install`, which also means a CI gate cannot silently skip it because
  a dependency failed to resolve.
- The v1.5.0 dashboard invariant survives intact: nothing opens an HTTP listener except an
  explicit `dashboard` command, and `.anti-slop/config.json` `{"dashboard": false}` still
  disables it. `lib/dashboard.mjs` and `lib/stats.mjs` are now dynamically imported so the
  `scan` path never loads the HTTP module at all.
- Zero-argument invocation used to start the stdio server and block; it now prints usage
  and exits 2.
- `/slop-check` calls the scanner via `Bash(node:*)` instead of an MCP tool, and falls back
  to the agent when it cannot.
- Version parity is now four spots, not five. `test/dashboard.test.mjs` A9 enforces it.
- 11 new tests assert the removal is real rather than dormant: no `.mcp.json`, no SDK
  import anywhere, no MCP identifier left in the entry point, and no subcommand except
  `dashboard` opening a port. Suite is 131 tests.

## 1.7.0 - 2026-07-27

Integrates the anti-AI work from the `ui-craft` 0.3.0 and `apple-ui-craft` 0.3.1 releases.
Both are downstream of this plugin's UI research, and both produced material that flows
back, including a correction to a rule this plugin shipped.

**Fixed: a rule that told people to delete responsive typography.** Strongest-10 entry 9
flagged any responsive type scale, with no remediation. A designer or agent clearing that
finding removes fluid type scaling, which makes the page worse and fails WCAG 1.4.4 Resize
Text. It is now the *verbatim* Tailwind default run, graded as a genericness signal, with a
`clamp()` remediation attached. Two corpus fixtures pin both directions.

**Fixed: `!important` overuse fired on the reduced-motion idiom.** `* { transition: none
!important }` inside a `prefers-reduced-motion` block is the correct WCAG 2.3.3
implementation, and the rule was reporting it on three clean controls. Its only available
"fix" was an accessibility regression. Now suppressed, and the rule fires at two or more
matches, since it is named *overuse*.

- **Confidence classes.** Every finding carries one of Hard defect, Quality defect, Pattern
  smell, or Taste note, in both the scanner's JSON output and the `slop-detector` report.
  Independent of severity: a possible hardcoded credential is severity high and confidence
  Pattern smell, because a regex cannot prove the string is live. Defined once, in
  `references/confidence-and-evidence.md`, with a test that fails on drift between the
  doctrine and the code.
- **Presence versus concentration.** Design and native tells declare which they are, and
  concentration tells carry a numeric threshold instead of firing on the first match:
  `rounded-everything` at 3, `cream-serif-default` / `ai-purple-hex` / `ai-purple-class` /
  `important-overuse` at 2. The floor rule -- a lone utility-class hit is not a finding --
  is now enforced rather than advisory.
- **Native UI rule set** (`references/native-ui-patterns.md`) with five SwiftUI tells:
  `UIScreen.main.bounds`, fixed content frames, device-idiom branching, fixed grid columns,
  and ungated repeating symbol effects. Design tells now run on web extensions only and
  native tells on Apple extensions only; previously every code extension was matched against
  Tailwind vocabulary.
- **Density and economy** (`references/density-and-economy.md`): the first rule against
  WASTE rather than excess, with thresholds for viewport utilisation, internal distribution,
  page economy, copy economy, and action placement. Waste without a measurement is a taste
  note; with one it is MEDIUM or HIGH.
- **Evidence discipline.** The detector states its evidence mode and coverage on the first
  line of its report, needs real geometry for any spatial or numeric claim (a screenshot is
  never geometry evidence), and reports NOT ASSESSED rather than clean for anything the
  evidence could not reach.
- **One corpus, 48 fixtures.** Absorbed ten fixtures authored in ui-craft, added a `native`
  modality and three new design fixtures. Labels now carry severity, confidence, and a role:
  `positive`, `clean-control`, or `coverage-boundary` (a real tell this scanner has no rule
  for, recorded rather than implied). anti-slop owns the corpus; ui-craft's is a downstream
  view. Per-item ownership across the three repos is in `docs/rankings-refresh.md`.
- **Two new gates.** `check-references.mjs` verifies every reference citation resolves to a
  real file and heading and warns on orphans; `corpus-contract.test.mjs` enforces the
  clean-control tolerances, catches label grading drift, and tests the scorer's own
  arithmetic. Suite is 123 tests, up from 76.
- Corpus accuracy moved **precision 95.4% -> 100.0%** and **recall 98.4% -> 98.6%**. The
  precision gain is the three reduced-motion false positives; recall rose despite dropping
  two `rounded-everything` labels that the floor rule shows were never correct.

## 1.6.0 - 2026-07-03

- CI-facing scan CLI: `node scripts/slop-scanner.mjs scan [options] <file...>` for pre-commit hooks and CI gates that don't speak MCP, with `--format`, `--fail-on`, `--record`, and `--quiet` flags.
- Split score naming: `Scan score: N/50` (deterministic, from `scan_file` or the CLI) and `Review score: N/50` (the `slop-detector` agent's 5-dimension judgment) are now always labeled separately so neither is mistaken for the other.
- Suppressed-finding capture and the `get_rule_stats` MCP tool: per-rule counts of findings that fired live versus were deliberately suppressed (escape hatch or `allowedWords`), with worst severity and last-seen timestamp.
- Labeled corpus and precision/recall measurement harness (`npm run measure`) with a committed baseline for tracking scanner accuracy across rule changes.
- Model policy: the `slop-detector` agent no longer pins a model. Its frontmatter reads `model: inherit`, so it always runs on the session's active Claude model, present or future.
- Docs refresh: corrected the reference-file count (10, not 8), added a worked walkthrough and a troubleshooting table to the README, and added this changelog.

## 1.5.0 - 2026-07-03

- The web dashboard became optional and on-demand: nothing starts an HTTP listener except an explicit `get_dashboard_url` call, and `.anti-slop/config.json` `{ "dashboard": false }` disables it entirely.
- Dashboard scope narrowed to findings statistics only (scan counts, severity breakdown, findings by rule, findings per scan, recent findings) — the earlier score-centric view was dropped.
- `slop-scanner.mjs` split into `scripts/lib/` modules (`rules.mjs`, `scan.mjs`, `store.mjs`, `dashboard.mjs`, `stats.mjs`, `cli.mjs`) with no behavior change.

## 1.4.x - 2026-06-22

- 1.4.1: cut hardcoded-secret false positives in the scanner.
- 1.4.0: integrated an empirical AI-tells dataset and expanded scanner coverage.
- 1.4.0 also dropped the prompt-based hooks that 1.2.0 introduced (commit `3011c54`): a hook was the wrong enforcement mechanism for judgment-shaped rules. The domain exceptions stayed, the `hooks/` directory went, and no release since has shipped one.
- There is no 1.3.0 entry below because 1.3.0 was never released; the number was skipped.

## 1.2.0 - 2026-03-30

- Context-aware hooks and expanded domain exceptions — the plugin now yields to academic, legal, medical, ML, and other domain conventions instead of flagging their standard vocabulary. (The hooks were removed before the next release; see 1.4.x.)

## 1.1.0 - 2026-03-30

- Plugin optimization pass informed by best-practices research on Claude Code plugin structure.

## 1.0.0 - 2026-03-30

- First stable release: the `anti-slop` skill, the `slop-detector` agent, the `/slop-check` command, the MCP scanner with web dashboard, and the banned-words/banned-phrases/pattern reference catalogs.

## 0.9.0 - 2026-03-30

- Initial release.
