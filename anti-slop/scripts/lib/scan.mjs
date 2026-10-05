import { extname, isAbsolute, relative, sep } from "path";
import { realpathSync } from "fs";
import { loadProjectConfig } from "./store.mjs";
import {
  BANNED_WORDS,
  BANNED_WORD_REGEXES,
  LOW_CONFIDENCE_WORDS,
  BANNED_PHRASES,
  DESIGN_PATTERNS,
  CODE_PATTERNS,
  TEXT_CONSTRUCTS,
  NATIVE_PATTERNS,
  VB_PATTERNS,
  VB_EXTENSIONS,
  CONTEXT_EXCEPTION_REGEXES,
  ESCAPE_HATCH,
  EMDASH_MIN_COUNT,
  EMDASH_MIN_DENSITY,
  EMOJI_REGEX,
  EMOJI_FILE_GUARD,
  EMOJI_ESCALATE_COUNT,
  PROSE_EXTENSIONS,
  PROSE_SCOPES,
  DEFAULT_PROSE_SCOPE,
  CODE_SURFACE_EXTENSIONS,
  WEB_SURFACE_EXTENSIONS,
  NATIVE_UI_EXTENSIONS,
  CONCENTRATION,
  BANNED_WORD_CONFIDENCE,
  BANNED_PHRASE_CONFIDENCE,
  EMDASH_CONFIDENCE,
  EMOJI_CONFIDENCE,
  BANNED_WORD_FIX,
  BANNED_PHRASE_FIX,
  EMDASH_FIX,
  EMOJI_FIX,
} from "./rules.mjs";

// ── Concentration gate ──
// A rule declaring mode CONCENTRATION reports nothing until its match count reaches
// minCount. Below the threshold the technique was used once, which is a choice, not a
// pattern -- reporting it is the false positive that trains people to ignore the scanner.
function meetsThreshold(pat, count) {
  if (count === 0) return false;
  return pat.mode === CONCENTRATION ? count >= pat.minCount : true;
}

// ── Prose noise-stripping: keep only the author's own prose. Blanks fenced code,
// inline code, double-quoted spans, blockquotes, YAML frontmatter, and any line
// carrying the escape-hatch marker. Line count is preserved so line numbers hold. ──
function stripProseNoise(content) {
  const lines = content.split("\n");
  const out = [];
  let inFence = false;
  let inFrontmatter = false;
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (i === 0 && line.trim() === "---") { inFrontmatter = true; out.push(""); continue; }
    if (inFrontmatter) { if (line.trim() === "---") inFrontmatter = false; out.push(""); continue; }
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; out.push(""); continue; }
    if (inFence) { out.push(""); continue; }
    if (/^\s*>/.test(line)) { out.push(""); continue; }
    if (ESCAPE_HATCH.test(line)) { out.push(""); continue; }
    line = line.replace(/`[^`]*`/g, " ").replace(/"[^"\n]*"/g, " ");
    out.push(line);
  }
  return out.join("\n");
}

const LEADING_COMMENT = /^\s*(\/\/|#|\*|\/\*|<!--|--)/;
const TRAILING_COMMENT = /(?:\/\/|\/\*|<!--|#|--).*$/;

// ── Blank every string literal on a line ──
// A `//` inside "http://example" is not a comment marker, and a banned word inside a UI
// copy string is not a comment. Both are handled by removing the literals first.
function stripStringLiterals(line) {
  return line
    .replace(/`(?:\\.|[^`\\])*`/g, "``")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");
}

// ── Comment text only (for scanning code files for prose-style tells) ──
// Both comment shapes count: a whole line whose first token is a marker, and the tail of
// a line after an unquoted marker. Trailing comments are the most common comment form in
// real code, and scanning only full-line comments made every one of them invisible.
// Line count is PRESERVED (a line contributing no comment becomes ""), the same way
// stripProseNoise preserves it: a finding reports the line it was found on, and dropping
// the non-comment lines made every code-surface line number off by however many lines of
// actual code preceded the match. Blank lines change no match count.
function extractComments(content, isVb = false) {
  if (isVb) {
    const split = splitVbLines(content);
    return content.split("\n").map((l, i) => (ESCAPE_HATCH.test(l) ? "" : split[i].comment)).join("\n");
  }
  const out = [];
  for (const line of content.split("\n")) {
    if (ESCAPE_HATCH.test(line)) { out.push(""); continue; }
    if (LEADING_COMMENT.test(line)) { out.push(line); continue; }
    const tail = stripStringLiterals(line).match(TRAILING_COMMENT);
    out.push(tail ? tail[0] : "");
  }
  return out.join("\n");
}

// ── VB.NET: split every line into code and comment ──
// VB has no block comments: a comment is `'` outside a string literal, or REM at the start
// of a statement (line start or after `:`). The generic helpers cannot be reused -- they
// read `'` as a string delimiter and `#` as a comment, while in VB `#Region`/`#If` are
// directives and `#1/1/2020#` is a date literal. A VB string escapes `"` by doubling it,
// which the toggle handles for free, and since VB 14 a string may span lines, so the
// string state carries from one line to the next. `bare` is the code with string contents
// removed (quotes kept): the VB rules must not read `"a = True"` as a comparison. `code`
// keeps string contents (hardcoded-secret needs them) but masks the comment markers
// `//`, `/*`, `--`, `#`, `*` inside strings to `_`, so `"// TODO: implement"` is not a
// placeholder comment. A single `-` or `/` stays, so `"sk-..."` and base64 keys still match.
const VB_COMMENT_CHARS = new Set(["'", "‘", "’"]);
// The VB lexer also takes typographic double quotes as string delimiters.
const VB_QUOTE_CHARS = new Set(['"', "“", "”"]);
// Shared rules that key on a comment marker and so must not see markers inside strings.
const COMMENT_MARKER_RULES = new Set(["placeholder-comment", "narrating-comment", "apologetic-comment", "deferral-comment", "banner-comment"]);
// Shared rules whose tokens cannot occur in VB (`@ts-ignore`, `eslint-disable`, ...), so a
// hit can only be string text; the VB table carries the VB form (vb-warning-suppression).
const VB_REPLACED_RULES = new Set(["suppression-comment"]);

