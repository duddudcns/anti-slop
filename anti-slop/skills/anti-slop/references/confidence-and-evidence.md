# Confidence and Evidence

How sure a finding is, and what has to be true before it can claim a number.

Six rules live here, and this file defines all of them: the confidence classes, the
presence/concentration split, the remediation floor, the evidence modes, the geometry rule,
and the not-assessed rule. Several domain files restate one of them with a local
specialisation (`design-patterns.md` on presence versus concentration,
`density-and-economy.md` on the measurement requirement, `frontend-patterns.md` on the
fluid-ramp form of the remediation floor, `native-ui-patterns.md` on what one Swift file
cannot show). Those restatements add domain detail; where they appear to differ, this file
is the definition. The scanner's rule table (`scripts/lib/rules.mjs`) mirrors the confidence
enum below in code, and `test/rule-metadata.test.mjs` fails if the two ever carry different
classes.

## Confidence classes

Severity says what a finding costs if it is real. Confidence says how sure we
are that it is real *here*. They are independent axes and must never be
collapsed into one.

What "costs" means depends on the class. For a defect the cost is functional: a
hole, a bug, an interface that does not work. For a Pattern smell the cost is
the genericness itself, so its severity follows how strongly the pattern reads
as unchosen in the corpus ranking (`empirical-rankings.md`), which is why a
purple gradient is medium and a lone `py-20` is low. The two scales share the
same three words, and the class column is what says which scale a finding is on.

| Class | Meaning | Typical source |
|---|---|---|
| **Hard defect** | Objective, should be fixed | Swallowed exception, `eval()`, unfinished `// rest of your code` stub, an `<img>` with no dimensions |
| **Quality defect** | Strongly justified, alternatives exist | `!important` instead of fixing specificity, a narrating comment, a fixed content frame |
| **Pattern smell** | Correlated with generated output, **not proven wrong here** | Almost every design tell, every banned word, the AI purple palette |
| **Taste note** | Advisory only | A horizontal-rule divider between sections |

**Pattern smell is the class most design tells belong to,** and its absence is
why a tell reads as an accusation. "This gradient is the Tailwind default" is a
true statement about correlation. "This gradient is wrong" is a claim the
scanner cannot support. The class is what keeps the first from being read as the
second.

The pairing that proves the axes are independent: `hardcoded-secret` is
**severity high, confidence Pattern smell**. If the match is a live credential
it is the worst finding in the file; a regex cannot prove it is not a fixture, a
variable name, or a placeholder. Downgrading the severity would understate the
risk and upgrading the confidence would be a lie, so it carries both.

## Presence and concentration

A regex fires on presence by default. Most property-level tells are only tells
when repeated, so each one declares which it is:

- **Presence** -- one occurrence is the finding. Reserved for specific, high-signal
  compositions: a verbatim default string, a named component fingerprint.
- **Concentration** -- the finding is the density. Carries a numeric threshold, and
  says nothing below it.

**The floor rule: a lone utility-class hit is not a finding.** One
`rounded-full` on an icon wrapper is not "the same radius on every interactive
control". One cream background is not the cream-plus-serif-plus-warm-accent combination. The
signal is a default reached for repeatedly and without a point of view, never
the presence of any single class.

## The remediation floor

Several tells describe the *default expression* of something the interface
genuinely needs: a responsive type scale, container padding, a focus ring, a
loading state, a reduced-motion block. For every one of these the cheapest way
to make the tell stop matching is to delete the behaviour, and that is always
the wrong answer.

1. **Every finding names its remediation.** A finding that only names the offence
   is incomplete, and an incomplete finding gets closed by deletion. The
   scanner holds itself to this: every rule carries a `fix`, and every finding prints
   it beside the rule id, the line, and the confidence class.
2. **A remediation may never reduce responsiveness, keyboard reachability,
   screen-reader output, contrast, hit-target size, or motion-preference
   handling.** If the only way to clear a tell is to make one of those worse, the
   remediation is wrong -- and so, usually, is the match.

Concretely: the fix for a stepped `text-4xl sm:text-5xl lg:text-6xl` ramp is a
fluid `clamp()` ramp, never a fixed size. The fix for a default focus ring is a
better focus ring, never `outline: none`. The fix for `* { transition: none
!important }` inside a `prefers-reduced-motion` block is nothing at all -- that is
the correct implementation of WCAG 2.3.3, and a scanner that flags it is asking
for an accessibility regression.

