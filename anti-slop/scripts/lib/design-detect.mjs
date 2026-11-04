// ── Shared design detection ──
// The one implementation of the parsing, colour maths and detectors the anti-slop scanner
// and ui-craft's scan_tells share. ui-craft vendors this file byte for byte behind a
// one-line header; edit it here and nowhere else. Node >= 18 standard library only.
//
// Third-party notice. Several detection rules re-express rules from impeccable
// (https://github.com/pbakaus/impeccable), Copyright 2025 Paul Bakaus, licensed under the
// Apache License, Version 2.0, as of commit 3671d50f0: low-contrast, side-tab, tiny-text,
// undersized-ui-text, tight-leading, wide-tracking, justified-text,
// extreme-negative-tracking, bounce-easing, pulsing-dot, marquee, codex-grid-background,
// repeating-stripes-gradient, radial-halo, gray-on-color, skipped-heading, dark-glow,
// gpt-thin-border-wide-shadow, its DESIGN.md reader and design-system-font, with
// impeccable's lessons on comment blanking, class-set scope, unknown values and rule-scoped
// waivers. Thresholds and exemptions are restated in this module's own code; no impeccable
// source is included.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";

// ── Extension families ──
const MARKUP_EXT = new Set([".html", ".htm", ".vue", ".svelte", ".astro"]);
const SCRIPT_EXT = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".mts", ".cts"]);
const STYLE_EXT = new Set([".css", ".scss", ".less"]);
const SLASH_STYLE_EXT = new Set([".scss", ".less"]);
const C_LIKE_EXT = new Set([".swift", ".m", ".mm"]);
const DOC_EXT = new Set([".md", ".mdx"]);

function normExt(ext) {
  const e = String(ext || "").toLowerCase();
  return e.startsWith(".") || e === "" ? e : `.${e}`;
}

// ── Low-level scanning ──
function blank(chars, start, end) {
  for (let i = start; i < end; i++) if (chars[i] !== "\n") chars[i] = " ";
}

// A quoted string ends at its closing quote or, unterminated, at the end of the line: an
// apostrophe in JSX text must cost one line, never the rest of the file.
function skipQuoted(src, i, end) {
  const q = src[i];
  let j = i + 1;
  while (j < end) {
    const c = src[j];
    if (c === "\\") { j += 2; continue; }
    if (c === q) return j + 1;
    if (c === "\n") return j;
    j++;
  }
  return end;
}

function skipRegexLiteral(src, i, end) {
  let j = i + 1;
  let inClass = false;
  while (j < end) {
    const c = src[j];
    if (c === "\\") { j += 2; continue; }
    if (c === "\n") return -1;
    if (c === "[") inClass = true;
    else if (c === "]") inClass = false;
    else if (c === "/" && !inClass) {
      j++;
      while (j < end && /[a-z]/i.test(src[j])) j++;
      return j;
    }
    j++;
  }
  return -1;
}

function lineEnd(src, i, end) {
  const k = src.indexOf("\n", i);
  return k === -1 || k > end ? end : k;
}

function blockCommentEnd(src, i, end) {
  const k = src.indexOf("*/", i + 2);
  return k === -1 || k + 2 > end ? end : k + 2;
}

const REGEX_PREFIX = /[(,=:[!&|?{};+\-*%~^]/;
const REGEX_KEYWORD = /(?:^|[^\w$])(?:return|typeof|case|do|else|in|of|void|yield|await|delete|throw|new)$/;

// Template literal: CSS comments inside it (styled-components, css``) are blanked, `//` is
// not (it is usually a URL), and each `${...}` interpolation is scanned as code.
function scanTemplate(src, chars, i, end) {
  let j = i + 1;
  while (j < end) {
    const c = src[j];
    if (c === "\\") { j += 2; continue; }
    if (c === "`") return j + 1;
    if (c === "$" && src[j + 1] === "{") { j = scanScript(src, chars, j + 2, end, true, true); continue; }
    if (c === "/" && src[j + 1] === "*") { const k = blockCommentEnd(src, j, end); if (chars) blank(chars, j, k); j = k; continue; }
    j++;
  }
  return end;
}

// JS-family comments, with strings, templates and regex literals skipped. `stopAtBrace`
// returns at the `}` that closes a template interpolation. `regexOk` is false for C-like
// languages, which have no regex literal.
function scanScript(src, chars, start, end, regexOk, stopAtBrace = false) {
  let i = start;
  let prev = "";
  let depth = 0;
  while (i < end) {
    const c = src[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") { i++; continue; }
    if (c === '"' || c === "'") { i = skipQuoted(src, i, end); prev = "a"; continue; }
    if (c === "`") { i = scanTemplate(src, chars, i, end); prev = "a"; continue; }
    if (c === "/") {
      const n = src[i + 1];
      if (n === "/") {
        if (src[i - 1] === ":") { i += 2; prev = "/"; continue; }
        const k = lineEnd(src, i, end);
        if (chars) blank(chars, i, k);
        i = k;
        continue;
      }
      if (n === "*") { const k = blockCommentEnd(src, i, end); if (chars) blank(chars, i, k); i = k; continue; }
      if (regexOk && (prev === "" || REGEX_PREFIX.test(prev) || REGEX_KEYWORD.test(src.slice(Math.max(start, i - 10), i).trimEnd()))) {
        const k = skipRegexLiteral(src, i, end);
        if (k !== -1) { i = k; prev = "a"; continue; }
      }
      i++;
      prev = "/";
      continue;
    }
    if (stopAtBrace) {
      if (c === "{") depth++;
      else if (c === "}") { if (depth === 0) return i + 1; depth--; }
    }
    prev = c;
    i++;
  }
  return end;
}

function scanStyle(src, chars, start, end, slashComments) {
  let i = start;
  while (i < end) {
    const c = src[i];
    if (c === '"' || c === "'") { i = skipQuoted(src, i, end); continue; }
    if ((c === "u" || c === "U") && /^url\(/i.test(src.slice(i, i + 4)) && !/[\w-]/.test(src[i - 1] || "")) {
      const k = src.indexOf(")", i);
      i = k === -1 || k > end ? end : k + 1;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") { const k = blockCommentEnd(src, i, end); blank(chars, i, k); i = k; continue; }
    if (slashComments && c === "/" && src[i + 1] === "/" && src[i - 1] !== ":") {
      const k = lineEnd(src, i, end);
      blank(chars, i, k);
      i = k;
      continue;
    }
    i++;
  }
}

// <script> and <style> bodies of a markup file: [start, end, tag, attrs].
function markupRegions(src) {
  const lower = src.toLowerCase();
  const regions = [];
  const re = /<(script|style)\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(src)) !== null) {
    const tag = m[1].toLowerCase();
    const bodyStart = m.index + m[0].length;
    const close = lower.indexOf(`</${tag}`, bodyStart);
    const bodyEnd = close === -1 ? src.length : close;
    regions.push([bodyStart, bodyEnd, tag, m[2]]);
    re.lastIndex = bodyEnd;
  }
  return regions;
}

function insideRegion(regions, i) {
  return regions.some(([s, e]) => i >= s && i < e);
}

function prepareMarkup(src, chars, ext) {
  const regions = markupRegions(src);
  if (ext === ".astro") {
    const fm = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---/.exec(src);
    if (fm) regions.push([4, 4 + fm[1].length, "script", ""]);
  }
  for (let i = src.indexOf("<!--"); i !== -1; i = src.indexOf("<!--", i + 4)) {
    if (insideRegion(regions, i)) continue;
    const k = src.indexOf("-->", i + 4);
    const end = k === -1 ? src.length : k + 3;
    blank(chars, i, end);
    i = end - 4;
  }
  for (const [s, e, tag, attrs] of regions) {
    if (tag === "style") scanStyle(src, chars, s, e, /\blang\s*=\s*["']?(?:scss|less)\b/i.test(attrs));
    else scanScript(src, chars, s, e, true);
  }
  // CSS or markup quoted as text inside <code> or <pre> is an example, not the page.
  const lower = src.toLowerCase();
  const re = /<(pre|code)\b[^>]*>/gi;
  let m;
  while ((m = re.exec(src)) !== null) {
    if (insideRegion(regions, m.index)) continue;
    const bodyStart = m.index + m[0].length;
    const close = lower.indexOf(`</${m[1].toLowerCase()}`, bodyStart);
    const bodyEnd = close === -1 ? src.length : close;
    blank(chars, bodyStart, bodyEnd);
    re.lastIndex = bodyEnd;
  }
}

const FENCE_CSS = /^(?:css|scss|less)$/i;
const FENCE_JS = /^(?:js|jsx|ts|tsx|mjs|cjs|javascript|typescript)$/i;

// Markdown: `<!-- -->` anywhere, and `/* */` or `//` only inside a fenced block of a
// language that has them. A glob like `aesthetic/*` in prose is never a comment opener.
function prepareDoc(src, chars) {
  for (let i = src.indexOf("<!--"); i !== -1; i = src.indexOf("<!--", i + 4)) {
    const k = src.indexOf("-->", i + 4);
    const end = k === -1 ? src.length : k + 3;
    blank(chars, i, end);
    i = end - 4;
  }
  for (const f of fencedBlocks(src)) {
    if (FENCE_CSS.test(f.lang)) scanStyle(src, chars, f.start, f.end, /^(?:scss|less)$/i.test(f.lang));
    else if (FENCE_JS.test(f.lang)) scanScript(src, chars, f.start, f.end, true);
  }
}

function fencedBlocks(src) {
  const out = [];
  const re = /^([ \t]*)(`{3,}|~{3,})[ \t]*([\w+-]*)[^\n]*\n/gm;
  let m;
  while ((m = re.exec(src)) !== null) {
    const fence = m[2];
    const start = m.index + m[0].length;
    const closeRe = new RegExp(`^[ \\t]*${fence[0] === "`" ? "`" : "~"}{${fence.length},}[ \\t]*$`, "gm");
    closeRe.lastIndex = start;
    const c = closeRe.exec(src);
    const end = c ? c.index : src.length;
    out.push({ lang: m[3] || "", start, end });
    re.lastIndex = c ? c.index + c[0].length : src.length;
  }
  return out;
}

// prepareSource(content, ext) -> { text, rawLines }. `text` has every comment blanked to
// spaces with newlines kept, so a line number in `text` is a line number in the file;
// markup files also blank the contents of <code> and <pre>. `rawLines` is the untouched
// content: escape hatches and waivers live in comments and are always read from it.
export function prepareSource(content, ext) {
  const e = normExt(ext);
  const rawLines = content.split("\n");
  let chars = null;
  if (STYLE_EXT.has(e)) { chars = content.split(""); scanStyle(content, chars, 0, content.length, SLASH_STYLE_EXT.has(e)); }
  else if (SCRIPT_EXT.has(e)) { chars = content.split(""); scanScript(content, chars, 0, content.length, true); }
  else if (C_LIKE_EXT.has(e)) { chars = content.split(""); scanScript(content, chars, 0, content.length, false); }
  else if (MARKUP_EXT.has(e)) { chars = content.split(""); prepareMarkup(content, chars, e); }
  else if (DOC_EXT.has(e)) { chars = content.split(""); prepareDoc(content, chars); }
  return { text: chars ? chars.join("") : content, rawLines };
}

export function lineIndex(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
  return (offset) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
}

// ── Bracket matching over code (strings and templates skipped) ──
const PAIRS = { "(": ")", "[": "]", "{": "}" };

function skipTemplatePlain(src, i, end = src.length) {
  return scanTemplate(src, null, i, end);
}

export function matchClose(src, open, end = src.length) {
  const want = PAIRS[src[open]];
  if (!want) return -1;
  const stack = [want];
  let i = open + 1;
  while (i < end) {
    const c = src[i];
    if (c === '"' || c === "'") { i = skipQuoted(src, i, end); continue; }
    if (c === "`") { i = skipTemplatePlain(src, i, end); continue; }
    if (PAIRS[c]) stack.push(PAIRS[c]);
    else if (c === ")" || c === "]" || c === "}") {
      if (stack[stack.length - 1] !== c) return -1;
      stack.pop();
      if (stack.length === 0) return i;
    }
    i++;
  }
  return -1;
}

// A copy of `expr` in which everything inside strings, templates and nested brackets is
// masked, so separators can be found at depth 0 with plain string searches.
function topMask(expr) {
  const out = new Array(expr.length);
  let depth = 0;
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i];
    if (c === '"' || c === "'" || c === "`") {
      const j = c === "`" ? skipTemplatePlain(expr, i) : skipQuoted(expr, i, expr.length);
      for (let k = i; k < j; k++) out[k] = "_";
      i = j - 1;
      continue;
    }
    if (c === "(" || c === "[" || c === "{") { depth++; out[i] = "_"; continue; }
    if (c === ")" || c === "]" || c === "}") { depth--; out[i] = "_"; continue; }
    out[i] = depth === 0 ? c : "_";
  }
  return out.join("");
}

function splitTop(expr, sep) {
  const mask = topMask(expr);
  const parts = [];
  let last = 0;
  for (let i = mask.indexOf(sep); i !== -1; i = mask.indexOf(sep, i + sep.length)) {
    parts.push(expr.slice(last, i));
    last = i + sep.length;
  }
  parts.push(expr.slice(last));
  return parts;
}

// Splits on a separator outside quotes and outside (), [] (CSS values, selectors, tokens).
function splitOutside(value, sep) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let last = 0;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (quote) { if (c === "\\") i++; else if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (depth === 0 && (sep === " " ? /\s/.test(c) : c === sep)) {
      parts.push(value.slice(last, i));
      last = i + 1;
    }
  }
  parts.push(value.slice(last));
  return parts.map((p) => p.trim()).filter((p) => p !== "");
}

function indexOutside(value, ch) {
  let depth = 0;
  let quote = null;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (quote) { if (c === "\\") i++; else if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (depth === 0 && c === ch) return i;
  }
  return -1;
}

// ── Class token sets ──
const CLASS_HELPERS = "cn|clsx|twMerge|twJoin|classNames|classnames|cx|cva|tv";
const CLASS_ATTR = /(?<![\w$.-])(v-bind:class|:class|className|class)\s*=\s*/g;
const CLASS_CALL = new RegExp(`(?<![\\w$.])(${CLASS_HELPERS})\\s*\\(`, "g");
const WHOLE_CALL = new RegExp(`^(${CLASS_HELPERS})\\s*\\(`);
const QUOTED = /^(["'])([\s\S]*)\1$/;

function plainTokens(value) {
  return value.replace(/\$\{[^}]*\}/g, " ").replace(/\{[^}]*\}/g, " ").split(/\s+/).filter(Boolean);
}

function templateTokens(body, out) {
  let staticText = "";
  let i = 0;
  while (i < body.length) {
    if (body[i] === "\\") { staticText += body.slice(i, i + 2); i += 2; continue; }
    if (body[i] === "$" && body[i + 1] === "{") {
      const close = matchClose(body, i + 1);
      if (close === -1) break;
      collectArg(body.slice(i + 2, close), out);
      staticText += " ";
      i = close + 1;
      continue;
    }
    staticText += body[i];
    i++;
  }
  out.base.push(...plainTokens(staticText));
}

function stripParens(expr) {
  let e = expr.trim();
  while (e.startsWith("(") && matchClose(e, 0) === e.length - 1) e = e.slice(1, -1).trim();
  return e;
}

// Finds a top-level `cond ? a : b` and returns [consequent, alternate], or null.
function ternaryParts(expr) {
  const mask = topMask(expr);
  let q = -1;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] !== "?") continue;
    if (mask[i + 1] === "." || mask[i + 1] === "?" || mask[i - 1] === "?") continue;
    q = i;
    break;
  }
  if (q === -1) return null;
  let need = 1;
  for (let i = q + 1; i < mask.length; i++) {
    const c = mask[i];
    if (c === "?" && mask[i + 1] !== "." && mask[i + 1] !== "?" && mask[i - 1] !== "?") need++;
    else if (c === ":" && --need === 0) return [expr.slice(q + 1, i), expr.slice(i + 1)];
  }
  return null;
}

function armsOf(expr, arms) {
  const t = ternaryParts(stripParens(expr));
  if (t) { armsOf(t[0], arms); armsOf(t[1], arms); return; }
  const sub = { base: [], arms: [] };
  collectArg(expr, sub);
  arms.push([...sub.base, ...sub.arms.flat()]);
}

