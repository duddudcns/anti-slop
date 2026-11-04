---
last-refreshed: 2026-07-03
next-due: 2026-10
method: docs/rankings-refresh.md
---

# Empirical Rankings

Which AI tells real people actually name, ranked by data instead of intuition. This file grounds the rest of the plugin: it tells you which rules to weight heavily, which to apply only when they cluster, and which popular "AI tells" the evidence does not support.

## Where the data comes from

Three independent corpus studies mined public Reddit discussion (2020-2026, via the Arctic Shift archive) for the patterns people cite when they say something "looks AI-generated," then hand-audited a sample to separate what humans actually *flag* from what a keyword search merely *matches*.

| Domain | Posts scanned | On-topic set | Verification |
|--------|--------------|--------------|--------------|
| Writing/prose | 89,239 | 7,984 posts + 604 hand-read | 20 readers + 5 adversarial auditors |
| Code | ~23,000 | 11,906 posts + 11,306 comments | LLM-classified into 19 tells, adversarially re-audited |
| UI/design | 3,214,533 | 46,971 posts + 3,033 comments | each tell verified by an independent agent |

Source: the `vibecoded-design-tells` project by JCarterJohnson (MIT-licensed analysis code; Reddit text not redistributed). The numbers below are reproduced from the committed result tables. Treat the **relative ordering and gap sizes** as the signal, not the absolute percentages: this is a proxy for vocal, online developers and writers, not a representative sample of all output.

## Four findings that shape every rule in this plugin

1. **Flag the unspecified default, not the value.** A tell is an unchosen default, not a banned token. Purple is a tell when the model reached for it because nothing else was specified; it is fine as a stated brand decision. The same logic covers serif fonts, em dashes, the word "comprehensive," and a broad `try/except`. The escape hatch (`anti-slop-allow` / `unslop-ignore` on the line) exists so a deliberate choice never gets nagged. Swapping one default for another ("delve" to "dive," purple to cream-and-serif) is not a fix; it resets the clock.

2. **Concentration is the signal, not lone hits.** One "utilize," one "however," one em dash, one `rounded-lg` card is almost never a tell. Across the full corpus, `however/thus/hence` is the single highest-frequency keyword (6.3% of all 7,984 on-topic posts), yet the 604-post hand-audit cited it 0% of the time. Weight by density (hits per 1,000 words, or repeated identical treatment), and let a single low-confidence hit read as clean.

3. **The loudest tells are structural and a regex cannot see them.** In every domain the top-cited tells are invisible to keyword matching. Writing: uniform sentence rhythm, sycophancy, fluent-but-empty paragraphs, hallucinated citations. Code: tutorial-shaped boilerplate, hallucinated APIs, over-engineering, ignoring the surrounding codebase. A clean scanner pass means the lexical layer is clean, not that the output reads human. The scanner is the cheap second pass; the semantic read (the `slop-detector` agent, or a careful human) is the first.

4. **Banning the old tells creates the new tell (the moving target).** As people learned the 2024 markers, a second default appeared: prose straining not to sound like AI (staccato fragments, forced lowercase, em-dash-dodging contortions, fake typos) and "tasteful" UI (cream background, serif display, a warm saturated accent) that now reads as AI just as fast. Apply the rules with judgment; mechanical over-correction is itself detectable.

## Writing: verified ranking

`cite%` = share of 604 hand-read posts that name it as a tell. `regex%` = keyword-match share over the same sample. The gap is the point.

