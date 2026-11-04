# Choosing With Intent

The positive half of the plugin. Removing tells leaves a vacuum; this file is what fills it. The thread running through all three domains (prose, code, UI) is the same: **AI output reads as generated because no one decided what it should be, so the model returns the average of its training data, and everyone's average is identical.** The fix is not a better default. It is a decision with a reason specific to this piece, this codebase, this brand.

This is a method, not a style. Any fixed style, applied by default, becomes the next average and the next tell. Cream-and-serif replaced purple-gradient that way. The goal is a chosen direction, whatever it is.

## The one move that does more than every rule combined

Get a concrete anchor before you generate, and match it.

| Domain | The anchor | If the user has none |
|--------|-----------|----------------------|
| UI | one real site, brand, or screenshot whose feel they want | commit to a *named* direction (dense-utilitarian, editorial, warm-consumer, stark-technical), not "modern and clean" |
| Code | the files the new code sits next to: the module it extends, the nearest sibling, the project's conventions | write one short conventions note and follow it; the tell is the *absence* of a chosen pattern, not any pattern |
| Prose | a sample of the target voice (past writing, a named author) | pick a named voice (plain-technical, dry-and-funny, blunt-operator), not "professional and engaging" |

A reference is how a human injects taste into a model that otherwise averages. Asking for one, when none was given, is the highest-leverage thing this plugin does. If the user genuinely cannot name one, do not silently produce one median result; produce a deliberate one and say what you chose, or offer two or three distinct directions.

## Prose: pin a register, then a speaker

Register decides what "plain" means and what counts as a tell. A fragment is native in a text message and a tell in a legal brief; a contraction is right in an email and wrong in a spec.

| Register | Where | What's native |
|----------|-------|---------------|
| Casual | texts, DMs, posts | contractions, fragments, slang, dropped subjects |
| Conversational-professional | work email, Slack, changelogs | plain, direct, light warmth, no throat-clearing |
| Expository | essays, articles, READMEs | clear argument, varied rhythm, a point of view, paragraphs over bullets (**where most unslopping happens**) |
| Formal | papers, briefs, specs | no contractions, structured, impersonal, sourced (**formality here is correct, not a tell**) |

