# 🧗 **Climb — ascend the arg tree**

Universal, self-adapting TUI for command-line tools. Stop memorizing flags. Explore, preview, and execute commands for git, docker, npm, kubectl, mcpjungle, and virtually any CLI.

[Releases](/releases) · [Changelog](./CHANGELOG.md) · [License](./LICENSE)

---

## TL;DR

```bash
# End users (no Node.js required)
curl -fsSL https://ain3sh.com/climb/install.sh | bash

# Alternative (direct from GitHub)
curl -fsSL https://raw.githubusercontent.com/ain3sh/climb/main/scripts/install.sh | bash

# Developers (Node 18+)
npm i -g climb-cli   # when published
climb
```

> **WSL users (Windows):** the Linux installer above works in WSL (Ubuntu/Debian/etc.) exactly the same way. Run it from your WSL shell. It installs to your WSL home (e.g., `/home/<you>/.climb`) and adds `~/.climb/bin` to your WSL PATH. No special Windows steps are required.

---

## Why climb?

**Before**

```bash
git commit --amend --no-edit --reuse-message=HEAD
docker run --rm -it -v "$(pwd)":/app -w /app node:18 npm test
kubectl get pods --all-namespaces --field-selector status.phase=Running
```

**After**

```bash
climb
# → Pick CLI (git/docker/kubectl/…)
# → Browse commands with confidence scores
# → Fill args via forms, preview, run, and re-run from history
```

---

## Features

| Area              | What you get                                                                   |
| ----------------- | ------------------------------------------------------------------------------ |
| Command discovery | Parses `--help`, builds an arg/subcommand tree, ranks commands with confidence |
| Interactive forms | Guided prompts for args and flags, with safe previews before execution         |
| Navigation        | Breadcrumbs, fuzzy search, vim keys (j/k), ESC to go back                      |
| History           | Exit codes, durations, timestamps; re-run/edit; export/clear                   |
| Multi-CLI         | Switch between git, docker, npm, kubectl, mcpjungle, and more without config   |
| UX polish         | Colorized output, tables, spinners, sensible defaults                          |

---

## Compatibility

| OS                     | CPU       | Install                  | Notes                                                                                                                                            |
| ---------------------- | --------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Linux (incl. WSL)**  | x64       | Binary, npm              | Works in WSL distributions (Ubuntu/Debian/etc.) via your WSL shell; installs under `/home/<you>/.climb`; use `~/.bashrc` or `~/.zshrc` for PATH. |
| macOS                  | x64/arm64 | Binary, npm              | First run may trigger Gatekeeper; see Troubleshooting                                                                                            |
| Windows 10/11 (native) | x64       | Binary, npm (PowerShell) | SmartScreen may warn on unsigned binaries; see Troubleshooting                                                                                   |

**Runtime:** Binaries require no Node. For npm/dev, Node ≥ 18 and npm ≥ 9.

---

## Installation

### End users (no Node.js required)

**One-liner (Linux/macOS/WSL)**

```bash
curl -fsSL https://raw.githubusercontent.com/ain3sh/climb/main/scripts/install.sh | bash
```

* On **WSL**, run the command inside your WSL shell (e.g., Ubuntu). The installer writes to `~/.climb` inside WSL and updates your WSL shell profile. Launch `climb` from WSL like any other Linux binary.

**Manual download**

