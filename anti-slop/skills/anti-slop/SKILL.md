---
name: anti-slop
version: 2.4.1-vb.1
description: Catches AI-default tells and agentic shortcomings in user-facing output: banned vocabulary and structural cliches in prose, AI-default design and UI code, accessibility failures, and security holes or regressions in the code under review. Use when writing or revising user-facing prose (UI copy and microcopy, notifications, marketing and store listings, release notes, public docs), when designing or building UI, and when asked to review output, a file, a diff, or a PR for AI patterns ("/slop-check", "check this for AI patterns", "does this read as AI-written?"). Context-aware: yields to domain conventions and project requirements.
---

## Core Principle: Do No Harm

This plugin must never reduce output quality. If a rule makes the output worse for the current task, skip the rule. Security and accessibility rules always apply. Vocabulary, style, and formatting rules yield to domain conventions and project requirements.

Apply rules with judgment, not mechanically. Rigid compliance creates its own detectable pattern. If the output reads like it was run through a filter (all warmth removed, all lists avoiding three items, synonym roulette), the rules are being applied too aggressively.

Four findings from the corpus data (`references/empirical-rankings.md`) sharpen this:

- **Flag the unspecified default, not the value.** A tell is an unchosen default, not a banned token. Purple, a serif font, an em dash, or a broad `try/except` is a tell when the model reached for it by default and a legitimate choice when it was chosen for a reason. A line marked `anti-slop-allow: <reason>` (or `unslop-ignore`) is a deliberate choice; leave it alone. The marker must sit on the offending line itself (`references/choosing-with-intent.md` states the placement contract).
- **Concentration, not lone hits.** One "utilize," one "however," one em dash is not a tell; several in a short span is. Some high-frequency words ("however," "nuanced," "comprehensive," "utilize") match often but are rarely the real signal. Weight by density; the single-hit words in § Vocabulary are the exception, a finding on one occurrence.
- **The loudest tells are structural, and no pattern matches them.** Sentence rhythm, sycophancy, fluent-but-empty paragraphs, tutorial-shaped code, hallucinated APIs, and code that ignores its neighbours are the top-cited tells in every domain, and every one of them is invisible to a word scan. A clean scan clears the cheap layer only. Route the rest to a semantic read (§ How to run this).
- **Banning the old tells creates the new one.** Mechanical over-correction is itself detectable: staccato prose dodging every em dash, or cream-and-serif replacing purple. The fix is a deliberate choice with a reason (`references/choosing-with-intent.md`), not avoidance.

## How to run this

The plugin ships three layers. Route by what the target is and what evidence is available.

| Layer | Trigger | How to run it |
|---|---|---|
| Inline self-check | In-scope output (user-facing prose, UI work, a review target) you wrote or edited in this turn, before you hand it back | § Quick Self-Check below; `references/self-check.md` for the full checklist by output type |
| Deterministic scan | The target is one or more files on disk | `node "${CLAUDE_PLUGIN_ROOT}/scripts/slop-scanner.mjs" scan <file...>`; a prose file the project has not listed under `userFacingProse` prints as skipped (§ Prose scope) |
| `slop-detector` agent | The target is a diff, a PR, a long response, or the structural tells above | Dispatch the `slop-detector` agent, or run `/slop-check <target>`, which runs both layers and reports both scores. Name the reference library in the dispatch prompt: `${CLAUDE_PLUGIN_ROOT}/skills/anti-slop/references` |

The scanner needs no install and has zero runtime dependencies. It exits 0 when clean, 1 on findings, 2 on a usage error, and takes `--format json`, `--fail-on <level>`, and `--quiet`. Every finding carries its rule id, line, confidence class, and a one-line fix: apply the fix, and never delete the construct to clear the match. It reads files only, never a directory or a glob, so pipe a file list in:

```bash
git diff --name-only --diff-filter=d | xargs node "${CLAUDE_PLUGIN_ROOT}/scripts/slop-scanner.mjs" scan
```

Run both layers whenever both apply, and say which one produced a given score. For code, build and type-check before either: hallucinated APIs are the second-ranked code tell by verified share and only a compiler catches them.

## Prose scope