Then pin a speaker inside the register, state the claim in one sentence before writing the body (if you can't write the claim, there is nothing to write yet), let structure follow the argument rather than an intro/three-body/conclusion template, and vary sentence length on purpose. Read it aloud; fix whatever lulls. Most tells have a plain mechanical fix that needs no taste: em dash to comma or period, "delve into" to "look at," cut the sycophantic opener, delete the "as an AI" line, drop the "in conclusion." Reserve voice work for prose that reads empty because nobody decided what it was.

## Code: fit the codebase, then verify what a regex cannot

Code has far less aesthetic latitude than prose or UI. There is rarely a tasteful choice, only "is it correct, and does it match what is already in this project." The single most-repeated fix across the entire code corpus: **make the model follow the existing code instead of guessing the average.**

1. **Feed the surrounding code first.** The module being extended, the nearest sibling, how the project handles errors and logging, its naming vocabulary. A change that follows existing patterns is small and invisible; one that ignores them is the 2000-line PR that should have been 50.
2. **State the real requirement, not the demo.** Name the real inputs, failure modes, and integration. Vague requirements produce the sample-app shape: one page, dummy data, no backend.
3. **Verify what a regex cannot. The two questions that catch most bugs.**
   - *Does it call anything that doesn't exist?* Run it. Resolve every import and method against real docs, not the model's confidence. `tsc --noEmit` + eslint, `mypy` + a real import, `go build ./...` + `go vet`, `cargo check` + clippy. This is the one verification prose and design do not get; lean on it. Hallucinated APIs are the #2 code tell and no regex sees them.
   - *Does it match how this repo already does things?* Read the diff against neighboring code. A new logging approach or error pattern mid-file is the style-mismatch tell.
4. **If you cannot explain a line, do not ship it.** Advanced code beside beginner mistakes that no one can account for is the mixed-skill tell.

Audit order for code, because code (unlike prose) runs: **build/type-check first** (catches hallucinated APIs, the loudest bug, invisible to any scanner), **scan second** (surface tells), **read the diff third** (shape, over-engineering, repo-fit). The scanner is the cheap second pass, never the first.

## UI: choose color, type, and structure on purpose

1. **Color from the project, not the framework.** Real brand color is best. If choosing, sample from something concrete (a product photo, a logo, a physical object) so the palette has a source. Build a neutral ramp you picked, not stock slate or stock cream. The test is not "is this nice" but "can I say why this project uses it." Avoid both current defaults: framework indigo/violet, and cream-plus-serif with whichever warm accent the tasteful default is wearing this year. Either is fine as a stated decision, neither as a fallback.
2. **Type for a reason, and pair it.** A display face plus a separate body face almost always reads as more considered than one face everywhere. Steer off autopilot on both sides: Inter/Geist (the no-choice default) and Instrument Serif/Fraunces/Playfair (the tasteful-choice default).
3. **Structure follows the goal.** Decide what the page is for and what the user should do first; let that set the sections. The centered-hero-plus-three-cards skeleton appears precisely when structure is chosen by default instead of by purpose. Show the real product (true screenshots, real data, real numbers) over abstract icon cards. The most-cited "lack of images" complaint is exactly this.
4. **Motion, radius, and effects are decisions to justify, not defaults to accept.** Motion must communicate something and honor `prefers-reduced-motion`. Radius is a small intentional scale, not one value on everything.

## The escape hatch, and the trap it guards against

A pattern chosen on purpose is not a tell. A broad catch at a system boundary, an emoji in a CLI banner, `process_data` in a genuine one-off script, an em dash in prose that deliberately uses them, purple as a real brand color, all legitimate. Mark the line `anti-slop-allow: <reason>` (or `unslop-ignore`) so the audit stays honest and stops nagging. The reason is the point: it forces the choice to be deliberate.

**Placement contract, stated because getting it wrong fails silently.**

1. **Same line only.** The marker must appear on the line that carries the finding. This scanner has no previous-line support and no block form; a marker on the line above is read as ordinary text and the finding still fires. Put it in a trailing comment (`const key = "demo"; // anti-slop-allow: fixture credential`), or at the end of a prose line.
2. **The regex looks for the marker, not the reason.** `/(?:anti-slop-allow|unslop-ignore)\b/i` is the whole match, so a bare `anti-slop-allow` with no reason suppresses the line. Write the reason anyway. A suppression nobody can audit is how a real defect stays hidden for a year, and the reason is the only thing that distinguishes a decision from a silencer.
3. **Whole-line by default, one rule on request.** A free-text marker drops the line from every rule, so a marker added for a purple hex also hides a hardcoded secret on the same line. To waive one rule and leave the rest reading the line, name it: `anti-slop-allow: gradient-text -- wordmark from the identity guide` (one or more rule ids, comma-separated, then ` -- ` and the reason). Every id before the ` -- ` must be a real rule id, or the waiver suppresses nothing and the CLI says so on stderr. The prose rules (banned words and phrases, text constructs, em-dash density, emoji) still drop the whole line for any marker. Keep suppressed lines short and single-purpose.
4. **Other tools in the same family may accept the previous line.** Some CI gates built on this vocabulary take `anti-slop-allow` on the offending line *or* the one above it. This scanner does not, so a suppression that works in one of those gates can be silently ignored here. When a suppression appears not to take effect, check the placement first.

The trap, in every domain: **do not over-correct.** Telling a model "write clean code / don't look AI" backfires into performed seniority: defensive checks for impossible cases, a type on every local, a comment on every block, a layer for a thing with one caller. Telling a writer to avoid every tell produces the 2026 register: staccato fragments on every beat, forced lowercase, em-dash-dodging contortions, fake typos. Telling a designer to avoid purple produces cream-and-serif on every site. The cure is always the anchor, not the avoidance: match the level the surrounding code operates at, the voice the piece actually needs, the brand the product actually has. Add nothing the neighbor would not have. The absence of voice dressed up as casual is still the absence of voice.

The one-line version: **get a real reference, match it, and check every claim is real.** Everything else here is what to do when you cannot.