When adding a rule, ask: *does this have a remediation, and does the remediation
make the page better?* If a technique's correct use is indistinguishable from
its lazy use, the rule is too wide. Narrow the match until it is not.

## Evidence modes

Every review states which mode produced it, as the first line of the report.

| Mode | Available | Can support |
|---|---|---|
| Static single-file | One file's source | Vocabulary, constructs, per-file patterns |
| Static multi-file | The tree or the diff | The above, plus cross-file consistency and component coherence |
| Screenshot | A rendered image | Composition and content; **no geometry** |
| Runtime | A running app with tooling | Everything, including measured geometry |

## The geometry evidence rule

A claim asserting spatial or numeric precision -- spacing values, alignment
offsets, target sizes, contrast ratios, layout-shift distances -- needs real
geometry:

| Surface | Acceptable evidence |
|---|---|
| Web | DOM bounding boxes, computed styles, layout metrics |
| Apple | Element frames from a hierarchy snapshot |
| Any | Arithmetic from numeric literals quoted out of the source |

**A screenshot is never geometry evidence.** Estimating distances from pixels is
unreliable. A contrast claim needs resolved colour values and a computed ratio,
never a colour sampled from an image.

Without geometry, the claim is capped at "possible issue, measurement needed"
and must be stated that way rather than asserted.

## The not-assessed rule

Report `NOT ASSESSED` rather than a clean verdict on anything the evidence could
not reach. Reporting a dimension clean from evidence that cannot contain it is a
false negative on exactly the class that evidence is blind to.

For the deterministic scanner this is narrow but real. It reads one file at a
time and therefore cannot judge:

- cross-file consistency (the same component styled three ways in three files)
- component coherence against a design system defined elsewhere
- state completeness (the empty, error, and loading states may live in sibling files)
- task flow, navigation, and error recovery, which need a sequence, not a file
- anything requiring a rendered frame or a measurement

### The families the catalogue teaches and the scanner has no rule for

The list above is about what one file cannot show. This one is about something more
expensive: tell families this catalogue documents in full, with worked examples, that no
deterministic rule matches at all. A scan is silent on every one of them, and silence here
reads exactly like a pass.

The scanner has rules for command injection, unsafe deserialization,
`dangerouslySetInnerHTML`, the comment-slop family, the pinch-zoom lock, positive
`tabindex`, and `as any`. These families have none:

| Family | Taught in | Why there is no rule |
|---|---|---|
| SQL injection by string concatenation | `code-patterns.md` § SQL Injection | The interpolation shape is indistinguishable from safe query building without knowing whether the value is user-controlled |
| Path traversal | `code-patterns.md` § Path Traversal | Same: the defect is an untrusted source, not a syntax |
| SSRF and open redirect | `code-patterns.md` § SSRF, § Open Redirect | Requires knowing which URLs the caller controls |
| IDOR / broken access control | `code-patterns.md` § Broken Access Control | The defect is an *absent* ownership check; absence is not matchable in one line |
| Insecure randomness | `code-patterns.md` § Insecure Randomness | `Math.random()` is correct for most uses; only the security context makes it wrong |
| N+1 queries | `code-patterns.md` § N+1 Queries | Needs the loop body and the call it makes, which is block scope |
| Missing HTTP timeouts, unbounded queries, naive retries | `code-patterns.md` § Backend Anti-Patterns | All absence claims |
| Race conditions in async code | `code-patterns.md` § Race Conditions | Needs interleaving, not text |

Two properties they share: each is bug-class rather than cosmetic, and each is an absence
or a context claim rather than a shape. That is the honest boundary of a single-line regex,
not an oversight to be closed by widening a rule until it fires on safe code.

**Consequence for any report built on a scan.** `slop-scanner.mjs scan` on a Python file
containing `query = f"SELECT * FROM users WHERE id = '{user_id}'"` prints `<path>: clean`,
which is the whole of the text report for a file with no findings (`"score": 50,
"verdict": "CLEAN"` under `--format json`). A verdict that presents that as the
deterministic half of a security review is a false negative on the highest-cost class in
the catalogue. Name the boundary in the report. The coverage matrix in
`empirical-rankings.md` states it per family.

A clean scan means "no rule matched in this file", which is a smaller claim than
"this file is good". Say the smaller thing.
