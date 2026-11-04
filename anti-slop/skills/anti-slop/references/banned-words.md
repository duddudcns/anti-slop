# Banned Words

Words whose frequency in published text jumped after 2022, and which corpus work since has repeatedly named as overrepresented in generated prose. `delve` is the most-studied case and the one currently receding fastest, which is a reminder that the list is a snapshot rather than a law.

The list is not the evidence. `empirical-rankings.md` carries the hand-audited corpus numbers, including the finding that several of the loudest-looking words here are almost never what a reader actually cites.

## Three tiers, and what each one asks of you

Not every word in this file is a tell, and treating them all as one was the mistake this file used to make. The scanner's two lists in `scripts/lib/rules.mjs` (`BANNED_WORDS` and `LOW_CONFIDENCE_WORDS`) are the source of truth for the first two tiers, and `self-check.md` § Vocabulary mirrors the same split.

| Tier | What it means | What to do |
|---|---|---|
| **Single-hit tells** | One occurrence in user-facing prose is a finding | Write the plain word instead |
| **Cluster tells** | Ordinary words with an inflated sense; a lone hit is the writer's prose, and the same cluster-tier word twice in one document is the finding | Let one pass; thin them out when they gather |
| **Plain-word preferences** | Ordinary English that also has an inflated use. Not a tell in either tier, never flagged by the scanner, and never reported by a reviewer | Prefer the plain word when it says the same thing; keep the word when it is the precise one |

The third tier is the largest, and it exists to say what not to do as much as what to do: a sentence that uses one of those words is not a finding, and a sentence rewritten to dodge one is worse than the original.

**Technical context caveat:** Many words below are standard terms in their domains. "Aggregate" in SQL and pandas, "benchmark" in testing and ML, "calibrate" in ML and instrumentation, "converge" in ML and numerical methods, "ecosystem" in npm and platform discussions, "landscape" in geography and page orientation, "ephemeral" in container storage, "synergy" in game design, "diverse" for demographic or cultural diversity. When the word is the precise term, use it. The scanner carries a context-exception table for the twenty-one words from both tell tiers most often used technically, so a `realm` in a game server or a `landscape` in a GIS tool scans clean.

**Register note:** Frequency data is based primarily on American English corpora. In British English formal prose, some words on this list (renowned, featuring) may be standard. Apply judgment for non-American registers. In academic and formal writing contexts, consult the Context Exceptions in SKILL.md before applying these bans.

**Concentration caveat:** A hand-audited Reddit corpus (see `empirical-rankings.md`) found several high-frequency "AI words" are almost never what readers actually flag: `however` / `thus` / `hence` match about 6% of posts but are cited as a tell 0% of the time; the same holds for `nuanced`, `when it comes to`, `utilize`, `navigate`, `comprehensive`, and `robust`. The single words there are the cluster tier; `when it comes to` and `however` / `thus` / `hence` are on no scanner list at all. One `utilize` is the writer's prose, and the same cluster-tier word twice in one document is the finding; the scanner reports nothing for a single hit. Six different fancy verbs in one paragraph read as slop too, but no scanner rule counts across words, so that case is the reviewer's to catch.

## Single-hit tells

The scanner flags these on one occurrence in user-facing prose, at medium severity, Pattern smell. Each has a plain word that says the same thing.

