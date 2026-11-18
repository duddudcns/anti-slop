# Self-Check Checklists

Run through the relevant checklist before finalizing output. These catch the most common AI tells. The minimum check lives in `SKILL.md` § Quick Self-Check; use the checklists here for a thorough review. Not every item applies to every output. Applying all rules mechanically creates its own detectable pattern.

Two framing rules. Judge most word and phrase tells by **concentration** — a lone hit is usually clean (see `empirical-rankings.md`) — and honor the **escape hatch**: a deliberate choice marked `anti-slop-allow:` / `unslop-ignore` is not a tell. The highest-signal tells (sentence rhythm, sycophancy, empty fluency, hallucinated APIs and citations, codebase-fit) are invisible to a word scan; read for them rather than relying on the lists.

## Text/Prose Checklist

### Vocabulary

The banned-words list splits in three, and a self-check checks the first two. The first group is flagged on a single hit. The second is the high-frequency set that people use normally, flagged only when the same word appears twice or more, at low severity. The split is `BANNED_WORDS` minus `LOW_CONFIDENCE_WORDS` in `scripts/lib/rules.mjs`; `empirical-rankings.md` § Writing: do NOT flag on a lone hit carries the corpus numbers behind it. The third group, the plain-word preferences in `banned-words.md` (`ensure`, `crucial`, `enhance` and the rest), is on neither list and is not a check: those words carry legal and technical weight, and treating them as tells produces exactly the over-correction this file warns about.

- [ ] No single-hit words? (`delve`, `elevate`, `embark`, `unveil`, `showcase`, `spearhead`, `orchestrate`, `synergize`, `galvanize`, `transcend`, `pivotal`, `cutting-edge`, `groundbreaking`, `transformative`, `unprecedented`, `unparalleled`, `multifaceted`, `bustling`, `enchanting`, `landscape`, `tapestry`, `synergy`, `testament`, `interplay`, `paradigm`, `intersection`, `gossamer`, `iridescent`, `luminous`, `ephemeral`, `ethereal`, `enigmatic`)
- [ ] No low-confidence word used twice? (`utilize`, `leverage`, `harness`, `seamless`, `foster`, `facilitate`, `streamline`, `comprehensive`, `robust`, `navigate`, `nuanced`, `meticulous`, `realm`, `holistic`, `myriad`, `plethora`, `paramount`, `intricate`, `vibrant`, `captivating`, `profound`, `empower`, `cultivate`)
- [ ] No promotional adjectives? (`groundbreaking`, `cutting-edge`, `transformative`, `unprecedented`; `vibrant` is a cluster tell, checked one line above)
- [ ] No unnecessary adverbs? (`really`, `just`, `literally`, `fundamentally`, `inherently`, `crucially`)
- [ ] No fancy verb substitutes for "is" or "has"? (`serves as`, `stands as`, `features`, `boasts`)
- [ ] Fewer than two 2026 plain-word collocations? (`quietly building`, `why this matters`, `earn the right to`, `decisions compound`, `built different`)

### Phrases

- [ ] No sycophantic opener? (`Great question`, `Absolutely`, `Certainly`, `I'd be happy to`)
- [ ] No sycophantic closer? (`Hope this helps`, `Feel free to`, `Let me know if you have questions`)
- [ ] No throat-clearing? (`Here's the thing`, `The truth is`, `Let me be clear`)
- [ ] No filler phrases? (`It's worth noting`, `At the end of the day`, `When it comes to`, `In today's`)
- [ ] No meta-commentary? (`Let me walk you through`, `In this section`, `As we'll see`, `Key takeaways`)
- [ ] No emphasis crutches? (`Let that sink in`, `Full stop`, `Make no mistake`)
- [ ] No journey metaphors? (`embark on`, `navigate the landscape`, `pave the way`)
- [ ] No significance inflation? (`pivotal moment`, `watershed moment`, `paradigm shift`)
- [ ] No vague declaratives? (`The implications are significant`, `The stakes are high`)
- [ ] No leaked model tooling tokens? (`oaicite`, `contentReference`, `turn0search0`, `[cite: 1]`, `grok_card`)

### Structure