| Tell | cite% | regex% | Reliability |
|------|------:|------:|-------------|
| Em dash overuse (—) | 7.1 | 6.0 | **High**: top tell on both passes; judged by density (a lone correct dash is clean) |
| Uniform / robotic sentence rhythm | 4.0 | n/a | **High, regex-blind**: 2nd most cited, no keyword can see it |
| "It's not just X, it's Y" / "not X, but Y" antithesis | 2.8 | 0.8 | **High**: the #1 *sentence* tell; regex under-counts |
| Sycophancy / yes-man tone | 2.5 | n/a | **High, regex-blind** |
| Perfectly-structured / formulaic essay shape | 2.5 | 0.5 | High, mostly regex-blind |
| "Dive in" / "deep dive" | 2.0 | 2.3 | Medium |
| Everything as bullet lists / "5 ways to…" listicles | 1.7 | 1.7 | Medium |
| Diction cluster (`delve`, `tapestry`, `unleash`, `game-changer`…) | 1.3 | 1.3 | **Inflated**: counts come from listicle/word-list copying, not independent observation. The scanner tier is separate: `delve` and `tapestry` are single-hit words and `game-changer` a banned phrase, each a finding on one occurrence |
| "As an AI language model" / leftover boilerplate | 1.2 | 0.3 | High when present; a hard defect on a single instance; aging out |
| Rule of three / triads | 1.2 | n/a | Medium, regex-blind |
| Empty, fluent, hollow paragraph | 0.7 | n/a | High, regex-blind |
| Emoji as bullets / headers | 0.8 | 0.0 | Real; regex under-counts the wording |
| Bolded lead-in labels (`**Word:**` + sentence) | 0.3 | 0.8 | Real but **presence ≠ citation**; weight by clustering |
| "In conclusion" / "In summary" closer | 0.2 | 0.2 | Real, low-frequency, easy to delete |

Leftover assistant boilerplate is the only tell ranked above that the scanner treats as a **hard defect**, at high severity on a single instance. Firing on one instance is not what sets it apart: `banned-words.md` § Single-hit tells and every banned phrase flag on one occurrence too. A quoted or blockquoted example of it is not an instance: a document that quotes the phrase to discuss it is not committing it, and the scanner strips quoted spans before it matches. The legs are the assistant speaking about itself, never a person's idiom, so "I can't help but notice" and a model's cutoff stated in the third person stay clean. The em dash is the top-cited tell but is judged by density: a lone, correctly used dash is clean, and the scanner flags only sustained overuse. The cluster-tier vocabulary is judged by clustering; the sentence constructs in the table fire on a single match.

### Writing: do NOT flag on a lone hit

These regex shares are the full-corpus keyword rate (all 7,984 posts, where over-matching is most visible); the cite% is from the 604-post hand-audit. They match often but are almost never what readers actually cite. They are usually the writer's own prose. Keep them as "prefer the plain word" guidance; never escalate a single occurrence.

| Word / phrase | regex% (full corpus) | cite% (sample) | Verdict |
|------|------:|------:|---------|
| however / thus / hence | 6.3 | 0.0 | **Noise**: highest keyword share corpus-wide, never cited |
| nuanced / nuance | 2.3 | 0.0 | **Noise** |
| when it comes to | 1.9 | 0.0 | **Noise** |
| utilize | 1.3 | 0.0 | Over-counts ("use" is better, not a smoking gun) |
| navigate / navigating | 1.5 | 0.0 | Over-counts |
| moreover / furthermore / additionally | 1.7 | 0.2 | Over-counts (one is just a connective) |
| `robust` | <1 | ~0 | Over-counts |
| `embark`, `ever-evolving` | <1 | ~0 | Over-counts here, but both ship as single-hit tells (`BANNED_WORDS` and `BANNED_PHRASES`); demoting either is a rule change and goes through `npm run measure` first |

The broader low-confidence set (match the lexicon but humans use them normally): `utilize, leverage, harness, streamline, foster, facilitate, cultivate, empower, navigate, comprehensive, robust, nuanced, meticulous, seamless, holistic, myriad, plethora, paramount, intricate, profound, vibrant, captivating, realm`. These are `banned-words.md` § Cluster tells: the scanner flags them at low severity only when two or more appear in one document, and a lone hit is clean.

## Code: verified ranking (precision-adjusted)

Verified share = raw share discounted by how often the cited quote really meant that tell. The loudest four are structural and regex-blind.