| Banned | Use Instead |
|--------|-------------|
| `delve` / `delving` | dig into, examine, look at |
| `elevate` | raise, improve |
| `embark` | start, begin |
| `unveil` / `unveiling` | show, reveal, announce |
| `showcase` / `showcasing` | show, display, present |
| `spearhead` | lead |
| `orchestrate` | arrange, coordinate, run (the Kubernetes and workflow-engine senses are excused) |
| `synergize` | work together |
| `galvanize` | motivate, push, spark |
| `transcend` | go beyond, surpass |
| `pivotal` | important, key (or say why it matters) |
| `cutting-edge` | new, modern, latest |
| `groundbreaking` | new (or describe what it broke) |
| `transformative` | big, major (or describe the change) |
| `unprecedented` | new, first, rare |
| `unparalleled` | best, top, unique |
| `multifaceted` | complex, varied (or name the facets) |
| `bustling` | busy, active |
| `enchanting` | appealing, attractive (the game-item sense is excused) |
| `landscape` (metaphorical) | name the specific field, market, or area |
| `tapestry` (metaphorical) | mix, combination (or describe specifically) |
| `synergy` | cooperation, combined effect (or describe it) |
| `testament` | proof, evidence, sign |
| `interplay` | interaction, relationship, connection |
| `paradigm` | model, approach, pattern (the programming-paradigm sense is excused) |
| `intersection` (metaphorical) | overlap, meeting point |
| `gossamer` | thin, delicate, fine |
| `iridescent` | shimmering (or describe the specific colors) |
| `luminous` | bright, glowing, lit |
| `ephemeral` | brief, short-lived, fleeting (the container and cache senses are excused) |
| `ethereal` | light, airy, delicate |
| `enigmatic` | mysterious, puzzling |

The last six are the fiction register's defaults; § Creative Writing below says why they count on sight there.

## Cluster tells

Ordinary words with an inflated sense. The scanner flags them at low severity, Pattern smell, only when two or more appear in one document; a lone hit is clean. When they gather, thin them out rather than replacing every one.

| Word | Plain alternative |
|------|-------------------|
| `utilize` / `utilizing` | use |
| `leverage` / `leveraging` | use |
| `harness` / `harnessing` | use, apply (the testing and wiring senses are excused) |
| `streamline` | simplify, speed up |
| `foster` / `fostering` | encourage, support |
| `facilitate` | help, enable |
| `cultivate` | build, grow, develop |
| `empower` / `empowering` | enable, give power to |
| `navigate` (metaphorical) | handle, deal with, work through |
| `comprehensive` | full, complete, thorough (fine in "comprehensive test coverage") |
| `robust` | strong, solid, reliable (fine in statistics and testing) |
| `nuanced` | subtle, complex, layered |
| `meticulous` | careful, precise, detailed |
| `seamless` | smooth, easy (the texture and tile senses are excused) |
| `holistic` | whole, complete, full |
| `myriad` | many |
| `plethora` | many, plenty |
| `paramount` | most important, top priority |
| `intricate` | complex, detailed |
| `profound` | deep, serious, major |
| `vibrant` | lively, active, bright (fine for colour and display work) |
| `captivating` | interesting, engaging (the audience-retention sense is excused) |
| `realm` | field, area, domain (the game-server sense is excused) |

## Plain-word preferences (not tells)

Everything below is ordinary English. Each word also has an inflated or reflexive use that generated prose reaches for, which is the only reason it is listed. **None of these is a finding.** The scanner does not match them, the self-check does not ask about them, and a reviewer does not report them. The guidance is one-directional: when you are choosing a word, prefer the plain one if it says the same thing; when the listed word is the precise one, or the plain word would change the meaning, keep it.

`validate`, `optimize`, `mitigate`, `aggregate`, `interpret`, `differentiate`, `correlate`, `quantify`, `benchmark`, `align`, `reconcile`, `elaborate`, `deliberate`, `formulate`, `ascertain`, `tailor`, `framework` and words like them are deliberately absent from every tier. They are the precise term in software, statistics, law, or plain business English, their usual replacements change the meaning, and no corpus ranks them as a tell, so a reviewer does not flag them.

### Verbs with an inflated use