- [ ] Not forcing lists to exactly three items? (If every list has three items, something is wrong.)
- [ ] No binary contrasts performed for drama? (Not X. Y. / The problem isn't X. It's Y. A contrast that corrects an assumption the reader held is information.)
- [ ] No "It's not just X, it's Y" / "not only X but also Y" antithesis? (the #1 sentence tell)
- [ ] No hedging seesaw? (Presenting both sides, then hedging, then hedging again)
- [ ] No dramatic fragmentation in expository prose? (One. Word. Sentences. For. Drama. Fragments are native to a casual register.)
- [ ] No rhetorical questions answered immediately?
- [ ] No topic-explanation-example-transition template in every paragraph?
- [ ] No summary/recap at the end that restates what was just said? (The closing message of an agentic session is the exception: the reader may have seen none of the tool output, so what was found, what changed and what failed is the deliverable, `writing-patterns.md` § Summary at the End.)
- [ ] No recapping the user's question before answering? (Naming the reading an ambiguous question took, in one clause, is information the reader needs.)
- [ ] No over-corrected "anti-AI" register? (staccato fragments everywhere, forced lowercase, em-dash-dodging contortions, fake typos)

### Rhythm

Every item here is countable on purpose. Rhythm is the second most-cited tell and the one a word scan cannot reach, so a checkbox that cannot be failed is worse here than anywhere else in this file.

- [ ] Sentence lengths vary? (No three consecutive sentences within three words of each other)
- [ ] At least one sentence under 10 words and one over 25, in any passage longer than five sentences?
- [ ] Paragraph lengths vary? (No three consecutive paragraphs with the same sentence count)
- [ ] Fewer than half the paragraphs end on a transition into the next one? (A paragraph that lands its last point and stops is normal human prose; a transition on every one is the template.)

### Punctuation

- [ ] Em dashes below the scanner's threshold? (It fires at five or more in the document AND four per 1,000 words, both conditions, counted after code and quotes are stripped. Correct at lower counts; do not contort the prose to go lower still.)
- [ ] Exclamation marks rare? (Max one per 1000 words in expository prose; dialogue and casual chat keep their own)
- [ ] No ellipsis abuse?
- [ ] No colon standing in for an em dash? (Swapping every dash for a colon is the documented over-correction, and readers now name it as its own tell.)

### Voice

- [ ] Active voice by default? (Passive is fine when the agent is unknown, irrelevant, or the patient is the topic; the tell is the passive that hides an actor the reader needs)
- [ ] No false agency? (Decisions don't "emerge," data doesn't "tell us")
- [ ] No passive voice hiding actors? ("Was implemented"; by whom?)
- [ ] Specific rather than vague? (Real numbers, named things, concrete details)
- [ ] No performative enthusiasm? (Exclamation marks that don't match the content)
- [ ] Direct and trusting of the reader? (No hand-holding, softening, or justifying)
- [ ] Uncertainty stated where it is real? (What was not verified, what could still fail, and how sure you are. Calibrated doubt is information; false confidence is the mirror tell, `writing-patterns.md` § False Confidence.)

### Formatting

- [ ] No unnecessary markdown headers? (Short responses don't need them)
- [ ] No bold used for emphasis in running prose? (A key term bolded on first use in a tutorial is teaching, not this)
- [ ] No emoji anywhere (prose, code, commits, logs, UI strings, headings)? (Two narrow exceptions: the user used emoji first and the tone calls for matching it, or the project's own convention requires them. An exception earned in one surface does not carry to the others.)
- [ ] Bullet points only for list-like content (no "5 ways to..." listicle scaffolding)?
- [ ] No horizontal-rule dividers (---) between every section?
- [ ] Formatting is minimal and functional?

## Code Checklist

### Comments

- [ ] No comments that restate the code?
- [ ] No "// Constructor" or "// Initialize X" type comments?
- [ ] No trivial JSDoc/docstrings on obvious functions?
- [ ] Comments only explain *why*, not *what*?
- [ ] No TODO comments without real plans (linked issues, specific dates)?
- [ ] No apologetic comments ("simplified implementation, may need enhancement")?
- [ ] No emoji in comments, variable names, or log output?
- [ ] No banner/divider comments (ASCII-art section separators)?
- [ ] No language-feature explanations ("Use a dict comprehension to...")?
- [ ] No leftover chat artifacts ("Here's the updated code", "As an AI", ``` fences, "Good catch!")?
- [ ] No placeholder-comment stubs ("// rest of your code", "// your logic here")? (the file is unfinished -- a bug, not a nit)

### Architecture

- [ ] No abstraction layers for single implementations?
- [ ] No factory/builder/strategy with only one concrete case?
- [ ] No trivial helper used exactly once? (A function earns its name by a second caller or by being complex enough to deserve one)
- [ ] No configuration objects for trivial fixed values?
- [ ] Code matches the codebase's existing patterns and conventions?
- [ ] No parameter, option, or config key that takes the same value at every call site today?
- [ ] No `if (true)` / `if (false)` dead branch left from scaffolding?

### Error Handling

- [ ] No try-catch that swallows errors silently?
- [ ] No null checks for values guaranteed by the type system? (But do check at trust boundaries.)
- [ ] Error handling at boundaries, not at every layer?
- [ ] Specific exception types, not bare `except` or `catch(e)`?

### Hygiene

- [ ] No unused imports?
- [ ] No unused variables?
- [ ] No commented-out code?
- [ ] No debugging residue files?
- [ ] No redundant type annotations the compiler infers?
- [ ] No over-correction into performed seniority? (a defensive check for a state the types make impossible, a type annotation on every local, a layer with one caller, a docstring on a one-line function). This is the code mirror of the prose checklist's over-corrected register: told to write "clean code", a model adds ceremony rather than removing it. Match the level of the surrounding file.

### Verification

- [ ] Built / type-checked / ran it to catch hallucinated APIs? (the loudest code bug, invisible to any scanner -- verify before scanning)
- [ ] Did the "clean code" instinct add ceremony rather than remove it? (Re-read the diff for the over-correction items in § Hygiene above.)
- [ ] All API methods verified to exist?
- [ ] All packages verified to exist in the registry?
- [ ] No `as any` cast to silence the compiler? (Narrow with a guard or type the value; a genuine reinterpretation carries a comment beside the cast)
- [ ] No deprecated APIs used unknowingly?
- [ ] Framework conventions followed?
- [ ] No mixed patterns from different frameworks?

### Security

- [ ] No SQL string concatenation? (Use parameterized queries)
- [ ] No innerHTML with unsanitized user input? (XSS)
- [ ] No eval() with user input?
- [ ] No hardcoded credentials or API keys?
- [ ] No shell=True with user-supplied input? (Command injection)
- [ ] No unsanitized file paths from user input? (Path traversal)
- [ ] Inputs checked at system boundaries?
- [ ] Secure random generation for security purposes?
- [ ] No sensitive data (passwords, tokens, PII) in log messages?

### Backend (if applicable)

- [ ] No N+1 query patterns?
- [ ] List endpoints paginated?
- [ ] HTTP calls have timeouts configured?
- [ ] Retry logic uses backoff (not immediate retries)?
- [ ] No unbounded queries without LIMIT?
- [ ] No shallow copies where deep copies are needed (nested mutations)?
- [ ] Decimal/integer arithmetic for money (not floating-point)?
- [ ] No race conditions in concurrent/async code?
- [ ] No blocking call inside async code? (`time.sleep`, synchronous file or network I/O on the event loop)
- [ ] Files, sockets, and connections closed on every path? (A context manager, `using`, or `finally`)
- [ ] Multi-step writes inside a transaction?

### Testing (if writing tests)

- [ ] Tests verify behavior, not implementation details?
- [ ] Tests would survive internal refactoring?
- [ ] No trivial tests (testing that true is true)?
- [ ] Edge cases covered?
- [ ] Mocks used only where necessary, not as a default?

### Regression Prevention (if modifying existing code)

- [ ] Changed only what was asked? No unrelated refactoring or cleanup?
- [ ] Read modified files AND their dependents before editing?
- [ ] Used Edit (targeted diff) not Write (full file rewrite)?
- [ ] All callers updated if function signature changed?
- [ ] All consumers updated if type definition changed?
- [ ] Error messages, status codes, response shapes preserved exactly?
- [ ] Default values, timeouts, rate limits, cache TTLs preserved?
- [ ] Log levels, metric names, log field names preserved?
- [ ] Feature flags and conditional logic not removed?
- [ ] Tests fixed the code, not weakened the assertions?
- [ ] No `--no-verify`, `@ts-ignore`, `eslint-disable` to suppress real errors?
- [ ] No destructive git commands without user approval?

### Frontend (if writing React/Next.js/CSS)

- [ ] No useEffect for derived state (compute during render or useMemo)?
- [ ] useEffect has cleanup function for timers, listeners, subscriptions?
- [ ] No "use client" on components that could be server components?
- [ ] No full library imports (lodash, moment) when tree-shakeable imports exist?
- [ ] Images have width/height attributes, loading="lazy", srcset?
- [ ] No z-index escalation (use a defined scale)?
- [ ] No animating layout properties (width, height, top, left)?
- [ ] Font loading uses font-display: swap and preload?
- [ ] Semantic HTML used (`<button>`, `<nav>`, `<dialog>`, `<details>`) not div soup?
- [ ] Headings follow hierarchy (h1 > h2 > h3, no skipped levels)?
- [ ] Link for navigation, button for actions (not reversed)?
- [ ] Empty, error, and loading states designed (not just the populated view)?
- [ ] Interactive elements actually function (not just styled)?
- [ ] Design tokens/CSS variables used instead of hardcoded values?
- [ ] No styled-components created inside render functions?
- [ ] No Tailwind dynamic class construction (`bg-${color}-500`)?
- [ ] No hydration mismatches (Date, Math.random, typeof window in render)?
- [ ] Search inputs debounced (not firing on every keystroke)?

## Design/UI Checklist

### Visual Design

- [ ] No purple-to-blue gradient as default?
- [ ] No cream-background + serif-display + warm-accent "tasteful default" combination? (the current top emerging tell; the accent is sage green or rusty orange depending on the wave)
- [ ] Font choice is intentional, not default Inter/Roboto?
- [ ] Color palette matches the project's brand/purpose?
- [ ] Layout responds to content, not a template?
- [ ] No three-column icon grid as default feature display?
- [ ] No glassmorphism without purpose?
- [ ] Shadow values vary by elevation need?
- [ ] Border radius is consistent and appropriate for the design?
- [ ] No gratuitous animations?
- [ ] No identical icon-in-colored-circle on every feature card (unless requested)?
- [ ] Component library defaults customized to match the project?

### CSS

- [ ] No magic number pixel values?
- [ ] Design tokens or CSS variables used?
- [ ] No !important overuse? (One against a third-party widget is pragmatism; the scanner counts from two)
- [ ] No excessive selector nesting?
- [ ] No duplicate styles?
- [ ] No `outline: none` without a replacement focus indicator?
- [ ] Text sizes in rem/em, not px? (Hairlines, borders, and icon boxes in px are fine)
- [ ] All animations wrapped in @media (prefers-reduced-motion: reduce)?

### Accessibility

- [ ] Text contrast meets WCAG AA? (4.5:1 normal text, 3:1 large text 18pt+/14pt bold+)
- [ ] UI component contrast meets 3:1? (borders, icons, focus indicators)
- [ ] Color not used as the sole indicator of meaning?
- [ ] Informative images have descriptive alt text? Decorative images have alt=""?
- [ ] Keyboard navigation works for all interactive elements?
- [ ] Visible focus indicators on all interactive elements?
- [ ] Focus trapped in modals? Returned to trigger on close?
- [ ] Dynamic updates (toasts, errors, loading) announced via aria-live?
- [ ] Semantic HTML used? (`<button>`, `<nav>`, `<main>`, not div-for-everything)
- [ ] Heading hierarchy correct? (h1 > h2 > h3, no skipped levels)
- [ ] Touch targets at least 24x24px with spacing (WCAG 2.5.8 AA)?
- [ ] Pinch zoom not blocked? (No `user-scalable=no`, `user-scalable=0` or `maximum-scale=1` in the viewport meta, WCAG 1.4.4)
- [ ] No positive `tabindex`? (Focus order follows the DOM; `0` and `-1` are the only values)
- [ ] No hover-only interactions without touch alternatives?
- [ ] Skip navigation link present?
- [ ] HTML element has lang attribute?

### States and Content

- [ ] Empty states designed? (What shows with zero data?)
- [ ] Error states designed? (What shows when API fails?)
- [ ] Loading states designed?
- [ ] No generic microcopy? ("Welcome back!", "Get started today!")
- [ ] No marketing language in functional UI?
- [ ] No placeholder content in final output?
- [ ] Microcopy is specific to the product and context?

## Quick Pass (Minimum Check)

The minimum check is the canonical list in `SKILL.md` § Quick Self-Check. Run that when pressed for time, and the relevant checklist above when reviewing properly.

One copy is deliberate: two lists that claim to be the same minimum drift apart, and a minimum check that disagrees with itself is worse than no minimum check.
