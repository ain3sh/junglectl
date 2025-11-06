# Climb `discover` smoke checks

Commands executed with `node dist/index.js discover` to exercise the non-TUI discovery surface.

## Default target (git)
- ✅ `node dist/index.js discover`
  - Lists core git subcommands with confidence scores around 0.75, confirming the discovery entry point works for the saved default target.

## Git subcommand traversal
- ⚠️ `node dist/index.js discover git status`
  - Command completes but the container lacks git manpages, so the helper prints placeholder guidance about installing documentation rather than a structured tree.

- ⚠️ `node dist/index.js discover git status --`
  - Finishes without error yet reports "(no options detected)" because the missing manpages prevent option scraping.

## npm entry
- ✅ `node dist/index.js discover npm`
  - Lists npm subcommands with confidence scores around 0.40 after a few seconds of parsing.

- ⚠️ `node dist/index.js discover npm install --`
  - Runs cleanly but returns "(no options detected)" because the environment-trimmed help text omits option listings.

## MCP jungle surface
- ✅ `node dist/index.js discover mcpjungle`
  - Shows empty collections (servers/tools/groups/prompts), which is expected without any registered MCP resources.

## Python discovery
- ⚠️ `node dist/index.js discover python3`
  - Completes successfully yet only surfaces the `-` pseudo-command and `file` positional placeholder due to the minimal Python help output available in the container.

## Notes
- All runs stayed in non-interactive mode and returned ASCII output without invoking the TUI.
- Missing system documentation (e.g., git manpages) limits option detection for some commands but does not block the discovery workflow itself.
