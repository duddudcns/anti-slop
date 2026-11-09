// Cross-file doctrine pairs. Each names two passages (file, a substring that locates the
// paragraph, plus an optional `locateBefore` for the wording an earlier release used, so the
// same pair can be scored on a base checkout) and the situation in which they might conflict. The audit script resolves the
// substrings to full paragraphs so Jev sees the real text.
export const PAIRS = [
  {
    id: "goal-vs-authenticity",
    situation: "the reader is scoring a piece of prose that is correct, clear, and secure but reads as machine-written",
    a: { file: "SKILL.md", locate: "The goal is correct, secure, accessible output, not hiding AI involvement." },
    b: { file: "agents/slop-detector.md", locate: "**Authenticity** (3/10: multiple banned words" },
  },
  {
    id: "readme-instruction-doc-vs-user-facing",
    situation: "the reader is writing the README of a public open-source project",
    a: { file: "SKILL.md", locate: "**Instruction documents** (CLAUDE.md, README, config docs)" },
    b: { file: "SKILL.md", locate: "The writing rules govern user-facing prose: UI copy and microcopy" },
  },
  {
    id: "words-never-vs-concentration",
    situation: "the reader writes one sentence containing the word 'leverage' in otherwise plain prose",
    a: { file: "references/banned-words.md", locate: "Ordinary words with an inflated sense. The scanner flags them at low severity", locateBefore: "Avoid these in general prose. Do not always pick the first alternative listed" },
    b: { file: "references/banned-words.md", locate: "**Concentration caveat:**", locateBefore: "**Concentration caveat (important):**" },
  },
  {
    id: "phrases-never-vs-clustering",
    situation: "the reader writes 'That said, the second option is cheaper' once in a memo",
    a: { file: "references/banned-phrases.md", locate: "- **Plain-word preferences.** Filler, transitions", locateBefore: "Phrases that identify text as AI-generated. Never use any of these in general prose." },
    b: { file: "references/banned-phrases.md", locate: "Everything else here is judged in context and by clustering" },
  },
  {
    id: "active-voice-throughout-vs-passive-ok",
    situation: "the reader writes 'The server was compromised on Tuesday' in an incident report",
    a: { file: "references/self-check.md", locate: "- [ ] Active voice by default?", locateBefore: "- [ ] Active voice throughout?" },
    b: { file: "SKILL.md", locate: "Passive voice is fine when the agent is unknown" },
  },
  {
    id: "bold-never-vs-pedagogical",
    situation: "the reader writes a tutorial for beginners and bolds a key term",
    a: { file: "references/self-check.md", locate: "- [ ] No bold used for emphasis in running prose? (A key term", locateBefore: "- [ ] No bold used for emphasis in running prose?" },
    b: { file: "SKILL.md", locate: "**Pedagogical/teaching contexts**: hand-holding phrases" },
  },
  {
    id: "warm-colors-vs-tasteful-default",
    situation: "the reader is choosing a palette for a new site with no brand and picks a cream background with a terracotta accent",
    a: { file: "references/design-patterns.md", locate: "**Instead:** Anchor the palette on the brand", locateBefore: "**Instead:** Choose colors based on the project's brand and purpose. Use warm colors" },
    b: { file: "references/design-patterns.md", locate: "**The signal is the combination.** Two distinct legs together are the strong tell", locateBefore: "**The signal is the combination.** Any two of {cream background, serif display, warm accent}" },
  },
  {
    id: "serif-suggested-vs-serif-tell",
    situation: "the reader is choosing a heading typeface for a new site with no brand and picks Fraunces",
    a: { file: "references/design-patterns.md", locate: "**Instead:** A pairing chosen for a reason", locateBefore: "**Instead:** Pick fonts that match the project's personality. Consider serif fonts, display fonts" },
    b: { file: "references/design-patterns.md", locate: "The counterpart trap is on the other side. Steering off Inter and landing on Instrument Serif or Fraunces" },
  },
  {
    id: "helper-once-checklist-vs-skill-exception",
    situation: "the reader extracts a forty-line block with one caller into a named function so the caller reads as three steps",
    a: { file: "references/self-check.md", locate: "- [ ] No trivial helper used exactly once?", locateBefore: "- [ ] No helper functions used exactly once?" },
    b: { file: "SKILL.md", locate: "No trivial helper used once; a function earns its name by a second caller or by being complex enough to deserve one." },
  },
  {
    id: "contractions-vs-formal-register",
    situation: "the reader is writing a formal specification",
    a: { file: "references/writing-patterns.md", locate: "**Fix, generally:** Write in the register the piece needs", locateBefore: "**Fix, generally:** Write naturally. Use contractions. Leave in some rough edges." },
    b: { file: "references/choosing-with-intent.md", locate: "| Formal | papers, briefs, specs | no contractions" },
  },
  {
    id: "emdash-cut-vs-threshold",
    situation: "the reader has written a 900-word article with three em dashes used as parenthetical insertions",
    a: { file: "references/writing-patterns.md", locate: "**Fix, when the density is over the scanner's threshold", locateBefore: "**Fix:** cut it \u2014 use a comma, a period, or parentheses." },
    b: { file: "SKILL.md", locate: "Do not self-check against a lower number; correcting below the measured threshold" },
  },
  {
    id: "adverbs-delete-vs-conversational",
    situation: "the reader writes 'I just need the port number' in a chat reply",
    a: { file: "references/banned-words.md", locate: "Delete these in polished expository prose when the sentence says the same thing without them.", locateBefore: "These adverbs add nothing in polished prose. Delete them" },
    b: { file: "SKILL.md", locate: "Brief acknowledgment (\"Sure.\" \"Of course.\" \"Right.\") is fine when the tone calls for it." },
  },
  {
    id: "no-emoji-any-context-vs-user-first",
    situation: "the user opened with three emoji and asked for a playful reply",
    a: { file: "references/writing-patterns.md", locate: "**Fix:** No emoji anywhere unless the user explicitly uses them" },
    b: { file: "SKILL.md", locate: "No emoji in any context: not in prose, not in code comments" },
  },
  {
    id: "rule-of-three-vs-three-fine",
    situation: "the reader has a list that genuinely has three items",
    a: { file: "SKILL.md", locate: "Vary sentence length on purpose:", locateBefore: "Don't force lists to exactly three items, and don't artificially avoid three either." },
    b: { file: "references/self-check.md", locate: "- [ ] Not forcing lists to exactly three items? (If every list has three items, something is wrong.)" },
  },
  {
    id: "over-validation-review-vs-generate",
    situation: "the reader is reviewing a pull request that adds a null check at an API boundary",
    a: { file: "references/empirical-rankings.md", locate: "| Over-defensive validation (null checks for impossible cases) | Inflated, ~40%." },
    b: { file: "SKILL.md", locate: "A catch block swallows an error when it neither rethrows", locateBefore: "No null checks for values the type system guarantees (but do check at trust boundaries)." },
  },
  {
    id: "test-fix-vs-never-modify",
    situation: "a failing test asserts on a status code the spec changed last week",
    a: { file: "references/regression-patterns.md", locate: "- Never modify a test's assertions to match incorrect code behavior" },
    b: { file: "references/regression-patterns.md", locate: "- The default assumption is that the code is wrong, not the test. Exceptions:" },
  },
];