| Tell | Verified share | Class | Regex-visible? |
|------|------:|-------|----------------|
| Boilerplate / tutorial-shaped "sample app" code | 18.6% | substance | No |
| Hallucinated APIs / made-up libraries, plausible-but-wrong logic | 11.2% | **bug** | No (build/type-check/run catches it) |
| Over-commenting (a comment narrating each line) | 8.5% | cosmetic | Partly |
| Over-engineering (abstraction/layers for a simple task) | 7.8% | substance | No |
| Emoji in code, comments, logs, commits | 3.9% | cosmetic | Yes |
| Style ignores the surrounding codebase | 3.5% | substance | No |
| try/except around everything / swallowed errors | 3.1% | **bug** | Partly |
| Suspiciously clean, no human mess | 2.3% | meta | No |
| Mixed skill (advanced beside beginner; can't explain it) | 1.9% | substance | No |
| Generic placeholder names (`process_data`, `doStuff`) | 1.9% | cosmetic | Yes |
| Placeholder comments left in (`// rest of your code`) | 1.6% | **bug** | Yes |
| Leftover chat artifacts (` ``` ` fences, "As an AI", "Note:") | 1.2% | cosmetic | Yes |

**Two axes, kept independent.** *Severity* = how loudly it reads as AI, which is the smell scale in `confidence-and-evidence.md` § Confidence classes; for a bug-class tell the cost is functional and the class column says so. *Class* = whether the code is actually wrong: **bug** (broken; fix it regardless of severity), **substance** (wrong-for-the-job, needs a human reading the diff against its neighbors), **cosmetic** (the chat voice leaking in, the light pass). A swallowed error is medium-severity but a bug; an emoji is the highest-precision cosmetic tell but harmless. The rule: never polish cosmetics while a swallowed error or hallucinated call ships.

### Code: do NOT flag

| Tell | Verdict |
|------|---------|
| Left-in debug logging (`print`/`console.log` everywhere) | **Rejected, precision ~0%**: every cited case was a workflow opinion, not real left-in logging. Do not flag bare logging. |
| Reinventing the wheel (re-implementing stdlib) | Inflated; mostly misattributed to duplication or hallucinated libs |
| Over-defensive validation (null checks for impossible cases) | Inflated, ~40%. **Asymmetry:** do NOT flag it when reviewing (half the complaints are the opposite, no validation at all), but DO avoid producing it when generating. It is the over-correction trap. |
| Type hints everywhere, docstring on every trivial function | Verified ~0.8% / 0.0%; barely registers |

## UI/design: verified ranking

Trust comment share over post share when they diverge (comments are 100% on-topic; post bodies inflate generic words like "cards" and "dark mode"). The stereotypical "AI design" memes (bento, mesh gradients) sit near the bottom or were rejected.

| Tell | Comment share | FP risk | Verdict |
|------|------:|---------|---------|
| "All looks the same" / cookie-cutter (umbrella) | 6.1% | low | Top finding |
| Default shadcn / Tailwind kit, un-themed | 2.5% | medium | #1 concrete cause |
| AI purple (indigo/violet primary) | 2.3% | low | Top color tell |
| Gradients / gradient hero text | 2.0% | low | Confirmed (share understates it) |
| Too many animations / Framer fade-ins | 1.1% | high | Minor, noisy signal |
| Rounded corners / pill buttons everywhere | 0.8% | medium | Confirmed |
| Dark mode + unprompted neon glow | 0.7% | low | Confirmed (the glow, not dark mode) |
| Emoji as icons / sparkles / rockets | 0.5% | medium | Confirmed (emoji *as UI*, not in copy) |
| Generic sans (Inter / Geist) | 0.4% | low | Confirmed (share understates it) |
| Symmetric hero + 3 feature cards + CTA | 0.4% | medium | Confirmed, thin |
| **Cream + serif + a warm accent "tasteful default"** | rising | n/a | The current top emerging tell; accent is sage green or rusty orange by wave. See `design-patterns.md` |

### UI: cleared by the data (do NOT flag)

| Pattern | Verdict |
|---------|---------|
| Mesh / blob / aurora backgrounds | **Rejected**: keyword artifact (most matches were GitHub `/blob/` URLs) |
| Bento grid | Dead last (0.1%); people defend it. Not a tell. |
| Glassmorphism / frosted glass | 0.2%, contested. Low signal. Flag only "everywhere, without purpose," not its presence. |
| shadcn / Tailwind / dark mode themselves | The *un-themed defaults* are the tell, not the tools. A themed shadcn site is invisible to the complaint. |

## How to use this file

- **Severity follows the data.** Top-ranked, low-FP tells (em dash, "not just X," AI purple, shadcn defaults, swallowed errors, hallucinated APIs, chat artifacts) carry weight. Inflated/low-confidence tells (the cluster-tier words, lone connectives, glassmorphism) only count when they cluster; the single-hit words (`delve`, `tapestry`) count on one occurrence.
- **Route regex-blind tells to a semantic read.** Rhythm, sycophancy, emptiness, formulaic shape, hallucinated APIs/citations, over-engineering, and codebase-fit need the `slop-detector` agent or a human, not the scanner.
- **Honor the escape hatch.** A flagged construct on a line marked `anti-slop-allow:` / `unslop-ignore` is a deliberate choice. Skip it.
- **A clean scan is not the finish line.** It clears the cheap layer. The structural read is where the real signal lives.

## 2026-07 spot-check

Bounded drift check of this file's top claims against public discussion from mid-2025 through mid-2026 (method and cadence: `docs/rankings-refresh.md`). This section records status only; any rule change goes through the measure harness first (`npm run measure` from `scripts/`).

| Claim (as ranked above) | Status | Evidence |
|-------------------------|--------|----------|
| Em dash is the top writing tell | Confirmed; drifting down at the source | Still the most-named tell in press and detection guides through 2026-02 (vrid), but GPT-5.1 (2025-11) now obeys "no em dashes" custom instructions per Altman (via Mowshowitz, 2025-11-18) and vendors cut the default rate, so fresh model output carries fewer. Keep density scoring; re-measure before any promotion. |
| `not just X, it's Y` antithesis | Confirmed; strengthening | Wikipedia's living "Signs of AI writing" page calls negative parallelism "stereotypically an AI sign"; Barron's counted the construction in Fortune 500 filings rising from ~50 (2023) to 200+ (2025) (via Hassid). |
| Cream + serif + sage as the emerging design tell | Confirmed as now-mainstream; accent detail drifting | Chayka (2026-06-29) describes beige and cream backgrounds with large italicized serif display as the recognizable generic AI web style, with rusty-orange accents named where this file says sage. FP risk rising: human 2026 design trends converge on the same palette. |
| AI purple / un-themed shadcn as the #1 concrete cause | Confirmed; NOT superseded by cream/serif | Still the leading concrete complaint for vibe-coded app UI; Adam Wathan's 2025-08 apology for `bg-indigo-500` drew 1M+ views (via prg.sh). Cream/serif is a second parallel default rather than a replacement. |
| Sycophancy / yes-man tone (regex-blind) | Confirmed; worse | Claude Code's "You're absolutely right!" became a reported product complaint (The Register 2025-08-13; claude-code issue #3382); GPT-5.1 reviewers report increased glazing and automatic "Good question" openers (Mowshowitz). The catchphrases themselves are already in the scanner's banned-phrase list; the tone in flowing prose stays agent territory. |
| Chat-artifact and cosmetic code tells (fences, emoji, placeholder comments) | Confirmed | Emoji-dense output is used operationally as a detection signal (Netcraft 2025); complaints about cleaning emoji-riddled AI comments persist on HN into 2026; 2026 AI-code-review checklists still lead with leftover artifacts. |
| Diction cluster (`delve` etc.) as an inflated tell | Confirmed direction; aging out faster | Wikipedia notes `delve` dropped sharply in 2025 as models updated; PubMed-corpus work tracks the vocabulary receding in medical writing. These are demotion candidates, never promotion: `delve` and `tapestry` are single-hit tells (`banned-words.md`), and moving one to the cluster tier is a rule change, measured first like any other. |
| Loudest tells are structural and regex-blind | Confirmed with new evidence | arXiv 2601.21276 (2026-01) measures AI pull requests ignoring reuse opportunities while reviewers rate them positively: surface plausibility masks exactly the defects a regex cannot see. |

Tells named in current sources that this file flagged as uncovered. All six were written up in `writing-patterns.md` for 2.1.0; the status column records where each landed and why.

| Tell | Where it lives now | Rule? |
|---|---|---|
| First-word fingerprints: model-specific openers ("Certainly!", "Good question", "I'd be happy to") as a distinct class (vrid 2026-02) | `writing-patterns.md` § First-Word Fingerprints, with the positional test that generalises past any fixed list | Partly. The named phrases are in `BANNED_PHRASES`; the class is agent territory |
| Participial sentence openers (`-ing` phrase first) at 2-5x the human rate (vrid 2026-02) | `writing-patterns.md` § Participial Sentence Openers, as a concentration tell | No. A single-occurrence match would be near-total false positives; needs a corpus pass before any rule |
| `From X to Y` sweep construction (vrid 2026-02) | `writing-patterns.md` § The "From X to Y" Sweep | No. Regex-visible but likely high FP; not measured |
| Personification of tools and data ("the data tells a story") (vrid 2026-02) | `writing-patterns.md` § False Agency and Personification. `SKILL.md` and `self-check.md` already carried the one-line form; the worked treatment is new | No. Regex-blind, agent territory |
| Title case forced onto every heading (Wikipedia) | `writing-patterns.md` § Forced Title Case on Every Heading | No, deliberately. The tell is inconsistency with the surrounding document, which a single-file match cannot judge |
| Em-dash-avoidance contortions cited as a tell in their own right | `writing-patterns.md` § The Over-Corrected Register (already covered at the time of the spot-check) | No. This is finding 4, the moving target, playing out on schedule |

## 2026-08 doctrine update: the em dash splits by vendor

The Economist analysed 1.2M words across 55,940 sentences from ChatGPT, Claude, Gemini and Grok (August 2026) and reported that **only Claude used em dashes more often than the human writers it was compared against**; ChatGPT used "markedly fewer than any other writer examined". The headline that travelled from this ("AI writing is no longer betrayed by em dashes") is true of the field and false of this plugin's traffic.

**What it changes here: nothing about the ranking, and one thing about how to read it.** The em dash stays the top-ranked writing tell, and em-dash density stays load-bearing rather than becoming less so, because the output this plugin is pointed at is predominantly Claude output, which is the one model still above the human rate. A future reader who demotes the em dash on the strength of the headline would be demoting it on evidence drawn from other vendors' output.

Two more results from the same corpus, both currently uncovered:

- **Sparse punctuation.** Models used fewer commas and semicolons than human writers and "hardly any parentheses", with long sentences and paragraphs rarely broken by a short one. That is the inverse of every density metric this plugin measures, and it is measurable with the machinery that already computes em dashes per 1,000 words. It is not shipped as a rule: reference docs, changelogs and terse operator prose all legitimately run comma-light, so the false-positive risk needs a corpus pass (`npm run measure`) before any threshold is set.
- **"And" is the models' most overused word**, and all four favour polysyllables (`significant`, `increasingly`), rare words (`interdependence`), scientific terms (`parameter`, `methodology`) and nominalisations, with Gemini and Claude most pronounced. The polysyllabic finding confirms the register `banned-words.md` is built on. The `and` finding has no shippable form: it is the most common word in English.

Source (accessed 2026-08-23): The Economist, "How to spot AI writing" (August 2026), via ontimebrief.com summary; independently summarised by Fast Company and Dataconomy.

Sources (accessed 2026-07-03): Wikipedia "Signs of AI writing" (en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing); Kyle Chayka, "The generic style of AI web design", 2026-06-29 (kylechayka.substack.com); Zvi Mowshowitz, "GPT-5.1 Follows Custom Instructions and Glazes", 2025-11-18 (thezvi.wordpress.com); vrid.ai "Signs of AI Writing", 2026-02-11; Ruben Hassid, "It's not [X], it's [Y]" (ruben.substack.com); Milind Nair, dev.to (why-does-ai-keep-saying-its-not-x-its-y); The Register, 2025-08-13 (claude_codes_copious_coddling_confounds); github.com/anthropics/claude-code issue 3382; prg.sh "Why Your AI Keeps Building the Same Purple Gradient Website"; Netcraft, "Excessive Emojis as an AI Indicator"; arXiv 2601.21276 "More Code, Less Reuse", 2026-01-29; PMC12679996 "Delving Into PubMed Records"; github.com/JCarterJohnson/vibecoded-design-tells (upstream corpus, still the original snapshot).

## Coverage matrix

The systematic answer to a question this catalogue documented rules for and never answered: **which tells can a scan reach at all?** Without it the not-assessed rule is aspirational, because nothing says which families a clean scan was silent about. Written against the 2.2.1 rule inventory and updated for the 2.4.0 additions.

Read the columns as: **scanner rule** = a deterministic rule exists and fires on one file's text. **Agent-reachable** = the `slop-detector` agent can judge it from source with `Read`/`Grep`/`Glob`. **Needs runtime or build** = neither layer can settle it without a compiler, a browser, or a running app.

| Tell family | Scanner rule | Agent-reachable | Needs runtime or build |
|---|---|---|---|
| Banned words and phrases | Yes | Yes | no |
| Em dash density | Yes | Yes | no |
| Antithesis, listicle scaffold, "in conclusion", fast-paced opener, "dive in", the "Honestly," opener, horizontal-rule dividers, marketing hype, "unlock the potential" | Yes | Yes | no |
| The 2026 plain-word register ("quietly building", "decisions compound", "why this matters") | Yes (`plain-aiism-collocation`, at two or more in one document) | Yes | no |
| Leftover assistant boilerplate, chat artifacts, model tooling tokens | Yes | Yes | no |
| Emoji in prose, code, logs, UI | Yes (Unicode's definition: default emoji presentation, U+FE0F-forced pictographs, keycaps, flags) | Yes | no |
| A media-control text glyph standing in for a control | Yes (`media-control-glyph`, web and native surfaces) | Yes | no |
| Sentence rhythm, uniform paragraph shape, five-paragraph essay | **No** | Yes | no |
| Sycophancy in flowing prose, empty fluency, emotional flatness | **No** | Yes | no |
| Participial openers, "From X to Y", personification, forced title case | **No** | Yes | no |
| Hallucinated APIs and packages | **No** | **No** | **Yes** (build, type-check, or registry lookup) |
| Tutorial-shaped code, over-engineering, style ignores the codebase | **No** | Yes (needs the neighbouring files) | no |
| Swallowed errors, placeholder stubs, dead branches, `forEach(async)` | Yes | Yes | no |
| Generic placeholder function names (`process_data`, `doStuff`) | Yes (`generic-naming`) | Yes | no |
| Whole-library imports, interpolated Tailwind classes, deprecated APIs, blanket lint and type suppressions | Yes (`full-lodash-import`, `full-moment-import`, `tailwind-dynamic-class`, `deprecated-api`, `suppression-comment`) | Yes | no |
| `<img>` with no width or height, `setState` inside a `useEffect`, blanket `DispatchQueue.main.async` on Apple surfaces | Yes (`img-no-dimensions`, `useeffect-setstate`, `dispatch-main-async-spam`) | Yes | no |
| `as any` casts and `catch (e: any)` | Yes (`cast-to-any` 2.4.0, `catch-any`) | Yes | no |
| Resource leaks, writes with no transaction, blocking calls in async code, catastrophic regex, hardcoded environment values | **No** | Yes | Sometimes |
| Narrating, banner, apologetic, deferral comments | Yes | Yes | no |
| `eval`, `innerHTML`, `dangerouslySetInnerHTML`, `shell=True`, unsafe deserialize | Yes | Yes | no |
| SQL injection, path traversal, SSRF, open redirect, IDOR, insecure randomness | **No** (see `confidence-and-evidence.md` § the families the catalogue teaches) | Yes | no |
| N+1 queries, missing timeouts, unbounded queries, race conditions | **No** | Partly (needs block scope the agent has and the scanner does not) | Sometimes |
| Hardcoded secrets | Yes (Pattern smell; cannot prove liveness) | Yes | **Yes** to confirm |
| AI purple, gradients, generic fonts, cream-serif default, frosted nav, gradient text | Yes | Yes | no |
| Un-themed shadcn and Tailwind card defaults, the `bg-*-100` icon circle, decorative blur blobs, the tracked-out overline, the verbatim hero type run, the shadcn stats literals | Yes (`shadcn-default-card`, `shadow-border-rounded-combo`, `icon-in-colored-circle`, `blur-blob`, `uppercase-overline`, `tailwind-hero-triplet`, `shadcn-stats-magic`) | Yes | no |
| Maximal rounding, unprompted neon glow, `transition-all`, uniform section padding | Yes (`rounded-everything`, `neon-glow`, `transition-all`, `uniform-section-padding`) | Yes | no |
| z-index escalation, `!important` overuse, marketing hype in UI copy, stock illustration sources | Yes (`z-index-escalation`, `important-overuse`, `hype-copy`, `stock-illustration`) | Yes | no |
| Unthemed Bootstrap palette hexes | Yes (2.2.0, narrowed 2.2.1 to require the primary blue) | Yes | no |
| Bootstrap's default shadow and zebra-striped tables | **No** | Yes | no |
| Generic microcopy and hero scroll-indicator literals | Yes (`generic-microcopy`, `hero-scroll-hint` 2.2.1) | Yes | no |
| Strongest-10 entries 3, 5, 6, 7, 8, 10 and most AI Component Fingerprints | **No** | Yes | no |
| Fixed page shells, fixed grid tracks, `100vh` shells, token drift, uniform radius | Yes (2.1.0) | Yes | no |
| Missing alt, `outline: none`, dead controls | Yes (2.1.0) | Yes | no |
| Pinch-zoom lock in the viewport meta, positive `tabindex` | Yes (2.4.0, `viewport-zoom-lock`, `positive-tabindex`) | Yes | no |
| Physical properties where logical ones belong (RTL), hardcoded user-visible strings, inputs without a matching type | **No** | Yes | no |
| Text contrast on a declared surface | Partly (2.5.0, `low-contrast`, `low-contrast-near-bar`: declared CSS, inline styles and CSS-in-JS only) | Partly (arithmetic from source literals only) | **Yes** for a rendered page |
| Tap-target sizes, keyboard reachability | **No** | Partly (arithmetic from source literals only) | **Yes** for any asserted number |
| Side stripes, type below the legibility floor, reading mechanics, bounce easing, the pulsing live dot | Yes (2.5.0, `side-stripe-accent`, `text-size-floor`, `tight-leading`, `wide-tracking`, `justified-narrow-column`, `crushed-tracking`, `bounce-easing`, `pulsing-dot`; the type rules read one block at a time) | Yes | no |
| Missing empty/error/loading states, cross-file component coherence | **No** | Partly (needs the sibling files) | no |
| Density and waste: viewport utilisation, page length, action distance | **No** | Taste note only, unless source literals give arithmetic | **Yes** for a graded finding |
| Native fixed geometry, idiom branching, fixed grid columns, repeating symbol effects, fixed font sizes | Yes | Yes | no |
| Dynamic Type to AX5, compact height, Display Zoom, RTL, Split View | **No** | **No** | **Yes** |

Three things follow, and they are the reason the table exists:

1. **A clean scan is a statement about the first column only.** Every "No" in it is a family the scan was silent about, not a family it cleared.
2. **The `slop-detector` agent owns the middle column and cannot reach the third.** Its tool grant is `Read`, `Grep`, `Glob`; the "needs runtime or build" rows are `NOT ASSESSED` on every dispatch unless the dispatcher supplies the output.
3. **Hallucinated APIs are the only top-five tell that no layer of this plugin reaches.** They rank second among code tells by verified share. Build and type-check before either layer, and pass the result in.
