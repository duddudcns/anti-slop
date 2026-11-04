# Rankings Refresh Runbook

Keeps `skills/anti-slop/references/empirical-rankings.md`, and the rules that lean on it, honest against a moving target. AI tells drift: vendors patch the loudest ones, writers learn them, and over-corrections become the next tells (finding 4 in the rankings file). This runbook defines a bounded quarterly refresh that a future session can execute with no prior context.

## Cadence

- Quarterly. The YAML metadata header at the top of `empirical-rankings.md` carries `last-refreshed` and `next-due`. Run the refresh when `next-due` arrives.
- Run early when a major model release or vendor announcement visibly shifts output style (example: GPT-5.1 in 2025-11 changed em-dash behavior and instruction following).
- Timebox: one session, 6-12 quality sources. This is a spot-check of the existing claims plus a scan for new tells. A full corpus re-mine (the `vibecoded-design-tells` methodology of scanning millions of Reddit posts) is a separate project, out of scope here.

## Procedure

1. Read `skills/anti-slop/references/empirical-rankings.md` fully. The claims under test are its ranked tables, its do-NOT-flag tables, and the four findings at the top.
2. Gather 6-12 sources from the classes below, mixing at least three classes. Prefer sources dated since the last refresh stamp.
3. Grade each top claim as confirmed, drifting, or superseded (definitions below), with one line of evidence and a source per claim.
4. Note new tells the file does not cover, graded with the frequency x specificity rubric.
5. Write the stamp into `empirical-rankings.md` (format below). Do not rewrite the existing analysis; the historical tables stay as the baseline the spot-checks diff against.
6. List rule-change candidates separately (session notes or an issue), each tagged pending-measure. Never change rule code in the same pass as the research; rule changes are a follow-up gated by the measure step below.
7. Dogfood and test before committing (gate below).

## Source classes and example queries

| Class | What it gives you | Example queries |
|-------|-------------------|-----------------|
| Corpus and academic studies | Measured frequencies, not vibes | `site:arxiv.org AI-generated text lexical features detection`, `AI-generated pull requests code review study`, `AI vocabulary corpus PubMed since ChatGPT` |
| Living reference pages | Curated, dated observations of emerging and aging-out signs | Wikipedia page `Signs of AI writing` (check its recent revisions) |
| Detection-tool and SEO-tool blogs | Current top-N lists practitioners act on | `signs of AI writing <current year>`, `how to spot AI text new tells` |
| Writing and dev community complaints | What real people name unprompted (the highest-value signal) | `em dash AI writing tell`, `AI code review complaints emoji comments`, `vibe coded design tells`, plus Reddit and Hacker News threads they lead to |
| Design criticism | Named aesthetics and their drift | `AI web design generic aesthetic`, `AI slop design <current year>` |
| Vendor releases and model-behavior commentary | Source-side drift: which tells got patched | `<model name> release writing style em dash custom instructions`, model changelogs, third-party release reviews |

Weighting rules, from the original study's hard lessons:

- Prefer sources that count something (a corpus, a hand-audit, a filing count) over sources that assert.
- Prefer unprompted complaints by real users over listicles; the rankings file's Inflated verdicts came from listicles copying each other's word lists.
- Two independent communities naming the same tell beats five copies of one blog post.
- Record the publication date of every source; a 2024 listicle is evidence about 2024.

## Grading rubric (frequency x specificity)

This mirrors how `empirical-rankings.md` was graded: what share of people cite the tell (frequency), and how well its presence separates AI output from human baseline (specificity, the inverse of FP risk).

| | High specificity | Low specificity |
|---|---|---|
| **High frequency** | Active rule material (medium or high severity) | Low-confidence, cluster-only (flag at count >= 2) |
| **Low frequency** | Single-instance rule only if precision is near-perfect (example: assistant boilerplate) | Do not encode; note and watch |

Additional axes to record per tell:

- Regex-visible or regex-blind. Regex-blind tells (rhythm, sycophantic tone in flowing prose, over-engineering, codebase fit) route to the skill and agent docs, never to scanner rules.
- For code: severity is separate from class (bug, substance, cosmetic). A tell can be quiet and still be a bug.
- Single-instance vs density: default to density and clustering; single-instance firing is the rare exception and needs near-perfect precision.

## Statuses

- **confirmed**: multiple current, independent sources still cite it. Keep the rule as is.
- **drifting**: still cited, but the underlying frequency is moving. Either the source patched it (vendor reduced the behavior) or humans adopted it (the tell lost specificity). Keep the rule, record the direction, and re-measure next quarter before promoting or demoting.
- **superseded**: no longer cited, or displaced by a successor default. Demotion or retirement candidate.

## Mapping conclusions to rule changes

All of these are candidates produced by the refresh, executed later behind the measure gate:

- **Promote severity**: confirmed on two consecutive refreshes, high specificity, and `npm run measure` shows precision holds after the change.
- **Demote severity or move to low-confidence**: drifting downward, or FP evidence accumulating (the tell lost specificity).
- **Add a pattern**: new tell graded high frequency x high specificity AND regex-visible. Author labeled corpus samples for it first, then measure.
- **Retire a pattern**: superseded on two consecutive refreshes and near-zero true positives in the corpus.
- **Doc-only routing**: regex-blind tells get written into the skill references (so the agent reads them) with no scanner change.