// Quote parity of a line's code part, read as if no string were open: a trailing comment
// may hold a lone `"` (`Sub F() ' "x`) and must not block string-state recovery.
// Returns the code part (so a trailing `' comment` does not defeat a `$`-anchored opener)
// and whether its quotes balance.
function vbCodeHead(text) {
  let open = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (VB_QUOTE_CHARS.has(ch)) open = !open;
    else if (!open && VB_COMMENT_CHARS.has(ch)) return { head: text.slice(0, i).trimEnd(), balanced: true };
  }
  return { head: text, balanced: !open };
}
// Case-sensitive on purpose: the VB editor normalizes keyword case, while prose writes a
// lower-case "as" ("Public transport as well"), and `As` must be followed by a type.
// Only openers that do not read as English prose ("For details...", "Return to menu" are
// common string text): directives, `End <block>`, declaration headers, Imports/Namespace,
// and Try/Catch/Finally in their statement shapes.
const VB_STATEMENT_START = /^\s*(?:#|End[ \t]+(?:Sub|Function|Property|Class|Module|Namespace|Try|If|Select|Using|With|While|Structure|Enum|Interface|Get|Set|SyncLock|Operator|Event|AddHandler|RemoveHandler|RaiseEvent)[ \t]*$|(?:(?:Private|Public|Protected|Friend|Shared|Overrides|Overridable|NotOverridable|MustOverride|MustInherit|NotInheritable|Partial|Async|Iterator|Shadows|Overloads|ReadOnly|WriteOnly|Default|WithEvents|Const)[ \t]+)*(?:(?:Sub|Function|Property|Operator|Event|Delegate[ \t]+(?:Sub|Function))[ \t]+[\w+\-*\/<>=&]+[ \t]*(?:\(|$|As[ \t]+[\w.]+)|(?:Class|Module|Structure|Enum|Interface)[ \t]+\w+[ \t]*(?:$|:[ \t]*(?:Inherits|Implements)\b))|(?:Private|Public|Protected|Friend)[ \t]+(?:(?:Shared|ReadOnly|WithEvents|Const)[ \t]+)*\w+[ \t]+As[ \t]+[\w.]+|Imports[ \t]+[\w.]+(?:[ \t]*=[ \t]*[\w.]+)?[ \t]*$|Namespace[ \t]+[\w.]+[ \t]*$|Try[ \t]*$|Finally[ \t]*$|Catch(?:[ \t]+\w+[ \t]+As[ \t]+[\w.]+|[ \t]*$))/;
function splitVbLines(content) {
  let inString = false;
  return content.split("\n").map((raw) => {
    const text = raw.replace(/\r$/, "");
    // Recovery: one stray `"` (XML literal text, an unterminated `#Region "x`) would
    // otherwise hide every later comment and finding. A line that opens with a statement
    // keyword cannot be the inside of a string, and directives never continue a string.
    // The line must also hold an even number of quotes, i.e. parse as a whole statement on
    // its own; `Return now"` closing a real multi-line string keeps the string state. Known
    // gap: a multi-line string whose continuation line itself reads as a statement.
    if (inString) {
      const { head, balanced } = vbCodeHead(text);
      if (balanced && VB_STATEMENT_START.test(head)) inString = false;
    }
    let bare = "";
    let code = "";
    // True at line start and after `:` until the next non-blank character.
    let atStatementStart = !inString;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (VB_QUOTE_CHARS.has(ch)) { inString = !inString; bare += '"'; code += ch; atStatementStart = false; continue; }
      if (inString) {
        const pair = ch + (text[i + 1] || "");
        if (pair === "//" || pair === "/*" || pair === "--") { code += "__"; i++; continue; }
        code += ch === "#" || ch === "*" ? "_" : ch;
        continue;
      }
      if (VB_COMMENT_CHARS.has(ch) || (atStatementStart && /^REM\b/i.test(text.slice(i, i + 4)))) {
        return { code, raw: text.slice(0, i), bare, comment: text.slice(i) };
      }
      code += ch;
      if (ch === ":") atStatementStart = true;
      else if (ch !== " " && ch !== "\t") atStatementStart = false;
      bare += ch;
    }
    if (/^\s*#/.test(text)) inString = false;
    return { code, raw: text, bare, comment: "" };
  });
}

// ── VB.NET lines with each comment rewritten to a `//` comment (line count preserved) ──
// `'''` XML doc comments and REM collapse to the same `// text`. Escape-hatched lines keep
// their marker, so countLinePattern still skips them.
// `masked` picks the string-masked code (for the comment-marker rules) or the raw code (for
// every other rule: hardcoded-secret's own exclusions for paths, `--flags` and `#colors`
// must see the real string).
function vbCommentNormalizedLines(content, masked = true) {
  const split = splitVbLines(content);
  // Hatched lines are rewritten too: the hatch token sits in the comment, so the rewritten
  // line still carries it and countLinePattern still skips it, while the dashboard's
  // suppressed count sees the same masked view the active path would have seen.
  return content.split("\n").map((l, i) => {
    const { comment } = split[i];
    const code = masked ? split[i].code : split[i].raw;
    if (!comment) return code;
    return `${code}// ${comment.replace(/^(?:REM\b|['‘’]+)[ \t]*/i, "")}`;
  });
}

// ── VB.NET code view for the cross-line VB rules (line count preserved) ──
// Comments and string contents are removed. An escape-hatched line becomes a placeholder
// statement rather than a blank: blanking it would empty a Catch body and turn the hatch
// into a new finding on another line. A line longer than VB_MAX_LINE (generated or
// minified code) becomes `_long_` so the lazy scans in VB_PATTERNS stay linear in practice.
const VB_MAX_LINE = 2000;
function vbCodeView(content) {
  const split = splitVbLines(content);
  return content
    .split("\n")
    .map((l, i) => {
      if (ESCAPE_HATCH.test(l)) return "_hatched_";
      const { bare } = split[i];
      // A placeholder, not a blank, for the same reason as `_hatched_`: a long statement
      // inside a Catch must not make the Catch look empty.
      return bare.length > VB_MAX_LINE ? "_long_" : bare;
    })
    .join("\n");
}

// ── Blank any line carrying the escape-hatch marker (preserves line count) ──
function stripEscapeHatchLines(content) {
  return content.split("\n").map(l => (ESCAPE_HATCH.test(l) ? "" : l)).join("\n");
}

// ── Mirror of stripEscapeHatchLines that KEEPS only the escape-hatched lines ──
function extractEscapeHatchedLines(content) {
  return content.split("\n").map(l => (ESCAPE_HATCH.test(l) ? l : "")).join("\n");
}

// ── File-scope guards (rules.mjs `requires` / `requiresMinCount` / `unless`) ──
// Evaluated ONCE per file, before the per-line loop: a rule whose file-level precondition
// fails never runs at all. A rule declaring neither field is always allowed.
export function fileGuardOk(pat, content) {
  if (pat.unless && pat.unless.test(content)) return false;
  if (pat.requires) {
    const found = content.match(globalize(pat.requires));
    if (!found || found.length < (pat.requiresMinCount || 1)) return false;
  }
  return true;
}

// ── Class-attribute token sets ──
// Utility-class order inside a `class=` attribute is arbitrary, so a fingerprint rule has
// to match the token SET, not a sequence. Scoped to one attribute value: a whole-line AND
// would match `class="rounded-xl"` on one element and `class="shadow-sm border"` on the
// next, which is two elements rather than one fingerprint.
const CLASS_ATTR = /\b(?:class|className)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*`([^`]*)`\s*\}|\{\s*"([^"]*)"\s*\}|\{\s*'([^']*)'\s*\})/g;

function classTokenSets(line) {
  const sets = [];
  const re = globalize(CLASS_ATTR);
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(line)) !== null) {
    const value = m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5] ?? "";
    sets.push(value.split(/\s+/).filter(Boolean));
  }
  return sets;
}

// One hit per class attribute whose token set contains every required token.
function countClassAll(line, required) {
  let hits = 0;
  for (const tokens of classTokenSets(line)) {
    const complete = required.every((req) =>
      typeof req === "string" ? tokens.includes(req) : tokens.some((t) => req.test(t)));
    if (complete) hits += 1;
  }
  return hits;
}

function globalize(re) {
  return re.flags.includes("g") ? re : new RegExp(re.source, re.flags + "g");
}

// ── Where a finding is (the remediation floor's other half) ──
// A finding that names no location is one the reader has to go looking for, which is the
// same failure as a finding that names no fix. Every violation object carries `line`: the
// 1-based line of its FIRST contributing match, counted against a haystack that preserves
// the original line count (stripProseNoise, extractComments and the per-line loops all do).
//
// A fresh RegExp per call rather than globalize(): exec() advances lastIndex, and the
// per-word and per-rule regexes are module-level objects shared across every scan.
function freshGlobal(re) {
  return new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
}

function lineAtIndex(text, index) {
  return text.slice(0, index).split("\n").length;
}

function firstMatchLine(text, re) {
  const m = freshGlobal(re).exec(text);
  return m ? lineAtIndex(text, m.index) : null;
}

function resolveSeverity(sev, count) {
  return typeof sev === "function" ? sev(count) : sev;
}

// ── Domain-context exception ──
// Word-start anchored (see rules.mjs CONTEXT_EXCEPTION_REGEXES). The old raw
// `contentLower.includes(entry)` was an unanchored substring test over the whole file, so
// the word "important" excused a banned word whose exception list contains "port", and
// "settings" excused one whose list contains "set", in almost every real document.
function hasContextException(lowerWord, contentLower) {
  const exceptions = CONTEXT_EXCEPTION_REGEXES.get(lowerWord);
  return Boolean(exceptions && exceptions.some((re) => re.test(contentLower)));
}

// ── Count regex matches per non-suppressed, non-escaped line ──
// Three counting shapes, in precedence order: `classAll` (unordered class-token set),
// `count` (a per-line predicate for tells whose arithmetic a regex cannot state -- see
// `token-drift-spacing`, which has to know that 13 is off a 4px grid and 16 is not), and
// the default `pattern` match count.
// Returns { count, line }: the total and the 1-based line of the first line that
// contributed to it, which is what the finding reports.
function countLinePattern(lines, pat) {
  const g = pat.classAll || pat.count ? null : globalize(pat.pattern);
  let count = 0;
  let line = null;
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i];
    if (ESCAPE_HATCH.test(text)) continue;
    if (pat.suppress && pat.suppress.test(text)) continue;
    let hits = 0;
    if (pat.classAll) hits = countClassAll(text, pat.classAll);
    else if (pat.count) hits = pat.count(text);
    else { const m = text.match(g); hits = m ? m.length : 0; }
    if (hits > 0 && line === null) line = i + 1;
    count += hits;
  }
  return { count, line };
}

// ── Suppressed-finding capture (opts.collectSuppressed) ──
// Mirror of stripProseNoise that KEEPS only the escape-hatched lines (blanking
// everything else, including fence/frontmatter/blockquote lines per the same
// precedence as the active path) so callers can measure what an escape-hatched
// line would have tripped had the marker not been there.
function extractEscapeHatchedProse(content) {
  const lines = content.split("\n");
  const out = [];
  let inFence = false;
  let inFrontmatter = false;
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (i === 0 && line.trim() === "---") { inFrontmatter = true; out.push(""); continue; }
    if (inFrontmatter) { if (line.trim() === "---") inFrontmatter = false; out.push(""); continue; }
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; out.push(""); continue; }
    if (inFence) { out.push(""); continue; }
    if (/^\s*>/.test(line)) { out.push(""); continue; }
    if (!ESCAPE_HATCH.test(line)) { out.push(""); continue; }
    line = line.replace(/`[^`]*`/g, " ").replace(/"[^"\n]*"/g, " ");
    out.push(line);
  }
  return out.join("\n");
}

