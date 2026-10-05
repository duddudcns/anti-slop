#!/usr/bin/env node
// anti-slop scanner -- entry point.
//
// Two jobs, and no protocol layer between them and the caller:
//   * as a CLI, `node slop-scanner.mjs <command>` runs the scanner (see lib/cli.mjs);
//   * as a module, it re-exports the rule tables and scan functions for the test suite
//     and for anything embedding the scanner directly.
//
// Never rename this file: the plugin's command and its docs point at this path.
//
// This was an MCP server until 2.0.0. The protocol bought nothing the CLI does not do
// better -- it needed a resident server, an SDK dependency, and a tool round-trip to
// deliver output a subprocess returns directly -- so it was removed rather than kept
// working. The plugin now has zero runtime dependencies.

import { pathToFileURL } from "url";

export {
  BANNED_WORDS,
  LOW_CONFIDENCE_WORDS,
  BANNED_PHRASES,
  DESIGN_PATTERNS,
  CODE_PATTERNS,
  TEXT_CONSTRUCTS,
  NATIVE_PATTERNS,
  VB_PATTERNS,
  CONFIDENCE,
  CONFIDENCE_CLASSES,
} from "./lib/rules.mjs";

export { scanContent, calculateScore, verdict } from "./lib/scan.mjs";

import { runCli } from "./lib/cli.mjs";

// Only dispatch when run directly; importing the module (for tests) must do nothing.
const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  process.exit(await runCli(process.argv.slice(2)));
}