The measure gate, mandatory for every scanner rule change:

1. From `scripts/`, run `npm run measure` BEFORE the change and save the output.
2. Apply the rule change.
3. Run `npm run measure` again. Both outputs go into the commit or PR description.
4. `npm test` must stay green; `test/corpus.test.mjs` enforces that precision/recall does not drop below the committed baseline tolerance. If the change intentionally moves the baseline, regenerate it consciously per `test/corpus/README.md` and say so in the commit message.

## Stamp format

1. Update the YAML metadata header at the top of `empirical-rankings.md`:

   ```yaml
   ---
   last-refreshed: YYYY-MM-DD
   next-due: YYYY-MM
   method: docs/rankings-refresh.md
   ---
   ```

   `next-due` is last-refreshed plus one quarter.

2. Append a new `## YYYY-MM spot-check` section at the end of the file containing:
   - one table row per checked claim: claim, status (confirmed / drifting / superseded), one-line evidence with source and date;
   - a short list of new tells not yet covered, each with its rubric grade or FP-risk note;
   - a source list with access date.

3. Rule-change candidates do NOT go into the reference file. They go into the refresh session's notes or issue, tagged pending-measure, so the reference stays a record of evidence rather than intent.

## Dogfood and test gate (mandatory before committing)

The plugin scans its own docs. Every edited markdown file must introduce zero new active findings against its pre-edit baseline.

```bash
cd anti-slop/scripts
node -e "import('./lib/scan.mjs').then(async m => {
  const fs = await import('node:fs');
  const p = process.argv[1];
  const v = m.scanContent(fs.readFileSync(p, 'utf8'), p, { proseScope: 'all' });
  for (const x of v) console.log(x.severity, x.type, x.word || x.phrase || x.name || '', 'line', x.line);
  console.log('TOTAL', v.length);
})" /absolute/path/to/edited.md
```

Writing rules that keep the delta at zero:

- Put every quoted example tell in backticks or double quotes; noise-stripping exempts those spans.
- Add no em dashes of your own; the density rule is cumulative over the file.
- Avoid the banned vocabulary in your own voice (the scanner will tell you if you slip).
- Run the full suite afterward even for docs-only changes: `cd anti-slop/scripts && npm test`.

## Downstream sync: ui-craft catalogue

A downstream UI plugin (`ui-craft`) distills this plugin's UI research into two files that
must be refreshed whenever a quarterly refresh changes the UI/design section of
`empirical-rankings.md` or the UI tells in `design-patterns.md` / `frontend-patterns.md`:

- `references/catalogue/02-empirical-evidence.md` -- mirrors the UI ranking table,
  cleared-memes list, and drift spot-checks.
- `references/catalogue/01-ai-tells.md` -- carries the merged tell catalogue; new or
  re-graded UI tells land there as well.

Procedure: after the refresh stamp lands here, apply the same delta to the ui-craft repo,
bump its patch version, and release it through your release channel. anti-slop remains the
source of truth for corpus evidence; ui-craft is a downstream distillation.

### Per-item ownership, settled 2026-07-27 (anti-slop 1.7.0)

The one-way flow above describes the *rankings* correctly and nothing else. `ui-craft`
0.3.0 and `apple-ui-craft` 0.3.1 produced material that flowed BACK into this repo,
including a correction to a rule this repo shipped. That integration is executed, and the
table below is its durable record.

**A file both repos edit independently is a fork.** Every row below names exactly one
owner. When a row's subject changes, it changes at the owner and propagates outward; a
change made only downstream is drift, not a change.

| Subject | Owner | Flow |
|---|---|---|
| Empirical rankings, corpus evidence, cleared memes | **anti-slop** | anti-slop -> both toolkits (unchanged) |
| The labeled corpus and its fixtures (all modalities) | **anti-slop** | anti-slop -> ui-craft. `ui-craft/tests/corpus/` is a downstream VIEW of the shared design fixtures, not a second hand-maintained set |
| Scanner rules, thresholds, firing modes | **anti-slop** | Local. `rules.mjs` stays this scanner's own table; the detectors and parsers it calls live in the shared module below |
| Shared detection module (`scripts/lib/design-detect.mjs`) | **anti-slop** | anti-slop -> ui-craft as a byte-identical vendored copy (`scripts/lib/design-detect.mjs`, behind a one-line vendor header naming the anti-slop version and commit), checked by ui-craft's selftest and its release gate. Edit it here, never in the copy |
| Confidence classes (the four-class enum) | **anti-slop**, adopted from ui-craft | Originated in `ui-craft/references/review/01-universal-rubric.md`; the definition now lives in `references/confidence-and-evidence.md` and the toolkits track it |
| Presence vs concentration, and the floor rule | **anti-slop**, adopted from ui-craft | Same. Thresholds are anti-slop's because only anti-slop has a machine that enforces them |
| Geometry evidence rule, not-assessed rule | **shared, defined here** | Adopted from both toolkits' evidence pipelines; `references/confidence-and-evidence.md` is the single definition and the toolkits cite their own copies for their own agents |
| The remediation floor (a fix never removes responsive/accessible/motion behaviour) | **anti-slop** | Adopted from ui-craft 0.3.0. Both repos found the same defect; the rule is stated once here |
| Density and economy thresholds | **shared, per surface** | Web thresholds from ui-craft, native from apple-ui-craft, merged into `references/density-and-economy.md`. The toolkits own their own runtime measurement tooling |
| Native/Apple UI tells | **apple-ui-craft** | apple-ui-craft -> anti-slop. `references/native-ui-patterns.md` is a distillation; apple-ui-craft remains the source of truth for iOS craft |
| Finding report FORMAT | **each repo owns its own** | Deliberately not shared. This repo emits machine JSON for a dashboard; the toolkits emit human-readable review reports. Only the FIELDS are common |
| WCAG mapping, review ledgers, CI verdict gates | **the toolkits** | Not ported. Out of scope for a scanner |