// Mirror of extractComments that selects only the escape-hatched comment lines, and
// preserves the line count for the same reason it does.
function extractEscapeHatchedComments(content, isVb = false) {
  if (isVb) {
    const split = splitVbLines(content);
    return content.split("\n").map((l, i) => (ESCAPE_HATCH.test(l) ? split[i].comment : "")).join("\n");
  }
  return content.split("\n")
    .map(l => (/^\s*(\/\/|#|\*|\/\*|<!--|--)/.test(l) && ESCAPE_HATCH.test(l) ? l : ""))
    .join("\n");
}

// Mirror of countLinePattern that counts only escape-hatched lines. A suppress-regex
// guard still applies: if it matches, the rule would not have fired even without the
// escape hatch, so that hit is a rule-internal exclusion, not a suppressed finding.
function countLinePatternOnEscapedLines(lines, pat) {
  const g = pat.classAll || pat.count ? null : globalize(pat.pattern);
  let count = 0;
  let line = null;
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i];
    if (!ESCAPE_HATCH.test(text)) continue;
    if (pat.suppress && pat.suppress.test(text)) continue;
    let hits = 0;
    if (pat.classAll) hits = countClassAll(text, pat.classAll);
    else if (pat.count) hits = pat.count(text);
    else { const m = text.match(g); hits = m ? m.length : 0; }
    if (hits > 0 && line === null) line = i + 1;
    count += hits;
  }
  return { count, line };
}

// Additive-only: computes what WOULD have fired for two deliberate-suppression paths
// -- (a) escape-hatched lines, (b) an allowedWords config entry -- so the dashboard can
// show suppressed activity without ever touching the active `violations` array above it.
// Scope is the four rule families keyed by a stable violation `type`: banned-word,
// banned-phrase, design-tell, code-pattern. text-construct and emoji are deferred:
// their per-line escape semantics differ (density/whole-document rules), so counting
// a hatched line as one suppressed construct would misstate what was avoided.
function collectSuppressedViolations({ content, lines, vbRawLines, isProse, isCode, isVb, isStyle, isTestFile, proseScan, allowedWords, contentLower }) {
  const suppressed = [];

  // (a) escape-hatch: words/phrases/design/code hits confined to escape-hatched lines.
  if (isProse || isCode) {
    const hatchedText = isProse ? extractEscapeHatchedProse(content) : extractEscapeHatchedComments(content, isVb);
    for (const word of BANNED_WORDS) {
      const lw = word.toLowerCase();
      // Allowed words are counted under (b) against the active text; a hatched-only
      // occurrence of an allowed word is deliberately counted nowhere (double-suppressed).
      if (allowedWords.has(lw)) continue;
      if (hasContextException(lw, contentLower)) continue;
      const matches = hatchedText.match(BANNED_WORD_REGEXES.get(word));
      if (!matches) continue;
      const count = matches.length;
      const lowConf = LOW_CONFIDENCE_WORDS.has(lw);
      if (lowConf && count < 2) continue;
      suppressed.push({
        type: "banned-word", word, count,
        line: firstMatchLine(hatchedText, BANNED_WORD_REGEXES.get(word)),
        severity: lowConf ? "low" : "medium",
        confidence: BANNED_WORD_CONFIDENCE,
        fix: BANNED_WORD_FIX,
        desc: `Banned AI-tell word "${word}" found ${count}x`,
        suppressed: true, suppressedBy: "escape-hatch",
      });
    }
  }

  // Phrases mirror the active path on BOTH surfaces. Guarding this branch on isProse alone
  // meant an escape-hatched phrase in a code file could not even be reported as suppressed.
  if (isProse || isCode) {
    const hatchedHay = (isProse ? extractEscapeHatchedProse(content) : extractEscapeHatchedLines(content)).toLowerCase();
    for (const phrase of BANNED_PHRASES) {
      if (!phrase) continue;
      const firstIdx = hatchedHay.indexOf(phrase);
      if (firstIdx === -1) continue;
      let count = 0;
      let searchFrom = 0;
      let idx;
      while ((idx = hatchedHay.indexOf(phrase, searchFrom)) !== -1) {
        count++;
        searchFrom = idx + phrase.length;
      }
      const lineNum = hatchedHay.substring(0, firstIdx).split("\n").length;
      suppressed.push({
        type: "banned-phrase", phrase, line: lineNum, count,
        severity: "medium",
        confidence: BANNED_PHRASE_CONFIDENCE,
        fix: BANNED_PHRASE_FIX,
        desc: `Banned phrase "${phrase}" found ${count}x (first at line ${lineNum})`,
        suppressed: true, suppressedBy: "escape-hatch",
      });
    }
  }

  if (isStyle) {
    for (const pat of DESIGN_PATTERNS) {
      if (!fileGuardOk(pat, content)) continue;
      const { count, line } = countLinePatternOnEscapedLines(lines, pat);
      if (meetsThreshold(pat, count)) {
        suppressed.push({
          type: "design-tell", name: pat.name, count, line,
          severity: resolveSeverity(pat.severity, count),
          confidence: pat.confidence, mode: pat.mode,
          fix: pat.fix,
          desc: `${pat.desc} (${count}x)`,
          suppressed: true, suppressedBy: "escape-hatch",
        });
      }
    }
  }

  if (isCode) {
    for (const pat of CODE_PATTERNS) {
      if (isTestFile && pat.skipInTests) continue;
      if (isVb && VB_REPLACED_RULES.has(pat.name)) continue;
      if (!fileGuardOk(pat, content)) continue;
      // Same line view per rule as the active path (raw strings for non-marker VB rules).
      const patLines = isVb && !COMMENT_MARKER_RULES.has(pat.name) ? vbRawLines : lines;
      const { count, line } = countLinePatternOnEscapedLines(patLines, pat);
      if (meetsThreshold(pat, count)) {
        suppressed.push({
          type: "code-pattern", name: pat.name, count, line,
          severity: resolveSeverity(pat.severity, count),
          confidence: pat.confidence,
          fix: pat.fix,
          desc: `${pat.desc} (${count}x)`,
          suppressed: true, suppressedBy: "escape-hatch",
        });
      }
    }
  }

  // (b) allowedWords: uses the SAME active textToScan (hatch lines already excluded
  // there), so this never double-counts against (a).
  if ((isProse || isCode) && allowedWords.size > 0) {
    const textToScan = isProse ? proseScan : extractComments(content, isVb);
    for (const word of BANNED_WORDS) {
      const lw = word.toLowerCase();
      if (!allowedWords.has(lw)) continue;
      if (hasContextException(lw, contentLower)) continue;
      const matches = textToScan.match(BANNED_WORD_REGEXES.get(word));
      if (!matches) continue;
      const count = matches.length;
      const lowConf = LOW_CONFIDENCE_WORDS.has(lw);
      if (lowConf && count < 2) continue;
      suppressed.push({
        type: "banned-word", word, count,
        line: firstMatchLine(textToScan, BANNED_WORD_REGEXES.get(word)),
        severity: lowConf ? "low" : "medium",
        confidence: BANNED_WORD_CONFIDENCE,
        fix: BANNED_WORD_FIX,
        desc: `Banned AI-tell word "${word}" found ${count}x`,
        suppressed: true, suppressedBy: "allowed-words",
      });
    }
  }

  return suppressed;
}

// ── Prose scope (rules.mjs PROSE_SCOPES) ──
// Precedence: the caller's opts (the CLI flag), then ANTI_SLOP_PROSE_SCOPE, then the
// project config, then the default. An unrecognised value at any level is ignored rather
// than failing the scan, the same way a malformed config file reads as empty.
function resolveProseScope(opts, config) {
  for (const candidate of [opts.proseScope, process.env.ANTI_SLOP_PROSE_SCOPE, config.proseScope]) {
    if (PROSE_SCOPES.includes(candidate)) return candidate;
  }
  return DEFAULT_PROSE_SCOPE;
}

export function proseScope(opts = {}) {
  return resolveProseScope(opts, loadProjectConfig());
}

// A small glob dialect, enough for a config file: `**` crosses directories, `*` and `?`
// stay inside one segment, everything else is literal. Anchored to the whole path, so
// `docs/**` takes a directory, `**/*.md` takes every markdown file, and `README.md` takes
// the root README and nothing else. No dependency, and no `path.matchesGlob`, which
// still prints an experimental warning on Node 22. Case-insensitive, because the
// filesystems most projects sit on fold case and `README.md` has to opt in `Readme.md`.
export function globToRegExp(glob) {
  // `**/**/` is `**/`. Uncollapsed, each segment compiled to an optional greedy group and a
  // chain of them backtracked exponentially on a non-match (twelve segments: nine seconds
  // on a 42-character path, from the 2.3.1 review). A segment run compiles to whole
  // segments, `(?:[^/]+/)*`, which a `/` delimits and the engine cannot re-partition.
  const collapsed = String(glob).replace(/(?:\*\*\/)+/g, "**/").replace(/\*{3,}/g, "**");
  let source = "";
  for (let i = 0; i < collapsed.length; i++) {
    const c = collapsed[i];
    if (c === "*" && collapsed[i + 1] === "*") {
      i += 1;
      if (collapsed[i + 1] === "/") { i += 1; source += "(?:[^/]+/)*"; } else source += ".*";
    } else if (c === "*") {
      source += "[^/]*";
    } else if (c === "?") {
      source += "[^/]";
    } else {
      source += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${source}$`, "i");
}

function toPosix(p) {
  return String(p).split(sep).join("/").replace(/^\.\//, "");
}

// The path as the caller gave it, plus its project-relative form when it was absolute:
// `git diff --name-only` hands the CLI relative paths, an editor or a command hands it
// absolute ones, and one config has to match both. Both ends are also resolved through
// realpath, because macOS hands out symlinked temp and volume paths (/var, /tmp) while
// getcwd() returns the resolved form, and `relative()` across that seam yields `../..`.
function candidatePaths(filePath) {
  const paths = new Set([toPosix(filePath)]);
  if (!isAbsolute(filePath)) return [...paths];
  const roots = new Set([process.cwd()]);
  const targets = new Set([filePath]);
  try { roots.add(realpathSync(process.cwd())); } catch { /* cwd gone: the given path still counts */ }
  try { targets.add(realpathSync(filePath)); } catch { /* not on disk: an embedder scanning a buffer */ }
  for (const root of roots) {
    for (const target of targets) {
      const rel = relative(root, target);
      if (rel && !rel.startsWith("..") && !isAbsolute(rel)) paths.add(toPosix(rel));
    }
  }
  return [...paths];
}

// Exported for the CLI, which reports a skipped prose file as skipped rather than clean:
// a "clean" line claims the file was read.
export function proseScopeFor(filePath, opts = {}) {
  const prose = PROSE_EXTENSIONS.has(extname(filePath).toLowerCase());
  const config = loadProjectConfig();
  const scope = resolveProseScope(opts, config);
  if (!prose || scope === "all") return { scope, prose, inScope: true };
  const globs = Array.isArray(config.userFacingProse) ? config.userFacingProse : [];
  const paths = candidatePaths(filePath);
  const inScope = globs.some((glob) => {
    const re = globToRegExp(toPosix(glob));
    return paths.some((p) => re.test(p));
  });
  return { scope, prose, inScope };
}

// ── Scanner ──
// opts.proseScope ("user-facing" | "all", default per proseScopeFor): under "user-facing"
// a prose file the project has not opted in returns no findings at all, suppressed
// entries included, so nothing is scored or recorded for it.
// opts.collectSuppressed (default false): when true, additionally appends entries for
// findings that a deliberate suppression choice hid -- an escape-hatched line or an
// allowedWords config entry -- flagged { suppressed: true, suppressedBy }. Default-off
// behavior is byte-identical to calling scanContent(content, filePath) with no opts.
export function scanContent(content, filePath, opts = {}) {
  const violations = [];
  // Binary read as UTF-8 (a PNG, a font, an archive) decodes to replacement characters and
  // stray code points that satisfy Unicode property escapes; text never carries a NUL byte
  // and binary carries one within its first few bytes. No rule applies to it.
  if (content.includes(" ")) return violations;
  const ext = extname(filePath).toLowerCase();
  const isProse = PROSE_EXTENSIONS.has(ext);
  if (isProse && !proseScopeFor(filePath, opts).inScope) return violations;
  // Markup-with-script surfaces (.html/.htm/.vue/.svelte/.astro) are code surfaces too:
  // their <script> blocks are the most common home for the very defects the code table
  // exists to catch, and <img> -- the whole target syntax of img-no-dimensions -- lives
  // there and nowhere else.
  const isCode = CODE_SURFACE_EXTENSIONS.has(ext);
  // Design tells run on web surfaces only and native tells on Apple surfaces only. Before
  // this split every code extension got the web table, so a .swift or .py file was being
  // matched against Tailwind class names -- harmless while no rule happened to collide,
  // and a guaranteed false positive as soon as one did.
  const isStyle = WEB_SURFACE_EXTENSIONS.has(ext);
  const isNative = NATIVE_UI_EXTENSIONS.has(ext);
  const isVb = VB_EXTENSIONS.has(ext);
  // Test/fixture files carry fake creds, example.com, and innerHTML scaffolding -- skip the
  // security / dummy-data patterns there so real findings are not drowned in test noise.
  // VB has no `.test.` suffix convention: tests live in `*.Tests` projects or `*Tests.vb`.
  // Case-sensitive and plural on purpose: `Contest.vb`, `SelfTest.vb` and the production
  // interface `IuserTest.vb` are not test files.
  const isTestFile = /\.(test|spec)\.[mc]?[jt]sx?$|(^|\/)(__tests__|__mocks__|fixtures|e2e)\/|\.stories\.[mc]?[jt]sx?$/i.test(filePath)
    || (isVb && /(^|[\\/])(?:[^\\/]*\.)?Tests?[\\/]|Tests\.[vV][bB]$/.test(filePath));
  const config = loadProjectConfig();
  const allowedWords = new Set((config.allowedWords || []).map(w => w.toLowerCase()));
  const contentLower = content.toLowerCase();

  // Prose scans the author's own text with noise stripped; code scans comment lines.
  const proseScan = isProse ? stripProseNoise(content) : null;

  // ── Banned words ──
  if (isProse || isCode) {
    const textToScan = isProse ? proseScan : extractComments(content, isVb);
    for (const word of BANNED_WORDS) {
      const lw = word.toLowerCase();
      if (allowedWords.has(lw)) continue;
      if (hasContextException(lw, contentLower)) continue;
      const matches = textToScan.match(BANNED_WORD_REGEXES.get(word));
      if (!matches) continue;
      const count = matches.length;
      // Concentration rule: a lone low-confidence word is the writer's own prose, not a tell.
      const lowConf = LOW_CONFIDENCE_WORDS.has(lw);
      if (lowConf && count < 2) continue;
      violations.push({
        type: "banned-word",
        word,
        count,
        line: firstMatchLine(textToScan, BANNED_WORD_REGEXES.get(word)),
        severity: lowConf ? "low" : "medium",
        confidence: BANNED_WORD_CONFIDENCE,
        fix: BANNED_WORD_FIX,
        desc: `Banned AI-tell word "${word}" found ${count}x`,
      });
    }
  }

  // ── Banned phrases ──
  // Code scans the WHOLE file, not just comments: assistant boilerplate leaks into UI copy
  // strings and identifiers as readily as into comments, and an assistant-voice greeting left
  // in a copy constant ships to a user. Escape-hatched lines are removed on both surfaces --
  // routing code through the raw content was the one rule family the hatch did not reach.
  if (isProse || isCode) {
    const hay = (isProse ? proseScan : stripEscapeHatchLines(content)).toLowerCase();
    for (const phrase of BANNED_PHRASES) {
      if (!phrase) continue; // indexOf("") returns 0, which would loop forever below
      const firstIdx = hay.indexOf(phrase);
      if (firstIdx === -1) continue;
      let count = 0;
      let searchFrom = 0;
      let idx;
      while ((idx = hay.indexOf(phrase, searchFrom)) !== -1) {
        count++;
        searchFrom = idx + phrase.length;
      }
      const lineNum = hay.substring(0, firstIdx).split("\n").length;
      violations.push({
        type: "banned-phrase",
        phrase,
        line: lineNum,
        count,
        severity: "medium",
        confidence: BANNED_PHRASE_CONFIDENCE,
        fix: BANNED_PHRASE_FIX,
        desc: `Banned phrase "${phrase}" found ${count}x (first at line ${lineNum})`,
      });
    }
  }

  // ── Text constructs + em-dash density (prose only) ──
  if (isProse) {
    for (const pat of TEXT_CONSTRUCTS) {
      const matches = proseScan.match(globalize(pat.pattern));
      const count = matches ? matches.length : 0;
      // The concentration gate applies here too. Every construct shipped before 2.1.0
      // declares no mode, for which meetsThreshold is exactly the old `if (matches)`;
      // a construct that only reads as a tell in bulk (plain-aiism-collocation) needs it.
      if (meetsThreshold(pat, count)) {
        violations.push({
          type: "text-construct",
          name: pat.name,
          count,
          line: firstMatchLine(proseScan, pat.pattern),
          severity: pat.severity,
          confidence: pat.confidence,
          fix: pat.fix,
          desc: `${pat.desc} (${count}x)`,
        });
      }
    }
    const emdashes = (proseScan.match(/—/g) || []).length;
    const words = (proseScan.match(/\S+/g) || []).length || 1;
    const density = (emdashes / words) * 1000;
    if (emdashes >= EMDASH_MIN_COUNT && density >= EMDASH_MIN_DENSITY) {
      violations.push({
        type: "text-construct",
        name: "em-dash-density",
        count: emdashes,
        line: firstMatchLine(proseScan, /—/g),
        severity: density >= EMDASH_MIN_DENSITY * 2 ? "medium" : "low",
        confidence: EMDASH_CONFIDENCE,
        fix: EMDASH_FIX,
        desc: `High em dash density (${emdashes} dashes, ${density.toFixed(1)}/1k words) -- the #1 AI writing tell`,
      });
    }
  }

  // ── Emoji (skips escape-hatch lines so an intentional CLI glyph can opt out) ──
  // The file-scope guard is scoped to PROSE: a document that names emoji is documenting
  // the tell (this plugin's own writing-patterns.md reference failed its own scanner over
  // exactly that), whereas a `.emoji` CSS class or an EMOJI_MAP constant is a source file
  // naming a symbol while shipping the glyphs. Code and markup opt out per line instead.
  const emojiSilenced = isProse && !fileGuardOk(EMOJI_FILE_GUARD, content);
  const emojiHaystack = emojiSilenced ? null : stripEscapeHatchLines(content);
  const emojiMatches = emojiHaystack === null ? null : emojiHaystack.match(EMOJI_REGEX);
  if (emojiMatches) {
    violations.push({
      type: "emoji",
      count: emojiMatches.length,
      line: firstMatchLine(emojiHaystack, EMOJI_REGEX),
      severity: emojiMatches.length > EMOJI_ESCALATE_COUNT ? "medium" : "low",
      confidence: EMOJI_CONFIDENCE,
      fix: EMOJI_FIX,
      desc: `${emojiMatches.length} emoji found in ${filePath}`,
    });
  }

  // ── Design + code patterns (per-line, with suppress + escape hatch) ──
  // VB lines are rewritten so a `'`/REM comment reads as `//`: the shared comment-slop
  // rules (narrating, placeholder, deferral, apologetic, banner) key on C-family markers.
  const lines = isVb ? vbCommentNormalizedLines(content) : content.split("\n");
  const vbRawLines = isVb ? vbCommentNormalizedLines(content, false) : null;
  if (isStyle) {
    for (const pat of DESIGN_PATTERNS) {
      if (!fileGuardOk(pat, content)) continue;
      const { count, line } = countLinePattern(lines, pat);
      if (meetsThreshold(pat, count)) {
        violations.push({
          type: "design-tell",
          name: pat.name,
          count,
          line,
          severity: resolveSeverity(pat.severity, count),
          confidence: pat.confidence,
          mode: pat.mode,
          fix: pat.fix,
          desc: `${pat.desc} (${count}x)`,
        });
      }
    }
  }
  // VB rules match across lines on the comment-free code view. They are not mirrored in
  // collectSuppressed: the escape hatch blanks its line before matching, so a hatched
  // line simply contributes nothing, and the dashboard reports no suppressed VB findings.
  if (isVb) {
    const view = vbCodeView(content);
    for (const pat of VB_PATTERNS) {
      if (isTestFile && pat.skipInTests) continue;
      if (!fileGuardOk(pat, content)) continue;
      const re = freshGlobal(pat.pattern);
      let count = 0;
      let line = null;
      let m;
      while ((m = re.exec(view)) !== null) {
        if (m[0] === "") { re.lastIndex++; continue; }
        if (line === null) line = lineAtIndex(view, m.index + m[0].search(/\S/));
        count++;
      }
      if (meetsThreshold(pat, count)) {
        violations.push({
          type: "code-pattern",
          name: pat.name,
          count,
          line,
          severity: resolveSeverity(pat.severity, count),
          confidence: pat.confidence,
          fix: pat.fix,
          desc: `${pat.desc} (${count}x)`,
        });
      }
    }
  }
  if (isNative) {
    for (const pat of NATIVE_PATTERNS) {
      if (!fileGuardOk(pat, content)) continue;
      const { count, line } = countLinePattern(lines, pat);
      if (meetsThreshold(pat, count)) {
        violations.push({
          type: "native-tell",
          name: pat.name,
          count,
          line,
          severity: resolveSeverity(pat.severity, count),
          confidence: pat.confidence,
          mode: pat.mode,
          fix: pat.fix,
          desc: `${pat.desc} (${count}x)`,
        });
      }
    }
  }
  if (isCode) {
    for (const pat of CODE_PATTERNS) {
      if (isTestFile && pat.skipInTests) continue;
      if (isVb && VB_REPLACED_RULES.has(pat.name)) continue;
      if (!fileGuardOk(pat, content)) continue;
      const patLines = isVb && !COMMENT_MARKER_RULES.has(pat.name) ? vbRawLines : lines;
      const { count, line } = countLinePattern(patLines, pat);
      // Same gate as the design table: every code rule shipped before 2.1.0 declares no
      // mode and behaves exactly as the old `count > 0`, while `banner-comment` -- a Taste
      // note whose whole claim is "this file is divided by ASCII art" -- needs two.
      if (meetsThreshold(pat, count)) {
        violations.push({
          type: "code-pattern",
          name: pat.name,
          count,
          line,
          severity: resolveSeverity(pat.severity, count),
          confidence: pat.confidence,
          fix: pat.fix,
          desc: `${pat.desc} (${count}x)`,
        });
      }
    }
  }

  if (opts.collectSuppressed) {
    violations.push(...collectSuppressedViolations({
      content, lines, vbRawLines, isProse, isCode, isVb, isStyle, isTestFile, proseScan, allowedWords, contentLower,
    }));
  }

  return violations;
}

