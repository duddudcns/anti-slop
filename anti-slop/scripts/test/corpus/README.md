# Labeled corpus + precision/recall harness

A small, hand-labeled set of prose/code/design samples with ground-truth expected findings,
used as a test harness to measure the scanner's precision and recall instead of just checking
that a handful of individual rules fire on individual inputs (that is what `scanner.test.mjs`
already does).

## Layout

- `prose/`, `code/`, `design/`, `native/` -- sample files. Design samples may live here OR
  reference the shared UI fixtures in `../fixtures/*.html` (do not duplicate or edit those
  files -- they are owned by `scanner.test.mjs`).
- `labels.json` -- `{ meta, fixtures }`. Each fixture is
  `{ file, modality, role, expected[], maxIncidentalFindings?, note? }`. `file` is a path
  relative to this directory (so `../fixtures/before.html` is valid). `expected[]` entries are
  `{ id, severity?, confidence? }`, where `id` is the rule key -- the same convention as the
  dashboard, `v.name || v.word || v.phrase || v.type` (a banned word's id IS the word, a
  banned phrase's id IS the phrase, everything else uses its rule `name`). `severity` and
  `confidence` record what the rule emits when it fires; an entry carrying neither is a KNOWN
  FALSE NEGATIVE, where the label is correct ground truth the scanner does not reach.

### Fixture roles

| Role | Means | `expected` |
|---|---|---|
| `positive` | Plants tells this scanner detects | non-empty |
| `clean-control` | Uses the prescribed technique CORRECTLY and must stay silent | empty |
| `coverage-boundary` | Plants a real tell this scanner has NO rule for | empty |

A `coverage-boundary` fixture is **not clean**, and must never be cited as evidence that the
tell it plants is absent. The role exists so the scanner's coverage limit is recorded rather
than implied, and so a future over-broad rule that starts firing on one is caught.

**A clean control is not "a file with no tells".** It is a file that exercises the constructs
the doctrine recommends, which is what catches the mirror failure: a scanner that has learned
to match constructs rather than defects. `responsive-type-clean.html` carries a fluid
`clamp()` ramp, a non-default stepped ramp, and the canonical `prefers-reduced-motion` block
precisely so that a rule which cannot tell those from the Tailwind default fails here.
Two of ui-craft's own controls were latent doctrine violations for several releases, so
audit these against current doctrine rather than trusting them.

Clean controls and coverage boundaries carry `maxIncidentalFindings`, and it is `0` on every
fixture. It used to be `1`, described as a tolerance rather than a hard zero -- but that slack
was unreachable: any finding on a negative fixture is a false positive by construction, and the
zero-tolerance per-rule gate in `corpus.test.mjs` fails the moment a baselined rule gains one.
The aggregate precision gates would not: one false positive against design's 54 true positives
is 0.982, inside the 0.02 tolerance.
A dominated gate is a dead test, so the field now states the policy the suite
actually enforces. `corpus-contract.test.mjs` enforces it, along with label/scanner grading
drift and the scorer's own arithmetic.
- `baseline.json` -- a committed snapshot of `node measure.mjs --format json`'s `rules`,
  `modalities`, and `overall` fields, captured against the scanner at the time the baseline was
  last regenerated. This is an honest MEASUREMENT, not a target: if the scanner has false
  positives or false negatives against this corpus, the baseline records them as-is.

## Running the harness

```bash
cd anti-slop/scripts
npm run measure                    # human-readable table: per-rule, per-modality, overall
npm run measure -- --format json   # machine-readable, same shape as baseline.json plus `misses`
```

`measure.mjs` always exits 0 -- it is a measurement tool, not a CI gate. The gate lives in
`corpus.test.mjs` (run by `npm test` like every other suite; bare `node --test` breaks because Node's recursive discovery executes the corpus code samples as bogus suites): it re-measures, asserts precision and
recall have not dropped by more than 0.02 below the committed baseline overall and per
modality, and asserts with no tolerance at all that no rule row in `baseline.json` lost a true
positive or gained a false positive.

## Adding a sample

1. Write the file under `prose/`, `code/`, or `design/` (or point at `../fixtures/*.html` for
   design). Use realistic, self-authored, or rule-derived content -- never copy real
   third-party text or a real secret.
2. Add an entry to `labels.json` with the modality, the role, and your best honest guess at
   `expected` -- the rule ids a careful human reviewer would say this file legitimately trips
   (or `[]` plus `"maxIncidentalFindings": 0` for a clean control or coverage boundary).
3. Run `npm run measure -- --format json` and check the `misses` array for your new file. If
   the actual scan differs from your guess, decide which is right:
   - If your `expected` was wrong (you mis-predicted a regex, or missed an interaction like
     `skipInTests` or a `suppress` guard) -- fix `labels.json`, not the scanner.
   - If the scanner is genuinely wrong (a real false positive/negative) -- leave `expected` at
     the correct ground truth and let it register as a miss. That is the point of this harness:
     surfacing rule-tuning candidates, not hiding them. Do not tune scanner rules from this
     package (they belong to `lib/rules.mjs`/`lib/scan.mjs`) -- write the finding down for
     whoever owns that follow-up work instead.
4. Run the full suite (`npm test`). The aggregate gates in `corpus.test.mjs` tolerate 0.02 of
   drift overall and per modality, so a single added clean negative or a new true positive will
   not trip them. The per-rule gate in the same file has no tolerance: it fails the moment a
   rule row in `baseline.json` loses a true positive or gains a false positive, with
   `useeffect-setstate`, the known false negative, as the one exemption.

Every new rule ships with a positive and a clean partner in the same change; a narrowing
ships with the should-flag twin it must not swallow. More precisely, every exemption a rule
carries ships with a should-flag twin the exemption must not swallow, as a probe in the rule's
test file or as a construct in a fixture: an exemption written without one fails open, and the
first sign is a whole class of real findings gone quiet. A rule cut from a release has its
construct removed from the shared positive in the same commit, or its label kept as a known
false negative with no severity, so a shared positive never carries an unlabelled construct.

A fixture is corrected, never relabelled, when a new rule proves it carries a real defect: a
clean control gets the computed fix, and a positive planting another tell is tuned so it plants
only that tell. The 2.5.0 contrast and type-floor corrections and the two control-face fixture
corrections record the change and the measured before and after values in each entry's
`note` in `labels.json`.

Two path traps worth knowing:
- Code samples are scanned under the exact path you put in `labels.json`. Positives that rely
  on `skipInTests`-gated rules (`innerhtml-usage`, `hardcoded-secret`, `boilerplate-marker`,
  `dead-branch`, `cast-to-any`, and the design rule `design-system-font`) need a
  **non**-test-looking path (e.g. `code/auth-handler.js`) to actually fire; a deliberately
  test-shaped path (e.g. `code/auth.test.js`) is how you build a *tricky-clean negative* that
  proves the skip works.
- The design/code pattern rules match **per line**, not across the whole file. A realistic
  multi-line construct (e.g. a `useEffect` whose body sets state a few lines down) can be a
  genuine miss for that reason -- see `code/user-profile-widget.jsx` in `labels.json`, which is
  exactly such a case and is recorded as a known false negative in `baseline.json`.

## Ownership

This corpus is the SINGLE labeled corpus for the anti-slop rule set and its downstream
distillations. `ui-craft/tests/corpus/` is a downstream VIEW of the shared design fixtures,
not a second hand-maintained set: fixtures flow anti-slop -> ui-craft, and a fixture edited
only downstream is drift rather than a change. Per-item ownership across the three repos is
recorded in `docs/rankings-refresh.md`, section "Downstream sync".

## Regenerating the baseline

Only regenerate when a rule change to `lib/rules.mjs`/`lib/scan.mjs` was an intentional,
reviewed change to detection behavior (not to make this test pass). Regenerate honestly:

```bash
cd anti-slop/scripts
node --input-type=module -e '
import { measure } from "./measure.mjs";
import { writeFileSync } from "fs";
const result = measure();
const baseline = { rules: result.rules, modalities: result.modalities, overall: result.overall };
writeFileSync("test/corpus/baseline.json", JSON.stringify(baseline, null, 2) + "\n");
'
```

Then diff `git diff test/corpus/baseline.json` and read every rule/modality that moved before
committing -- a baseline regeneration should be reviewed exactly like a scanner rule change,
because it is one: it changes what "no regression" means going forward.
