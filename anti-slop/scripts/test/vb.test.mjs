import { test } from "node:test";
import assert from "node:assert/strict";
import { scanContent } from "../lib/scan.mjs";

// VB.NET support, asserted in both directions like rule-additions.test.mjs: the shape each
// rule catches and the counter-example it must stay silent on. Fixtures use CRLF because
// that is what VB files on Windows carry, and mixed keyword case because VB ignores it.

const crlf = (...lines) => lines.join("\r\n") + "\r\n";
const scan = (content) => scanContent(content, "Module1.vb");
const find = (rule, content) => scan(content).find((v) => v.name === rule);
const fires = (rule, content) => Boolean(find(rule, content));

// ── vb-empty-catch ───────────────────────────────────────────────────────────

test("vb-empty-catch: an empty Catch before End Try is a finding, on the Catch line", () => {
  const src = crlf("Sub F()", "  Try", "    X()", "  Catch ex As Exception", "", "  End Try", "End Sub");
  const v = find("vb-empty-catch", src);
  assert.ok(v);
  assert.equal(v.line, 4);
});

test("vb-empty-catch: a comment-only body, a bare Catch before Finally, and lower case all count", () => {
  assert.ok(fires("vb-empty-catch", crlf("Try", "X()", "Catch", "  ' ignore", "End Try")));
  assert.ok(fires("vb-empty-catch", crlf("Try", "X()", "Catch ex As IOException", "Finally", "Y()", "End Try")));
  assert.ok(fires("vb-empty-catch", crlf("try", "x()", "catch ex as exception when ex.Message <> \"\"", "end try")));
});

test("vb-empty-catch: the single-line form `Catch : End Try` is a finding", () => {
  assert.ok(fires("vb-empty-catch", crlf("Try : X() : Catch ex As Exception : End Try")));
});

test("vb-empty-catch: a Catch with a real body is NOT a finding", () => {
  assert.ok(!fires("vb-empty-catch", crlf("Try", "X()", "Catch ex As Exception", "  Log(ex)", "End Try")));
  assert.ok(!fires("vb-empty-catch", crlf("Try", "X()", "Catch ex As Exception", "  Throw", "Finally", "Y()", "End Try")));
});

test("vb-empty-catch: counts each empty Catch in the file", () => {
  const src = crlf("Try", "A()", "Catch", "End Try", "Try", "B()", "Catch e As Exception", "End Try");
  assert.equal(find("vb-empty-catch", src).count, 2);
});

// ── vb-bool-literal-compare ──────────────────────────────────────────────────

test("vb-bool-literal-compare: a condition compared to True/False is a finding", () => {
  assert.ok(fires("vb-bool-literal-compare", crlf("If done = True Then", "X()", "End If")));
  assert.ok(fires("vb-bool-literal-compare", crlf("ElseIf ok <> false Then")));
  assert.ok(fires("vb-bool-literal-compare", crlf("If a > 0 AndAlso busy = False Then")));
});

test("vb-bool-literal-compare: assignments, plain conditions and comments are NOT findings", () => {
  assert.ok(!fires("vb-bool-literal-compare", crlf("done = True", "busy = False")));
  assert.ok(!fires("vb-bool-literal-compare", crlf("If done Then", "X()", "End If")));
  assert.ok(!fires("vb-bool-literal-compare", crlf("' If done = True Then")));
  // WPF ShowDialog() is Boolean?; comparing it to True is the idiom, not slop.
  assert.ok(!fires("vb-bool-literal-compare", crlf("If dlg.ShowDialog(Me) = True Then Open()")));
  assert.ok(!fires("vb-bool-literal-compare", crlf("If dlg.ShowDialog() <> True OrElse busy Then Exit Sub")));
  // An assignment in a single-line If body is not the condition.
  assert.ok(!fires("vb-bool-literal-compare", crlf("If ready Then panel.Visible = True")));
  assert.ok(!fires("vb-bool-literal-compare", crlf("If Not x Then list.Add(New Item With {.On = False})")));
});

// ── vb-bool-return-branch ────────────────────────────────────────────────────

