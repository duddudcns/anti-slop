# Writing Anti-Patterns

Structural, tonal, and formatting patterns that mark text as AI-generated. Three things decide whether one of them is a finding: the register (`choosing-with-intent.md`: a fragment is native in a text message and a tell in a spec), concentration (one instance of almost anything is the writer's prose), and position (an opener or a closer filled by reflex). Read each entry's fix as the direction to move in, not a rule to satisfy mechanically; § The Over-Corrected Register is what mechanical satisfaction produces.

## What the data ranks highest

A study that hand-audited 604 high-engagement Reddit posts (see `empirical-rankings.md`) found the two most reliable, hardest-to-argue tells are a **punctuation tell** (the em dash) and a **construction tell** ("It's not just X, it's Y"). Both are surface-detectable and repeatedly named. Below the head, the most-cited tells are structural and invisible to any keyword search: **uniform sentence rhythm** (the 2nd most-cited tell overall), **sycophancy**, **fluent-but-empty paragraphs**, and **hallucinated citations**. These rank above almost every lexical tell, which is why a clean word-scan does not mean human-reading prose.

Two principles govern how hard to push any of this:

- **Concentration, not lone hits.** One "utilize," one "however," one em dash is not a tell. The data shows `however/thus/hence` matches 6.3% of posts but is cited as a tell by 0%. Weight by density. Leftover assistant boilerplate ("as an AI language model") and the single-hit words in `banned-words.md` count on a single instance; the em dash, though the top-cited tell, is judged by density too, so a lone correct dash is clean.
- **Banning the old tells creates a new one.** As writers learned the 2024 markers, an over-corrected register appeared and reads as AI just as fast. It has its own section below. Apply these rules with judgment; mechanical avoidance is itself a pattern.

### The Em Dash

The single most-cited AI writing tell. Essentially absent from on-topic posts before 2024, then 6.7% in 2025 — "the ChatGPT era in one punctuation mark." Use em dashes for their correct grammatical purpose (a parenthetical insertion, an abrupt break). The tell is **density**: several per short passage, or the em dash standing in for every comma, colon, and semicolon.

**Fix, when the density is over the scanner's threshold (five in the document and four per 1,000 words):** cut the surplus and keep the dashes doing a parenthetical's job; a comma, a period, or parentheses take the rest. Below the threshold there is nothing to fix. Two cautions the data is explicit about: do not just swap in a colon (people now flag that too), and do not contort the sentence to dodge the dash (the contortion is the newer tell). If you genuinely write with em dashes, that is a choice; keep it and mark the line `anti-slop-allow: <reason>`.

## Structural Anti-Patterns

### Rule of Three

AI defaults to groups of three: three adjectives, three bullet points, three examples. Don't pad or trim lists to reach three. If the content has two things, list two. If four, list four. If three, three is fine. The tell is when every list in a piece of text lands on exactly three items, suggesting the count is forced rather than natural.

**Slop:** "It's fast, reliable, and scalable." (when only speed and reliability matter)
**Fix:** "It's fast and reliable." (or name four things if four exist)

### Binary Contrasts

The "Not X. Y." reversal structure. AI uses this constantly for false drama. Includes the enumerated variant where the second half is a long list building to a punchline.

**Slop:** "The problem isn't technical. It's cultural."
**Fix:** "The problem is cultural." (Just state the point.)

**Not a tell when:** the negation carries information the reader did not have. "The outage was not the database; it was DNS" corrects an assumption. The tell is the reversal performed for drama on a point nobody disputed.

**Slop:** "It's not about the code. It's about the people."
**Fix:** "The people matter more than the code here."

**Slop:** "Not the cosmetic problems — the security holes, the missing error handling, the N+1 queries, and the fact that every component looks identical."
**Fix:** State what it does. "It catches security holes, missing error handling, and N+1 queries." The "Not X — Y" frame adds nothing.

### The "Not Just X, It's Y" Antithesis

The single-sentence negate-then-assert, and the #1 sentence-level tell in the corpus data. "It's not just X, it's Y." "Not only X, but also Y." "That's not X; that's Y." "More than just X." The negation manufactures profundity for free: it adds no information, but the rhythm performs depth. It is the clearest single marker of the "AI accent" — people name it constantly ("It's not just a problem, it's a full-blown disaster").

**Slop:** "This isn't just a feature, it's a whole new way of working."
**Fix:** "It changes how the team works." If Y is the point, just say Y.

**Slop:** "It's not only faster, but also more reliable."
**Fix:** "It's faster and more reliable."

The construction has a reframe variant that reads as less formulaic and is not: **"It's not about X, it's about Y."** Same negate-then-assert shape, same free profundity, and it is the version currently rising fastest.

**Slop:** "It's not about the tooling, it's about the culture."
**Fix:** "The tooling is fine; nobody reviews." Say the thing you were going to say after the comma.

The scanner matches `just`, `only`, `merely`, `simply`, `about`, and `really` as the qualifier, and it needs the second clause to fire, so a single-clause "It's not about money." stays clean.

This is distinct from the two-sentence Binary Contrast above ("Not X. Y."). Both perform a drama the content should carry on its own.

### Negative Listing

Listing what something *isn't* before revealing what it *is*. A dramatic buildup that wastes the reader's time.

**Slop:** "It's not a framework. It's not a library. It's a paradigm shift."
**Fix:** "It changes how you think about state management."

### Dramatic Enumeration

A long comma-separated list with parallel structure (often repeating "the" before each item) that builds to a longer, punchier final item. AI uses this to perform expertise — rattling off a list of specific things to seem knowledgeable, then landing on a snarky observation as the closer. The structure is: "[item], [item], [item], [item], and [longer snarky punchline item]."

**Slop:** "It produces N+1 queries, swallowed errors, hardcoded secrets, inaccessible forms, 70KB lodash imports, and hero sections that all look identical."
**Fix:** Break into categories or just pick the two or three that matter most for the point you're making. Not every sentence needs to prove you know the full list.

**Slop:** "the security holes it introduces, the accessibility it ignores, the performance it tanks, the abstractions it invents for no reason, and the purple-gradient sameness it defaults to on every project."
**Fix:** "It introduces security holes, ignores accessibility, and defaults to the same visual style on every project." Or better: just describe what the tool does about it instead of listing the problems.

### Hedging Seesaw

Presenting one side, then immediately hedging with the other, then hedging back. Says nothing.

**Slop:** "While X has clear benefits, it also comes with trade-offs. That said, the benefits often outweigh the costs, though not in every case."
**Fix:** Pick a position. Acknowledge the counterpoint in one sentence max, then move on.

### Dramatic Fragmentation

Sentence fragments for fake emphasis. Performative simplicity. Includes the two-sentence variant where a short declarative sentence is followed by a short contradicting or reinforcing one.

**Slop:** "Speed. That's what this is about."
**Fix:** "This is about speed." (Complete sentence.)

**Slop:** "Faster builds. Fewer bugs. Better DX."
**Fix:** "It produces faster builds with fewer bugs."

**Slop:** "These aren't opinions. They're from published research."
**Fix:** Just present the research. The reader can tell the difference between opinions and citations without being told.

**Not a tell when:** the register is casual and the fragment is native to it. "Faster builds. Fewer bugs." in a chat reply is how people write; the same line in a specification performs.

### Rhetorical Questions Answered Immediately

Posing a question, then answering it in the next sentence. Socratic posturing.

**Slop:** "What if there were a better way? There is."
**Fix:** "A better approach exists." (Skip the question.)

**Slop:** "Why does this matter? Because..."
**Fix:** State why it matters directly.

### Topic-Explanation-Example-Transition

The template paragraph structure AI defaults to. Every paragraph follows the same format: state the topic, explain it, give an example, then transition to the next section. Break this pattern. Start with the example sometimes. End abruptly. Skip the transition.

**Slop:** "Caching improves performance. When a value is expensive to compute, storing the result avoids recomputing it. For example, a memoized fibonacci function returns instantly on repeat calls. This brings us to invalidation."
**Fix:** "A memoized fibonacci returns instantly on repeat calls. The hard part is knowing when the stored answer went stale." Two sentences, no scaffolding, and the second one is the thing worth saying.

The diagnostic: read only the first sentence of every paragraph. If each one announces its topic and none makes a claim, the template is running the piece.

### The Five-Paragraph Essay

Introduction, three body paragraphs, conclusion. This format screams "I'm fulfilling a structure." Let the content determine the shape.

**Slop:** an opening paragraph that lists the three things the piece will cover, three paragraphs covering them in that order, and a closing paragraph restating all three.
**Fix:** open on the claim, spend the length each point actually needs (one may take four paragraphs and another one sentence), and stop when the argument is finished. If a section can be cut without the argument losing anything, it was there to fill a slot.

### Recapping Before Answering

Restating the user's question before answering it. The user knows what they asked.

**Slop:** "You asked about implementing authentication in Next.js. Authentication is an important aspect of web development. Here's how to..."
**Fix:** Start with the implementation. Skip the recap.

**Not a tell when:** the question was ambiguous and the answer opens by naming the reading it took, in one clause ("Taking 'the config' to mean `config/http.ts`: ..."). That is information the reader needs to check the answer.

### Summary at the End

Restating everything that was just said, often starting with "In summary" or "To wrap up." The reader just read it.

**Fix:** Stop when the content is done. No conclusion paragraph unless it adds something new.

The closing message of an agentic session is the case that looks like this tell and is not. The reader there may have seen none of the intermediate tool output, so a final message that states what was found, what changed, what failed, and what was left undone carries information for the first time. The test is the same as everywhere else in this file: cut a sentence that restates what the reader has already read, and keep one that tells them something they have not.

## Tonal Anti-Patterns

### Performed Enthusiasm

Exclamation marks and excited language that doesn't match the content. Comes from RLHF training rewarding upbeat responses.

**Slop:** "This is a really exciting approach! Let's see how it works!"
**Fix:** "It works by..." (Let the content be exciting if it is.)

### Corporate Consultant Voice

Language that sounds like a McKinsey deck. Abstract, impressive-sounding, information-free.

**Slop:** "This represents a strategic opportunity to optimize our value delivery pipeline."
**Fix:** "We can ship faster if we fix the build step."

### The Helpful Assistant Tone

Overly accommodating, overly cautious, speaks to the user as if they might break.

**Slop:** "I should mention that this approach might have some potential drawbacks that could possibly affect performance in certain scenarios."
**Fix:** "This is slower on large datasets." (Be direct.)

### Emotional Flatness

Everything at the same emotional register. No humor, no surprise, no frustration, no personality. Every sentence sounds exactly as important as every other sentence.

**Slop:** "The migration completed successfully. Three records failed validation. The remaining 40,000 were imported. The failed records are in the error log."
**Fix:** "The migration went through. Three records failed validation, which is three more than it should be, and they are sitting in the error log; the other 40,000 are in." The 40,000 and the 3 are not equally interesting, and the prose should say which one you care about.

**Fix, generally:** Let some things be casual. Let some things be blunt. Vary the register.

### False Confidence

Asserting facts with certainty when the answer is uncertain. AI rarely says "I don't know" or "I'm not sure." It just states things.

**Slop:** "The timeout is 30 seconds by default, so the retry never fires before the request resolves."
**Fix:** "The default looks like 30 seconds, but I have not checked this version's config; if it is lower, the retry can fire while the first request is still open." The uncertainty is information, and hiding it costs the reader the one thing they needed to check.

**Fix, generally:** When uncertain, say so plainly. "I'm not sure about this" is better than a wrong answer stated with confidence.

### Performed Edginess

AI trying to sound casual, opinionated, or irreverent while maintaining perfectly structured prose. The tell is the contrast: the sentence structure is methodical (parallel clauses, clean enumeration, balanced rhythm) but the vocabulary is informal or snarky. Real casual writing has irregular structure. AI "casual" is polished writing wearing a t-shirt.

**Slop:** "Not the 'oh no you can tell AI wrote this' problems — the security holes, the inaccessible UIs, the eval() calls, and the fact that every landing page looks the same."
**Fix:** "It scans for security vulnerabilities, accessibility failures, and performance problems in AI-generated output."

The fix is boring. That's the point. A README intro should say what the tool does. The edgy framing adds personality that reads as manufactured because it is.

### Dismissing a Practice as Theater

Calling a practice theater (`security theater`, `growth theatre`, `process theater`) to dismiss it without saying what it fails to do. The word carries the verdict, so the sentence never has to show the gap between what the practice claims and what it achieves, and the reader is asked to share a sneer instead of a finding.

**Slop:** "Most of the quarterly review is `growth theatre`."
**Fix:** "The quarterly review shows the same three charts each time and never asks why trial sign-ups stopped rising."

Say what the practice fails to do and what that costs. The scanner rule is `theater-slop-phrase` (low, Pattern smell), on a practice word followed by theater or theatre in either spelling; a Title Case name such as a venue or a company is not the framing, and neither is a theater of operations.

### Equivocation ("Both Sides")

Presenting every topic as having two equally valid sides. Refusing to take a position.

**Slop:** "There are compelling arguments on both sides of this debate."
**Fix:** Take the position the evidence supports. Acknowledge the counterargument if it's real, not as a reflex.

## Formatting Anti-Patterns

### Headers for Short Responses

Adding markdown headers to a 3-sentence response. Headers serve navigation in long documents, not emphasis in short ones.

**Fix:** Use headers only when the response is long enough to need them (more than ~4 paragraphs on distinct subtopics).

### Bold for Emphasis

Bolding key words in running prose to highlight "important" parts. Reads like a textbook, not a person writing.

**Fix:** If the sentence is well-written, the emphasis is in the words themselves. Bold is for labels, definitions, and navigation -- not emphasis. A key term bolded on first use in a tutorial for beginners is teaching, not this tell (`SKILL.md` § Context Exceptions).

### Bullet Point Lists for Everything

Converting prose into bullet points. Bullets are for reference material (steps, lists of items). Explanations, arguments, and analysis belong in paragraphs. The listicle scaffold is the loud version: "5 ways to...", "7 signs you...", "3 reasons...". A numbered-listicle headline over what should be prose is a named tell.

**Fix:** Use bullets only for actually list-like content: steps, features, options, requirements. Never for arguments or explanations. Drop the "N ways to" framing and write the paragraph.

### Bolded Lead-In Labels

`**Performance:** the cache...`, `**Security:** all inputs are...`, `**Note:** this only applies...`, on every bullet of a list, so the list reads as a table with the labels bolded. Real but low-cited in the corpus (`empirical-rankings.md`: 0.8% regex share, 0.3% cited), and judged by clustering: one labelled bullet is a label, a list where every bullet carries one is the template.

**Slop:** "- **Speed:** the new index cuts query time. - **Safety:** the migration is reversible. - **Cost:** storage grows by 2 GB."
**Fix:** "The new index cuts query time, the migration is reversible, and storage grows by 2 GB." Or keep the bullets and drop the labels, which the sentences already carry.

### Admonition Boxes for Ordinary Sentences

A `> **Note:**` callout, a `:::tip` block, or a bold "Important:" lead-in wrapped around a sentence that is not a warning. Generated documentation reaches for the box because it looks like documentation; the reader gets a page where every third paragraph shouts. An admonition marks a sentence the reader must not miss (data loss, a security boundary, a step that cannot be undone), and a page has few of those.

**Slop:** "> **Note:** The config file is located at `config/app.yml`."
**Fix:** "The config file is `config/app.yml`." Keep the box for the sentence about the command that deletes the database.

### Excessive Code Blocks

Wrapping non-code content (commands, file paths, single values) in code blocks when inline code would do. Or wrapping everything in code blocks.

**Fix:** Use inline code for short references (`filename.txt`, `--flag`). Use code blocks only for multi-line code or commands that should be copied.

### Emoji Abuse

AI inserts emoji everywhere: as bullet points, section headers, status indicators, variable names, commit messages, log output, UI labels, code comments, and error messages. This is one of the most pervasive AI tells.

Common offenses:
- Emoji as list markers ("✅ Done", "🚀 Deploy", "📦 Package")
- Emoji in commit messages ("✨ Add feature", "🐛 Fix bug")
- Emoji in code comments (`// 🔥 Hot path` or `// ⚠️ Warning`)
- Emoji in variable/function names (`const 🎯target` or CSS class `.card-✨`)
- Emoji in console.log output (`console.log('🟢 Server started')`)
- Emoji in UI strings as status indicators instead of proper icons/text
- Emoji in error messages ("❌ Something went wrong")
- Emoji in README headers and documentation sections

**Fix:** No emoji anywhere unless the user explicitly uses them and the context calls for matching their style. Use words for status ("PASS", "FAIL", "WARNING"), text for headings, proper icon components for UI, and conventional prefixes for commits. Emoji are decorative noise that adds zero information and marks output as AI-generated.

**How the scanner grades it.** Severity escalates with the count: a handful is low, more than five is medium, because one glyph in a CLI banner is a choice and twenty across a file is the house style. An emoji is what Unicode renders as one: a character with default emoji presentation, a pictograph forced to emoji presentation by U+FE0F, a keycap sequence, or a flag, with a joined sequence (a family, a flag built from parts) counted once. Typographic arrows, the command-key symbol, heavy check marks, and geometric shapes are text and are not matched; the block list that once matched them flagged 187 plain right arrows across one fleet in two weeks. A bare play or pause sign used as a control is the `media-control-glyph` tell instead, which runs on web and Apple surfaces alike. A file that is *about* emoji, this one included, is guarded by the word appearing in it, because a catalogue that cannot quote its own examples is not a catalogue. `console-log-emoji` covers the log-output leg separately, since a glyph in a log line survives longer than one in a comment and breaks more parsers.

### Markdown in Non-Markdown Contexts

Using markdown formatting in contexts that don't render it (emails, chat messages, commit messages).

**Fix:** Match the formatting to the medium.

### Horizontal-Rule Dividers

Dropping `---`, `***`, or `___` rules between every section. Named as "another obvious AI writing marker" — recent Claude models throw them in constantly. A horizontal rule is for a genuine thematic break, not as connective tissue between paragraphs.

**Fix:** Use a paragraph break. Reserve the rule for a real section boundary in a long document.

### Forced Title Case on Every Heading

Every heading capitalised as a title, including ones that are plainly sentences: "How To Configure The Cache", "What This Means For Your Team". The tell is not title case itself; it is title case applied by reflex to headings that are questions or clauses, and applied at a depth where nobody does it by hand (an `h4` reading "Why This Matters" in a document whose `h2`s are sentence case).

**Slop:** `### Adding A New Rule To The Scanner`
**Fix:** `### Adding a new rule to the scanner`

**Judgment note, and the reason there is no rule for this.** Title case is a legitimate house style. The Chicago and AP conventions are title case, and plenty of documentation sites apply it deliberately at every level. The tell is **inconsistency with the surrounding document**, which a single-file pattern match cannot judge and a reader can see instantly. Check the document's own other headings before writing this finding, and drop it if they agree.

### Leaked Model Tooling Tokens

Vendor-internal citation and tooling markup left in the output: `oaicite`, `contentReference`, `attributableIndex`, `turn0search0`, `[cite: 1]`, `grok_card`, `ppl-ai-file-upload`. These are not stylistic tells. They are machine tokens that a person could not have typed, and one of them is proof of provenance in a way no vocabulary choice ever is.

**Slop:** "The timeout defaults to 30 seconds :contentReference[oaicite:3]{index=3}."
**Fix:** "The timeout defaults to 30 seconds." Delete the token; if it was standing in for a real citation, write the real citation.

The scanner matches these as `model-tooling-artifact` at high severity, presence-flagged, in prose and in code alike. They sit alongside § Leftover Chat Artifacts in `code-patterns.md`: same class, different vocabulary. Do not confuse them with real markup that happens to look similar. A `:::note` admonition, a `[1]` footnote reference, and a variable named `attributedString` are all ordinary and none of them matches.

## Sentence-Level Anti-Patterns

### First-Word Fingerprints

The class, not the list. Individual openers ("Certainly!", "Absolutely!", "That's a great question!", "I'd be happy to help!") are in `banned-phrases.md` and in the scanner's phrase list, but the tell generalises past any list: **the first word of a generated response is drawn from a small pool, and the pool is model-specific.** Reflexive agreement ("You're right", "Exactly"), reflexive enthusiasm ("Perfect!", "Love this"), and reflexive framing ("Sure thing", "Happy to") all belong to it, and new members appear with every model release.

The test is positional and does not need a list: **read the first three words alone. Do they carry information?** If they could be deleted without the reader losing anything, they are the fingerprint, whatever the words happen to be this month.

**Slop:** "Great question! The timeout lives in `config/http.ts`."
**Slop:** "You're absolutely right to check that. The timeout lives in `config/http.ts`."
**Fix:** "The timeout lives in `config/http.ts`."

Brief acknowledgment is not this tell. "Sure." before a real answer is conversational; "Great question!" before the same answer is a filler slot the model fills by habit.

### Participial Sentence Openers

Starting a sentence with an `-ing` phrase: "Building on this, the team...", "Having reviewed the data, we...", "Considering the constraints, the approach...". Measured at roughly two to five times the human rate in generated prose, which makes it the mirror image of the trailing form in § -ing Appended Analysis below: the same construction, moved to the front.

**Slop:** "Building on the previous release, the migration adds three indexes."
**Fix:** "The migration adds three indexes." The participle attaches the sentence to whatever came before, which is a transition, and most sentences do not need one.

**Judgment note.** The construction is correct English and every writer uses it. This is a concentration tell: one is invisible, and three in a page is the rhythm. It has no scanner rule for the same reason (the false-positive rate on a single-occurrence match would be near-total), so it lives on the semantic read.

### The "From X to Y" Sweep

"From startups to enterprises." "From onboarding to offboarding." "From simple scripts to complex pipelines." The construction performs coverage: it asserts a range without naming what is in it, and the two endpoints are almost always the two most obvious ones.

**Slop:** "From small teams to large organizations, everyone benefits from better tooling."
**Fix:** "A four-person team gets the same speedup as a four-hundred-person one." Or delete the framing and name the one case that matters.

**Slop:** "It handles everything from authentication to authorization."
**Fix:** "It handles authentication and authorization." The sweep added a preposition and no information.

### False Agency and Personification

Abstractions given verbs that only people have. Data "tells a story". Decisions "emerge". The architecture "wants" something. Numbers "reveal" and metrics "suggest". Each one hides who did the thing, which is the same defect as § Passive Voice with an extra flourish.

**Slop:** "The data tells a compelling story about user behavior."
**Fix:** "Seventy percent of sessions end on the pricing page." The data does not narrate; you read it, and what you read is the sentence worth writing.

**Slop:** "A consensus emerged that the API should be versioned."
**Fix:** "Priya and Sam argued for versioning the API and nobody objected."

**Slop:** "The code wants to be structured this way."
**Fix:** "I structured it this way because the parser and the formatter both need the token list."

The exception is live metaphor a writer chose. "The build is angry at me again" is a joke with an author; "the data suggests" is a slot filler. The test is whether removing the personification loses anything.

### Wh- Openers

Starting too many sentences with What, When, Where, Which, Who, Why, How. Reads like a FAQ.

**Fix:** Lead with the subject or verb. Restructure for directness.

### Copula Avoidance

Using elaborate verbs instead of "is" or "has." "Serves as" instead of "is." "Features" instead of "has."

**Fix:** Use "is" and "has" when they're the right words. Simple verbs are fine.

### Elegant Variation

Using different synonyms for the same thing to avoid repetition. "The function," "the method," "the routine," "the procedure" all meaning the same function. This confuses readers -- they wonder if these are different things.

**Fix:** Repeat the same word if it means the same thing. Repetition is clear. Variation creates ambiguity. The exception is when the words mean different things: a function and the method that wraps it are two things and get two names.

### -ing Appended Analysis

Tacking present participle phrases onto the end of sentences: "...highlighting the importance of," "...underscoring the need for," "...reflecting a broader trend."

**Fix:** Make it a separate sentence or delete it. These danglers add nothing.

### Passive Voice

"Was implemented," "has been shown," "can be achieved." Hides the actor.

**Fix:** Name who did it. "We implemented," "The study showed," "You can achieve."

**Not a tell when:** the agent is unknown ("the server was compromised"), irrelevant ("the bill was passed"), or the patient is the topic of the paragraph. The tell is the passive that hides an actor the reader needs.

### Uniform Sentence Length

Every sentence roughly the same length. AI tends to produce medium-length sentences consistently. No short punches. No long, winding explorations.

**Fix:** Vary on purpose. A four-word sentence after a thirty-word one creates rhythm. A one-sentence paragraph creates emphasis.

## Meta-Patterns

### Temporal Flatness

AI text says "in recent years" instead of naming a year. "Some researchers" instead of naming them. "A growing body of evidence" instead of citing papers. This vagueness about time, attribution, and specifics distinguishes AI from informed human writing.

**Slop:** "In recent years, a growing body of evidence has shown that some researchers find AI-generated pull requests harder to review."
**Fix:** "Google's 2025 DORA report put review time up 91% on teams at high AI adoption." One date, one source, one number, and the sentence is now checkable.

**Fix, generally:** Name the year. Name the person. Cite the specific paper. If the specifics aren't known, say so directly rather than hiding behind vague attribution. Never invent a citation to satisfy this rule: a hallucinated paper is a worse tell than a vague one, the reader can check it, and "I could not find the source for this" stated plainly is the honest form.

### The Knowledge-Style Mismatch

AI combines deep domain knowledge with a writing style no expert in that domain would use. A real neurosurgeon doesn't explain neurosurgery with bullet points and encouraging sign-offs. The mismatch between knowledge depth and presentation style is a strong tell.

**Slop:** "Great question! Let's break down cache coherence: **MESI protocol** handles this through four states. Hope that clears things up!"
**Fix:** "MESI gives each line four states, and the invalidate traffic is what kills you once more than four cores share a line." Someone who works on this writes about the part that bites, not the part that fits a slide.

**Fix, generally:** Match the style to the domain. Technical content gets technical style. Casual questions get casual answers.

### The Confident Generalist

AI writes about every topic with the same level of confidence and the same tone. A human expert writes about their field with casual mastery and about unfamiliar fields with visible uncertainty. AI lacks this variation.

**Slop:** the same measured, evenly-hedged paragraph shape applied to Postgres index selection, to eighteenth-century naval logistics, and to the writer's own product.
**Fix:** write the thing you know from the inside, with the shortcuts and irritations that come with it, and say "I am reading this off Wikipedia" about the thing you do not. The shift between the two is the signal.

**Fix, generally:** When writing about uncertain territory, say so. Modulate confidence to match actual knowledge depth.

### Absence of Imperfection

Human writing naturally contains colloquialisms, incomplete thoughts, opinions stated without hedging, humor, sarcasm, and personal references. The near-total absence of these is itself a tell. AI text is "too clean."

**Slop:** "This approach offers several advantages while introducing certain trade-offs that should be carefully considered."
**Fix:** "It is faster and I do not love how much state it keeps, but nothing else finished in under a second." An actual opinion, stated flat, is the thing generated prose keeps sanding off.

**Fix, generally:** Write in the register the piece needs (`choosing-with-intent.md`). In a casual or conversational register that means contractions, an opinion stated flat, and a rough edge left in; in a formal specification it means none of those, and the formality is not a tell. A slightly imperfect voice sounds human; a perfectly polished one sounds generated. Note the failure mode on the other side: manufactured roughness is § The Over-Corrected Register below, and it reads as generated just as fast.

### The Over-Corrected Register (Trying Not to Sound Like AI)

The mirror of this whole catalog, and a real tell in its own right. As writers learned the 2024 markers, a second default appeared: prose visibly straining not to read as AI. It reads as a machine trying not to look like a machine just as fast as the thing it avoids. Naming it matters because an anti-slop pass that only removes the old tells pushes writing straight into this one.

What it looks like:
- Staccato three-word fragments on every beat — uniform in a new way
- Forced lowercase or dropped capitals in otherwise-standard context
- A "here's the thing" / "look" / "real talk" cold open bolted onto formal content
- Profanity or "lol" dropped in to seem off-the-cuff against an otherwise polished register
- Conspicuous em-dash avoidance: every dash swapped for an ellipsis or colon, or a sentence contorted around the gap
- Deliberately inserted typos to beat detectors

**Fix:** do not over-apply the rules. The fix for an em dash is a comma or period in a sentence you would actually write, not an ellipsis or a contortion. The fix for the smooth, voiceless paragraph is a real voice — pick a register and commit (see `choosing-with-intent.md`) — not the absence of voice dressed up as casual. Vary sentence length for real, long sentences included. If a casual marker is not native to the register you chose, cut it.

## Short-Form Registers

Everything above this section is shaped for articles and essays. An agentic development tool emits almost none of those. It emits commit messages, PR bodies, changelog entries, and code-review comments, and those are the highest-volume prose in the entire workflow. They have their own tells, and `SKILL.md` § Context Exceptions exempts "instruction documents" from the formatting rules, which a reader can easily over-extend to cover a PR body. It does not: a PR body is prose someone has to read, and every rule here applies to it.

The register is `choosing-with-intent.md`'s conversational-professional: plain, direct, no throat-clearing, no warmth performed for its own sake.

### Commit Messages

- **The body restates the diff.** "Updated the `parseConfig` function to accept an optional `strict` parameter and updated its three callers." The diff already says that. Say why the parameter exists.
- **Emoji prefixes.** Only where the project's own history uses them (`SKILL.md` § Formatting states the exception and its limit).
- **Filler subject lines.** "Various improvements", "Minor fixes", "Update files".

**Slop:** `Refactor: improve error handling in the sync worker for better reliability`
**Fix:** `sync: retry on 429 instead of dropping the batch` plus a body sentence naming the incident that prompted it.

### PR Bodies

- **The `## Summary` / `## Changes` / `## Test plan` template on a three-line change.** Headings are navigation; a PR nobody needs to navigate does not need them.
- **The bullet list that is the file list.** If the reviewer can get it from "Files changed", it is not a description.
- **"This PR does X. It also does Y. Additionally, it does Z."** The recap shape from § Summary at the End, transplanted.
- **Confidence with no evidence.** "Thoroughly tested" without saying what was run.

**Slop:** "## Summary\nThis PR introduces a robust caching layer to significantly improve performance.\n## Changes\n- Added cache.ts\n- Updated api.ts"
**Fix:** "Adds a 60-second cache in front of `/api/prices`. p95 on the dashboard drops from 1.4s to 180ms. `cache.ts` is new; `api.ts` calls it. Cache is keyed on realm id only, so a stale price survives at most a minute, which the pricing team signed off on."

### Changelog Entries

- **Emoji-bulleted feature lists**, and a sparkle glyph after a `feat:` prefix. See § Emoji Abuse above for the full set.
- **Marketing copy in a technical file.** "We're excited to announce a powerful new way to..."
- **Entries written from the author's side.** "Refactored the store module" tells a user nothing. Write what changed for them.

**Slop:** `- [sparkle] Enhanced the scanning experience with powerful new capabilities`
**Fix:** `- scan now accepts multiple files and exits 1 on any finding`

### README Openers

- **A feature list before a sentence about what the thing is.** "## Features" with eight bullets, each starting with an emoji or a bolded label, above a paragraph that never says what the project does or who it is for.
- **A badge row as the first line.** Build, coverage, version, license, and a chat badge before a single word of prose.
- **Marketing register on a tool.** "Blazing fast", "batteries included", "the modern way to".

**Slop:** "# Widgetizer\n\n[build] [coverage] [npm] [license]\n\n## Features\n- Blazing fast\n- Zero config\n- Fully typed"
**Fix:** "Widgetizer turns a Figma frame into a React component. It reads the frame over the Figma API and writes one file per component, with the tokens the frame uses." Say what it does, who it is for, and the one command that runs it; the badges can follow.

### Code-Review Comments

- **The sycophantic opener, in its native habitat.** "Great catch!", "Nice work on this!", "Love this approach!" before the actual comment. `banned-phrases.md` § Sycophantic Openers bans the class rather than these three phrases, and the scanner matches "Good catch!" and "Great catch!" in a source file as `chat-artifact`; the surface is worth naming because it is where they survive longest.
- **Hedging that hides the ask.** "Might be worth considering possibly extracting this?" Either it should change or it should not.
- **Restating the code back to the author.** They wrote it.
- **Praise with no object.** "This looks good to me" on a 900-line diff is a rubber stamp wearing a comment.

**Slop:** "Great catch on the null check! I wonder if it might potentially be worth considering whether we could maybe extract this into a helper?"
**Fix:** "This block is repeated in `sync.ts` at line 40. Worth a helper, or leave it until there is a third." State the observation, then the ask, then the option to decline.

### Agent Closing Messages

The last message of an agentic session is the one the person reads, often without having seen any of the tool output. § Summary at the End says why it is the deliverable rather than a recap. Its own tells:

- **Verification claimed, not shown.** "All tests pass" with no command and no result line. The reader cannot tell a run from a guess, and the guess is the more common of the two.
- **A next-steps list that hands back work the request covered.** "Next steps: wire the handler, add the migration." That list is the unfinished half of the task, and writing it down is stopping short dressed as planning. Work that genuinely needs the owner (a credential, a product decision) is named as such, with the reason.
- **A recap of tool output the reader already saw**, or a restatement of the plan before the result.
- **The trailing offer** ("Let me know if you'd like me to..."), which `banned-phrases.md` § Sycophantic Openers covers and which survives longest here.

**Slop:** "I've implemented the upload feature! All tests pass. Next steps: add error handling to the upload path and update the docs. Let me know if you'd like me to do that!"
**Fix:** "The upload path now rejects files over 10 MB with a 413 (`upload.ts:42`). `node --test test/upload.test.mjs`: 14 passed. Not done: the docs still say 5 MB; I left them because the limit is under discussion in #212." What changed, what was run with its result, what was left and why.

## Creative Writing Tells

When generating fiction, narrative, or creative content:

- **Purple prose:** Over-reliance on ornate "literary" language.
- **Sensory checklist:** Mechanically touching on all five senses.
- **Emotional telling:** "She felt a profound sense of sadness" instead of showing sadness through action.
- **Character action cliches:** Characters sigh, take deep breaths, and stare out windows at inhuman rates. Eyes are constantly "glistening," "sparkling," or "widening." Lips "curl," "purse," or "tremble."
- **Safe resolution:** Every story ends with a pat emotional resolution or obvious twist. No genuine darkness, moral ambiguity, or discomfort.
- **AI fiction vocabulary:** `whispering`, `tendrils`, `etched`, `nestled`, `palpable`, `symphony` (metaphor), `kaleidoscope` (metaphor), `gossamer`, `iridescent`, `luminous`, `ephemeral`, `ethereal`, `cascade` (metaphor), `ember`, `silhouette`, `enigmatic`.

**Fix:** Show don't tell. Let characters act rather than emote. Avoid wrapping every story in a bow. Use specific, surprising details rather than stock descriptions.

In fiction the register decides. A story told in a lush voice may use any of these on purpose, and a lone `nestled` is the author's word. The tell is the stock set arriving together where nothing specific was seen. `banned-words.md` § Creative Writing carries the word list under the same rule.