The writing rules govern user-facing prose: UI copy and microcopy, notifications and emails, marketing and store listings, release notes and tester-facing build notes, and public documentation. Internal documents are out of scope: specs, plans, ADRs and decision logs, evidence and audit reports, handoffs, changelogs, contributor docs, and CLAUDE.md. Do not scan them for writing tells, do not scrub em dashes or vocabulary in them, and do not report their density as a finding or explain it away in a pull request. Code files keep their comment rules on every surface.

The scanner draws the same line: a `.md`, `.mdx`, `.txt`, or `.rst` file prints as `skipped (prose scope: user-facing)` unless the project lists it under `userFacingProse` in `.anti-slop/config.json` (case-insensitive globs relative to the directory the scanner runs in, such as `docs/release-notes/**`; run it from the project root) or sets `proseScope` to `all`. A skipped file is neither clean nor a finding; leave it alone. Pass `--prose-scope all` only when the user asks for a document to be reviewed as user-facing copy.

## Scope and Limitations

This plugin catches the documented shortcomings of agentic development: security holes, accessibility failures, performance problems, generic design defaults, and regressions. The goal is correct, secure, accessible output, not hiding AI involvement.

It targets web-centric code (Python, TypeScript, JavaScript, CSS) and general English prose, with a layout and adaptation rule set for Apple platforms (`references/native-ui-patterns.md`). It has limited coverage of systems languages (Rust, Go, C/C++), Jetpack Compose, ML/data science workflows, and non-English contexts. For domains not covered, apply the underlying principles (specificity, economy, correctness) rather than the specific word lists.

**A finding states how sure it is, and a clean result states what it could not see.** Every
finding carries one of four confidence classes (Hard defect, Quality defect, Pattern smell,
Taste note), independent of severity; most design tells are Pattern smells, and grading
them honestly is what stops a tell reading as an accusation. Claims of spatial or numeric
precision need real geometry, never a screenshot. Anything the evidence could not reach is
reported NOT ASSESSED rather than clean. `references/confidence-and-evidence.md` is the
single definition of all six: the confidence classes, the presence/concentration split, the
remediation floor, the evidence modes, the geometry rule, and the not-assessed rule. The
domain reference files restate individual rules where a domain needs a local
specialisation, and those restatements defer to that file.

## Context Exceptions

These rules target general-purpose output. Domain-specific work overrides vocabulary, phrasing, and style rules. **When in doubt, follow the domain convention, not the banned list.**

- **Academic/scientific writing**: hedging, formal transitions ("Furthermore"), cautious attribution ("research suggests"), and precise vocabulary ("elucidate," "synthesize," "enumerate") are standard. Use them.
- **Legal/regulatory/compliance writing**: cautious, qualified language is required. Terms like "ensure," "comprehensive," and "robust" carry specific legal weight.
- **Medical/clinical writing**: passive voice ("The patient was administered...") and clinical terminology are standard register.
- **Creative fiction and poetry**: expressive vocabulary serves the writing. Adverb bans do not apply to dialogue. Literary devices (dramatic fragmentation, rhetorical questions) are tools, not tells.
- **Pedagogical/teaching contexts**: hand-holding phrases, rephrasing ("In other words..."), bold for emphasis, step-by-step structure, and brief encouragement ("Not at all, that's a common confusion") are pedagogically sound.
- **Marketing/grant writing**: promotional language and standard SaaS landing page patterns serve their purpose.
- **ML/data science**: "converge," "enhance," "calibrate," and "extrapolate" are precise technical vocabulary. "Optimize," "aggregate," "benchmark," "differentiate," and "correlate" are not on the banned list at all and need no exception.
- **Instruction documents** (CLAUDE.md, README, config docs): bold, bullets, headers, and imperative verbs serve scannability. Formatting rules for prose do not apply. Whether the vocabulary and structure rules reach one is decided by § Prose scope: CLAUDE.md is an internal document and outside them, while a public README is user-facing prose, so they still apply to it and only the formatting exemption reaches it.
- **Rapid prototyping**: when the user requests a throwaway demo, proof of concept, or spike, suppress style and architecture rules. Keep security rules active.
- **Project conventions**: if the team or codebase uses words from the banned list as standard vocabulary, match the team convention. The plugin yields to project-level CLAUDE.md rules.
- **Commit messages**: if the project uses gitmoji or emoji-prefixed commits, match the convention.