Two mechanical guards keep the shared surfaces honest, and both run in `npm test`:
`test/rule-metadata.test.mjs` fails if the code enum and the doctrine file disagree, and
`test/corpus-contract.test.mjs` fails if a label's declared grading drifts from what the
scanner emits.

**What changed in this repo as a result** (all in 1.7.0): the Strongest-10 entry 9 rule was
narrowed from "any responsive type scale" to the verbatim Tailwind run and given a
`clamp()` remediation; `important-overuse`, `rounded-everything`, `cream-serif-default` and
the two AI-purple rules became concentration tells with thresholds; design and native tells
were split by file extension; the corpus absorbed ui-craft's ten authored fixtures and
gained a native modality.

### Parallel authoring from a shared upstream, 2.2.x

The 2.2.0 UI tells did not travel down the one-way flow above. Both repos absorbed the same
third-party MIT catalogue ([VibeCurb](https://github.com/Yu-369/VibeCurb), Copyright (c)
2026 Yu-369) in the same release wave: they landed here as `design-patterns.md` entries plus
the `bootstrap-default-blue` and `hero-scroll-hint` scanner rules, and in ui-craft as new
reference files rather than as a delta applied to `references/catalogue/01-ai-tells.md`.
The substance agrees across both -- the `scale(0.9)`-`scale(0.97)` entrance range and the
logo ban list are the same wording -- so this is a record correction, not content drift.

**Ownership is unchanged: anti-slop owns the UI tells.** A future refresh applies its delta
here first and propagates outward, per the table above. Two known asymmetries stand as
deliberate omissions rather than pending work: ui-craft's own files carry the material in
its house voice rather than as a verbatim mirror, and the hero scroll-indicator tell has no
ui-craft catalogue entry -- fleet coverage for it comes from this scanner's rule.

### Shared detection and its fixtures, 2.5.0

2.5.0 moved the parsing, colour maths and the new detectors into `scripts/lib/design-detect.mjs`
so the two scanners run one implementation of each rule: contrast on declared surfaces, the
side stripe, the type floors, the reading mechanics, bounce easing, the pulsing dot, the
glow test, the card trio, the cream legs, the primary face and the rule-scoped waiver.
Several of those re-express rules from [impeccable](https://github.com/pbakaus/impeccable)
(Copyright 2025 Paul Bakaus, Apache-2.0); the module's header names them, and the README
carries the notice.

The fixtures move the usual way, anti-slop -> ui-craft, as byte-for-byte copies with
ui-craft's own labels:

| Fixture | Change in 2.5.0 | ui-craft copy |
|---|---|---|
| `contrast-pairs.html`, `contrast-clean.html`, `contrast-ground.html`, `contrast-ground-clean.html` | New pairs for the contrast rules | Copy both pairs |
| `side-stripe-cards.html`, `side-stripe-clean.html` | New pair for the side stripe | Copy |
| `type-floors.html`, `type-floors-clean.html` | New pair for the type floors | Copy |
| `reading-mechanics.html`, `reading-mechanics-clean.html` | New shared pair for the four reading-mechanics rules | Copy |
| `motion-bounce.html`, `motion-spring-clean.html`, `live-dot.html`, `live-dot-clean.html` | New pairs for bounce easing and the pulsing dot | Copy |
| `fluid-adaptive-clean.html`, `viewport-query-card.html`, `fixed-desktop-shell.html`, `vh-bottom-bar.html`, `uncommitted-radius.html`, `token-drift.html` | Real contrast failures corrected (values in each label note) | Replace the copy |
| `cream-serif-sage.html`, `legacy-marketing-page.html` | The planted Inter moved onto content copy (a control-only face is the label fallback); the hero gained its sub-line | Replace the copy |
| `frosted-nav-neon.html`, `gradient-hero.html`, `shadcn-card-kit.html`, `small-avatar-clean.html` | The viewport meta the ui-craft copies already carried | Already identical |