| Prefer plain | When the plain word says the same thing |
|--------------|------------------------------------------|
| `underscore` | stress, highlight |
| `unpack` (metaphorical) | explain, break down |
| `elucidate` | explain, clarify |
| `synthesize` | combine, merge (standard in academic and chemistry registers) |
| `expedite` | speed up |
| `augment` | add to, increase |
| `exemplify` | show, demonstrate |
| `consolidate` | combine, merge |
| `extrapolate` | extend, predict (a term in statistics) |
| `substantiate` | prove, back up, support |
| `juxtapose` | compare, set against |
| `encompass` | include, cover |
| `assimilate` | absorb, take in |
| `fortify` | strengthen |
| `calibrate` | adjust, tune (a term in ML and instrumentation) |
| `emulate` | copy, imitate (a term in computing) |
| `permeate` | spread through, fill |
| `conceptualize` | imagine, picture |
| `manifest` | show, appear |
| `scrutinize` | examine, inspect |
| `elicit` | draw out, get |
| `enumerate` | list, count (a term in programming) |
| `disseminate` | spread, share |
| `culminate` | end in, lead to |
| `actualize` | achieve, make real |
| `accentuate` | highlight, stress |
| `illuminate` (metaphorical) | clarify |
| `reiterate` | repeat, restate |
| `ensure` | make sure (prose only; standard in technical and legal writing) |
| `enhance` | improve, add to (a term in image processing and data augmentation) |
| `conjecture` | guess, speculate (a term in mathematics) |
| `speculate` | guess |
| `expound` | explain |
| `revitalize` | refresh, renew |
| `amplify` | increase, boost |
| `converge` | meet, join (a term in ML and numerical methods) |
| `bolster` | support, strengthen |
| `garner` | get, earn, collect |
| `pioneer` (verb) | lead, start |
| `burgeon` | grow, expand |
| `demystify` | explain, clarify |
| `transmute` | change, transform |

### Adjectives with an inflated use

| Prefer plain | When the plain word says the same thing |
|--------------|------------------------------------------|
| `crucial` | important, key (or say why) |
| `impactful` | effective, strong (or describe the impact) |
| `overarching` | broad, main, overall |
| `innovative` | new (or describe the innovation) |
| `indispensable` | essential, needed, required |
| `unwavering` | steady, firm, constant |
| `invaluable` | very useful, essential |
| `noteworthy` | notable, worth mentioning |
| `commendable` | good, solid, well-done |
| `imperative` | necessary, urgent, required |
| `diverse` | varied, mixed, different (fine for demographic or cultural diversity) |
| `dynamic` | active, changing, energetic (a term in programming and physics) |
| `compelling` | strong, convincing, interesting |
| `formidable` | tough, powerful, serious |
| `indelible` | lasting, permanent |
| `ubiquitous` | everywhere, common, widespread |
| `burgeoning` | growing, expanding |

### Nouns that stand in for a specific thing

| Prefer the specific thing | Instead of |
|---------------------------|-----------|
| the field, market, or system | `ecosystem` (fine for npm and platform ecosystems) |
| the basis, foundation | `underpinnings`, `bedrock`, `cornerstone`, `linchpin` |
| the project, effort, attempt | `endeavor` |
| the connection, link, center | `nexus` |
| the test, challenge | `crucible` |
| the trigger, spark, cause | `catalyst` (a term in chemistry) |
| the puzzle, mystery | `enigma` |

### Adverbs that usually add nothing

Delete these in polished expository prose when the sentence says the same thing without them. In conversational writing `just` and `actually` are ordinary; `significantly` is a term in statistics; `effectively` meaning "in effect" stays.

| Usually deletable |
|-------------------|
| `really`, `just`, `literally`, `genuinely`, `honestly`, `simply`, `actually` |
| `deeply`, `truly`, `fundamentally`, `inherently`, `inevitably` |
| `interestingly`, `importantly`, `crucially`, `impressively`, `notably` |
| `effectively`, `strategically`, `comprehensively`, `intricately`, `essentially` |
| `significantly`, `remarkably`, `undeniably`, `undoubtedly`, `arguably`, `admittedly`, `increasingly` |

### Promotional language

Words that read like a press release or travel brochure. Drop or replace in functional writing; in marketing copy the register decides.

| Prefer plain | When the plain word says the same thing |
|--------------|------------------------------------------|
| `nestled` | located, sits |
| `thriving` | active, growing, busy |
| `renowned` | known, well-known, famous |
| `featuring` | with, including, has |
| `timeless` | lasting, classic |
| `awe-inspiring` / `breathtaking` | impressive, striking |
| `exquisite` | fine, beautiful, detailed |
| `uncharted` | new, unexplored |
| `boundless` | vast, unlimited, wide |
| `marveling` | impressed by, surprised by |