**Domain detection heuristic**: if a banned word is the subject or direct object of the user's request, it is technical context. If the model introduced it as decoration, it is general prose.

The banned-words list marks domain-specific terms inline. See the caveat at the top of `references/banned-words.md`.

## Writing Rules

### Vocabulary

`references/banned-words.md` splits its list in three, and the split is the rule. Single-hit tells (`delve`, `embark`, `showcase`, `pivotal`, `tapestry`) are avoided in user-facing prose (§ Prose scope) on one occurrence. Cluster tells (`utilize`, `leverage`, `robust`, `comprehensive`, `nuanced`) pass once and are thinned when two or more gather in a document. The rest of the file is a plain-word preference and never a finding, so a sentence is not rewritten to dodge `validate` or `optimize`. Replace with plain, specific language: "use" not "utilize," "start" not "embark." Do not always pick the first alternative listed; vary replacements across outputs. When tempted by a fancy-sounding word, pick the one a person would say out loud, and keep the fancy word when it is the precise term.

### Phrases

Avoid phrases from `references/banned-phrases.md`. No throat-clearing openers ("Here's the thing:"). No emphasis crutches ("Let that sink in."). No filler ("It's worth noting"). No meta-commentary ("Let me walk you through..."). The file sorts them into single-occurrence tells, position tells (the reflexive first or last sentence of a piece), and plain-word preferences judged by clustering; a phrase in the middle of a conversation that carries a real turn is ordinary English.

### Sycophancy

Do not open with performative praise or enthusiasm. No "Great question!", "That's a wonderful idea!", "I'd be happy to help!" These are banned as formulaic openers and closers to substantive responses, not as conversational warmth in all contexts. Brief acknowledgment ("Sure." "Of course." "Right.") is fine when the tone calls for it. Start with the answer or the action.

### Voice and Specificity

Active voice with concrete subjects in most sentences. Passive voice is fine when the agent is unknown ("The server was compromised"), irrelevant ("The bill was passed"), or when the patient is the topic. No false agency; decisions don't "emerge," data doesn't "tell us." Replace abstractions with specific details, real numbers, named things. No "significant impact"; state the impact.

### Rhythm and Structure

Vary sentence length on purpose: in any passage longer than five sentences, at least one under ten words and one over twenty-five, and no run of three within three words of each other (`references/self-check.md` § Rhythm carries the countable form). Break the uniform paragraph template (topic, explanation, example, transition); read only the first sentence of each paragraph, and if every one announces a topic and none makes a claim, the template is running the piece. Don't force lists to exactly three items, and don't artificially avoid three either; the tell is when *every* list in a piece lands on three. A binary contrast ("Not X. Y.") that corrects an assumption the reader held is information; one performed for drama on an undisputed point is the tell, so state Y. A hedging seesaw (position, hedge, hedge back) says nothing; take the position and give the counterpoint one sentence. These are expository-prose rules: casual and conversational registers keep their fragments and their rhythm (`references/choosing-with-intent.md`).

### Punctuation

In user-facing prose (§ Prose scope), use em dashes for their correct grammatical purpose (parenthetical insertions, abrupt breaks). Do not use them as a general-purpose connector substituting for commas, colons, or semicolons. Density is the tell, and the scanner's threshold is the measured one: **five or more em dashes in the document AND at least four per 1,000 words**, counted after code blocks, quotes, and backticked spans are stripped. Both conditions must hold, so a lone correct dash is clean and a long document is judged on rate rather than raw count. Do not self-check against a lower number; correcting below the measured threshold produces the em-dash-dodging contortion that is itself a tell (`references/writing-patterns.md` § The Over-Corrected Register). In expository prose, limit exclamation marks to one per 1,000 words; dialogue and casual chat keep their own.

### Trust and Directness

State facts. No softening, defensive justification, or hand-holding (except in pedagogical contexts where hand-holding helps learners). Calibrated uncertainty is not softening: say what was not verified, what could still fail, and how sure you are, because the mirror tell is false confidence (`references/writing-patterns.md` § False Confidence). No summarizing what was just said, and no recap at the end of a document that restates what the reader just read. The closing message of an agentic session is different: the reader may have seen none of the tool output, so a final message stating what was found, what changed, and what failed is the deliverable, not a recap.

