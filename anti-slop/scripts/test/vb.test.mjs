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

test("vb-empty-catch: a one-line Catch body is NOT empty; an empty Catch before another Catch is", () => {
  assert.ok(!fires("vb-empty-catch", crlf("Try", "X()", "Catch ex As Exception : Log(ex)", "End Try")));
  assert.ok(fires("vb-empty-catch", crlf("Try", "X()", "Catch ex As IOException", "Catch ex As Exception", "Log(ex)", "End Try")));
});

test("the escape hatch on a Catch body line does not create an empty-Catch finding", () => {
  assert.ok(!fires("vb-empty-catch", crlf("Try", "X()", "Catch ex As Exception", "  Log(ex) ' anti-slop-allow", "End Try")));
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
  assert.ok(!fires("vb-bool-literal-compare", crlf("If dlg.ShowDialog(GetOwner()) = True Then Open()")));
  // A named argument (`:=`) and a comparison inside a string are not conditions.
  assert.ok(!fires("vb-bool-literal-compare", crlf("If Check(strict:=True) Then X()")));
  assert.ok(!fires("vb-bool-literal-compare", crlf("If s = \"a = True\" Then X()")));
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

// ── VB twins of the shared C#-reaching rules ─────────────────────────────────

test("vb-dead-branch: If True/False, #If False, While False are findings; a real condition is not", () => {
  for (const s of ["If True Then", "If False Then X()", "#If False Then", "ElseIf true Then", "While False", "Do While False", "Do Until True"]) {
    assert.ok(fires("vb-dead-branch", crlf(s)), s);
  }
  assert.ok(!fires("vb-dead-branch", crlf("If TrueCount > 0 Then", "#If DEBUG Then", "While running", "' If True Then")));
  for (const s of ["While False OrElse keepRunning", "While False = finished", "Do Until True AndAlso finished"]) {
    assert.ok(!fires("vb-dead-branch", crlf(s)), s);
  }
  assert.ok(fires("vb-dead-branch", crlf("While False ' never")));
  for (const s of ["Do While False : Work() : Loop", "Do Until True : Work() : Loop", "While False : Work() : End While"]) {
    assert.ok(fires("vb-dead-branch", crlf(s)), s);
  }
});

test("vb-generic-naming: DoStuff / ProcessData are findings, a specific name is not", () => {
  assert.ok(fires("vb-generic-naming", crlf("Private Sub DoStuff()")));
  assert.ok(fires("vb-generic-naming", crlf("Public Function ProcessData(x As Integer) As Integer")));
  assert.ok(!fires("vb-generic-naming", crlf("Private Sub DoStuffWithRecipe()", "Sub LoadRecipe()")));
});

test("vb-warning-suppression: #Disable Warning is a finding, #Enable is not", () => {
  assert.ok(fires("vb-warning-suppression", crlf("#Disable Warning BC42024")));
  assert.ok(!fires("vb-warning-suppression", crlf("#Enable Warning BC42024")));
});

// ── Boolean busywork (Quality) vs a plain literal compare (Taste) ────────────

test("vb-compare-of-comparison: a comparison compared to True/False again is a finding", () => {
  for (const s of ["If (count > 0) = True Then X()", "If (a <> b) = False Then X()", "ok = (x IsNot Nothing) = True", "If x = True = True Then X()"]) {
    assert.ok(fires("vb-compare-of-comparison", crlf(s)), s);
  }
  for (const s of ["If count > 0 Then X()", "If Directory.Exists(p) = False Then X()", "If Check(a, b) = True Then X()", "If Validate(count > 0) = True Then X()"]) {
    assert.ok(!fires("vb-compare-of-comparison", crlf(s)), s);
  }
});

test("vb-bool-ternary: If/IIf returning True/False is a finding, a real ternary is not", () => {
  assert.ok(fires("vb-bool-ternary", crlf("ok = If(count > 0, True, False)")));
  assert.ok(fires("vb-bool-ternary", crlf("ok = IIf(IsValid(x), False, True)")));
  assert.ok(!fires("vb-bool-ternary", crlf("label = If(ok, \"Yes\", \"No\")", "If(ok) Then X()")));
  for (const s of ["If (ready) Then SetFlags(x, True, False)", "x = If(a, Foo(b, True, False), c)", "ok = If(chk.IsChecked, True, False)", "ok = If(dlg.ShowDialog(), True, False)"]) {
    assert.ok(!fires("vb-bool-ternary", crlf(s)), s);
  }
  assert.ok(fires("vb-bool-ternary", crlf("chk.IsChecked = If(x = 1, True, False)")));
  assert.ok(fires("vb-bool-ternary", crlf("ok = If (count > 0, True, False)")));
  assert.ok(fires("vb-bool-ternary", crlf("ok = IIf (IsValid(x), False, True)")));
  assert.ok(fires("vb-bool-ternary", crlf("Return If (n > 0, True, False)")));
});

test("vb-bool-assign-branch: If/Else assigning True/False to one variable is a finding", () => {
  assert.ok(fires("vb-bool-assign-branch", crlf("If File.Exists(p) Then", "  result = True", "Else", "  result = False", "End If")));
  assert.ok(fires("vb-bool-assign-branch", crlf("If x > 0 Then Me.ok = True Else Me.ok = False")));
  assert.ok(!fires("vb-bool-assign-branch", crlf("If x > 0 Then", "  a = True", "Else", "  b = False", "End If")));
  assert.ok(!fires("vb-bool-assign-branch", crlf("If cb.IsChecked Then ok = True Else ok = False")));
  assert.ok(!fires("vb-bool-assign-branch", crlf("If cb.IsChecked Then", "  ok = True", "Else", "  ok = False", "End If")));
  assert.ok(!fires("vb-bool-assign-branch", crlf("If x > 0 Then", "  Log(x)", "  ok = True", "Else", "  ok = False", "End If")));
});

test("review round: compound Not, inner =, lower-case literal, inline XML summary, mixed-language comment", () => {
  assert.ok(!fires("vb-double-negation", crlf("If Not (enabled OrElse done = False) Then X()")));
  assert.ok(fires("vb-compare-of-comparison", crlf("If (count = 0) = True Then X()")));
  assert.ok(fires("vb-compare-of-comparison", crlf("If (count > 0) = true Then X()")));
  assert.ok(fires("vb-narrating-comment", crlf("''' <summary>Processes the data.</summary>", "Sub P()")));
  assert.ok(!fires("vb-narrating-comment", crlf("' Check if the 파일이 잠겨 있으면 재시도", "X()")));
  const t0 = Date.now();
  scan(crlf("' Constructor" + " ".repeat(50000) + "x"));
  assert.ok(Date.now() - t0 < 1000, `took ${Date.now() - t0}ms`);
});

test("vb-double-negation: Not Not / Not (x = False) are findings, a single Not is not", () => {
  assert.ok(fires("vb-double-negation", crlf("If Not Not ready Then X()")));
  assert.ok(fires("vb-double-negation", crlf("If Not (done = False) Then X()")));
  assert.ok(!fires("vb-double-negation", crlf("If Not done Then X()", "If Not (a > b) Then X()")));
});

test("vb-narrating-comment: VB-shaped narration is a finding, a why-comment and Korean are not", () => {
  for (const s of ["' Check if the file exists", "' Re-throw the exception", "''' Processes the data."]) {
    assert.ok(fires("vb-narrating-comment", crlf(s, "X()")), s);
  }
  for (const s of ["' Constructor", "' Properties", "' Check if the PLC answered within 2s; the watchdog otherwise resets the line",
    "' Increments the retry counter so the watchdog trips after 3 misses", "''' Gets the name.", "''' Sets the value.","' Constructor runs before the PLC is ready, so defer Connect","' 생성자", "''' Processes the data from both PLC ports in arrival order.", "''' Checks whether the heat exchanger is included in the HSystem","Dim s = \"' Constructor\""]) {
    assert.ok(!fires("vb-narrating-comment", crlf(s, "X()")), s);
  }
});

test("VB narration rules are Taste notes; code rules and placeholder comments are not", () => {
  const vs = scan(crlf("' Initialize the counter", "' Check if the file exists", "Sub F()", "  ' TODO: implement", "End Sub"));
  for (const r of ["narrating-comment", "vb-narrating-comment"]) {
    const v = vs.find((x) => x.name === r);
    assert.ok(v && v.confidence === "Taste note", `${r}: ${JSON.stringify(v)}`);
  }
  assert.equal(vs.find((x) => x.name === "placeholder-comment").confidence, "Hard defect");
  // Other languages keep the shared rule's own class.
  const js = scanContent("// Initialize the counter\nlet i = 0;\n", "a.js").find((x) => x.name === "narrating-comment");
  assert.equal(js.confidence, "Quality defect");
});

test("banned phrases: VB code is not prose; comments and strings still are", () => {
  assert.ok(!scan(crlf("For Each token In summary.Split(\",\"c)", "Next")).some((v) => v.phrase === "in summary"));
  assert.ok(scan(crlf("' In summary, this module handles input")).some((v) => v.phrase === "in summary"));
  assert.ok(scan(crlf("Dim s = \"In summary, all good\"")).some((v) => v.phrase === "in summary"));
  assert.ok(scan(crlf("Dim s = “In summary, all good”")).some((v) => v.phrase === "in summary"));
  assert.ok(scan(crlf("Dim s = \"first line", "in summary, all good\"")).some((v) => v.phrase === "in summary"));
});

test("dashboard suppressed path agrees with the active path for VB phrases and narration", () => {
  const sup = (src) => scanContent(src, "M.vb", { collectSuppressed: true }).filter((v) => v.suppressed);
  assert.ok(!sup(crlf("For Each token In summary ' anti-slop-allow")).some((v) => v.phrase === "in summary"));
  const n = sup(crlf("' Initialize the counter anti-slop-allow")).find((v) => v.name === "narrating-comment");
  assert.ok(!n || n.confidence === "Taste note", JSON.stringify(n));
});

// ── Line continuations (explicit ` _` and implicit) ──────────────────────────

test("continued statements are judged as one statement, reported on their first line", () => {
  const ternary = crlf("Sub F()", "  ok = If(count > 0, _", "         True, False)", "End Sub");
  assert.equal(find("vb-bool-ternary", ternary)?.line, 2);
  assert.ok(fires("vb-bool-ternary", crlf("ok = If(count > 0,", "        True,", "        False)")));
  assert.ok(fires("vb-compare-of-comparison", crlf("If (a > 0 AndAlso", "    b > 0) = True Then X()")));
  assert.ok(fires("vb-empty-catch", crlf("Try", "X()", "Catch ex As Exception When ex.Message <> \"\" AndAlso _", "    ex.HResult <> 0", "End Try")));
  assert.ok(fires("vb-bool-assign-branch", crlf("If a > 0 AndAlso", "   b > 0 Then", "  ok = True", "Else", "  ok = False", "End If")));
});

test("continuation joining does not glue separate statements or bodies", () => {
  // A Catch body continued over two lines is still a body, not an empty Catch.
  assert.ok(!fires("vb-empty-catch", crlf("Try", "X()", "Catch ex As Exception", "  Log(ex.Message, _", "      ex)", "End Try")));
  // A blank line after a trailing operator ends the run.
  assert.ok(!fires("vb-bool-ternary", crlf("x = a +", "", "y = If(ok, \"a\", \"b\")")));
  // An identifier ending in _ is not a continuation.
  assert.ok(!fires("vb-dead-branch", crlf("Dim my_", "If False_Flag Then X()")));
  // Line numbers after a joined statement are unchanged.
  assert.equal(find("vb-dead-branch", crlf("Dim s = Join(a, _", "  b)", "If False Then X()"))?.line, 3);
});

test("C# and VB now agree on dead branches", () => {
  assert.ok(scanContent("class A { void F() { if (true) { X(); } } }\n", "A.cs").some((v) => v.name === "dead-branch"));
  assert.ok(fires("vb-dead-branch", crlf("If True Then", "X()", "End If")));
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

test("a multi-line string keeps its apostrophe out of the comments", () => {
  const vs = scan(crlf("Dim q = \"line1", "it's delve here\"", "Dim x = 1"));
  assert.ok(!vs.some((v) => v.word === "delve"), JSON.stringify(vs));
});

test("a stray quote does not hide the rest of the file", () => {
  const src = crlf("Dim x = <a>d\"</a>", "' delve tapestry", "Try", "X()", "Catch", "End Try", "If a = True Then X()");
  assert.ok(fires("vb-empty-catch", src));
  assert.ok(fires("vb-bool-literal-compare", src));
  assert.ok(fires("vb-empty-catch", crlf("#Region \"Helpers", "Sub F()", "Try", "X()", "Catch", "End Try", "End Sub")));
});

test("a long statement inside a Catch does not make the Catch empty or rethrow-only", () => {
  const long = "Log(ex) : ".repeat(300);
  assert.ok(!fires("vb-empty-catch", crlf("Try", "X()", "Catch ex As Exception", long, "End Try")));
  assert.ok(!fires("vb-rethrow-only-catch", crlf("Try", "X()", "Catch ex As Exception", long, "Throw", "End Try")));
});

test("vb-bool-literal-compare: IsChecked and `:`-separated bodies are NOT findings", () => {
  assert.ok(!fires("vb-bool-literal-compare", crlf("If chkAuto.IsChecked = True Then X()")));
  assert.ok(!fires("vb-bool-literal-compare", crlf("While Running : done = True : End While")));
  assert.ok(!fires("vb-bool-literal-compare", crlf("End If : done = True")));
  assert.ok(fires("vb-bool-literal-compare", crlf("While busy = True : Wait() : End While")));
});

test("comment markers inside VB strings are not comments", () => {
  assert.ok(!fires("placeholder-comment", crlf("Dim s = \"// TODO: implement\"")));
  assert.ok(!fires("narrating-comment", crlf("Dim s = \"# initialize the counter\"")));
  assert.ok(!fires("placeholder-comment", crlf("Dim q = \"line1", "// TODO: implement\"")));
});

test("string masking keeps secret detection: sk- keys and base64 with / still fire, a path does not", () => {
  assert.ok(fires("hardcoded-secret", crlf("Const ApiKey As String = \"sk-abcdefghijklmnop\"")));
  assert.ok(fires("hardcoded-secret", crlf("Const Token As String = \"aGVsbG8vd29ybGQvZm9vYmFyYmF6cXV4/Q==\"")));
  assert.ok(!fires("hardcoded-secret", crlf("Const Token As String = \"/abc123456\"")));
});

test("hardcoded-secret keeps its path, flag and color exclusions in VB strings", () => {
  for (const v of ["/api/v1/token-2", "--password-file-1", "#ff00aa11", "../secrets/key_v1"]) {
    assert.ok(!fires("hardcoded-secret", crlf(`Dim token As String = "${v}"`)), v);
  }
  assert.ok(fires("hardcoded-secret", crlf("Dim ApiKey As String = \"sk-proj-abcdefghijklmnop\"")));
  assert.ok(fires("boilerplate-marker", crlf("Dim k = \"sk-xxx\"")));
});

test("English prose at the start of a multi-line string line does not end the string", () => {
  for (const lead of ["For details see docs", "Return to the main menu", "Case closed", "If you can"]) {
    const vs = scan(crlf("Dim s = \"x", `${lead} ' delve tapestry`, "\"", "Dim y = 1"));
    assert.ok(!vs.some((v) => v.word === "delve"), `${lead}: ${JSON.stringify(vs)}`);
  }
});

test("suppression markers inside VB strings are not suppressions", () => {
  assert.ok(!fires("suppression-comment", crlf("Dim s = \"# type: ignore\"")));
  for (const t of ["@ts-ignore", "@ts-nocheck", "eslint-disable-next-line", "@SuppressWarnings"]) {
    assert.ok(!fires("suppression-comment", crlf(`Dim s = "${t}"`)), t);
  }
});

test("a quote inside a trailing comment does not block string-state recovery", () => {
  const vs = scan(crlf("Dim x = <a>d\"</a>", "Sub F() ' \"delve tapestry", "If done = True Then X()", "End Sub"));
  assert.ok(vs.some((v) => v.word === "delve"), JSON.stringify(vs));
});

test("after a stray quote, declaration headers recover the string state", () => {
  const heads = ["Public Property Name As String", "Public ReadOnly Property Name As String", "Public MustInherit Class Foo",
    "Public Class Foo : Inherits Bar", "Public Overloads Function F() As Integer", "Public Event Changed As EventHandler",
    "Public Delegate Sub D()", "Public Const X As Integer = 1", "Private WithEvents btn As Button", "Imports IO = System.IO", "End SyncLock"];
  for (const h of heads) {
    const vs = scan(crlf("Dim x = <a>d\"</a>", `${h} ' delve tapestry`));
    assert.ok(vs.some((v) => v.word === "delve"), h);
  }
});

test("prose starting with End inside a multi-line string does not end the string", () => {
  const vs = scan(crlf("Dim s = \"x", "End event registration ' TODO: implement", "\"", "' delve tapestry"));
  assert.ok(!fires("placeholder-comment", crlf("Dim s = \"x", "End event registration ' TODO: implement", "\"")));
  assert.ok(vs.some((v) => v.word === "delve"), JSON.stringify(vs));
});

test("English 'as' prose inside a multi-line string does not end it", () => {
  for (const lead of ["Public transport as well as taxis", "Friend request as a favor", "Class size as reported", "Event log: nothing"]) {
    const vs = scan(crlf("Dim s = \"Notice:", `${lead} ' delve into the tapestry`, "are allowed\"", "' delve into the tapestry here"));
    const delve = vs.find((v) => v.word === "delve");
    assert.ok(delve && delve.line === 4, `${lead}: ${JSON.stringify(vs)}`);
  }
});

test("vb-dead-branch is skipped in test files, like the shared dead-branch", () => {
  assert.ok(!scanContent(crlf("If False Then X()"), "Psy.Tests/Foo.vb").some((v) => v.name === "vb-dead-branch"));
});

test("dashboard: a hatched secret that the active path would not flag is not reported as suppressed", () => {
  const sup = (src) => scanContent(src, "M.vb", { collectSuppressed: true }).filter((v) => v.suppressed).map((v) => v.name);
  assert.ok(!sup(crlf("Const Password As String = \"--password-stdin-x1\" ' anti-slop-allow")).includes("hardcoded-secret"));
  assert.ok(!sup(crlf("Const Token As String = \"#1a2b3c4d5e6f\" ' anti-slop-allow")).includes("hardcoded-secret"));
  assert.ok(sup(crlf("Const ApiKey As String = \"sk-proj-abcdefghijklmnop\" ' anti-slop-allow")).includes("hardcoded-secret"));
});

test("typographic double quotes delimit VB strings", () => {
  const vs = scan(crlf("Dim s = “hello ' delve tapestry”"));
  assert.ok(!vs.some((v) => v.word === "delve"), JSON.stringify(vs));
});

test("collectSuppressed: a hatched VB comment reports what it suppressed, a hatched string does not", async () => {
  const sup = (src) => scanContent(src, "M.vb", { collectSuppressed: true }).filter((v) => v.suppressed).map((v) => v.name || v.word);
  assert.ok(sup(crlf("' TODO: implement anti-slop-allow")).includes("placeholder-comment"));
  assert.ok(sup(crlf("' delve into the tapestry anti-slop-allow")).includes("delve"));
  assert.ok(!sup(crlf("Dim s = \"// TODO: implement\" ' anti-slop-allow")).includes("placeholder-comment"));
});

test("a plain Tests folder holds test files", () => {
  const src = crlf("Const ApiKey As String = \"q8Zt3kLm9Xw2Pv7R\"");
  assert.ok(!scanContent(src, "Psy/Tests/Foo.vb").some((v) => v.name === "hardcoded-secret"));
});

test("SelfTest.vb and IuserTest.vb are production files, not tests", () => {
  const src = crlf("Const ApiKey As String = \"q8Zt3kLm9Xw2Pv7R\"");
  for (const p of ["Psy/SelfTest.vb", "Psy/TestControl/IuserTest.vb"]) {
    assert.ok(scanContent(src, p).some((v) => v.name === "hardcoded-secret"), p);
  }
});

test("a multi-line string closing on a keyword-led line keeps later comments visible", () => {
  const vs = scan(crlf("Dim s = \"first", "Return now\"", "' delve tapestry"));
  assert.ok(vs.some((v) => v.word === "delve"), JSON.stringify(vs));
});

test("vb-bool-literal-compare: a named argument before the comparison still matches", () => {
  assert.ok(fires("vb-bool-literal-compare", crlf("If Check(strict:=True) = True Then X()")));
});

test("upper-case .VB test files are test files", () => {
  const src = crlf("Const ApiKey As String = \"q8Zt3kLm9Xw2Pv7R\"");
  assert.ok(!scanContent(src, "Psy/ParserTests.VB").some((v) => v.name === "hardcoded-secret"));
});

test("adjacent empty handlers each count; a selective rethrow before a broader Catch is clean", () => {
  const three = crlf("Try", "X()", "Catch ex As IOException", "Catch ex As TimeoutException", "Catch ex As Exception", "End Try");
  assert.equal(find("vb-empty-catch", three).count, 3);
  const selective = crlf("Try", "X()", "Catch ex As OperationCanceledException", "  Throw", "Catch ex As Exception", "  Return Cached", "End Try");
  assert.ok(!fires("vb-rethrow-only-catch", selective));
  const lastOnly = crlf("Try", "X()", "Catch ex As IOException", "  Log(ex)", "Catch ex As Exception", "  Throw", "End Try");
  assert.ok(fires("vb-rethrow-only-catch", lastOnly));
});

test("vb-bool-literal-compare: a Do While body after `:` is NOT a finding", () => {
  assert.ok(!fires("vb-bool-literal-compare", crlf("Do While ready : done = True : Loop")));
});

test("an inline `: REM` is a comment", () => {
  const vs = scan(crlf("X() : REM delve into the tapestry"));
  assert.ok(vs.some((v) => v.word === "delve"), JSON.stringify(vs));
});

test("a very long generated line does not stall the VB rules", () => {
  const long = "If a = b AndAlso c ".repeat(20000);
  const t0 = Date.now();
  scan(crlf(long, "If done = True Then X()"));
  assert.ok(Date.now() - t0 < 2000, `took ${Date.now() - t0}ms`);
  assert.ok(fires("vb-bool-literal-compare", crlf(long, "If done = True Then X()")));
});

test("#Region and date literals are not read as comments", () => {
  const vs = scan(crlf("#Region \"delve tapestry synergy\"", "Dim d = #1/1/2020#", "#End Region"));
  assert.ok(!vs.some((v) => v.type === "banned-word"), JSON.stringify(vs));
});

test("hardcoded-secret: a VB `As String` constant is a finding, an environment read is not", () => {
  assert.ok(fires("hardcoded-secret", crlf("Const ApiKey As String = \"q8Zt3kLm9Xw2Pv7R\"")));
  assert.ok(!fires("hardcoded-secret", crlf("Dim ApiKey As String = \"api_key\"")));
  assert.ok(!fires("hardcoded-secret", crlf("Dim Password As String = \"\"")));
});

test("the escape hatch silences a VB line", () => {
  assert.ok(!fires("vb-bool-literal-compare", crlf("If ok = True Then X() ' anti-slop-allow")));
});

test("VB test projects and *Tests.vb files are test files: skipInTests rules stay silent", () => {
  const src = crlf("Const ApiKey As String = \"q8Zt3kLm9Xw2Pv7R\"");
  assert.ok(!scanContent(src, "Psy.Tests/LoginTests.vb").some((v) => v.name === "hardcoded-secret"));
  assert.ok(!scanContent(src, "Psy.Tests\\Fixture.vb").some((v) => v.name === "hardcoded-secret"));
  assert.ok(!scanContent(src, "Psy/ParserTests.vb").some((v) => v.name === "hardcoded-secret"));
  assert.ok(scanContent(src, "Psy/Contest.vb").some((v) => v.name === "hardcoded-secret"));
});

test("VB rules never fire on other languages", () => {
  const cs = "class A { bool F(bool x) { if (x == true) { return true; } else { return false; } } }\n";
  assert.ok(!scanContent(cs, "A.cs").some((v) => String(v.name).startsWith("vb-")));
});