// ── Score calculation ──
export function calculateScore(violations) {
  let score = 50;
  for (const v of violations) {
    if (v.severity === "high") score -= 5;
    else if (v.severity === "medium") score -= 2;
    else score -= 1;
  }
  return Math.max(0, Math.min(50, score));
}

// ── Verdict ladder (source-aligned): a weighted-count tier for the scan summary. ──
// Uses the source scanners' additive weights (high=3, medium=2, low=1), which are
// distinct from the /50 score. For prose, pass the word count so a long, lightly
// flecked document is not over-escalated (the concentration guard).
export function verdict(violations, words = 0) {
  const W = { high: 3, medium: 2, low: 1 };
  let weighted = 0, high = 0, medium = 0;
  for (const v of violations) {
    weighted += W[v.severity] || 1;
    if (v.severity === "high") high++;
    else if (v.severity === "medium") medium++;
  }
  if (weighted === 0) return "CLEAN";
  if (high === 0 && medium === 0) return "MINOR";
  if (high >= 3 || weighted >= 15) return "STRONG";
  if (high >= 1) return "SOME";
  const density = words > 0 ? (weighted / words) * 1000 : 0;
  if (weighted >= 6 && !(words >= 600 && density < 2.0)) return "SOME";
  return "MINOR";
}