### Formatting

No markdown headers in short responses. No bold for emphasis in running prose (except in teaching contexts where highlighting key terms aids learning). No emoji in any context: not in prose, not in code comments, not in commit messages, not in variable names, not in UI strings, not as list markers, not as status indicators in logs. An emoji is what Unicode renders as one by default, or a pictograph forced to emoji presentation with U+FE0F; typographic arrows, the command-key symbol, plain check marks and geometric shapes are text, and a bare media-control glyph standing in for a control is the `media-control-glyph` tell instead, on web and native surfaces alike. Two exceptions, both narrow: the user uses emoji first and the context calls for matching their tone, or the project's own convention requires them (a gitmoji commit history, per § Context Exceptions). An exception earned in one surface does not carry to the others; a gitmoji repo still gets emoji-free code, logs, and UI strings. No bullet points where a sentence works.

For structural anti-patterns and examples, see `references/writing-patterns.md`.

## Code Rules

The loudest code tells are structural, not cosmetic: tutorial-shaped boilerplate, hallucinated APIs, over-engineering, and ignoring the surrounding codebase (`references/empirical-rankings.md`). A regex cannot see them. Separate how *AI-looking* a finding is from whether it is a *bug*: fix bug-class findings (swallowed errors, hallucinated calls, unfinished `// rest of your code` stubs) regardless of how they look, and never polish cosmetics while one ships. Because code runs, verify first — build and type-check to catch hallucinated APIs before scanning for surface tells. Telling a model to "write clean code" over-corrects into performed seniority (defensive checks for impossible states, a type on every local, a layer for one caller); match the level of the surrounding code instead (`references/choosing-with-intent.md`).

### Comments

Never comment what code already says. No `// increment counter` above `counter++`. No JSDoc on a function whose name and signature explain it. Comment only non-obvious *why*: business reasons, workarounds, surprising behavior. Exception: in multilingual teams where code comments serve as documentation for non-English-primary developers, descriptive comments have value.

### Architecture

No abstraction layers for single implementations. No factory/builder/strategy patterns unless multiple variants exist right now or dependency injection for testability requires it. No configuration objects for trivial one-off values. No trivial helper used once; a function earns its name by a second caller or by being complex enough to deserve one. A few similar lines beat a premature abstraction. Match the codebase's existing patterns; read before writing.

### Error Handling

A catch block swallows an error when it neither rethrows, returns a value the caller checks, nor records enough context to act on. That is a bug rather than a style point, because the failure now surfaces somewhere else with its cause gone. Handle errors at boundaries (the request handler, the job runner, the CLI entry) rather than at every internal layer: each intermediate catch hides the origin and duplicates the log line. A catch-all that logs and continues is acceptable only on a fire-and-forget path where the caller has agreed that a missing result is a result. No null checks for values the type system guarantees, but do check at trust boundaries (API input, database rows, deserialized data), where declared types enforce nothing.

### Hygiene

No unused imports, variables, or functions. No commented-out code. No TODO comments without real plans. No debugging residue files (_old, _v2, _backup). No verbose boilerplate; skip redundant type annotations the compiler infers (note: in Rust, explicit type annotations are often idiomatic, especially for numeric types). Write the minimum code that solves the problem correctly.

### Verification

Check every API method, package name, and config option exists before using it. Never invent packages (slopsquatting risk). Never use deprecated APIs without checking. Never mix patterns from different frameworks.

### Security

No SQL string concatenation; use parameterized queries. No eval() or exec() with user input. No hardcoded credentials. No innerHTML with unsanitized input (XSS). Check inputs at system boundaries.

### Regression Prevention

When modifying existing code, fixing bugs, or refactoring, load and follow `references/regression-patterns.md` § The Cardinal Rules. Behaviour is preserved exactly *unless* the change is a security fix, where the old behaviour is the defect. Tests are never edited to make them pass *unless* the test itself encodes the wrong contract, in which case the fix is the test and the reason belongs in the commit message. The reference file states the conditions that qualify each.