1. Grab your binary from [GitHub Releases](https://github.com/ain3sh/climb/releases)

   * Linux x64: `climb-linux-x64`
   * macOS Intel: `climb-darwin-x64`
   * macOS Apple Silicon: `climb-darwin-arm64`
   * Windows: `climb-win32-x64.exe`
2. Make executable and run:

```bash
chmod +x ./climb-linux-x64
./climb-linux-x64
```

**PATH**

```bash
# Add ~/.climb/bin to PATH (Linux/macOS/WSL)
echo 'export PATH="$HOME/.climb/bin:$PATH"' >> ~/.bashrc  # or ~/.zshrc
```

### Developers & contributors (npm)

Prereqs: Node ≥ 18, npm ≥ 9.

```bash
# When published
npm i -g climb-cli
# Or run without global install
npx climb-cli
```

**Local dev**

```bash
git clone https://github.com/ain3sh/climb
cd climb
npm install
npm run dev       # tsx watch
```

---

## Quick start (60 seconds)

```bash
climb
# 1) Select CLI (git/docker/npm/kubectl/…)
# 2) Explore → choose a command
# 3) Fill arguments in guided prompts
# 4) Preview full command
# 5) Execute, then inspect History and re-run
```

---

## How it works

* **Introspection:** climb runs each tool’s `--help` (or equivalent) and parses subcommands/flags into a graph.
* **Ranking:** commands surface with a confidence score based on help structure, frequency hints, and heuristics.
* **Execution:** preview renders the exact command; nothing runs until you confirm.
* **History:** metadata (exit code, duration, timestamp) is stored locally for re-run and export.

Implementation uses a SEA-friendly stack (`child_process`, `@inquirer/prompts`, `esbuild`, `postject`).

---

## Agents: MCP‑style tool discovery for any CLI

climb gives LLM agents a discovery surface similar to MCP servers’ tool listings, but for **arbitrary CLIs**. The TUI is for humans; agents can use the **headless JSON interfaces** below to inspect, plan, and execute deterministically.

### Headless interfaces

* **Export command graph**

  ```bash
  # Build a machine‑readable arg/subcommand tree from CLI help
  climb export <cli> --format json > graph.json
  ```

  Output includes commands, summaries, options/flags with types, required/optional, and examples. Stable IDs let agents cache and reference nodes.

* **Plan & preview**

  ```bash
  # Produce a structured preview for a candidate invocation (no side effects)
  climb preview <cli> --json -- "<args...>"
  # → { command, argv, cwd, envPolicy, preview, safetyNotes }
  ```

* **Execute with structure**

  ```bash
  # Run with a structured result envelope suitable for tool use
  climb run <cli> --json -- "<args...>"
  # → { command, status, exitCode, durationMs, stdout, stderr }
  ```

> These headless commands are designed so an MCP client (or any agent runtime) can emulate **tool discovery** and **tool use** without writing bespoke adapters for each CLI.

### Design considerations (agent‑friendly)

* **Token efficiency:** export once, cache graph by CLI version; send short IDs in subsequent calls.
* **Determinism:** explicit argv in previews; no ambient state mutation unless `--allow-env`/`--cwd` is set.
* **Safety:** dry‑run by default in `preview`; `run` requires an explicit `--confirm` in non‑TTY contexts.
* **Observability:** machine‑readable timings, exit codes, and truncated output windows with byte counts.
* **Policy hooks:** optional allowlist/denylist for commands and flags; redaction for secrets in history.

### MCP adjacency

If you already use MCP servers, you can keep them for high‑value, hand‑curated tools and use **climb export** to fill the gaps for long‑tail CLIs. The effect mirrors MCP **tool discovery** for everything that exposes `--help`.

---

## Configuration

**Location:** `~/.climb/config.json`
**Auto-migration:** `~/.junglectl` → `~/.climb` on first run.

Key settings:

* `targetCli`: active CLI (e.g., "git")
* `cliPath`: override executable path
* `defaultArgs`: array of args appended to every run
* `history`: `{ enabled: true, max: 100 }`
* `registryUrl`: for mcpjungle
* `cacheTtl`: per-source TTLs

Edit via Settings in the TUI or by hand.

---

## Keyboard shortcuts

| Action                | Keys                               |
| --------------------- | ---------------------------------- |
| Navigate              | `↑ ↓` or `j / k`                   |
| Select/confirm        | `Enter`                            |
| Back                  | `ESC`                              |
| Exit (from main menu) | `Ctrl+C`                           |
| Toggle checkbox       | `Space`                            |
| Toggle all / invert   | `a` / `i`                          |
| Filter list           | start typing                       |
| Text input clear      | `Ctrl+U` (line), `Ctrl+K` (to end) |

---

## Examples

**Explore git**

```
? Select a command:
  commit (0.95) – Record changes
❯ push   (0.90) – Update remote refs
  pull   (0.90) – Fetch and merge
  …
```

**Argument form and preview**

```
? Enter arguments for: git push
  remote (optional): origin
  branch (optional): main
  --force? No
  --tags? Yes

Preview: git push origin main --tags
Execute? ✓
```

---

## Troubleshooting

### Binary blocked (macOS)

Gatekeeper may quarantine downloaded binaries. Allow from System Settings → Privacy & Security, or remove the attribute:

```bash
xattr -d com.apple.quarantine /path/to/climb-darwin-arm64
```

### SmartScreen warning (Windows native)

Unsigned binaries can trigger “Windows protected your PC.” Choose **More info → Run anyway**. Reputation improves with code signing.

### WSL notes (Windows)

* Use your WSL shell to install and run `climb` with the Linux binary or installer.
* PATH updates go into your WSL profile (e.g., `~/.bashrc`), not Windows PowerShell.
* To launch from Windows Terminal, open a WSL profile tab and run `climb` there.

### CLI tool not found

Install the target CLI and ensure it’s on PATH (inside your environment: Linux/macOS/WSL):

```bash
sudo apt install git docker.io kubectl      # Ubuntu/Debian/WSL Ubuntu
brew install git docker kubectl             # macOS
```

### PATH issues (Linux/macOS/WSL)

```bash
echo 'export PATH="$HOME/.climb/bin:$PATH"' >> ~/.bashrc  # or ~/.zshrc
```

### Reset config/history

```bash
rm -rf ~/.climb
# or just history
rm ~/.climb/history.json
```

---

## Building binaries (contributors)

Node SEA packs your app into a single executable using a SEA blob injected into a Node binary with `postject`. CI builds cross-platform artifacts.

**Local (current platform)**

```bash
npm run build
npm run build:sea:current
./dist/binaries/climb-linux-x64   # test
```

**All platforms (via GitHub Actions)**

```bash
git tag v2.0.1
git push --tags
# CI builds Linux/macOS (x64+arm64)/Windows and drafts a Release
```

Resulting sizes are typically ~45–55 MB depending on Node base and bundling.

**Notes**

* SEA reads a blob resource named `NODE_SEA_BLOB` and requires a sentinel fuse at injection time.
* There’s no general VFS in Node SEA; assets must be bundled and accessed carefully.

---

## Architecture

* `src/core/` executor, help parser, cache, config, introspection
* `src/commands/` explore, history, switch-cli, invoke
* `src/ui/` prompts, tables, spinners
* `src/types/` TypeScript definitions
* `scripts/` SEA and install scripts

Stack: TypeScript (strict), `child_process`, `@inquirer/prompts`, `chalk`, `cli-table3`, `ora`, `esbuild`, `postject`.

---

## Security & privacy

* **Execution:** climb runs exactly the command shown in preview. You approve before execution.
* **Local only:** History and config live in `~/.climb/`. No network calls are made unless your chosen CLI does so.
* **Least surprise:** You can disable history or reduce retention in Settings.

---

## Contributing

* Good first issues: new CLI adapters, help-parser improvements, command templates/favorites, test coverage, docs.
* Dev scripts:

```bash
npm run dev
npm run type-check
npm run build
npm run build:sea
npm run clean
```

---

## Project stats

* Cross-platform binaries (no Node required)
* TypeScript strict mode
* ~3k LOC core
* Works with common CLIs out of the box

---

## License

MIT © ain3sh

---

## Acknowledgments

* Node.js SEA and postject maintainers for making single-file binaries possible.
* Inquirer ecosystem for solid prompts.
* `chalk`, `ora`, `cli-table3`, `esbuild` for a smooth DX.