### Compound modifiers

Hyphenated compounds generated prose stacks in front of nouns. `data-driven` and `results-driven` are ordinary in business and engineering writing; the tell is two or three of these in one paragraph.

| Prefer plain | When the plain word says the same thing |
|--------------|------------------------------------------|
| `ever-changing` | changing (`ever-evolving` is a banned phrase, flagged on a single occurrence, not a preference) |
| `ever-expanding` | growing |
| `ever-competitive` | competitive |
| `hyper-connected` | connected |
| `fast-paced` | quick, busy |
| `game-changing` | big, important (or say what changed) |
| `thought-provoking` | interesting (or say what it provokes) |
| `forward-thinking` | modern, progressive |
| `results-driven` | effective, focused |
| `data-driven` | based on data |

### Fancy substitutes for "is" and "has"

Generated prose avoids simple linking verbs. Use "is" and "has" when they are the right words. Every row below applies only when the verb means plain "is" or "has": "the column represents the total" (means "stands for"), "the proxy operates as a cache" (describes a role), and "the plan features three tiers" (marketing) are the verb doing real work.

| Prefer plain | Instead of |
|--------------|-----------|
| is | `serves as`, `stands as`, `constitutes`, `functions as`, `operates as` |
| is | `represents`, `marks` (when either means "is") |
| has | `features`, `offers`, `boasts` |

## The 2026 Plain-Word Register

Everything above this section describes the 2024 tell: an inflated word standing in for a plain one, `delve` for "look at". The 2026 tell inverts it. Plain, short, Anglo-Saxon words are used metaphorically to manufacture weight: `quietly`, `shift`, `matters`, `shape`, `land`, `real`, `earn`, `the work`, `hold`, `pull`, `compound`, `signal`, `built different`. "Quietly building the future." "Decisions compound." "Earn the right to your reader's attention."

None of these words is bannable, and none of them is on any list in this file. Every one is ordinary English doing an ordinary job most of the time, and a word-level ban would fire on most correctly written prose. The tell is the **metaphorical collocation**, and only when several land in one passage. Treat it exactly as the cluster tier is treated: a single hit is the writer's prose.

The scanner reflects that. `plain-aiism-collocation` matches the collocations only (`quietly building`, `why this matters`, `this matters because`, `earn the right to`, `decisions compound`, `built different`, `the pull of`, `hold space`, `sends a signal that`, `do the work`), at low severity and only at two or more in one document. The bare words are deliberately absent from `BANNED_WORDS` and must stay absent.

The fix is the same as everywhere else in this file: say the concrete thing. "Decisions compound" means "the second decision is cheaper because of the first"; write that instead.

## Creative Writing

Words generated fiction overuses in narrative and descriptive writing. Six of them (`gossamer`, `iridescent`, `luminous`, `ephemeral`, `ethereal`, `enigmatic`) are single-hit tells in the scanner because they arrive as a set; the rest are preferences. In fiction the register decides: a story told in a lush voice may use any of these on purpose, and a lone `palpable` is the author's word. The tell is the stock set arriving together where nothing specific was seen.

| Prefer a specific, surprising detail | Instead of |
|--------------------------------------|-----------|
| strong, obvious, thick | `palpable` |
| bright, dazzling, colorful | `resplendent` |
| gut-level, raw, physical | `visceral` |
| name the thing | `ineffable` |
| playful, odd, quirky | `whimsical` |
| sad, touching, sharp | `poignant` |
| suggestive, reminiscent | `evocative` |
| gripping, absorbing | `riveting`, `spellbinding` |
| tempting, teasing | `tantalizing` |

Also avoid: characters sighing, taking deep breaths, or staring out windows as default emotional beats. Eyes should not constantly "glisten," "sparkle," or "widen." Find specific, unexpected actions instead.