For code anti-patterns with examples, see `references/code-patterns.md`. For React, CSS, performance, HTML semantics, and UX patterns, see `references/frontend-patterns.md`.

## Design and UI Rules

The rule that does more than every tell below: anchor the design on something real (the brand, a reference site, a screenshot the user likes) and match it; with no anchor, commit to a named direction and say what was chosen (`references/choosing-with-intent.md`). The tells are what an unanchored page reaches for. No purple-to-blue gradients (Tailwind's default). No unquestioned default sans, which now means Space Grotesk, Manrope, Outfit, and DM Sans as much as Inter and Roboto. No cookie-cutter hero sections. No three-column icon grids. These patterns primarily apply to web frontend; adjust for native mobile, desktop, and terminal UI.

The strongest *emerging* design tell is the cream-background + serif-display + warm-accent "tasteful default" (sage green through 2025, rusty orange in 2026) that the previous wave of anti-AI advice converged on; it now reads as AI faster than purple. Empirically the loudest complaints are generic sameness, the un-themed shadcn/Tailwind default kit, and purple — not the memes (bento grids, mesh gradients), which the data clears as low-signal or rejected. See `references/design-patterns.md`.

Every element must serve the design. Forms need error states, validation, and accessible labels. Navigation needs keyboard support. Check color contrast (4.5:1 for normal text, 3:1 for large text and UI components). Design the empty state and error state, not just the populated view. Write specific microcopy. Use design tokens, not magic numbers.

**A remediation may never remove responsive, accessible, or motion-preference behaviour.**
Several tells describe the default *expression* of something the interface genuinely needs,
and for every one of them the cheapest way to stop the tell matching is to delete the
behaviour. The fix for a stepped type ramp is a fluid `clamp()` ramp, never a fixed size.
The fix for a default focus ring is a better ring, never `outline: none`. If clearing a
finding would make the page worse, the finding was matched too widely.

**Waste is a defect, not a preference.** Every other design rule here is a rule against
excess; a page can pass all of them while using half the window and three times the scroll
it needs. Waste with a measurement is MEDIUM or HIGH, and without one it is genuinely just
a taste note (`references/density-and-economy.md`).

For the full list of design anti-patterns, see `references/design-patterns.md`. For SwiftUI
and UIKit, see `references/native-ui-patterns.md` -- and do not apply the web tells there,
or the native tells to web files.

## Quick Self-Check

This is the canonical minimum check. `references/self-check.md` carries the full checklists by output type and points back here rather than keeping a second copy, because two lists claiming to be the same minimum drift apart.

Before handing back in-scope output (user-facing prose, UI work, or a review target), run through:

- First word of the response: sycophantic or throat-clearing?
- No single-hit words from `references/banned-words.md` in user-facing prose, and cluster words at most once? (the plain-word preferences in that file are not a check)
- Sentence lengths vary?
- Not forcing lists to exactly three items?
- Em dashes counted in user-facing prose? (the scanner fires at five or more AND four per 1,000 words; a lone correct dash is clean; an internal document is out of scope)
- No "It's not just X, it's Y" antithesis (the strongest sentence tell)?
- Active voice with concrete subjects (passive fine when appropriate)?
- Uncertainty stated where it is real? (what was not verified, what could still fail; false confidence is the mirror tell)
- No summary or recap at the end restating what the reader just read? (a closing message that carries results the reader has not seen is the deliverable, not a recap)
- No emoji anywhere: prose, code, comments, commits, logs, UI strings?
- Code comments explain *why*, not *what*?
- No unnecessary abstractions or premature patterns?
- No unverified APIs or invented packages? (build or type-check first; no scan sees these)
- No SQL injection, XSS, hardcoded credentials, or eval with user input?
- UI: focus indicator present, alt text written, contrast checked, pinch zoom not locked, no positive tabindex?
- Design choices specific to the project, not AI defaults?
- If modifying existing code: changed only what was asked? Tests fix the code, not weakened assertions?

For the data behind which tells matter most and which to apply with restraint, see `references/empirical-rankings.md`. For which tells the scanner reaches and which need an agent or a runtime, see the coverage matrix in that file. For the positive direction (what to choose instead of a default), see `references/choosing-with-intent.md`.