test("vb-bool-return-branch: If/Else returning True/False is a finding", () => {
  assert.ok(fires("vb-bool-return-branch", crlf("If x > 0 Then", "  Return True", "Else", "  Return False", "End If")));
});

test("vb-bool-return-branch: branches that do work are NOT findings", () => {
  assert.ok(!fires("vb-bool-return-branch", crlf("If x > 0 Then", "  Log(x)", "  Return True", "Else", "  Return False", "End If")));
});

// ── vb-rethrow-only-catch ────────────────────────────────────────────────────

test("vb-rethrow-only-catch: a Catch whose only statement is Throw / Throw ex is a finding", () => {
  assert.ok(fires("vb-rethrow-only-catch", crlf("Try", "X()", "Catch ex As Exception", "  Throw ex", "End Try")));
  assert.ok(fires("vb-rethrow-only-catch", crlf("Try", "X()", "Catch", "  Throw", "Finally", "Y()", "End Try")));
});

test("vb-rethrow-only-catch: a Catch that adds context or does work is NOT a finding", () => {
  assert.ok(!fires("vb-rethrow-only-catch", crlf("Try", "X()", "Catch ex As Exception", "  Log(ex)", "  Throw", "End Try")));
  assert.ok(!fires("vb-rethrow-only-catch", crlf("Try", "X()", "Catch ex As IOException", '  Throw New AppException("load failed", ex)', "End Try")));
});

// ── Shared comment-slop rules reach VB comments ──────────────────────────────

test("shared comment-slop rules fire on VB comments", () => {
  assert.ok(fires("narrating-comment", crlf("' Initialize the counter", "Dim i = 0")));
  assert.ok(fires("deferral-comment", crlf("Dim t = 5 ' hardcoded for now")));
  assert.ok(fires("placeholder-comment", crlf("Sub F()", "  ' TODO: implement", "End Sub")));
  assert.ok(fires("banner-comment", crlf("' ==========", "Dim a = 1", "' ==========")));
});

test("comment-slop rules do NOT fire on a VB comment that explains why", () => {
  const vs = scan(crlf("' PLC replies late after a reset, so wait one cycle", "Wait(1)"));
  assert.ok(!vs.some((v) => /comment/.test(String(v.name))), JSON.stringify(vs));
});

// ── Comments, strings, and the shared rules ──────────────────────────────────

test("an apostrophe inside a string is not a comment", () => {
  assert.ok(fires("vb-bool-literal-compare", crlf("Dim s = \"it's\" : If ok = True Then X()")));
  // The banned word sits in a string, not a comment, so the comment-only scan skips it.
  const vs = scan(crlf("Dim s = \"don't delve here\""));
  assert.ok(!vs.some((v) => v.word === "delve"), JSON.stringify(vs));
});

test("banned words are found in VB ' and REM comments", () => {
  const vs = scan(crlf("' We delve into the rich tapestry", "REM seamless synergy", "Dim x = 1"));
  for (const w of ["delve", "tapestry", "synergy"]) {
    assert.ok(vs.some((v) => v.word === w), `${w} missing: ${JSON.stringify(vs.map((v) => v.word || v.name))}`);
  }
});

test("#Region and date literals are not read as comments", () => {
  const vs = scan(crlf("#Region \"delve tapestry synergy\"", "Dim d = #1/1/2020#", "#End Region"));
  assert.ok(!vs.some((v) => v.type === "banned-word"), JSON.stringify(vs));
});

test("hardcoded-secret: a VB `As String` constant is a finding, an environment read is not", () => {
  assert.ok(fires("hardcoded-secret", crlf("Const ApiKey As String = \"q8Zt3kLm9Xw2Pv7R\"")));
  assert.ok(!fires("hardcoded-secret", crlf("Dim ApiKey As String = Environment.GetEnvironmentVariable(\"API_KEY\")")));
});

test("the escape hatch silences a VB line", () => {
  assert.ok(!fires("vb-bool-literal-compare", crlf("If ok = True Then X() ' anti-slop-allow")));
});

test("VB rules never fire on other languages", () => {
  const cs = "class A { bool F(bool x) { if (x == true) { return true; } else { return false; } } }\n";
  assert.ok(!scanContent(cs, "A.cs").some((v) => String(v.name).startsWith("vb-")));
});