// Collects class tokens from one expression: unconditional strings join `base`, each arm of
// a ternary becomes its own entry in `arms` (exclusive arms never pair), and a condition's
// own strings (`v === "primary" && ...`) are dropped.
function collectArg(raw, out) {
  const expr = stripParens(raw);
  if (!expr) return;
  if (ternaryParts(expr)) { armsOf(expr, out.arms); return; }
  const mask = topMask(expr);
  if (mask.includes("&&")) { const parts = splitTop(expr, "&&"); collectArg(parts[parts.length - 1], out); return; }
  for (const op of ["||", "??"]) {
    if (mask.includes(op)) { for (const p of splitTop(expr, op)) collectArg(p, out); return; }
  }
  if (mask.includes("+")) { for (const p of splitTop(expr, "+")) collectArg(p, out); return; }
  const call = WHOLE_CALL.exec(expr);
  if (call && matchClose(expr, call[0].length - 1) === expr.length - 1) {
    const inner = expr.slice(call[0].length, -1);
    if (call[1] === "cva" || call[1] === "tv") collectCva(inner, out);
    else collectArgs(inner, out);
    return;
  }
  const q = QUOTED.exec(expr);
  if (q && skipQuoted(expr, 0, expr.length) === expr.length) { out.base.push(...plainTokens(q[2])); return; }
  if (expr.startsWith("`") && skipTemplatePlain(expr, 0) === expr.length) { templateTokens(expr.slice(1, -1), out); return; }
  if (expr.startsWith("[") && matchClose(expr, 0) === expr.length - 1) { collectArgs(expr.slice(1, -1), out); return; }
  if (expr.startsWith("{") && matchClose(expr, 0) === expr.length - 1) {
    for (const entry of splitTop(expr.slice(1, -1), ",")) {
      const key = /^\s*(["'])([^"'\n]*)\1\s*:/.exec(entry);
      if (key) out.base.push(...plainTokens(key[2]));
    }
  }
}

function collectArgs(argsText, out) {
  for (const arg of splitTop(argsText, ",")) collectArg(arg, out);
}

// cva/tv: the first argument is the base; every string in the config is its own exclusive
// arm (one variant value never pairs with another).
function collectCva(argsText, out) {
  const args = splitTop(argsText, ",");
  const first = stripParens(args[0] || "");
  const rest = first.startsWith("{") ? args : args.slice(1);
  if (!first.startsWith("{")) collectArg(first, out);
  for (const a of rest) {
    for (const m of a.matchAll(/"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`/g)) {
      const tokens = plainTokens(m[1] ?? m[2] ?? m[3] ?? "");
      if (tokens.length) out.arms.push(tokens);
    }
  }
}

// The element name of the tag an attribute at `idx` belongs to, or null.
function tagAt(text, idx) {
  const lt = text.lastIndexOf("<", idx);
  if (lt === -1) return null;
  const m = /^<([A-Za-z][\w.:-]*)/.exec(text.slice(lt, lt + 80));
  if (!m) return null;
  let depth = 0;
  for (let i = lt + m[0].length; i < idx; i++) {
    const c = text[i];
    if (depth === 0 && (c === '"' || c === "'")) {
      const j = text.indexOf(c, i + 1);
      if (j === -1 || j >= idx) return null;
      i = j;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0 && text[i - 1] !== "=") return null;
  }
  return m[1].toLowerCase();
}

function uniq(list) {
  return [...new Set(list)];
}

// classTokenSets(text) -> [{ tokens, line, tag, arm, group, start, end }]. Every class
// source (class=, className=, :class=, and cn/clsx/twMerge/classNames/cva calls) is matched
// over the whole text, so a multi-line attribute is one source. A source's unconditional
// tokens form one set (arm null); each ternary arm or cva variant is a further set with an
// integer arm id. `${...}` interpolations are dropped from the tokens; `tag` is the
// containing element (null for a bare helper call). Run it on prepareSource().text.
export function classTokenSets(text, lineOf = lineIndex(text)) {
  const groups = [];
  const consumed = [];
  const attr = new RegExp(CLASS_ATTR.source, "g");
  let m;
  while ((m = attr.exec(text)) !== null) {
    const kind = m[1];
    const vStart = m.index + m[0].length;
    const q = text[vStart];
    let end;
    let collected;
    if (q === '"' || q === "'") {
      end = text.indexOf(q, vStart + 1);
      if (end === -1) continue;
      const value = text.slice(vStart + 1, end);
      collected = { base: [], arms: [] };
      if (kind.includes(":")) collectArg(value, collected);
      else collected.base.push(...plainTokens(value));
      end += 1;
    } else if (q === "{") {
      const close = matchClose(text, vStart);
      if (close === -1) continue;
      collected = { base: [], arms: [] };
      collectArg(text.slice(vStart + 1, close), collected);
      end = close + 1;
    } else {
      const u = /^[^\s>"'=`]+/.exec(text.slice(vStart, vStart + 300));
      if (!u) continue;
      end = vStart + u[0].length;
      collected = { base: plainTokens(u[0]), arms: [] };
    }
    consumed.push([m.index, end]);
    groups.push({ start: m.index, end, line: lineOf(m.index), tag: tagAt(text, m.index), ...collected });
    attr.lastIndex = end;
  }
  const call = new RegExp(CLASS_CALL.source, "g");
  while ((m = call.exec(text)) !== null) {
    const at = m.index;
    if (consumed.some(([s, e]) => at >= s && at < e)) continue;
    const open = at + m[0].length - 1;
    const close = matchClose(text, open);
    if (close === -1) continue;
    const collected = { base: [], arms: [] };
    if (m[1] === "cva" || m[1] === "tv") collectCva(text.slice(open + 1, close), collected);
    else collectArgs(text.slice(open + 1, close), collected);
    groups.push({ start: at, end: close + 1, line: lineOf(at), tag: null, ...collected });
    call.lastIndex = close + 1;
  }
  groups.sort((a, b) => a.start - b.start);
  const sets = [];
  groups.forEach((g, group) => {
    const shared = { line: g.line, tag: g.tag, group, start: g.start, end: g.end };
    const base = uniq(g.base);
    if (base.length) sets.push({ tokens: base, arm: null, ...shared });
    g.arms.forEach((a, k) => { const tokens = uniq(a); if (tokens.length) sets.push({ tokens, arm: k, ...shared }); });
  });
  return sets;
}

// effectiveClassSets(sets) -> the token sets an element can actually carry at once: a
// source with no arms is its base set; a source with arms yields base + one arm per arm.
export function effectiveClassSets(sets) {
  const byGroup = new Map();
  for (const s of sets) {
    if (!byGroup.has(s.group)) byGroup.set(s.group, { base: null, arms: [] });
    const g = byGroup.get(s.group);
    if (s.arm === null) g.base = s;
    else g.arms.push(s);
  }
  const out = [];
  for (const g of byGroup.values()) {
    if (g.arms.length === 0) { if (g.base) out.push(g.base); continue; }
    for (const a of g.arms) out.push({ ...a, tokens: uniq([...(g.base ? g.base.tokens : []), ...a.tokens]) });
  }
  return out;
}

// matchingClassSets(sets, test) -> the sets whose tokens pass `test`, one per element an
// element can be: a source whose unconditional tokens pass counts once, otherwise each arm
// is tested with the unconditional tokens added. Feed it classTokenSets() output.
export function matchingClassSets(sets, test) {
  const byGroup = new Map();
  for (const s of sets) {
    if (!byGroup.has(s.group)) byGroup.set(s.group, { base: null, arms: [] });
    const g = byGroup.get(s.group);
    if (s.arm === null) g.base = s;
    else g.arms.push(s);
  }
  const out = [];
  for (const g of byGroup.values()) {
    if (g.base && test(g.base.tokens)) { out.push(g.base); continue; }
    for (const a of g.arms) {
      const tokens = uniq([...(g.base ? g.base.tokens : []), ...a.tokens]);
      if (test(tokens)) out.push({ ...a, tokens });
    }
  }
  return out.sort((x, y) => x.start - y.start);
}

// tailwindToken("md:hover:bg-indigo-500/10") -> { variants: ["md","hover"],
// base: "bg-indigo-500", opacity: "10", important: false }. A `/` suffix is reported as
// opacity on every token; only colour utilities should read it as one (`w-1/2`).
export function tailwindToken(token) {
  let t = String(token);
  let important = false;
  if (t.endsWith("!")) { important = true; t = t.slice(0, -1); }
  const parts = [];
  let depth = 0;
  let last = 0;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === "[" || c === "(") depth++;
    else if (c === "]" || c === ")") depth--;
    else if (c === ":" && depth === 0) { parts.push(t.slice(last, i)); last = i + 1; }
  }
  let base = t.slice(last);
  if (base.startsWith("!")) { important = true; base = base.slice(1); }
  let opacity = null;
  const slash = indexOutside(base, "/");
  if (slash > 0) { opacity = base.slice(slash + 1); base = base.slice(0, slash); }
  return { variants: parts, base, opacity, important };
}

const STATE_VARIANTS = new Set([
  "hover", "focus", "focus-visible", "focus-within", "active", "visited", "disabled", "enabled",
  "checked", "indeterminate", "open", "invalid", "valid", "user-invalid", "user-valid",
  "placeholder", "placeholder-shown", "required", "optional", "target", "read-only", "autofill",
]);

// A state variant paints only while the element is in that state. Breakpoints (sm..2xl,
// min-*, max-*), dark:, print:, motion-*:, rtl:, ltr: and pseudo-elements are not states.
export function isStateVariant(variant) {
  const v = String(variant);
  if (STATE_VARIANTS.has(v)) return true;
  if (/^(?:group|peer|aria|data|has)-/.test(v)) return true;
  return /^\[.*:(?:hover|focus|focus-visible|focus-within|active|checked|disabled)\b/.test(v);
}

// ── CSS blocks ──
const PASSTHROUGH_AT = new Set(["media", "supports", "container", "layer", "document", "scope", "starting-style", "include", "if", "else", "each", "for", "while", "at-root"]);

function leadingSpace(src, i) {
  let k = i;
  while (k < src.length && /\s/.test(src[k])) k++;
  return k;
}

function splitSelectorList(head) {
  return splitOutside(head, ",");
}

function joinSelectors(parents, own) {
  const out = [];
  for (const p of parents) for (const o of own) out.push(o.includes("&") ? o.replace(/&/g, p) : `${p} ${o}`);
  return out;
}

function parseOffsets(head) {
  return splitOutside(head, ",").map((h) => {
    const t = h.trim().toLowerCase();
    if (t === "from") return 0;
    if (t === "to") return 1;
    const n = parseFloat(t);
    return Number.isFinite(n) ? n / 100 : null;
  }).filter((n) => n !== null);
}

function parseDeclaration(seg, segPos, lineAt) {
  const lead = leadingSpace(seg, 0);
  const t = seg.slice(lead).trimEnd();
  if (!t) return null;
  const line = lineAt(segPos + lead);
  if (/^@apply\b/i.test(t)) return { prop: "@apply", value: t.slice(6).trim(), important: false, line };
  const colon = indexOutside(t, ":");
  if (colon <= 0) return null;
  let prop = t.slice(0, colon).trim();
  if (!/^(?:--[\w-]+|-?[A-Za-z][\w-]*)$/.test(prop)) return null;
  if (!prop.startsWith("--")) prop = prop.toLowerCase();
  let value = t.slice(colon + 1).trim();
  let important = false;
  const imp = /\s*!\s*important\s*$/i.exec(value);
  if (imp) { important = true; value = value.slice(0, imp.index).trim(); }
  return { prop, value, important, line };
}

// One CSS text (a stylesheet, a <style> body, a template body): blocks with selectors joined
// to their nesting parents, and @keyframes collected separately.
function parseCssText(css, lineAt, out, opts = {}) {
  const stack = [];
  const rootAt = opts.atRules || [];
  const atRules = () => [...rootAt, ...stack.filter((f) => f.type === "at" || f.at).map((f) => f.at || f.head)];
  const selectorsInScope = () => {
    for (let k = stack.length - 1; k >= 0; k--) if (stack[k].type === "rule" && !stack[k].atBlock) return stack[k].selectors;
    return null;
  };
  const makeRule = (selectors, pos, extra = {}) => {
    const block = { selector: selectors.join(", "), decls: [], line: lineAt(pos), atRules: atRules(), inline: false, tag: null, ...extra.block };
    out.blocks.push(block);
    return { type: "rule", selectors, block, ...extra.frame };
  };
  if (opts.rootSelector) stack.push(makeRule([opts.rootSelector], 0));
  if (opts.keyframesName) stack.push({ type: "kf", name: opts.keyframesName, steps: [], line: lineAt(0), atRules: atRules() });
  const addDecl = (frame, seg, segPos) => {
    if (!frame) return;
    if (frame.type !== "rule" && frame.type !== "kfstep") return;
    const d = parseDeclaration(seg, segPos, lineAt);
    if (!d) return;
    if (frame.type === "kfstep") frame.decls.push(d);
    else frame.block.decls.push(d);
  };
  const finish = (f) => {
    if (!f) return;
    if (f.type === "kfstep") f.kf.steps.push({ offsets: f.offsets, decls: f.decls, line: f.line });
    else if (f.type === "kf") out.keyframes.push({ name: f.name, steps: f.steps, line: f.line, atRules: f.atRules });
  };
  let seg = 0;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === '"' || c === "'") { i = skipQuoted(css, i, css.length) - 1; continue; }
    if (c === "(") { const j = matchClose(css, i); if (j !== -1) i = j; continue; }
    if (c === "{") {
      const headPos = leadingSpace(css, seg);
      const head = css.slice(seg, i).trim();
      const parent = stack[stack.length - 1];
      let frame;
      if (parent && parent.type === "kf") frame = { type: "kfstep", offsets: parseOffsets(head), decls: [], line: lineAt(headPos), kf: parent };
      else if (parent && (parent.type === "kfstep" || parent.type === "skip")) frame = { type: "skip" };
      else if (head.startsWith("@")) {
        const name = (/^@([\w-]+)/.exec(head) || [, ""])[1].toLowerCase();
        if (name.endsWith("keyframes")) frame = { type: "kf", name: head.replace(/^@[\w-]+\s*/, "").replace(/^["']|["']$/g, "").trim(), steps: [], line: lineAt(headPos), atRules: atRules() };
        else if (PASSTHROUGH_AT.has(name)) {
          const scope = selectorsInScope();
          frame = scope ? makeRule(scope, headPos, { frame: { at: head } }) : { type: "at", head };
          if (scope) frame.block.atRules = [...frame.block.atRules, head];
        } else frame = makeRule([head], headPos, { frame: { atBlock: true } });
      } else {
        const own = splitSelectorList(head);
        const scope = selectorsInScope();
        const selectors = scope ? joinSelectors(scope, own) : own.map((s) => s.replace(/^&\s*/, "").trim() || s);
        frame = makeRule(selectors.length ? selectors : [head], headPos);
      }
      stack.push(frame);
      seg = i + 1;
      continue;
    }
    if (c === ";") { addDecl(stack[stack.length - 1], css.slice(seg, i), seg); seg = i + 1; continue; }
    if (c === "}") {
      addDecl(stack[stack.length - 1], css.slice(seg, i), seg);
      finish(stack.pop());
      seg = i + 1;
    }
  }
  addDecl(stack[stack.length - 1], css.slice(seg), seg);
  while (stack.length) finish(stack.pop());
}

function camelToKebab(key) {
  const k = key.replace(/^(Webkit|Moz|ms|O)(?=[A-Z])/, (p) => `-${p.toLowerCase()}`);
  return k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

const UNITLESS = new Set(["line-height", "font-weight", "opacity", "z-index", "flex", "flex-grow", "flex-shrink", "order", "zoom", "animation-iteration-count", "aspect-ratio", "scale"]);

function parseStyleObject(body, bodyPos, lineAt) {
  const decls = [];
  let cursor = 0;
  for (const entry of splitTop(body, ",")) {
    const entryPos = body.indexOf(entry, cursor);
    cursor = entryPos + entry.length;
    const m = /^\s*(?:(["'])([^"']+)\1|([A-Za-z_$][\w$]*))\s*:\s*([\s\S]*?)\s*$/.exec(entry);
    if (!m) continue;
    const key = m[2] ?? m[3];
    const prop = key.startsWith("--") ? key : camelToKebab(key);
    let raw = m[4];
    let value;
    const q = /^(["'])([\s\S]*)\1$/.exec(raw);
    if (q) value = q[2];
    else if (/^`[^`$]*`$/.test(raw)) value = raw.slice(1, -1);
    else if (/^-?\d*\.?\d+$/.test(raw)) value = UNITLESS.has(prop) || Number(raw) === 0 ? raw : `${raw}px`;
    else value = "var(--js)";
    decls.push({ prop, value, important: false, line: lineAt(bodyPos + Math.max(0, entryPos) + leadingSpace(entry, 0)) });
  }
  return decls;
}

function classSelectorOfTag(text, tagStart, limit) {
  const tagText = text.slice(tagStart, limit);
  const c = /\bclass(?:Name)?\s*=\s*["']([^"']*)["']/.exec(tagText);
  return c ? c[1].trim().split(/\s+/).filter(Boolean).map((t) => `.${t}`).join("") : "";
}

// Replaces each `${...}` in a template body: a bare identifier stays as itself (a
// keyframes name), anything else becomes var(--js), an unknown value. Newlines are kept.
function neutraliseInterpolations(body) {
  let out = "";
  let i = 0;
  while (i < body.length) {
    if (body[i] === "$" && body[i + 1] === "{") {
      const close = matchClose(body, i + 1);
      if (close === -1) { out += body.slice(i); break; }
      const inner = body.slice(i + 2, close);
      const id = /^\s*([A-Za-z_$][\w$]*)\s*$/.exec(inner);
      out += (id ? id[1] : "var(--js)") + "\n".repeat((inner.match(/\n/g) || []).length);
      i = close + 1;
      continue;
    }
    out += body[i];
    i++;
  }
  return out;
}

const TEMPLATE_START = /(?<![\w$.])(?:(styled(?:\s*\.\s*[A-Za-z_$][\w$]*|\s*\([^()]*\))(?:\s*\.\s*(?:attrs|withConfig)\s*\((?:[^()]|\([^()]*\))*\))*(?:\s*<[^`<>]*>)?)|(css|createGlobalStyle|injectGlobal)|(keyframes))\s*`/g;

// cssBlocks(text, ext) -> { blocks, keyframes }. blocks: [{ selector, decls: [{ prop,
// value, important, line }], line, atRules, inline, tag }]; keyframes: Map name ->
// { steps: [{ offsets, decls, line }], line, atRules }. Sources: a whole stylesheet,
// <style> bodies, fenced css blocks in markdown, style="" attributes (selector
// `tag.classes[style]`, inline true), JSX style={{ }} objects (keys kebab-cased, bare
// numbers given px), and styled/css/createGlobalStyle/keyframes templates (root selector
// `&`). Run it on prepareSource().text.
export function cssBlocks(text, ext, lineOf = lineIndex(text)) {
  const e = normExt(ext);
  const out = { blocks: [], keyframes: [] };
  const region = (start, end, opts) => parseCssText(text.slice(start, end), (p) => lineOf(start + p), out, opts);
  if (STYLE_EXT.has(e)) region(0, text.length);
  if (MARKUP_EXT.has(e)) for (const [s, en, tag] of markupRegions(text)) if (tag === "style") region(s, en);
  if (DOC_EXT.has(e)) for (const f of fencedBlocks(text)) if (FENCE_CSS.test(f.lang)) region(f.start, f.end);
  if (SCRIPT_EXT.has(e) || MARKUP_EXT.has(e) || DOC_EXT.has(e)) {
    const re = new RegExp(TEMPLATE_START.source, "g");
    let m;
    while ((m = re.exec(text)) !== null) {
      const tick = m.index + m[0].length - 1;
      const end = skipTemplatePlain(text, tick);
      const body = neutraliseInterpolations(text.slice(tick + 1, Math.max(tick + 1, end - 1)));
      const startLine = lineOf(tick + 1);
      const nl = lineIndex(body);
      const lineAt = (p) => startLine + nl(p) - 1;
      if (m[3]) {
        const name = (/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*$/.exec(text.slice(Math.max(0, m.index - 80), m.index)) || [])[1] || "";
        parseCssText(body, lineAt, out, { keyframesName: name });
      } else if (m[1]) parseCssText(body, lineAt, out, { rootSelector: "&" });
      else parseCssText(body, lineAt, out);
      re.lastIndex = end;
    }
  }
  if (!STYLE_EXT.has(e)) {
    const attr = /(?<![\w:.-])style\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\{)/g;
    let m;
    while ((m = attr.exec(text)) !== null) {
      const tag = tagAt(text, m.index);
      const object = m[0].endsWith("{{");
      if (!tag && !object) continue;
      const tagStart = tag ? text.lastIndexOf("<", m.index) : m.index;
      if (object) {
        const open = m.index + m[0].length - 1;
        const close = matchClose(text, open);
        if (close === -1) continue;
        const decls = parseStyleObject(text.slice(open + 1, close), open + 1, lineOf);
        const cls = tag ? classSelectorOfTag(text, tagStart, m.index) : "";
        if (decls.length) out.blocks.push({ selector: `${tag || "*"}${cls}[style]`, decls, line: lineOf(m.index), atRules: [], inline: true, tag });
        attr.lastIndex = close + 1;
        continue;
      }
      const value = m[1] ?? m[2] ?? "";
      const valueStart = m.index + m[0].search(/["']/) + 1;
      const decls = [];
      let cursor = 0;
      for (const seg of value.split(";")) {
        const d = parseDeclaration(seg, valueStart + cursor, lineOf);
        cursor += seg.length + 1;
        if (d) decls.push(d);
      }
      const cls = classSelectorOfTag(text, tagStart, m.index);
      if (decls.length) out.blocks.push({ selector: `${tag}${cls}[style]`, decls, line: lineOf(m.index), atRules: [], inline: true, tag });
    }
  }
  const keyframes = new Map();
  for (const k of out.keyframes) {
    if (!k.name) continue;
    if (k.atRules.some((a) => /prefers-reduced-motion\s*:\s*reduce/i.test(a)) && keyframes.has(k.name)) continue;
    keyframes.set(k.name, { steps: k.steps, line: k.line, atRules: k.atRules });
  }
  return { blocks: out.blocks.filter((b) => b.decls.length > 0), keyframes };
}

// ── Class tokens and the text outside class sources ──
// classTokenHits(ctx, test): one hit per token, in its own set, whose parsed tailwindToken
// passes `test`. classFreeLines(ctx): the prepared text with every class source blanked,
// split into lines, for the same vocabulary written outside markup (an @apply line).
// lineRegexHits(lines, re): one hit per match.
export function classTokenHits(ctx, test) {
  const hits = [];
  for (const set of ctx.classSets) for (const t of set.tokens) if (test(tailwindToken(t))) hits.push({ line: set.line, evidence: t });
  return hits;
}

export function classFreeLines(ctx) {
  return memo(ctx, "classFreeLines", () => {
    const chars = ctx.text.split("");
    const seen = new Set();
    for (const set of ctx.classSets) {
      if (seen.has(set.group)) continue;
      seen.add(set.group);
      blank(chars, set.start, set.end);
    }
    return chars.join("").split("\n");
  });
}

export function lineRegexHits(lines, re) {
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
  const hits = [];
  lines.forEach((line, i) => {
    for (const m of line.matchAll(g)) hits.push({ line: i + 1, evidence: m[0] });
  });
  return hits;
}

// A utility that paints at rest: no state variant and no opacity tint.
export function isResting(t) {
  return !t.opacity && !t.variants.some(isStateVariant);
}

// ── Custom properties ──
const ROOT_SELECTOR = /^(?::root|html|body|\*|:host)$/i;

export function isRootSelector(selector) {
  const list = splitSelectorList(selector);
  return list.length > 0 && list.every((s) => ROOT_SELECTOR.test(s.trim()));
}

// customProperties(blocks) -> Map name -> value. A root-level definition (:root, html,
// body, *, :host, outside any at-rule) wins over a scoped or media-query override, so a
// dark-mode block does not repaint the light page the rest of the file is measured on;
// among equals the last declaration wins.
export function customProperties(blocks) {
  const all = new Map();
  const root = new Map();
  for (const b of blocks) {
    for (const d of b.decls) {
      if (!d.prop.startsWith("--")) continue;
      all.set(d.prop, d.value);
      if (!b.atRules.length && isRootSelector(b.selector)) root.set(d.prop, d.value);
    }
  }
  for (const [k, v] of root) all.set(k, v);
  return all;
}

// resolveVars(value, props): var(--x[, fallback]) replaced recursively to depth 5. An
// unresolved var() stays in the string, and every caller reads such a value as unknown,
// never as a number: silence over a wrong number.
export function resolveVars(value, props, depth = 0) {
  if (typeof value !== "string" || !value.includes("var(") || depth > 5) return value;
  let out = "";
  let i = 0;
  while (i < value.length) {
    const k = value.indexOf("var(", i);
    if (k === -1) { out += value.slice(i); break; }
    if (k > 0 && /[\w-]/.test(value[k - 1])) { out += value.slice(i, k + 4); i = k + 4; continue; }
    const close = matchClose(value, k + 3);
    if (close === -1) { out += value.slice(i); break; }
    out += value.slice(i, k);
    const inner = value.slice(k + 4, close);
    const comma = indexOutside(inner, ",");
    const name = (comma === -1 ? inner : inner.slice(0, comma)).trim();
    const fallback = comma === -1 ? undefined : inner.slice(comma + 1).trim();
    const v = props ? props.get(name) : undefined;
    if (v !== undefined && v !== "") out += resolveVars(v, props, depth + 1);
    else if (fallback !== undefined) out += resolveVars(fallback, props, depth + 1);
    else out += value.slice(k, close + 1);
    i = close + 1;
  }
  return out;
}

export function isUnresolved(value) {
  return typeof value !== "string" || value.includes("var(");
}

// ── Colour ──
const NAMED_SOURCE =
  "aliceblue:f0f8ff,antiquewhite:faebd7,aqua:00ffff,aquamarine:7fffd4,azure:f0ffff,beige:f5f5dc,bisque:ffe4c4," +
  "black:000000,blanchedalmond:ffebcd,blue:0000ff,blueviolet:8a2be2,brown:a52a2a,burlywood:deb887," +
  "cadetblue:5f9ea0,chartreuse:7fff00,chocolate:d2691e,coral:ff7f50,cornflowerblue:6495ed,cornsilk:fff8dc," +
  "crimson:dc143c,cyan:00ffff,darkblue:00008b,darkcyan:008b8b,darkgoldenrod:b8860b,darkgray:a9a9a9," +
  "darkgreen:006400,darkgrey:a9a9a9,darkkhaki:bdb76b,darkmagenta:8b008b,darkolivegreen:556b2f," +
  "darkorange:ff8c00,darkorchid:9932cc,darkred:8b0000,darksalmon:e9967a,darkseagreen:8fbc8f," +
  "darkslateblue:483d8b,darkslategray:2f4f4f,darkslategrey:2f4f4f,darkturquoise:00ced1,darkviolet:9400d3," +
  "deeppink:ff1493,deepskyblue:00bfff,dimgray:696969,dimgrey:696969,dodgerblue:1e90ff,firebrick:b22222," +
  "floralwhite:fffaf0,forestgreen:228b22,fuchsia:ff00ff,gainsboro:dcdcdc,ghostwhite:f8f8ff,gold:ffd700," +
  "goldenrod:daa520,gray:808080,green:008000,greenyellow:adff2f,grey:808080,honeydew:f0fff0,hotpink:ff69b4," +
  "indianred:cd5c5c,indigo:4b0082,ivory:fffff0,khaki:f0e68c,lavender:e6e6fa,lavenderblush:fff0f5," +
  "lawngreen:7cfc00,lemonchiffon:fffacd,lightblue:add8e6,lightcoral:f08080,lightcyan:e0ffff," +
  "lightgoldenrodyellow:fafad2,lightgray:d3d3d3,lightgreen:90ee90,lightgrey:d3d3d3,lightpink:ffb6c1," +
  "lightsalmon:ffa07a,lightseagreen:20b2aa,lightskyblue:87cefa,lightslategray:778899,lightslategrey:778899," +
  "lightsteelblue:b0c4de,lightyellow:ffffe0,lime:00ff00,limegreen:32cd32,linen:faf0e6,magenta:ff00ff," +
  "maroon:800000,mediumaquamarine:66cdaa,mediumblue:0000cd,mediumorchid:ba55d3,mediumpurple:9370db," +
  "mediumseagreen:3cb371,mediumslateblue:7b68ee,mediumspringgreen:00fa9a,mediumturquoise:48d1cc," +
  "mediumvioletred:c71585,midnightblue:191970,mintcream:f5fffa,mistyrose:ffe4e1,moccasin:ffe4b5," +
  "navajowhite:ffdead,navy:000080,oldlace:fdf5e6,olive:808000,olivedrab:6b8e23,orange:ffa500," +
  "orangered:ff4500,orchid:da70d6,palegoldenrod:eee8aa,palegreen:98fb98,paleturquoise:afeeee," +
  "palevioletred:db7093,papayawhip:ffefd5,peachpuff:ffdab9,peru:cd853f,pink:ffc0cb,plum:dda0dd," +
  "powderblue:b0e0e6,purple:800080,rebeccapurple:663399,red:ff0000,rosybrown:bc8f8f,royalblue:4169e1," +
  "saddlebrown:8b4513,salmon:fa8072,sandybrown:f4a460,seagreen:2e8b57,seashell:fff5ee,sienna:a0522d," +
  "silver:c0c0c0,skyblue:87ceeb,slateblue:6a5acd,slategray:708090,slategrey:708090,snow:fffafa," +
  "springgreen:00ff7f,steelblue:4682b4,tan:d2b48c,teal:008080,thistle:d8bfd8,tomato:ff6347," +
  "turquoise:40e0d0,violet:ee82ee,wheat:f5deb3,white:ffffff,whitesmoke:f5f5f5,yellow:ffff00,yellowgreen:9acd32";

export const NAMED_COLORS = new Map(NAMED_SOURCE.split(",").map((pair) => {
  const [name, hex] = pair.split(":");
  return [name, { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16) }];
}));

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function component(tok, percentScale) {
  const t = tok.trim().toLowerCase();
  if (t === "none") return 0;
  const n = parseFloat(t);
  if (!Number.isFinite(n) || !/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?%?$/.test(t)) return NaN;
  return t.endsWith("%") ? (n / 100) * percentScale : n;
}

function hueDegrees(tok) {
  const t = tok.trim().toLowerCase();
  if (t === "none") return 0;
  const n = parseFloat(t);
  if (!Number.isFinite(n)) return NaN;
  if (t.endsWith("turn")) return n * 360;
  if (t.endsWith("grad")) return n * 0.9;
  if (t.endsWith("rad")) return (n * 180) / Math.PI;
  return n;
}

function encode(v) {
  const c = clamp(v, 0, 1);
  return 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
}

function decode(v) {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function fromOklab(L, A, B, alpha) {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return {
    r: encode(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: encode(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: encode(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    a: alpha,
  };
}

function hslToRgb(h, s, l, a) {
  const k = (n) => (n + h / 30) % 12;
  const amp = s * Math.min(l, 1 - l);
  const f = (n) => l - amp * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return { r: 255 * f(0), g: 255 * f(8), b: 255 * f(4), a };
}

function functionArgs(body) {
  if (body.includes(",")) {
    const parts = body.split(",").map((p) => p.trim());
    return { parts: parts.slice(0, 3), alpha: parts[3] };
  }
  const [main, alpha] = body.split("/");
  return { parts: main.trim().split(/\s+/), alpha: alpha === undefined ? undefined : alpha.trim() };
}

// parseColor(value) -> { r, g, b, a } (channels 0-255, unrounded) or null. Reads hex,
// rgb()/rgba(), hsl()/hsla(), oklch(), oklab(), transparent and the 148 named colours.
// color-mix(), relative colour syntax, currentColor, system colours and any value still
// holding a var() return null: an unknown colour is never guessed.
export function parseColor(value) {
  if (typeof value !== "string") return null;
  const s = value.trim().toLowerCase();
  if (!s || s.includes("var(") || s.includes("calc(") || /\bfrom\b/.test(s)) return null;
  if (s === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  let m = /^#([0-9a-f]{3,8})$/.exec(s);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
    if (h.length !== 6 && h.length !== 8) return null;
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 };
  }
  m = /^(rgba?|hsla?|oklch|oklab)\(\s*([^()]*)\)$/.exec(s);
  if (m) {
    const { parts, alpha } = functionArgs(m[2]);
    if (parts.length < 3) return null;
    const a = alpha === undefined ? 1 : clamp(component(alpha, 1), 0, 1);
    if (Number.isNaN(a)) return null;
    let rgb;
    if (m[1].startsWith("rgb")) {
      const [r, g, b] = parts.map((p) => component(p, 255));
      rgb = { r, g, b, a };
    } else if (m[1].startsWith("hsl")) {
      const h = hueDegrees(parts[0]);
      const sat = parseFloat(parts[1]) / 100;
      const lig = parseFloat(parts[2]) / 100;
      rgb = hslToRgb(((h % 360) + 360) % 360, clamp(sat, 0, 1), clamp(lig, 0, 1), a);
    } else if (m[1] === "oklch") {
      const L = parts[0].trim().endsWith("%") ? parseFloat(parts[0]) / 100 : component(parts[0], 1);
      const C = component(parts[1], 0.4);
      const H = (hueDegrees(parts[2]) * Math.PI) / 180;
      rgb = fromOklab(L, C * Math.cos(H), C * Math.sin(H), a);
    } else {
      const L = parts[0].trim().endsWith("%") ? parseFloat(parts[0]) / 100 : component(parts[0], 1);
      rgb = fromOklab(L, component(parts[1], 0.4), component(parts[2], 0.4), a);
    }
    if ([rgb.r, rgb.g, rgb.b].some((v) => !Number.isFinite(v))) return null;
    return { r: clamp(rgb.r, 0, 255), g: clamp(rgb.g, 0, 255), b: clamp(rgb.b, 0, 255), a: rgb.a };
  }
  const named = NAMED_COLORS.get(s);
  return named ? { ...named, a: 1 } : null;
}

// toOklch({ r, g, b }) -> { L, C, H } (L 0-1, H in degrees 0-360).
export function toOklch({ r, g, b }) {
  const R = decode(r);
  const G = decode(g);
  const B = decode(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const Bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  let H = (Math.atan2(Bb, A) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L, C: Math.sqrt(A * A + Bb * Bb), H };
}

export function toHex({ r, g, b }) {
  return `#${[r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0")).join("")}`;
}

export function rgbSpread({ r, g, b }) {
  return Math.max(r, g, b) - Math.min(r, g, b);
}

// WCAG 2.x relative luminance and contrast ratio.
export function relativeLuminance({ r, g, b }) {
  return 0.2126 * decode(r) + 0.7152 * decode(g) + 0.0722 * decode(b);
}

export function contrastRatio(a, b) {
  const x = relativeLuminance(a);
  const y = relativeLuminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// composite(fg, bg): fg's alpha laid over an opaque bg.
export function composite(fg, bg) {
  const a = fg.a === undefined ? 1 : fg.a;
  return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 };
}

// ratioLabel(ratio, threshold): one decimal; two when one would round a failing ratio up to
// the bar; truncated when two would still reach it. A failing ratio never prints as the bar.
export function ratioLabel(ratio, threshold) {
  const one = ratio.toFixed(1);
  if (!(ratio < threshold) || Number(one) < threshold) return one;
  const two = ratio.toFixed(2);
  if (Number(two) < threshold) return two;
  return (Math.floor(ratio * 100) / 100).toFixed(2);
}

// ── Font stacks ──
const GENERIC_FAMILIES = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "math", "emoji", "fangsong", "inherit", "initial", "unset", "revert", "revert-layer", "default"]);
const CSS_WIDE = new Set(["inherit", "initial", "unset", "revert", "revert-layer", "default"]);
const SYSTEM_FAMILIES = new Set(["system-ui", "ui-sans-serif", "ui-serif", "ui-rounded", "ui-monospace", "-apple-system", "apple-system", "blinkmacsystemfont", "sf mono", "new york", "system"]);
const SYSTEM_FONT_KEYWORDS = /^(?:caption|icon|menu|message-box|small-caption|status-bar|-apple-system[\w-]*)$/i;
const FONT_SIZE_TOKEN = /^(?:[+-]?(?:\d+\.?\d*|\.\d+)(?:px|rem|em|%|pt|pc|vw|vh|vmin|vmax|ch|ex|q|mm|cm|in|cqw|cqi)|xx-small|x-small|small|medium|large|x-large|xx-large|xxx-large|larger|smaller|(?:calc|clamp|min|max|var)\(.*\))$/i;

export function isSystemFamily(name) {
  const n = String(name).toLowerCase().trim();
  return SYSTEM_FAMILIES.has(n) || /^(?:sf pro|sf compact|segoe ui)\b/.test(n);
}

function splitFamilies(list) {
  return splitOutside(list, ",").map((f) => f.replace(/^["']|["']$/g, "").trim()).filter(Boolean);
}

// The font shorthand: [style] [variant] [weight] [stretch] size[/line-height] family-list.
export function fontShorthandParts(value) {
  const tokens = splitOutside(value, " ");
  if (tokens.length === 1 && SYSTEM_FONT_KEYWORDS.test(tokens[0])) return { size: null, lineHeight: null, families: ["system-ui"] };
  for (let i = 0; i < tokens.length; i++) {
    const [size, lh] = tokens[i].split("/");
    if (!FONT_SIZE_TOKEN.test(size)) continue;
    let lineHeight = lh || null;
    let rest = i + 1;
    if (!lineHeight && tokens[rest] === "/") { lineHeight = tokens[rest + 1] || null; rest += 2; }
    else if (!lineHeight && tokens[rest] && tokens[rest].startsWith("/")) { lineHeight = tokens[rest].slice(1) || tokens[rest + 1]; rest += tokens[rest] === "/" ? 2 : 1; }
    return { size, lineHeight, families: splitFamilies(tokens.slice(rest).join(" ")) };
  }
  return { size: null, lineHeight: null, families: [] };
}

// fontStack(block, props) -> [families] from the last font-family or font declaration.
export function fontStack(block, props) {
  let value = null;
  for (const d of block.decls) {
    if (d.prop === "font-family") value = { kind: "family", v: d.value };
    else if (d.prop === "font") value = { kind: "font", v: d.value };
  }
  if (!value) return [];
  const resolved = resolveVars(value.v, props);
  if (value.kind === "family") return splitFamilies(resolved);
  return fontShorthandParts(resolved).families;
}

// primaryFamily(stack) -> { kind: "system"|"face"|"none", name }. CSS generic keywords are
// skipped; a first remaining family that is a platform face makes the stack a system stack;
// an unresolved var() first makes it unknown ("none"); a stack of generics alone is the
// platform default ("system"). `name` is lower-cased.
export function primaryFamily(stack) {
  if (!stack || stack.length === 0) return { kind: "none", name: null };
  let generic = null;
  for (const f of stack) {
    const n = f.toLowerCase().trim();
    if (GENERIC_FAMILIES.has(n)) { if (!generic && !CSS_WIDE.has(n)) generic = n; continue; }
    if (n.includes("var(")) return { kind: "none", name: null };
    if (isSystemFamily(n)) return { kind: "system", name: n };
    return { kind: "face", name: n };
  }
  return generic ? { kind: "system", name: generic } : { kind: "none", name: null };
}

// ── Waivers ──
const WAIVER_MARKER = /(?:anti-slop-allow|unslop-ignore)\b/i;

// parseWaiver(rawLine, knownIds) -> null (no marker) | { all: true } (line-wide) |
// { rules: Set, unknown: [] } (scoped). The scoped form is syntactic:
// `anti-slop-allow: <id>[, <id>] -- <reason>`. A marker without ` -- ` is free text and
// line-wide, as it always was. With ` -- `, every token before it must be a known id; if any
// is not, the waiver suppresses nothing and `unknown` names the ids, so a waiver that cannot
// match never silently widens.
export function parseWaiver(rawLine, knownIds) {
  const m = WAIVER_MARKER.exec(String(rawLine));
  if (!m) return null;
  const rest = rawLine.slice(m.index + m[0].length).replace(/^\s*:/, "");
  const sep = /\s--(?=\s|$)/.exec(rest);
  if (!sep) return { all: true };
  const ids = rest.slice(0, sep.index).split(/[\s,]+/).filter(Boolean);
  if (ids.length === 0) return { all: true };
  const known = knownIds instanceof Set ? knownIds : new Set(knownIds || []);
  const unknown = ids.filter((id) => !known.has(id));
  if (unknown.length) return { rules: new Set(), unknown };
  return { rules: new Set(ids), unknown: [] };
}

export function waiverCovers(waiver, ruleId) {
  return Boolean(waiver && (waiver.all || waiver.rules.has(ruleId)));
}

// ── Block helpers ──
export function declEntry(block, prop) {
  let found;
  for (const d of block.decls) if (d.prop === prop) found = d;
  return found;
}

export function decl(block, prop) {
  const d = declEntry(block, prop);
  return d ? d.value : undefined;
}

// A length in px: px, rem and em at 16px, 0; anything else (%, vw, calc(), var()) is not
// a number this module will guess.
export function lengthPx(value, props) {
  if (value === undefined || value === null) return undefined;
  const v = resolveVars(String(value), props).trim().toLowerCase();
  if (v === "0") return 0;
  const m = /^([+-]?(?:\d+\.?\d*|\.\d+))(px|rem)$/.exec(v);
  if (!m) return undefined;
  return m[2] === "px" ? Number(m[1]) : Number(m[1]) * 16;
}

export function fontSizePx(block, props) {
  let size;
  for (const d of block.decls) {
    if (d.prop === "font-size") size = d.value;
    else if (d.prop === "font") { const p = fontShorthandParts(resolveVars(d.value, props)); if (p.size) size = p.size; }
  }
  return lengthPx(size, props);
}

export function fontWeight(block, props) {
  let w;
  for (const d of block.decls) {
    if (d.prop === "font-weight") w = resolveVars(d.value, props);
    else if (d.prop === "font") { const m = /(?:^|\s)(bold|bolder|[1-9]00)(?=\s)/i.exec(resolveVars(d.value, props)); if (m) w = m[1]; }
  }
  if (w === undefined) return 400;
  if (/^(?:bold|bolder)$/i.test(String(w).trim())) return 700;
  const n = parseFloat(w);
  return Number.isFinite(n) ? n : 400;
}

export function lineHeightValue(block, props) {
  let lh;
  for (const d of block.decls) {
    if (d.prop === "line-height") lh = d.value;
    else if (d.prop === "font") { const p = fontShorthandParts(resolveVars(d.value, props)); if (p.lineHeight) lh = p.lineHeight; }
  }
  return lh === undefined ? undefined : resolveVars(lh, props).trim();
}

// Selector structure: compounds split on combinators, the last compound is the subject.
export function compoundsOf(selector) {
  return String(selector).trim().split(/\s*[>+~]\s*|\s+(?![^[(]*[\])])/).filter(Boolean);
}

export function subjectOf(selector) {
  const c = compoundsOf(selector);
  return c[c.length - 1] || "";
}

export function tagOfCompound(compound) {
  const m = /^([a-zA-Z][\w-]*)/.exec(compound);
  return m ? m[1].toLowerCase() : null;
}

export function classWordsOf(compound) {
  const words = [];
  for (const m of String(compound).matchAll(/[.#]([\w-]+)/g)) words.push(m[1].toLowerCase(), ...m[1].toLowerCase().split(/[-_]+/));
  return words;
}

export function inAtRule(block, re) {
  return block.atRules.some((a) => re.test(a));
}

export const REDUCED_MOTION = /prefers-reduced-motion\s*:\s*reduce/i;

// ── Per-file context ──
function lazy(obj, key, fn) {
  Object.defineProperty(obj, key, {
    configurable: true,
    enumerable: true,
    get() {
      const value = fn();
      Object.defineProperty(obj, key, { value, enumerable: true, configurable: true });
      return value;
    },
  });
}

// makeContext(content, ext, { designSystem }) -> { ext, content, text, rawLines, lines,
// lineOf, classSets, effectiveSets, css, props, pageGround, designSystem, memo }. Every field
// after rawLines is computed on first read and once per file; detectors take the context and
// share it. `designSystem` is a readDesignSystem() result or null.
export function makeContext(content, ext, extras = {}) {
  const e = normExt(ext);
  const { text, rawLines } = prepareSource(content, e);
  const ctx = { ext: e, content, text, rawLines, designSystem: extras.designSystem || null, memo: new Map() };
  lazy(ctx, "lineOf", () => lineIndex(text));
  lazy(ctx, "lines", () => text.split("\n"));
  lazy(ctx, "classSets", () => classTokenSets(text, ctx.lineOf));
  lazy(ctx, "effectiveSets", () => effectiveClassSets(ctx.classSets));
  lazy(ctx, "css", () => cssBlocks(text, e, ctx.lineOf));
  lazy(ctx, "props", () => customProperties(ctx.css.blocks));
  lazy(ctx, "pageGround", () => pageGroundOf(ctx));
  return ctx;
}

export function memo(ctx, key, fn) {
  if (!ctx.memo.has(key)) ctx.memo.set(key, fn(ctx));
  return ctx.memo.get(key);
}

// backgroundOf(block, props) -> undefined (none declared) | { kind: "colour", colour } |
// { kind: "none" } (transparent) | { kind: "image" } | { kind: "unknown" }, with `entry`.
export function backgroundOf(block, props) {
  let entry;
  let image = false;
  for (const d of block.decls) {
    if (d.prop === "background" || d.prop === "background-color") entry = d;
    if (d.prop === "background-image" && !/^\s*none\s*$/i.test(d.value)) image = true;
  }
  if (image) return { kind: "image", entry };
  if (!entry) return undefined;
  const v = resolveVars(entry.value, props).trim();
  if (/url\(|gradient\(|image\(|image-set\(|element\(/i.test(v)) return { kind: "image", entry };
  if (/^(?:none|transparent|initial|unset|inherit|revert)$/i.test(v)) return { kind: "none", entry };
  if (v.includes("var(")) return { kind: "unknown", entry };
  const tokens = splitOutside(v, " ");
  const colours = [];
  for (const t of tokens) {
    const c = parseColor(t);
    if (c) colours.push(c);
    else if (!/^(?:no-repeat|repeat|repeat-x|repeat-y|space|round|center|top|bottom|left|right|fixed|scroll|local|border-box|padding-box|content-box|cover|contain|auto|\/|[+-]?(?:\d+\.?\d*|\.\d+)(?:px|rem|em|%)?)$/i.test(t)) return { kind: "unknown", entry };
  }
  if (colours.length === 1) return colours[0].a <= 0.001 ? { kind: "none", entry } : { kind: "colour", colour: colours[0], entry };
  return colours.length === 0 ? { kind: "none", entry } : { kind: "unknown", entry };
}

// The page ground: the opaque colour background of the last html/body/:root block outside
// any at-rule, or null when there is none (an undeclared ground is unknown, not white).
function pageGroundOf(ctx) {
  let ground = null;
  for (const b of ctx.css.blocks) {
    if (b.inline || b.atRules.length) continue;
    if (!splitSelectorList(b.selector).some((s) => /^(?::root|html|body)$/i.test(s.trim()))) continue;
    const bg = backgroundOf(b, ctx.props);
    if (!bg) continue;
    ground = bg.kind === "colour" && bg.colour.a >= 0.99 ? bg.colour : null;
  }
  return ground;
}

// ── Selector helpers for the detectors ──
function normSelector(selector) {
  return String(selector).replace(/\s+/g, " ").trim();
}

function selectorIndex(blocks) {
  const map = new Map();
  for (const b of blocks) if (!b.inline) map.set(normSelector(b.selector), b);
  return map;
}

// The ancestors of a plain descendant chain, nearest first: `.card .body .meta` ->
// [".card .body", ".card"]. Any other combinator or a selector list has none.
function descendantAncestors(selector) {
  const s = normSelector(selector);
  if (s.includes(",") || /[>+~]/.test(s)) return [];
  const parts = compoundsOf(s);
  const out = [];
  for (let k = parts.length - 1; k >= 1; k--) out.push(parts.slice(0, k).join(" "));
  return out;
}

const DARK_SCOPE = /prefers-color-scheme\s*:\s*dark|^print$|\bprint\b/i;
const DARK_SELECTOR = /(?:^|[\s.#[(:,-])dark(?![\w-])|data-(?:theme|mode|color-scheme)\s*=\s*["']?dark/i;

// ── low-contrast and low-contrast-near-bar ──
// WCAG 1.4.3 on declared surfaces only. A pair is measured when the text colour and its
// surface are both known: the block's own background, the background of the exact block
// its plain descendant chain names, or the page ground when nothing else in the file paints
// a surface. Anything else is not measured, and no number is printed for it.
const CONTRAST_SKIP = /:disabled\b|\[disabled\]|\[aria-disabled=["']?true|::?selection\b|::?marker\b|:visited\b|sr-only|visually-hidden|screen-reader/i;
const CONTRAST_SKIP_SUBJECT = new Set(["svg", "path", "circle", "rect", "line", "polyline", "polygon", "hr", "img", "video", "canvas", "iframe"]);
const STATE_PSEUDO = /:hover\b|:focus-visible\b|:focus-within\b|:focus\b|:active\b/g;
const PLACEHOLDER = /::?placeholder\b/g;

function surfaceFrom(bg, ground) {
  if (!bg) return undefined;
  if (bg.kind === "none") return undefined;
  if (bg.kind !== "colour") return null;
  if (bg.colour.a >= 0.99) return bg.colour;
  return ground ? composite(bg.colour, ground) : null;
}

// colourPairs(ctx) -> every text colour paired with the surface the file declares for it:
// { block, sel, fg, surface, source ("block" | "ancestor" | "page ground"), state, placeholder,
// size, weight, colorEntry, ownBg }. Unknown surfaces and unparseable colours are left out.
export function colourPairs(ctx) {
  return memo(ctx, "colourPairs", () => {
    const props = ctx.props;
    const ground = ctx.pageGround;
    const blocks = ctx.css.blocks.filter((b) => !b.selector.startsWith("@") && !inAtRule(b, DARK_SCOPE) && !DARK_SELECTOR.test(b.selector));
    const bySelector = selectorIndex(blocks);
    const groundOnly = Boolean(ground) && !blocks.some((b) => {
      if (isRootSelector(b.selector) || /::?(?:selection|marker|placeholder)\b/i.test(b.selector)) return false;
      const bg = backgroundOf(b, props);
      if (!bg || bg.kind === "none") return false;
      if (bg.kind !== "colour") return true;
      return bg.colour.a >= 0.99 && toHex(bg.colour) !== toHex(ground);
    });
    const pairs = [];
    for (const b of blocks) {
      const sel = normSelector(b.selector);
      if (CONTRAST_SKIP.test(sel)) continue;
      if (CONTRAST_SKIP_SUBJECT.has(tagOfCompound(subjectOf(sel)) || "")) continue;
      if (b.decls.some((d) => /^(?:-webkit-)?background-clip$/.test(d.prop) && /text/i.test(d.value))) continue;
      const state = (sel.match(STATE_PSEUDO) || [])[0] || null;
      const placeholder = PLACEHOLDER.test(sel);
      PLACEHOLDER.lastIndex = 0;
      const baseSel = state || placeholder ? normSelector(sel.replace(STATE_PSEUDO, "").replace(PLACEHOLDER, "")) : null;
      const base = baseSel ? bySelector.get(baseSel) || null : null;
      let colorEntry = declEntry(b, "color");
      const ownBg = backgroundOf(b, props);
      if (state && !colorEntry && !ownBg) continue;
      if (state && !colorEntry && base) colorEntry = declEntry(base, "color");
      if (!colorEntry) continue;
      if (/^(?:transparent|currentcolor|inherit|initial|unset|revert)$/i.test(colorEntry.value.trim())) continue;
      let fg = parseColor(resolveVars(colorEntry.value, props));
      if (!fg || fg.a <= 0.02) continue;
      let surface = surfaceFrom(ownBg, ground);
      let source = "block";
      if (surface === undefined && base) surface = surfaceFrom(backgroundOf(base, props), ground);
      if (surface === undefined && !b.inline) {
        for (const anc of descendantAncestors(baseSel || sel)) {
          const a = bySelector.get(anc);
          if (!a) continue;
          const sfc = surfaceFrom(backgroundOf(a, props), ground);
          if (sfc === undefined) continue;
          surface = sfc;
          source = "ancestor";
          break;
        }
      }
      if (surface === undefined && groundOnly) { surface = ground; source = "page ground"; }
      if (!surface) continue;
      if (fg.a < 1) fg = composite(fg, surface);
      const size = fontSizePx(b, props) ?? (base ? fontSizePx(base, props) : undefined) ?? 16;
      const weight = Math.max(fontWeight(b, props), base ? fontWeight(base, props) : 0);
      pairs.push({ block: b, sel, fg, surface, source, state, placeholder, size, weight, colorEntry, ownBg });
    }
    return pairs;
  });
}

export function lowContrastHits(ctx) {
  return memo(ctx, "lowContrast", () => {
    const hasLabel = /<label\b/i.test(ctx.text);
    const hits = [];
    const seen = new Set();
    for (const p of colourPairs(ctx)) {
      const large = p.size >= 24 || (p.size >= 18.66 && p.weight >= 700);
      const bar = large ? 3 : 4.5;
      const ratio = contrastRatio(p.fg, p.surface);
      if (ratio >= bar) continue;
      const key = `${p.state ? "s" : "r"}${toHex(p.fg)}${toHex(p.surface)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const label = ratioLabel(ratio, bar);
      const nearBar = (p.placeholder && hasLabel) || Number(label) >= (large ? 2.8 : 4.2);
      const at = declEntry(p.block, "color") || (p.ownBg && p.ownBg.entry) || p.colorEntry;
      const prefix = p.state ? `${p.state} state: ` : p.placeholder ? "placeholder: " : "";
      hits.push({
        line: at.line || p.block.line,
        near: nearBar,
        ratio,
        evidence: `${prefix}${p.sel} ${label}:1 (need ${bar}:1), text ${toHex(p.fg)} on ${toHex(p.surface)} (${p.source})`,
      });
    }
    return hits;
  });
}

// ── side-stripe-accent ──
// A coloured stripe on one side of a card, whatever draws it: a side border, an absolute
// ::before/::after bar, an inset side shadow, a JSX style object, or a Tailwind border-l-N.
// Square boxes count too (a thicker bar is needed, 3px). Selection and live-region edges are
// substance, not decoration, and are exempt; so are controls, table parts, list items and
// inline text, which carry side rules for their own reasons.
const STRIPE_EXEMPT_TAGS = new Set(["a", "button", "input", "select", "textarea", "option", "pre", "code", "kbd", "span", "th", "td", "tr", "table", "li", "hr", "nav", "summary", "img", "svg", "html", "body"]);
const STRIPE_STATE = /:hover\b|:focus\b|:focus-visible\b|:active\b|\[aria-selected|\[aria-current|\[aria-invalid|:invalid\b|\[role=["']?(?:status|alert|alertdialog|log)\b|\[aria-live|\.(?:is-)?(?:active|current|selected)(?![\w-])/i;
const STRIPE_CONTROL_WORDS = new Set(["btn", "button", "input", "field", "select", "textarea"]);
const NEUTRAL_KEYWORD = /^(?:transparent|currentcolor|inherit|initial|unset|white|black|silver|gainsboro|whitesmoke|(?:dark|light|dim|slate|lightslate|darkslate)?gr[ae]y)$/i;
const BORDER_STYLES = new Set(["none", "hidden", "solid", "double", "dotted", "dashed", "groove", "ridge", "inset", "outset"]);
const BORDER_WIDTH_KEYWORD = { thin: 1, medium: 3, thick: 5 };

// true = neutral (clears the hit), false = chromatic, null = unknown (keeps the hit).
function colourNeutral(token, props) {
  if (token === undefined || token === null) return null;
  const t = resolveVars(String(token), props).trim();
  if (NEUTRAL_KEYWORD.test(t)) return true;
  const c = parseColor(t);
  if (!c) return null;
  return c.a < 0.1 || rgbSpread(c) < 30;
}

function parseBorderValue(value, props) {
  const out = { width: undefined, style: undefined, colour: undefined };
  for (const tok of splitOutside(resolveVars(value, props), " ")) {
    const t = tok.toLowerCase();
    if (BORDER_STYLES.has(t)) out.style = t;
    else if (BORDER_WIDTH_KEYWORD[t] !== undefined) out.width = BORDER_WIDTH_KEYWORD[t];
    else if (lengthPx(t, props) !== undefined) out.width = lengthPx(t, props);
    else out.colour = tok;
  }
  return out;
}

function expandBox(value, props, read) {
  const parts = splitOutside(resolveVars(value, props), " ").map(read);
  const [t, r = t, b = t, l = r] = parts;
  return { top: t, right: r, bottom: b, left: l };
}

const SIDE_OF = { left: "left", right: "right", top: "top", bottom: "bottom", "inline-start": "left", "inline-end": "right", "block-start": "top", "block-end": "bottom" };

// The final width, style and colour of each border side after every declaration in order.
function borderSides(block, props) {
  const sides = {};
  for (const s of ["top", "right", "bottom", "left"]) sides[s] = { width: 0, style: "none", colour: undefined, line: block.line };
  let at = block.line;
  const apply = (names, parsed) => {
    for (const n of names) {
      sides[n].line = at;
      if (parsed.width !== undefined) sides[n].width = parsed.width;
      if (parsed.style !== undefined) sides[n].style = parsed.style;
      if (parsed.colour !== undefined) sides[n].colour = parsed.colour;
    }
  };
  for (const d of block.decls) {
    const p = d.prop;
    at = d.line;
    let m;
    if (p === "border") {
      const v = parseBorderValue(d.value, props);
      apply(["top", "right", "bottom", "left"], { width: v.width ?? 3, style: v.style ?? "none", colour: v.colour ?? null });
    } else if (p === "border-width") {
      const box = expandBox(d.value, props, (t) => lengthPx(t, props) ?? BORDER_WIDTH_KEYWORD[t] ?? 0);
      for (const s of Object.keys(box)) sides[s].width = box[s];
    } else if (p === "border-style") {
      const box = expandBox(d.value, props, (t) => t.toLowerCase());
      for (const s of Object.keys(box)) sides[s].style = box[s];
    } else if (p === "border-color") {
      const box = expandBox(d.value, props, (t) => t);
      for (const s of Object.keys(box)) sides[s].colour = box[s];
    } else if (p === "border-inline" || p === "border-block") {
      const v = parseBorderValue(d.value, props);
      apply(p === "border-inline" ? ["left", "right"] : ["top", "bottom"], { width: v.width ?? 3, style: v.style ?? "none", colour: v.colour ?? null });
    } else if ((m = /^border-(left|right|top|bottom|inline-start|inline-end|block-start|block-end)$/.exec(p))) {
      const v = parseBorderValue(d.value, props);
      apply([SIDE_OF[m[1]]], { width: v.width ?? 3, style: v.style ?? "none", colour: v.colour ?? null });
    } else if ((m = /^border-(left|right|top|bottom|inline-start|inline-end|block-start|block-end)-(width|style|color)$/.exec(p))) {
      const s = sides[SIDE_OF[m[1]]];
      s.line = d.line;
      const v = resolveVars(d.value, props).trim();
      if (m[2] === "width") s.width = lengthPx(v, props) ?? BORDER_WIDTH_KEYWORD[v.toLowerCase()] ?? s.width;
      else if (m[2] === "style") s.style = v.toLowerCase();
      else s.colour = v;
    }
  }
  return sides;
}

// Corner radii in px; undefined where a corner cannot be read (var(), calc(), unknown).
function cornerRadii(block, props) {
  const r = { tl: null, tr: null, br: null, bl: null };
  const read = (t) => {
    const v = String(t).trim();
    if (/^\d*\.?\d+%$/.test(v)) return parseFloat(v) > 0 ? 999 : 0;
    const px = lengthPx(v, props);
    return px === undefined ? undefined : px;
  };
  for (const d of block.decls) {
    if (d.prop === "border-radius") {
      const [t, rr = t, b = t, l = rr] = splitOutside(resolveVars(d.value, props).split("/")[0], " ").map(read);
      Object.assign(r, { tl: t, tr: rr, br: b, bl: l });
    }
    const m = /^border-(top|bottom|start|end)-(left|right|start|end)-radius$/.exec(d.prop);
    if (m) {
      const key = { "top-left": "tl", "top-right": "tr", "bottom-right": "br", "bottom-left": "bl", "start-start": "tl", "start-end": "tr", "end-end": "br", "end-start": "bl" }[`${m[1]}-${m[2]}`];
      r[key] = read(splitOutside(resolveVars(d.value, props), " ")[0] || "");
    }
  }
  return r;
}

// "rounded" | "square" | "unknown" for the two corners away from the stripe side. An
// unknown radius is not evidence of a square box, and is treated as rounded.
function farCorners(block, props, side) {
  const r = cornerRadii(block, props);
  const far = side === "left" ? [r.tr, r.br] : [r.tl, r.bl];
  if (far.every((v) => v === null)) return { shape: "unknown" };
  if (far.some((v) => v === undefined || v === null)) return { shape: "unknown" };
  return far.every((v) => v >= 4) ? { shape: "rounded", px: Math.min(...far) } : { shape: "square" };
}

function stripeExempt(ctx, selector) {
  const list = splitSelectorList(selector);
  return list.every((sel) => {
    if (STRIPE_STATE.test(sel)) return true;
    const host = sel.replace(/::?(?:before|after)\b/g, "");
    if (classWordsOf(subjectOf(host)).some((w) => STRIPE_CONTROL_WORDS.has(w))) return true;
    const tags = subjectTags(ctx, host);
    return tags.length > 0 && tags.every((tag) => STRIPE_EXEMPT_TAGS.has(tag));
  });
}

const PSEUDO_HOST_EXEMPT = new Set(["pre", "code", "nav", "hr"]);
const STRIPE_SHAPE = (shape, px) => (shape === "square" ? "a square box" : shape === "rounded" ? `a rounded card (${px}px)` : "a card");

function stripeFromBorders(b, props) {
  const sides = borderSides(b, props);
  for (const side of ["left", "right"]) {
    const s = sides[side];
    if (!(s.width >= 2) || (s.style !== "solid" && s.style !== "double")) continue;
    const others = ["top", "bottom", side === "left" ? "right" : "left"].map((k) => (sides[k].style === "none" || sides[k].style === "hidden" ? 0 : sides[k].width));
    const widest = Math.max(...others);
    if (!(widest <= 1 || s.width >= 2 * widest)) continue;
    if (colourNeutral(s.colour, props) === true) continue;
    const corner = farCorners(b, props, side);
    if (corner.shape === "square" && s.width < 3) continue;
    const colourText = s.colour ? ` ${resolveVars(String(s.colour), props).trim()}` : "";
    return { line: s.line, evidence: `border-${side}: ${s.width}px ${s.style}${colourText} on ${STRIPE_SHAPE(corner.shape, corner.px)}` };
  }
  return null;
}

function stripeFromPseudo(b, props) {
  if (!/::?(?:before|after)\b/.test(b.selector)) return null;
  const hosts = splitSelectorList(b.selector).map((s) => tagOfCompound(subjectOf(s.replace(/::?(?:before|after)\b/g, ""))));
  if (hosts.length && hosts.every((h) => h && PSEUDO_HOST_EXEMPT.has(h))) return null;
  if (!/^(?:absolute|fixed)$/i.test(String(decl(b, "position") || "").trim())) return null;
  const w = lengthPx(decl(b, "width"), props);
  if (!(w >= 3 && w <= 12)) return null;
  const inset = decl(b, "inset") !== undefined;
  const top = lengthPx(decl(b, "top"), props);
  const bottom = lengthPx(decl(b, "bottom"), props);
  const fullHeight = inset || (top !== undefined && bottom !== undefined && top >= 0 && top <= 20 && bottom >= 0 && bottom <= 20) || /^100%$/.test(String(decl(b, "height") || "").trim());
  const atSide = inset || lengthPx(decl(b, "left"), props) === 0 || lengthPx(decl(b, "right"), props) === 0 || lengthPx(decl(b, "inset-inline-start"), props) === 0;
  if (!fullHeight || !atSide) return null;
  const bg = backgroundOf(b, props);
  if (!bg || bg.kind !== "colour") return null;
  if (colourNeutral(toHex(bg.colour), props) === true || bg.colour.a < 0.1) return null;
  return { line: bg.entry.line, evidence: `${subjectOf(b.selector).match(/::?(?:before|after)/)[0]} ${w}px bar ${toHex(bg.colour)}` };
}

function stripeFromInsetShadow(b, props) {
  const w = lengthPx(decl(b, "width"), props);
  if (w !== undefined && w <= 40) return null;
  for (const d of b.decls) {
    if (d.prop !== "box-shadow" && d.prop !== "-webkit-box-shadow") continue;
    for (const layer of splitOutside(resolveVars(d.value, props), ",")) {
      const toks = splitOutside(layer, " ");
      if (!toks.some((t) => t.toLowerCase() === "inset")) continue;
      const lengths = [];
      let colour;
      for (const t of toks) {
        if (t.toLowerCase() === "inset") continue;
        const px = lengthPx(t, props);
        if (px !== undefined) lengths.push(px);
        else colour = t;
      }
      const [x = 0, y = 0, blur = 0, spread = 0] = lengths;
      if (Math.abs(x) < 3 || Math.abs(x) > 12 || y !== 0 || blur !== 0 || spread !== 0) continue;
      if (colourNeutral(colour, props) === true) continue;
      return { line: d.line, evidence: `inset ${Math.abs(x)}px side shadow${colour ? ` ${colour}` : ""}` };
    }
  }
  return null;
}

const TW_SIDE = /^border-([lrse])-(?:(\d+)|\[(\d+(?:\.\d+)?)px\])$/;
const TW_STRIPE_COLOUR = /^border-(?:[lrse]-)?(?:([a-z]+)-(\d{2,3})|(primary|accent|brand|success|warning|danger|info)|\[#[0-9a-f]{3,8}\])$/i;
const TW_NEUTRAL_FAMILY = /^(?:gray|grey|slate|zinc|neutral|stone)$/i;
const TW_STRIPE_TAG_EXEMPT = new Set(["a", "button", "input", "li", "td", "th", "tr", "nav"]);

function stripeFromClassSet(set) {
  if (set.tag && TW_STRIPE_TAG_EXEMPT.has(set.tag)) return null;
  const toks = set.tokens.map(tailwindToken);
  if (toks.some((t) => t.base === "animate-spin")) return null;
  let side = null;
  let n = 0;
  let raw = "";
  for (const t of toks) {
    if (t.variants.some(isStateVariant)) continue;
    const m = TW_SIDE.exec(t.base);
    if (m) { side = m[1]; n = Number(m[2] ?? m[3]); raw = t.base; }
  }
  if (!side) return null;
  const colour = toks.find((t) => !t.variants.some(isStateVariant) && TW_STRIPE_COLOUR.test(t.base) && !TW_SIDE.test(t.base));
  if (!colour) return null;
  const cm = TW_STRIPE_COLOUR.exec(colour.base);
  if (cm[1] && TW_NEUTRAL_FAMILY.test(cm[1])) return null;
  const farSide = side === "l" || side === "s" ? /^rounded-(?:r|e|tr|br|te|be)(?:-|$)/ : /^rounded-(?:l|s|tl|bl|ts|bs)(?:-|$)/;
  const rounded = toks.some((t) => /^rounded(?:-(?:sm|md|lg|xl|2xl|3xl|\[[^\]]+\]))?$/.test(t.base) || farSide.test(t.base));
  if (n < (rounded ? 2 : 4)) return null;
  return `${raw} ${colour.base}${rounded ? " on a rounded card" : ""}`;
}

export function sideStripeHits(ctx) {
  return memo(ctx, "sideStripe", () => {
    const props = ctx.props;
    const hits = [];
    for (const b of ctx.css.blocks) {
      if (b.selector.startsWith("@") || stripeExempt(ctx, b.selector)) continue;
      const found = stripeFromPseudo(b, props) || stripeFromBorders(b, props) || stripeFromInsetShadow(b, props);
      if (found) hits.push({ line: found.line, evidence: `${normSelector(b.selector)}: ${found.evidence}` });
    }
    for (const set of ctx.effectiveSets) {
      const evidence = stripeFromClassSet(set);
      if (evidence) hits.push({ line: set.line, evidence });
    }
    return hits;
  });
}

// ── text-size-floor ──
// Running text below 12px, functional text at or below 10.9px (an 11px floor with a 0.1px
// tolerance), small print at or below 9.9px. Precedence: small print, then reading, then
// functional. A selector that names a label-like word is functional even when it also names a
// reading word (`.post-meta`). Only px, rem and the font shorthand's size are judged.
const READING_TAGS = new Set(["p", "li", "dd", "blockquote", "article"]);
const READING_WORDS = new Set(["body", "copy", "prose", "description", "desc", "lede", "lead", "summary", "excerpt", "paragraph", "text", "content", "entry", "post"]);
const FUNCTIONAL_WORDS = new Set(["badge", "caption", "chip", "label", "meta", "pill", "tag", "preview", "code", "stamp"]);
const SIZE_EXEMPT_TAGS = new Set(["sub", "sup", "option", "code", "kbd", "samp", "var", "pre", "html"]);
const SMALL_PRINT = /(?:^|[^a-z])(?:legal|copyright|fine-?print|disclaimer|disclosures?|small-print)(?![a-z])|(?<![\w-])footnote(?![\w-])/i;
const NOT_SMALL_PRINT_TAGS = new Set(["a", "button", "input", "label"]);

function isCaps(block, props) {
  const tt = resolveVars(String(decl(block, "text-transform") || ""), props);
  const fv = resolveVars(`${decl(block, "font-variant-caps") || ""} ${decl(block, "font-variant") || ""}`, props);
  return /uppercase/i.test(tt) || /small-caps/i.test(fv);
}

function fmtPx(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function textSizeFloorHits(ctx) {
  return memo(ctx, "textSizeFloor", () => {
    const props = ctx.props;
    const hits = [];
    for (const b of ctx.css.blocks) {
      if (b.selector.startsWith("@") || /^:root$/i.test(b.selector.trim())) continue;
      const size = fontSizePx(b, props);
      if (size === undefined || size >= 12) continue;
      const caps = isCaps(b, props);
      for (const sel of splitSelectorList(b.selector)) {
        if (/\[aria-hidden/i.test(sel)) continue;
        const subject = subjectOf(sel);
        const tags = subjectTags(ctx, sel);
        const tag = tags.length === 1 ? tags[0] : tagOfCompound(subject);
        if (tags.length && tags.every((t) => SIZE_EXEMPT_TAGS.has(t))) continue;
        // A utility class (`text-xs`, `font-small`) names a style, not a kind of text.
        const words = classWordsOf(subject.replace(/\.(?:text|font|fs|leading|tracking)-[\w-]+/g, ""));
        let kind = "functional text";
        let floor = 11;
        let fires = size <= 10.9;
        if ((SMALL_PRINT.test(sel) || tag === "small") && !NOT_SMALL_PRINT_TAGS.has(tag || "")) {
          kind = "small print";
          floor = 10;
          fires = size <= 9.9;
        } else if (!words.some((w) => FUNCTIONAL_WORDS.has(w)) && !caps && ((tag && READING_TAGS.has(tag)) || words.some((w) => READING_WORDS.has(w)))) {
          kind = "running text";
          floor = 12;
          fires = size < 12;
        }
        if (!fires) continue;
        const at = declEntry(b, "font-size") || declEntry(b, "font");
        hits.push({ line: at ? at.line : b.line, evidence: `${normSelector(sel)}: font-size ${fmtPx(size)}px (${kind}, floor ${floor}px)` });
        break;
      }
    }
    return hits;
  });
}

// ── Reading mechanics: tight-leading, wide-tracking, justified-narrow-column,
// crushed-tracking ── Block-local judgements: a size or leading inherited from a parent
// rule is not resolved, so these are floors on recall, never guesses.
const HEADING_WORDS = /(?:^|[^a-z])(?:heading|title|headline|display|hero|logo|brand|wordmark)(?![a-z])/i;
const LEADING_EXEMPT_TAGS = new Set(["a", "button", "label", "span", "summary", "small", "code", "kbd", "samp", "pre"]);
const FURNITURE_WORDS = new Set(["btn", "button", "chip", "badge", "tag", "pill", "label", "meta", "stamp", "num", "count", "icon", "kbd", "code", "close", "dismiss", "toggle"]);
const TRACKING_EXEMPT_TAGS = new Set(["a", "button", "label", "nav", "th", "summary"]);
const TRACKING_LABEL_WORDS = new Set(["btn", "eyebrow", "kicker", "overline", "label", "badge", "tag", "chip", "pill", "meta", "num", "step", "caps"]);
const CJK_LANG = /:lang\(\s*["']?(?:ja|zh|ko)\b/i;
const JUSTIFY_EXEMPT_LANG = /:lang\(\s*["']?(?:ar|fa|he|th|ja|zh|ko)\b/i;
const WORDMARK_WORDS = /logo|brand|wordmark|monogram/i;

// A readout (a device code, a tabular figure, text set to copy whole) is never running text.
function isReadout(block, props) {
  return /tabular-nums/i.test(resolveVars(String(decl(block, "font-variant-numeric") || ""), props))
    || /^\s*all\s*$/i.test(String(decl(block, "user-select") ?? decl(block, "-webkit-user-select") ?? ""));
}

// A furniture or label word among the subject's class words always marks a label, whatever
// element the file's markup says the selector styles.
function namesFurniture(subject, extra) {
  return classWordsOf(subject).some((w) => FURNITURE_WORDS.has(w) || (extra && extra.has(w)));
}

function isMonospace(block, props) {
  return fontStack(block, props).some((f) => /mono|courier|consolas|menlo|monaco/i.test(f));
}

function letterSpacingEm(block, props, size) {
  const entry = declEntry(block, "letter-spacing");
  if (!entry) return undefined;
  const v = resolveVars(entry.value, props).trim().toLowerCase();
  if (/^[+-]?(?:\d+\.?\d*|\.\d+)em$/.test(v)) return { em: parseFloat(v), entry };
  const px = lengthPx(v, props);
  if (px === undefined || size === undefined || size <= 0) return undefined;
  return { em: px / size, entry };
}

// Elements of a markup or JSX file with their tag, classes and text (child tags stripped,
// up to the element's own closing tag): enough to tell a six-character label from a
// paragraph, which a stylesheet alone cannot.
function elementsOf(ctx) {
  return memo(ctx, "elements", () => {
    if (!MARKUP_EXT.has(ctx.ext) && ctx.ext !== ".jsx" && ctx.ext !== ".tsx") return [];
    const text = ctx.text;
    const lower = text.toLowerCase();
    const out = [];
    const re = /<([a-zA-Z][\w-]*)(?=[\s>/])/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      let i = m.index + m[0].length;
      let depth = 0;
      while (i < text.length) {
        const c = text[i];
        if (depth === 0 && (c === '"' || c === "'")) { const j = text.indexOf(c, i + 1); i = j === -1 ? text.length : j + 1; continue; }
        if (c === "{") depth++;
        else if (c === "}") depth--;
        else if (c === ">" && depth === 0 && text[i - 1] !== "=") break;
        i++;
      }
      const head = text.slice(m.index + m[0].length, i);
      const attrs = new Map();
      for (const a of head.matchAll(/([A-Za-z_:][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|\{[^}]*\}|([^\s"'=<>`]+)))?/g)) attrs.set(a[1].toLowerCase(), a[2] ?? a[3] ?? a[4] ?? "");
      if (attrs.size === 0) continue;
      const tag = m[1].toLowerCase();
      const close = lower.indexOf(`</${tag}`, i);
      const inner = text.slice(i + 1, close === -1 ? Math.min(text.length, i + 2000) : close);
      const cls = attrs.get("class") ?? attrs.get("classname") ?? "";
      out.push({ tag, attrs, classes: new Set(cls.split(/\s+/).filter(Boolean)), text: inner.replace(/<[^>]*>/g, " ").replace(/\{[^}]*\}/g, " ").replace(/\s+/g, " ").trim() });
    }
    return out;
  });
}

// The elements in the file's own markup that a selector's subject compound names by class, id
// or attribute; null when the compound names none of those (a bare tag or a pseudo-class).
function subjectElements(ctx, selector) {
  const subject = subjectOf(selector).replace(/::?[\w-]+(?:\([^)]*\))?/g, "");
  const classes = [...subject.matchAll(/\.([\w-]+)/g)].map((x) => x[1]);
  const ids = [...subject.matchAll(/#([\w-]+)/g)].map((x) => x[1]);
  const attrs = [...subject.matchAll(/\[\s*([\w:-]+)\s*(?:[~|^$*]?=\s*["']?([^"'\]]*)["']?)?\s*\]/g)].map((x) => [x[1].toLowerCase(), x[2]]);
  if (!classes.length && !ids.length && !attrs.length) return null;
  const tag = tagOfCompound(subject);
  return elementsOf(ctx).filter((e) => (!tag || e.tag === tag)
    && classes.every((c) => e.classes.has(c))
    && ids.every((id) => e.attrs.get("id") === id)
    && attrs.every(([name, value]) => e.attrs.has(name) && (value === undefined || e.attrs.get(name) === value)));
}

// True when the subject names classes, an id or attributes and every element in the file that
// it names holds `max` characters of text or fewer. No matching element is unknown (false).
function shortTextOnly(ctx, selector, max) {
  const matches = subjectElements(ctx, selector);
  return Boolean(matches && matches.length > 0 && matches.every((e) => e.text.length <= max));
}

// The subject's element names: the compound's own tag, or, where the compound names only
// classes, ids or attributes, the tags of the elements in the file's markup it matches.
// Empty when neither says.
function subjectTags(ctx, selector) {
  const tag = tagOfCompound(subjectOf(selector).replace(/::?[\w-]+(?:\([^)]*\))?/g, ""));
  if (tag) return [tag];
  const matches = subjectElements(ctx, selector);
  return matches ? uniq(matches.map((e) => e.tag)) : [];
}

export function tightLeadingHits(ctx) {
  return memo(ctx, "tightLeading", () => {
    const props = ctx.props;
    const hits = [];
    for (const b of ctx.css.blocks) {
      if (b.selector.startsWith("@")) continue;
      const size = fontSizePx(b, props);
      if (size === undefined || size >= 24) continue;
      const lh = lineHeightValue(b, props);
      if (lh === undefined) continue;
      let ratio;
      if (/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(lh)) ratio = Number(lh);
      else if (/^[\d.]+%$/.test(lh)) ratio = parseFloat(lh) / 100;
      else if (/^[\d.]+em$/i.test(lh)) ratio = parseFloat(lh);
      else { const px = lengthPx(lh, props); if (px !== undefined) ratio = px / size; }
      if (ratio === undefined) continue;
      const r = Math.round(ratio * 100) / 100;
      if (r >= 1.3) continue;
      if (fontWeight(b, props) >= 600) continue;
      if (isCaps(b, props) && r >= 1.0) continue;
      if (/nowrap|pre/i.test(String(decl(b, "white-space") || ""))) continue;
      if (declEntry(b, "-webkit-line-clamp") || declEntry(b, "line-clamp")) continue;
      if (isMonospace(b, props) || isReadout(b, props)) continue;
      if (size >= 20 && r >= 1.15) continue;
      const sel = splitSelectorList(b.selector).find((s) => {
        if (namesFurniture(subjectOf(s))) return false;
        const tags = subjectTags(ctx, s);
        if (tags.length && tags.every((tag) => /^h[1-6]$/.test(tag) || LEADING_EXEMPT_TAGS.has(tag))) return false;
        return !(HEADING_WORDS.test(s) || shortTextOnly(ctx, s, 50));
      });
      if (!sel) continue;
      const at = declEntry(b, "line-height") || declEntry(b, "font");
      hits.push({ line: at ? at.line : b.line, evidence: `${normSelector(sel)}: line-height ${r.toFixed(2)}x at ${fmtPx(size)}px (need 1.3)` });
    }
    return hits;
  });
}

export function wideTrackingHits(ctx) {
  return memo(ctx, "wideTracking", () => {
    const props = ctx.props;
    const hits = [];
    for (const b of ctx.css.blocks) {
      if (b.selector.startsWith("@")) continue;
      const ls = letterSpacingEm(b, props, fontSizePx(b, props));
      if (!ls || ls.em <= 0.05) continue;
      if (isCaps(b, props) || isReadout(b, props) || /smcp|c2sc/i.test(String(decl(b, "font-feature-settings") || ""))) continue;
      const sel = splitSelectorList(b.selector).find((s) => {
        if (CJK_LANG.test(s) || namesFurniture(subjectOf(s), TRACKING_LABEL_WORDS)) return false;
        const tags = subjectTags(ctx, s);
        return !((tags.length && tags.every((tag) => TRACKING_EXEMPT_TAGS.has(tag))) || shortTextOnly(ctx, s, 20));
      });
      if (!sel) continue;
      hits.push({ line: ls.entry.line, evidence: `${normSelector(sel)}: letter-spacing ${ls.em.toFixed(2)}em on running text` });
    }
    return hits;
  });
}

export function justifiedNarrowHits(ctx) {
  return memo(ctx, "justifiedNarrow", () => {
    const props = ctx.props;
    const bySelector = selectorIndex(ctx.css.blocks);
    const hyphenated = (b) => /auto/i.test(`${decl(b, "hyphens") || ""} ${decl(b, "-webkit-hyphens") || ""}`);
    const hits = [];
    for (const b of ctx.css.blocks) {
      if (b.selector.startsWith("@")) continue;
      const align = declEntry(b, "text-align");
      if (!align || !/^justify$/i.test(resolveVars(align.value, props).trim())) continue;
      if (JUSTIFY_EXEMPT_LANG.test(b.selector) || hyphenated(b) || isReadout(b, props)) continue;
      if (descendantAncestors(b.selector).some((a) => bySelector.has(a) && hyphenated(bySelector.get(a)))) continue;
      const size = fontSizePx(b, props);
      const measures = ["width", "max-width"].map((p) => decl(b, p)).filter((v) => v !== undefined).map((v) => {
        const t = resolveVars(v, props).trim().toLowerCase();
        if (/^[\d.]+ch$/.test(t)) return parseFloat(t);
        const px = lengthPx(t, props);
        if (px === undefined) return undefined;
        return size ? px / (0.5 * size) : px / 8;
      }).filter((n) => n !== undefined);
      if (measures.length === 0) continue;
      const chars = Math.min(...measures);
      if (chars > 45) continue;
      hits.push({ line: align.line, evidence: `${normSelector(b.selector)}: justify at about ${Math.round(chars)} characters a line, no hyphens` });
    }
    return hits;
  });
}

export function crushedTrackingHits(ctx) {
  return memo(ctx, "crushedTracking", () => {
    const props = ctx.props;
    const hits = [];
    for (const b of ctx.css.blocks) {
      if (b.selector.startsWith("@")) continue;
      const size = fontSizePx(b, props);
      const ls = letterSpacingEm(b, props, size);
      if (!ls) continue;
      const display = size !== undefined && size >= 40;
      if (!(ls.em < (display ? -0.09 : -0.07))) continue;
      const sel = splitSelectorList(b.selector).find((s) => !CJK_LANG.test(s) && !WORDMARK_WORDS.test(s) && !shortTextOnly(ctx, s, 20));
      if (!sel) continue;
      hits.push({ line: ls.entry.line, evidence: `${normSelector(sel)}: letter-spacing ${ls.em.toFixed(2)}em at ${size === undefined ? "an unknown size" : `${fmtPx(size)}px`}` });
    }
    return hits;
  });
}

// ── Motion: bounce-easing and pulsing-dot ──
const ANIMATION_KEYWORDS = new Set(["none", "infinite", "normal", "reverse", "alternate", "alternate-reverse", "forwards", "backwards", "both", "running", "paused", "linear", "ease", "ease-in", "ease-out", "ease-in-out", "step-start", "step-end", "initial", "inherit", "unset", "auto"]);
const BOUNCE_NAME = /bounce|elastic|wobble|jiggle|rubber/i;

// The keyframes names a block runs, from `animation` layers and `animation-name`.
function animationNames(block, props) {
  const out = [];
  for (const d of block.decls) {
    if (d.prop === "animation-name") {
      for (const n of splitOutside(resolveVars(d.value, props), ",")) out.push({ name: n.trim(), entry: d });
    } else if (d.prop === "animation") {
      for (const layer of splitOutside(resolveVars(d.value, props), ",")) {
        const name = splitOutside(layer, " ").find((t) => /^-?[a-zA-Z_][\w-]*$/.test(t) && !ANIMATION_KEYWORDS.has(t.toLowerCase()));
        if (name) out.push({ name, entry: d });
      }
    }
  }
  return out;
}

function runsInfinitely(block, props) {
  return block.decls.some((d) => (d.prop === "animation" || d.prop === "animation-iteration-count") && /(?:^|[\s,])infinite(?:$|[\s,])/i.test(resolveVars(d.value, props)));
}

function cubicBeziers(value) {
  return [...String(value).matchAll(/cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/gi)].map((m) => ({ text: m[0], y1: Number(m[2]), y2: Number(m[4]) }));
}

// Anticipation and overshoot together is the elastic shape; a single overshoot settles once,
// the way a spring does, and stays clean.
const elastic = (c) => c.y1 < -0.1 && c.y2 > 1.1;

function transformChannels(value) {
  const ch = {};
  const num = (t) => { const m = /^([-+]?(?:\d+\.?\d*|\.\d+))(px|%)?$/.exec(t.trim()); return m ? { v: Number(m[1]), unit: m[2] || "" } : null; };
  for (const m of String(value).matchAll(/(translate3d|translateX|translateY|translate|scale3d|scaleX|scaleY|scale)\(([^)]*)\)/gi)) {
    const fn = m[1].toLowerCase();
    const args = m[2].split(",").map((a) => a.trim());
    if (fn === "translatex") ch.x = num(args[0]);
    else if (fn === "translatey") ch.y = num(args[0]);
    else if (fn === "translate" || fn === "translate3d") { ch.x = num(args[0]); ch.y = args[1] !== undefined ? num(args[1]) : ch.y || { v: 0, unit: "" }; }
    else if (fn === "scalex") ch.sx = num(args[0]);
    else if (fn === "scaley") ch.sy = num(args[0]);
    else ch.s = num(args[0]);
  }
  return ch;
}

function keyframePoints(kf) {
  const points = [];
  for (const step of kf.steps) {
    const t = step.decls.filter((d) => d.prop === "transform").pop();
    for (const offset of step.offsets) points.push({ offset, ch: t ? transformChannels(t.value) : {} });
  }
  return points.sort((a, b) => a.offset - b.offset);
}

function reversals(values) {
  let sign = 0;
  let count = 0;
  for (let i = 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    if (Math.abs(d) < 1e-9) continue;
    const s = d > 0 ? 1 : -1;
    if (sign !== 0 && s !== sign) count++;
    sign = s;
  }
  return count;
}

// The most direction reversals any one transform channel makes across a keyframes block of
// four or more points.
function bounceReversals(kf) {
  const points = keyframePoints(kf);
  if (points.length < 4) return 0;
  let most = 0;
  for (const key of ["x", "y", "s", "sx", "sy"]) {
    const seq = points.map((p) => (p.ch[key] ? p.ch[key].v : key.startsWith("s") ? 1 : 0));
    if (!points.some((p) => p.ch[key])) continue;
    most = Math.max(most, reversals(seq));
  }
  return most;
}

// SpinKit's "bounce" loaders only fade and shrink: every declaration is opacity, a shadow, a
// filter opacity, an in-range timing function, or a scale between 0 and 1.
function onlyPulses(kf) {
  return kf.steps.every((step) => step.decls.every((d) => {
    if (d.prop === "opacity" || d.prop === "box-shadow") return true;
    if (d.prop === "filter") return /^\s*opacity\([^)]*\)\s*$/i.test(d.value);
    if (d.prop === "animation-timing-function") return cubicBeziers(d.value).every((c) => c.y1 >= 0 && c.y1 <= 1 && c.y2 >= 0 && c.y2 <= 1);
    if (d.prop === "transform") {
      const fns = [...d.value.matchAll(/([a-zA-Z0-9]+)\(([^)]*)\)/g)];
      return fns.length > 0 && fns.every((f) => /^scale(?:3d|X|Y)?$/i.test(f[1]) && f[2].split(",").every((n) => { const v = Number(n.trim()); return v >= 0 && v <= 1; }));
    }
    return false;
  }));
}

export function bounceEasingHits(ctx) {
  return memo(ctx, "bounceEasing", () => {
    const props = ctx.props;
    const kfs = ctx.css.keyframes;
    const hits = [];
    for (const b of ctx.css.blocks) {
      if (inAtRule(b, REDUCED_MOTION)) continue;
      let hit = null;
      for (const { name, entry } of animationNames(b, props)) {
        const kf = kfs.get(name);
        if (BOUNCE_NAME.test(name) && !(kf && onlyPulses(kf))) { hit = { line: entry.line, evidence: `${entry.prop}: ${name}` }; break; }
        const n = kf ? bounceReversals(kf) : 0;
        if (n >= 2) { hit = { line: entry.line, evidence: `${entry.prop}: ${name} (keyframes reverse ${n} times)` }; break; }
      }
      if (!hit) {
        for (const d of b.decls) {
          const timing = /^(?:animation|animation-timing-function|transition|transition-timing-function)$/.test(d.prop);
          const readToken = d.prop.startsWith("--") && new RegExp(`var\\(\\s*${d.prop.replace(/[-]/g, "\\-")}(?![\\w-])`).test(ctx.text);
          if (!timing && !readToken) continue;
          const c = cubicBeziers(d.value).find(elastic);
          if (c) { hit = { line: d.line, evidence: c.text }; break; }
        }
      }
      if (hit) hits.push(hit);
    }
    for (const set of ctx.classSets) {
      if (set.tokens.some((t) => tailwindToken(t).base === "animate-bounce")) hits.push({ line: set.line, evidence: "animate-bounce" });
    }
    return hits;
  });
}

const TW_DOT_SIZE = /^(?:w|h|size)-(?:1|1\.5|2|2\.5|3|3\.5|4)$/;
const TW_ANY_SIZE = /^(?:w|h|size)-/;

export function pulsingDotHits(ctx) {
  return memo(ctx, "pulsingDot", () => {
    const props = ctx.props;
    const kfs = ctx.css.keyframes;
    const hits = [];
    for (const b of ctx.css.blocks) {
      if (inAtRule(b, REDUCED_MOTION) || !runsInfinitely(b, props)) continue;
      const names = animationNames(b, props);
      const pulsing = names.find(({ name }) => {
        const kf = kfs.get(name);
        if (!kf) return /pulse|blink|ping|glow|breathe/i.test(name);
        const decls = kf.steps.flatMap((s) => s.decls);
        const pulses = decls.some((d) => d.prop === "opacity" || d.prop === "box-shadow" || (d.prop === "transform" && /scale/i.test(d.value)));
        const heightOnly = decls.some((d) => d.prop === "height") && !decls.some((d) => d.prop === "width");
        const pts = keyframePoints(kf);
        const travel = (key) => { const v = pts.filter((p) => p.ch[key] && p.ch[key].unit !== "%").map((p) => p.ch[key].v); return v.length ? Math.max(...v) - Math.min(...v) : 0; };
        return pulses && !heightOnly && travel("x") < 4 && travel("y") < 4;
      });
      if (!pulsing) continue;
      // An animation opted in under a media query keeps its box in the base rule.
      const twins = ctx.css.blocks.filter((o) => o !== b && normSelector(o.selector) === normSelector(b.selector));
      const geo = (prop) => decl(b, prop) ?? twins.map((o) => decl(o, prop)).filter((v) => v !== undefined).pop();
      const w = lengthPx(geo("width"), props);
      const h = lengthPx(geo("height"), props);
      if (!(w >= 2 && w <= 16 && h >= 2 && h <= 16) || Math.max(w, h) / Math.min(w, h) > 1.5) continue;
      const r = resolveVars(String(geo("border-radius") || ""), props).trim();
      const pct = /^(\d*\.?\d+)%$/.exec(r);
      const rpx = lengthPx(r, props);
      if (!((pct && Number(pct[1]) >= 40) || (rpx !== undefined && (rpx >= 999 || rpx >= 0.4 * Math.min(w, h))))) continue;
      hits.push({ line: pulsing.entry.line, evidence: `${normSelector(b.selector)}: ${fmtPx(w)}x${fmtPx(h)}px dot running ${pulsing.name} forever` });
    }
    for (const set of ctx.effectiveSets) {
      const toks = set.tokens.map(tailwindToken).filter((t) => !t.variants.some(isStateVariant));
      const anim = toks.find((t) => t.base === "animate-ping" || t.base === "animate-pulse");
      if (!anim || !toks.some((t) => t.base === "rounded-full")) continue;
      const sizes = toks.filter((t) => TW_ANY_SIZE.test(t.base));
      if (sizes.length === 0 || !sizes.every((t) => TW_DOT_SIZE.test(t.base))) continue;
      hits.push({ line: set.line, evidence: `${anim.base} rounded-full ${sizes.map((t) => t.base).join(" ")}` });
    }
    return hits;
  });
}

// ── neon-glow ──
// A glow a viewer can see: an outset layer with zero offsets, a blur over 4px, a chromatic
// colour, and blur x alpha of 3 or more. On a bar or track whose declared sides differ by four
// times or more, a halo that lights more than twice the element's own area is a lit track, not
// a glow. A focus halo is a state indicator and is never this tell.
const FOCUS_STATE = /:focus\b|:focus-visible\b|:focus-within\b/i;

function glowLayer(layer, props, kind) {
  const toks = splitOutside(resolveVars(layer, props), " ");
  if (toks.some((t) => t.toLowerCase() === "inset")) return null;
  const lengths = [];
  const rest = [];
  for (const t of toks) {
    const px = lengthPx(t, props);
    if (px !== undefined) lengths.push(px);
    else rest.push(t);
  }
  if (lengths.length < 3) return null;
  const [x, y, blur, spread = 0] = lengths;
  if (x !== 0 || y !== 0 || !(blur > 4)) return null;
  const colourText = rest.join(" ");
  const c = parseColor(colourText);
  if (!c) return blur >= 16 ? { blur, spread, strength: null, text: `${kind}: ${layer.trim()}` } : null;
  const strength = blur * (c.a === undefined ? 1 : c.a);
  if (rgbSpread(c) < 30 || strength < 3) return null;
  return { blur, spread, strength, text: `${kind}: ${layer.trim()} (strength ${strength.toFixed(1)})` };
}

// Only a bar or track (one declared side at least four times the other) can be a lit track:
// a halo around a dot or a card keeps the glow verdict. The light reaches half the blur plus
// the spread past each edge.
function litAreaTooWide(block, props, g) {
  const w = lengthPx(decl(block, "width"), props);
  const h = lengthPx(decl(block, "height"), props);
  if (!(w > 0 && h > 0) || Math.max(w, h) < 4 * Math.min(w, h)) return false;
  const extent = g.blur / 2 + g.spread;
  return (w + 2 * extent) * (h + 2 * extent) - w * h > 2 * w * h;
}

// False when the markup shows no element carrying the selector's classes; a stylesheet
// with no markup beside it, or a selector naming no class, is taken as used.
function selectorUsed(ctx, selector) {
  const els = elementsOf(ctx);
  if (!els.length) return true;
  return splitSelectorList(selector).some((s) => {
    const subject = subjectOf(s).replace(/::?[\w-]+(?:\([^)]*\))?/g, "");
    const classes = [...subject.matchAll(/\.([\w-]+)/g)].map((x) => x[1]);
    return classes.length === 0 || els.some((e) => classes.every((c) => e.classes.has(c)));
  });
}

export function glowHits(ctx, opts = {}) {
  const props = ctx.props;
  const shadowProps = opts.textShadow ? ["box-shadow", "-webkit-box-shadow", "text-shadow"] : ["box-shadow", "-webkit-box-shadow"];
  const hits = [];
  for (const b of ctx.css.blocks) {
    if (b.selector.startsWith("@") || FOCUS_STATE.test(b.selector)) continue;
    let hit = null;
    for (const d of b.decls) {
      if (!shadowProps.includes(d.prop)) continue;
      for (const layer of splitOutside(resolveVars(d.value, props), ",")) {
        const g = glowLayer(layer, props, d.prop);
        if (g && !(d.prop !== "text-shadow" && litAreaTooWide(b, props, g))) { hit = { line: d.line, evidence: g.text }; break; }
      }
      if (hit) break;
    }
    if (hit) hits.push(hit);
  }
  // A glow in a keyframe step counts when a painted element runs it: not a focus state, not
  // a block that sets display: none, and not a class no element in the markup carries.
  const run = new Set();
  for (const b of ctx.css.blocks) {
    if (FOCUS_STATE.test(b.selector) || inAtRule(b, REDUCED_MOTION) || /^\s*none\s*$/i.test(String(decl(b, "display") || ""))) continue;
    if (!selectorUsed(ctx, b.selector)) continue;
    for (const { name } of animationNames(b, props)) run.add(name);
  }
  for (const [name, kf] of ctx.css.keyframes) {
    if (!run.has(name)) continue;
    const found = kf.steps.flatMap((step) => step.decls).find((d) => shadowProps.includes(d.prop) && splitOutside(resolveVars(d.value, props), ",").some((layer) => glowLayer(layer, props, d.prop)));
    if (found) hits.push({ line: found.line, evidence: `@keyframes ${name}: ${found.prop}: ${found.value}` });
  }
  for (const set of ctx.classSets) {
    for (const raw of set.tokens) {
      const t = tailwindToken(raw);
      if (t.variants.some((v) => /^focus(?:-visible|-within)?$/.test(v))) continue;
      const m = /^(drop-shadow|shadow)-\[(.+)\]$/.exec(t.base);
      if (!m) continue;
      const value = m[2].replace(/_/g, " ");
      const g = splitOutside(value, ",").map((layer) => glowLayer(layer, props, m[1])).find(Boolean);
      if (g) { hits.push({ line: set.line, evidence: `${raw}${g.strength === null ? "" : ` (strength ${g.strength.toFixed(1)})`}` }); break; }
    }
  }
  return hits;
}

// ── marquee ──
// An auto-scrolling horizontal loop: a <marquee>, or keyframes that carry a row sideways by a
// fifth of its width or more, run forever. A one-step keyframes body that also scales or
// fades is an entrance, not a loop; reduced-motion blocks are skipped.
function horizontalTravel(kf) {
  const values = [];
  let fades = false;
  for (const step of kf.steps) {
    for (const d of step.decls) {
      if (d.prop === "opacity" || (d.prop === "transform" && /scale/i.test(d.value))) fades = true;
      if (d.prop !== "transform") continue;
      const m = /translate(?:X|3d)?\(\s*([-+]?(?:\d+\.?\d*|\.\d+))%/i.exec(d.value);
      if (m) values.push(Number(m[1]));
    }
  }
  if (values.length === 0) return 0;
  if (values.length === 1) return kf.steps.length === 1 && fades ? 0 : Math.abs(values[0]);
  return Math.max(...values) - Math.min(...values);
}

export function marqueeHits(ctx) {
  return memo(ctx, "marquee", () => {
    const props = ctx.props;
    const hits = [];
    const tag = /<marquee\b/i.exec(ctx.text);
    if (tag) hits.push({ line: ctx.lineOf(tag.index), evidence: "<marquee>" });
    for (const b of ctx.css.blocks) {
      if (inAtRule(b, REDUCED_MOTION) || !runsInfinitely(b, props)) continue;
      for (const { name, entry } of animationNames(b, props)) {
        const kf = ctx.css.keyframes.get(name);
        const travel = kf ? horizontalTravel(kf) : 0;
        if (travel >= 20) { hits.push({ line: entry.line, evidence: `${normSelector(b.selector)}: ${name} carries the row ${fmtPx(travel)}% sideways, forever` }); break; }
      }
    }
    return hits;
  });
}

// ── background-pattern ──
// Template texture behind content: a grid of two or more hairline stops on a px tile, a dot
// field (a radial stop of 2px or less on a px tile), or repeating stripes whose last stop
// falls short of the full length. One hairline is a rule or a rail, and a repeating
// gradient that runs its whole length paints once; both stay clean.
function gradientCalls(value, name) {
  const out = [];
  const re = new RegExp(`(?<![\\w-])${name}\\(`, "gi");
  let m;
  while ((m = re.exec(value)) !== null) {
    const open = m.index + m[0].length - 1;
    const close = matchClose(value, open);
    if (close === -1) break;
    out.push(splitOutside(value.slice(open + 1, close), ","));
    re.lastIndex = close + 1;
  }
  return out;
}

const FULL_LENGTH = /^(?:100%|360deg|1turn|400grad|6\.2832rad)$/i;

export function backgroundPatternHits(ctx) {
  return memo(ctx, "backgroundPattern", () => {
    const props = ctx.props;
    const hits = [];
    for (const b of ctx.css.blocks) {
      const entries = b.decls.filter((d) => d.prop === "background" || d.prop === "background-image");
      if (!entries.length) continue;
      const value = entries.map((d) => resolveVars(d.value, props)).join(", ");
      const size = resolveVars(String(decl(b, "background-size") || ""), props);
      const tile = /\b\d{1,3}(?:\.\d+)?px\b/.test(size) || /\/\s*\d{1,3}(?:\.\d+)?px\b/.test(value);
      const at = entries[entries.length - 1];
      let kind = null;
      const hairlines = (value.match(/\b\d{1,3}px\s*,\s*transparent\s+\d{1,3}px/gi) || []).length + (value.match(/transparent\s+calc\(\s*100%\s*-\s*\d{1,3}px\s*\)/gi) || []).length;
      if (hairlines >= 2 && tile) kind = "a grid of hairlines on a tile";
      if (!kind && tile) {
        for (const args of gradientCalls(value, "radial-gradient")) {
          const dot = args.some((a, i) => { const m = /(\d*\.?\d+)px\s*$/.exec(a); return m && Number(m[1]) <= 2 && /^transparent\b/i.test(args[i + 1] || ""); });
          if (dot) { kind = "a dot field on a tile"; break; }
        }
      }
      if (!kind) {
        for (const fn of ["repeating-linear-gradient", "repeating-radial-gradient", "repeating-conic-gradient"]) {
          for (const args of gradientCalls(value, fn)) {
            const last = splitOutside(args[args.length - 1] || "", " ");
            const pos = last[last.length - 1] || "";
            if (last.length > 1 && /^-?\d*\.?\d+(?:px|rem|em|%|deg|turn|grad|rad)$/i.test(pos) && !FULL_LENGTH.test(pos)) { kind = `repeating stripes (${fn})`; break; }
          }
          if (kind) break;
        }
      }
      if (kind) hits.push({ line: at.line, evidence: `${normSelector(b.selector)}: ${kind}` });
    }
    return hits;
  });
}

// ── radial-halo ──
// A saturated radial glow fading to nothing behind a section of a dark page: the first stop
// opaque (alpha 0.7 or more) and chromatic, the last transparent, no stop pinned within 24px
// (that is a dot or a spot, not a halo). A light page, or a translucent wash, stays clean.
function gradientStops(args) {
  const stops = [];
  for (const arg of args) {
    const toks = splitOutside(arg, " ");
    const idx = toks.findIndex((t) => parseColor(t));
    if (idx === -1) continue;
    stops.push({ colour: parseColor(toks[idx]), positions: toks.slice(idx + 1) });
  }
  return stops;
}

export function radialHaloHits(ctx) {
  return memo(ctx, "radialHalo", () => {
    const ground = ctx.pageGround;
    if (!ground || relativeLuminance(ground) >= 0.05) return [];
    const props = ctx.props;
    const hits = [];
    for (const b of ctx.css.blocks) {
      const entries = b.decls.filter((d) => d.prop === "background" || d.prop === "background-image");
      if (!entries.length) continue;
      const value = entries.map((d) => resolveVars(d.value, props)).join(", ");
      if (/url\(/i.test(value)) continue;
      for (const args of gradientCalls(value, "radial-gradient")) {
        const stops = gradientStops(args);
        if (stops.length < 2) continue;
        if (stops.some((st) => st.positions.some((p) => { const px = lengthPx(p, props); return px !== undefined && px <= 24; }))) continue;
        const first = stops[0].colour;
        const last = stops[stops.length - 1].colour;
        if (last.a > 0.05 || first.a < 0.7 || rgbSpread(first) < 24) continue;
        hits.push({ line: entries[entries.length - 1].line, evidence: `${normSelector(b.selector)}: radial halo ${toHex(first)} fading to transparent on a dark page` });
        break;
      }
    }
    return hits;
  });
}

// ── gray-on-color ──
// Neutral mid-grey text on a chromatic surface reads muddy: the grey has no hue of its own
// to sit on the colour with. Class form: one class set (one element, one ternary arm) with a
// resting text-gray/slate/zinc/neutral/stone 300 to 600 and a resting chromatic bg-* above
// 100. CSS form: a pair resolved on its own block or its ancestor (never the page ground)
// whose ink is grey (HSL saturation under 0.2, lightness 0.3 to 0.85) and whose surface reads
// as colour.
const GREY_TEXT = /^text-(?:gray|slate|zinc|neutral|stone)-(\d{3})$/;
const COLOUR_BG = /^bg-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(\d{2,3})$/;

function hsl({ r, g, b }) {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const L = (max + min) / 2;
  const d = max - min;
  const S = d === 0 ? 0 : d / (1 - Math.abs(2 * L - 1));
  return { s: S, l: L };
}

function readsAsColour(c) {
  const lum = relativeLuminance(c);
  const need = lum < 0.01 ? 40 * Math.sqrt(0.01 / Math.max(lum, 1e-4)) : 40;
  if (rgbSpread(c) < need) return false;
  const o = toOklch(c);
  return !(o.L >= 0.9 && o.C < 0.09);
}

export function grayOnColorHits(ctx) {
  return memo(ctx, "grayOnColor", () => {
    const hits = [];
    const seen = new Set();
    for (const p of colourPairs(ctx)) {
      if (p.source === "page ground" || seen.has(p.block)) continue;
      const { s: sat, l } = hsl(p.fg);
      if (!(sat < 0.2 && l > 0.3 && l < 0.85) || !readsAsColour(p.surface)) continue;
      seen.add(p.block);
      hits.push({ line: (declEntry(p.block, "color") || p.colorEntry).line, evidence: `${p.sel}: grey ${toHex(p.fg)} on ${toHex(p.surface)}` });
    }
    for (const set of ctx.effectiveSets) {
      const toks = set.tokens.map(tailwindToken).filter(isResting);
      const grey = toks.find((t) => { const m = GREY_TEXT.exec(t.base); return m && Number(m[1]) >= 300 && Number(m[1]) <= 600; });
      const bg = toks.find((t) => { const m = COLOUR_BG.exec(t.base); return m && Number(m[1]) > 100; });
      if (grey && bg) hits.push({ line: set.line, evidence: `${grey.base} on ${bg.base}` });
    }
    return hits;
  });
}

// ── skipped-heading ──
// In a full HTML document, a heading that jumps more than one level down from the one before
// it (h2 then h4). The first heading never reports, going back up never reports, and the
// first heading of a <footer> or role="contentinfo" region may start lower: a site footer's
// outline is its own. Script and style bodies, comments and <code>/<pre> text are not read.
function elementRegions(text, open) {
  const lower = text.toLowerCase();
  const out = [];
  let m;
  while ((m = open.exec(text)) !== null) {
    const tag = m[1].toLowerCase();
    const close = lower.indexOf(`</${tag}`, m.index + m[0].length);
    out.push([m.index, close === -1 ? text.length : close]);
  }
  return out;
}

export function skippedHeadingHits(ctx) {
  return memo(ctx, "skippedHeading", () => {
    if (!MARKUP_EXT.has(ctx.ext) || !/<!doctype\s+html|<html\b/i.test(ctx.text)) return [];
    const chars = ctx.text.split("");
    for (const [s0, e0] of markupRegions(ctx.text)) blank(chars, s0, e0);
    const text = chars.join("");
    const footers = [
      ...elementRegions(text, /<(footer)\b[^>]*>/gi),
      ...elementRegions(text, /<([a-zA-Z][\w-]*)\b[^>]*\brole\s*=\s*["']contentinfo["'][^>]*>/gi),
    ];
    const firstInFooter = new Set();
    const headings = [...text.matchAll(/<h([1-6])\b/gi)].map((m) => ({ level: Number(m[1]), index: m.index }));
    for (const [fs, fe] of footers) {
      const first = headings.find((h) => h.index > fs && h.index < fe);
      if (first) firstInFooter.add(first.index);
    }
    const hits = [];
    let prev = 0;
    for (const h of headings) {
      if (prev > 0 && h.level > prev + 1 && !firstInFooter.has(h.index)) hits.push({ line: ctx.lineOf(h.index), evidence: `h${prev} then h${h.level}` });
      prev = h.level;
    }
    return hits;
  });
}

// ── The cream-serif tasteful default ──
// Four legs: a CREAM ground, a SERIF display face, the SAGE accent and the CLAY accent (the
// rusty-orange drift form). The tell is two distinct legs: cream + serif, cream + sage,
// serif + sage, or serif + clay. Clay completes the combination only beside the serif
// display: a warm editorial ground with a brick accent is a common human choice. Two hits of
// one leg are one leg.
const CREAM_LEGS = [
  ["cream", /#(?:faf8f5|f5f1e8|f3eee3|fdfbf7|f7f3ec|faf6ef|f6f1e7|fbf7f0|f4efe4)\b|\bbg-(?:stone|amber|orange)-(?:50|100)\b/gi],
  ["serif", /\b(?:Instrument\s*Serif|Fraunces|Playfair\s*Display|Cormorant|Spectral|DM\s*Serif)\b/gi],
  ["sage", /#15573a\b/gi],
  ["clay", /\b(?:text|bg|border|ring|decoration)-(?:orange|amber)-(?:600|700|800)\b|#(?:b7410e|c2410c|9a3412|a0522d|d97757)\b/gi],
];
const CREAM_PAIRS = [["cream", "serif"], ["cream", "sage"], ["serif", "sage"], ["serif", "clay"]];

// creamLegHits(ctx) -> every leg match, { line, leg, evidence }, on the prepared text.
export function creamLegHits(ctx) {
  return memo(ctx, "creamLegs", () => {
    const hits = [];
    for (const [leg, re] of CREAM_LEGS) for (const h of lineRegexHits(ctx.lines, re)) hits.push({ ...h, leg, evidence: `${leg} ${h.evidence}` });
    return hits.sort((a, b) => a.line - b.line);
  });
}

// creamCombination(hits) -> the hits when their distinct legs form a firing pair, else [].
// Apply it after waivers, so a waived leg no longer completes the pair.
export function creamCombination(hits) {
  const legs = new Set(hits.map((h) => h.leg));
  if (!CREAM_PAIRS.some(([a, b]) => legs.has(a) && legs.has(b))) return [];
  const named = [...legs].map((leg) => hits.find((h) => h.leg === leg).evidence).join(" + ");
  return hits.map((h, i) => (i === 0 ? { ...h, evidence: named } : h));
}

// ── The framed card treatment ──
// framedCardSets(ctx) -> one entry per class source that is a card (a padding token plus a
// radius, a border leg or a shadow), with `trio` set when it carries the library default
// trio: shadow-sm (or shadow), a real border leg, and rounded-lg or larger. A colour-only
// border-gray-200 draws nothing in Tailwind and is not a border leg.
const PADDING_TOKEN = /^p[xy]?-(?:\d|\[)/;
const RADIUS_TOKEN = /^rounded(?:-(?:sm|md|lg|xl|2xl|3xl))?$/;
const TRIO_RADIUS = /^rounded-(?:lg|xl|2xl|3xl)$/;
const BORDER_LEG = /^border(?:-\d+|-\[\d+(?:\.\d+)?px\])?$/;
const SHADOW_TOKEN = /^shadow(?:-(?:sm|md|lg|xl|2xl))?$/;
const TRIO_SHADOW = /^shadow(?:-sm)?$/;

export function framedCardSets(ctx) {
  return memo(ctx, "framedCards", () => {
    const byGroup = new Map();
    for (const set of ctx.effectiveSets) {
      const bases = restingTokenBases(set.tokens);
      if (!bases.some((b) => PADDING_TOKEN.test(b))) continue;
      const devices = { rounded: bases.some((b) => RADIUS_TOKEN.test(b)), border: bases.some((b) => BORDER_LEG.test(b)), shadow: bases.some((b) => SHADOW_TOKEN.test(b)) };
      if (!devices.rounded && !devices.border && !devices.shadow) continue;
      const trio = bases.some((b) => TRIO_SHADOW.test(b)) && devices.border && bases.some((b) => TRIO_RADIUS.test(b));
      const prev = byGroup.get(set.group);
      if (!prev || (trio && !prev.trio)) byGroup.set(set.group, { line: set.line, tokens: set.tokens, trio, devices, evidence: set.tokens.join(" ") });
    }
    return [...byGroup.values()].sort((a, b) => a.line - b.line);
  });
}

function restingTokenBases(tokens) {
  return tokens.map(tailwindToken).filter(isResting).map((t) => t.base);
}

// framedCardTrio(cards) -> the trio cards when the treatment repeats: three or more, or two
// or more when every card on the surface carries it. Apply it after waivers.
export function framedCardTrio(cards) {
  const trio = cards.filter((c) => c.trio);
  if (trio.length >= 3 || (trio.length >= 2 && trio.length === cards.length)) return trio;
  return [];
}

// ── Primary families ──
// primaryFamilyBlocks(ctx) -> one entry per block that declares a font stack (font-family or
// the font shorthand; @font-face and other at-blocks excluded, since they define a face
// rather than set one): { line, selector, kind, name, control }. `control` is true when
// every selector in the list is a button, field or label, the place a UI label fallback face
// lives; a reflex face there is permitted when the page sets another face for content.
const CONTROL_TAGS = new Set(["button", "input", "select", "textarea", "option", "label"]);
const CONTROL_WORDS = new Set(["btn", "button", "control", "input", "select", "toggle", "switch"]);

// familyKey(name): a family name compared the way a person spells it many ways: lower case,
// quotes, spaces, hyphens and underscores removed ("Geist Sans", "GeistSans", "geist-sans").
export function familyKey(name) {
  return String(name || "").toLowerCase().replace(/["']/g, "").replace(/[\s_-]+/g, "");
}

export function isControlSelector(selector) {
  return splitSelectorList(selector).every((s) => {
    const subject = subjectOf(s).replace(/::?[\w-]+(?:\([^)]*\))?/g, "");
    const tag = tagOfCompound(subject);
    return (tag && CONTROL_TAGS.has(tag)) || classWordsOf(subject).some((w) => CONTROL_WORDS.has(w));
  });
}

export function primaryFamilyBlocks(ctx) {
  return memo(ctx, "primaryFamilies", () => {
    const out = [];
    for (const b of ctx.css.blocks) {
      if (b.selector.startsWith("@")) continue;
      const stack = fontStack(b, ctx.props);
      if (stack.length === 0) continue;
      const pf = primaryFamily(stack);
      const at = declEntry(b, "font-family") || declEntry(b, "font");
      out.push({ line: at ? at.line : b.line, selector: normSelector(b.selector), kind: pf.kind, name: pf.name, control: isControlSelector(b.selector) });
    }
    return out;
  });
}

// ── DESIGN.md ──
// A project's DESIGN.md frontmatter is evidence of a documented choice: a declared violet is
// the brand, not the framework default, and a face set outside the declared typography is
// drift. Read-only; nothing here writes the file.
const DESIGN_FILE_NAMES = ["DESIGN.md", "Design.md", "design.md"];
const designDirCache = new Map();
const designFileCache = new Map();

// findDesignMd(filePath) -> the nearest DESIGN.md walking up from the file's directory, or
// null. The walk stops after the first directory holding .git or package.json, and never
// climbs above the user's home directory. Memoised per directory.
export function findDesignMd(filePath) {
  const home = resolve(homedir());
  let dir = dirname(resolve(filePath));
  const visited = [];
  let found = null;
  for (;;) {
    if (designDirCache.has(dir)) { found = designDirCache.get(dir); break; }
    visited.push(dir);
    const hit = DESIGN_FILE_NAMES.map((n) => join(dir, n)).find((f) => existsSync(f));
    if (hit) { found = hit; break; }
    const parent = dirname(dir);
    if (existsSync(join(dir, ".git")) || existsSync(join(dir, "package.json")) || dir === home || parent === dir) break;
    dir = parent;
  }
  for (const v of visited) designDirCache.set(v, found);
  return found;
}

// A small indentation-based reader for the frontmatter maps DESIGN.md uses: nested keys,
// scalars, quoted strings and # comments. Lists are skipped.
export function parseFrontmatter(text) {
  const m = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(String(text));
  const root = {};
  if (!m) return root;
  const stack = [{ indent: -1, node: root }];
  for (const raw of m[1].split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith("#") || raw.trim().startsWith("- ")) continue;
    const indent = raw.length - raw.trimStart().length;
    const kv = /^([^:#]+?)\s*:\s*(.*)$/.exec(raw.trim());
    if (!kv) continue;
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
    const parent = stack[stack.length - 1].node;
    const key = kv[1].trim().replace(/^["']|["']$/g, "");
    let value = kv[2];
    const quoted = /^(["'])(.*?)\1/.exec(value);
    if (quoted) value = quoted[2];
    else value = value.replace(/\s+#.*$/, "").trim();
    if (value === "") {
      parent[key] = {};
      stack.push({ indent, node: parent[key] });
    } else parent[key] = value;
  }
  return root;
}

// readDesignSystem(path) -> { path, colors: [{ name, value, rgb }], fonts: Set of familyKey,
// purpleArc: [{ name, hex, H, C }] } or null when the file cannot be read. purpleArc holds the
// declared colours inside the window where the palette check runs at all (OKLCH hue 250 to
// 320, chroma 0.08 or more).
export function readDesignSystem(path) {
  if (!path) return null;
  if (designFileCache.has(path)) return designFileCache.get(path);
  let result = null;
  try {
    const fm = parseFrontmatter(readFileSync(path, "utf8"));
    const colors = [];
    for (const [name, value] of Object.entries(fm.colors || fm.colours || {})) {
      if (typeof value !== "string") continue;
      const rgb = parseColor(value);
      if (rgb) colors.push({ name, value, rgb });
    }
    const fonts = new Set();
    for (const role of Object.values(fm.typography || {})) {
      const family = role && typeof role === "object" ? role.fontFamily || role["font-family"] : null;
      if (typeof family !== "string") continue;
      for (const f of splitFamilies(family.replace(/var\(\s*--[\w-]+\s*,\s*([^)]*)\)/g, "$1"))) {
        if (!GENERIC_FAMILIES.has(f.toLowerCase())) fonts.add(familyKey(f));
      }
    }
    const purpleArc = colors.map((c) => ({ c, o: toOklch(c.rgb) }))
      .filter(({ o }) => o.H >= 250 && o.H <= 320 && o.C >= 0.08)
      .map(({ c, o }) => ({ name: c.name, hex: toHex(c.rgb), H: o.H, C: o.C }));
    result = { path, colors, fonts, purpleArc };
  } catch {
    result = null;
  }
  designFileCache.set(path, result);
  return result;
}

// True when a colour literal sits within 6 per channel of a colour DESIGN.md declares.
export function declaredColour(ds, rgb) {
  return Boolean(ds && rgb && ds.colors.some((c) => Math.abs(c.rgb.r - rgb.r) <= 6 && Math.abs(c.rgb.g - rgb.g) <= 6 && Math.abs(c.rgb.b - rgb.b) <= 6));
}

// declaredPurple(ds, rgb): a purple match is the palette when its OKLCH hue lies within 15
// degrees of a declared colour on the purple arc, both at chroma 0.08 or more. A declared
// blue-600 (hue about 263) covers its own hue and leaves a violet (about 293) a tell.
export function declaredPurple(ds, rgb) {
  if (!ds || !rgb || !ds.purpleArc || ds.purpleArc.length === 0) return false;
  const o = toOklch(rgb);
  if (o.C < 0.08) return false;
  return ds.purpleArc.some((p) => { const d = Math.abs(p.H - o.H) % 360; return Math.min(d, 360 - d) <= 15; });
}

// purpleMatchExempt(ds, rgb): the documented palette, by literal or by hue.
export function purpleMatchExempt(ds, rgb) {
  return declaredColour(ds, rgb) || declaredPurple(ds, rgb);
}

// The Tailwind ramps the purple utilities name, 400 to 800, so a class token has a colour to
// compare with the declared palette.
const TAILWIND_PURPLE_SOURCE = {
  indigo: ["818cf8", "6366f1", "4f46e5", "4338ca", "3730a3"],
  violet: ["a78bfa", "8b5cf6", "7c3aed", "6d28d9", "5b21b6"],
  purple: ["c084fc", "a855f7", "9333ea", "7e22ce", "6b21a8"],
  fuchsia: ["e879f9", "d946ef", "c026d3", "a21caf", "86198f"],
};

// tailwindPurpleColour(base) -> rgb for bg|text|from|via|to|border|ring|fill|stroke|
// decoration|outline-(indigo|violet|purple|fuchsia)-(400..800), else null.
export function tailwindPurpleColour(base) {
  const m = /^(?:bg|text|from|via|to|border|ring|fill|stroke|decoration|outline)-(indigo|violet|purple|fuchsia)-([4-8])00$/.exec(String(base));
  return m ? parseColor(`#${TAILWIND_PURPLE_SOURCE[m[1]][Number(m[2]) - 4]}`) : null;
}

// designSystemFontHits(ctx): a block whose primary face is not among the faces DESIGN.md
// declares for its typography. A system stack never counts, and nothing fires without a
// declared typography.
export function designSystemFontHits(ctx) {
  const ds = ctx.designSystem;
  if (!ds || ds.fonts.size === 0) return [];
  return primaryFamilyBlocks(ctx)
    .filter((b) => b.kind === "face" && !ds.fonts.has(familyKey(b.name)))
    .map((b) => ({ line: b.line, evidence: `${b.selector}: ${b.name} is not a face DESIGN.md declares` }));
}
