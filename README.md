# 🧗 climb

**Climb — ascend the arg tree**

Universal self-adapting TUI for ANY CLI. Stop memorizing commands and flags. climb gives you a beautiful, interactive interface for git, docker, npm, kubectl, and any CLI tool—with autocomplete search, dynamic forms, and command discovery.

---

## 🎯 Why climb?

### Universal CLI Explorer

climb adapts to ANY command-line tool—no configuration needed:

```bash
climb
# → Select CLI: git, docker, npm, kubectl, mcpjungle, etc.
# → Explore commands interactively
# → View command history
# → Get help without leaving the TUI
```

### Before (Manual CLI)
```bash
# Remember git commands and flags
git commit --amend --no-edit --reuse-message=HEAD
git rebase --interactive --autosquash origin/main

# Docker with long commands
docker run --rm -it -v $(pwd):/app -w /app node:18 npm test

# kubectl complexity
kubectl get pods --all-namespaces --field-selector status.phase=Running
```

### After (climb)
```bash
climb
# → Switch to git/docker/kubectl
# → Browse commands with confidence scores
# → Interactive argument input
# → Command preview before execution
# → History tracking with re-run
```

---

## ✨ Features

### Core Capabilities
- 🔍 **Command Discovery** - Browse commands with confidence scores
- 🧭 **Interactive Navigation** - Subcommand exploration with breadcrumbs
- ⚡ **Command History** - Track, re-run, and edit past commands
- 🎯 **Smart Help Parsing** - Extracts commands from `--help` output
- 🔄 **CLI Switching** - Instantly switch between git, docker, npm, kubectl, etc.

### User Experience
- 🔍 **Autocomplete Search** - Find commands instantly with fuzzy matching
- 🎨 **Beautiful UI** - Color-coded status, loading spinners, formatted tables
- ⌨️ **Keyboard Navigation** - Vim-style shortcuts (j/k), ESC to go back
- 📋 **Command Preview** - See the full command before executing
- 🛡️ **History Tracking** - FIFO rotation with export/clear options

### Technical
- 🌐 **Cross-Platform** - Linux, macOS, Windows support
- 📝 **Type-Safe** - TypeScript strict mode with zero errors
- 🚀 **Self-Adapting** - Works with ANY CLI tool automatically
- 💾 **Config Migration** - Seamless v1.0 → v2.0 migration (~/.junglectl → ~/.climb)

---

## 🚀 Installation

### For End Users (No Node.js Required!)

**One-line install (Linux/macOS):**
```bash
curl -fsSL https://raw.githubusercontent.com/ain3sh/climb/main/scripts/install.sh | bash
```

**Manual download:**
Download the appropriate binary from [GitHub Releases](https://github.com/ain3sh/climb/releases):
- **Linux x64**: `climb-linux-x64`
- **macOS Intel**: `climb-darwin-x64`
- **macOS Apple Silicon**: `climb-darwin-arm64`
- **Windows**: `climb-win32-x64.exe`

Then run:
```bash
chmod +x climb-linux-x64      # Make executable (Linux/macOS)
./climb-linux-x64              # Run
```

### For Contributors & Developers (npm)

**Prerequisites:**
- Node.js 18.0.0 or higher
- npm 9.0.0 or higher

**Global installation:**
```bash
# From npm (once published)
npm install -g climb-cli

# Run directly with npx
npx climb-cli
```

**Local development:**
```bash
git clone https://github.com/ain3sh/climb
cd climb
npm install
npm run build
npm start
```

### Verify Installation

```bash
climb --version
# or
climb
```

On first run:
- Creates config at `~/.climb/config.json`
- Shows CLI selector (git, docker, npm, etc.)
- Uses default settings

### Building SEA Binaries (Optional for Contributors)

**Build for current platform only (fast):**
```bash
npm run build:sea:current
./dist/binaries/climb-linux-x64  # Test the binary
```

**Build for all platforms (requires GitHub Actions):**
```bash
# Tag and push to trigger GitHub Actions
git tag v2.0.1
git push --tags

# GitHub Actions automatically:
# 1. Builds binaries for Linux, macOS (x64 + arm64), Windows
# 2. Creates GitHub Release
# 3. Uploads all binaries
```

**What gets built:**
- `climb-linux-x64` (~45MB)
- `climb-darwin-x64` (~45MB)
- `climb-darwin-arm64` (~45MB)
- `climb-win32-x64.exe` (~45MB)

---

## 📖 Quick Start Guide

### 1. Launch climb

```bash
climb
```

### 2. Select or Switch CLI

First run shows CLI selector:
- git
- docker
- npm
- kubectl
- mcpjungle (MCP server support)
- ...and more

Or use **"Switch CLI"** from settings.

### 3. Explore Commands

From the main menu:
1. Select **"Explore"** - Browse available commands
2. View commands ranked by confidence
3. Navigate subcommands interactively
4. Fill in arguments with guided prompts
5. Preview and execute

### 4. View History

From the main menu:
1. Select **"History"** - View past commands
2. See exit codes, duration, timestamps
3. Re-run commands with one keystroke
4. Edit and modify before re-running
5. Clear history or export to JSON

### 5. Customize

- **Switch CLI** - Change target CLI tool
- **Settings** - Configure cache, history size (mcpjungle: registry URL)
- **ESC Navigation** - Always go back, never exit accidentally

---

## 📋 What You Get

### Main Menu
```
  🧗 climb v2.0.0

  Exploring: git
  CLI: git | Version: 2.43.0 ✅

? What would you like to do?
  ❯ 🔍 Explore git Commands
    📜 View Command History
    🔄 Switch CLI
    ⚙️  Settings
    ❌ Exit
```

### Example: Command Exploration (git)

```
? Select a command to explore:
  commit (0.95) - Record changes to the repository
  ❯ push (0.90) - Update remote refs along with objects
  pull (0.90) - Fetch and merge from remote
  branch (0.85) - List, create, or delete branches
  checkout (0.85) - Switch branches or restore files
  merge (0.80) - Join development histories
  rebase (0.80) - Reapply commits on another base
  ...

→ Selected: git push

? Enter arguments for: git push
  remote (optional): origin
  branch (optional): main
  --force? No
  --tags? Yes

Preview: git push origin main --tags

✓ Execute? Yes

🚀 Executing: git push origin main --tags
[Output shown here...]
✅ Command completed (exit code: 0, 1.2s)
```

---

## ⚙️ Configuration

**Location**: `~/.climb/config.json`

**Customizable Settings**:
- **Target CLI** - Currently selected CLI tool (git, docker, npm, kubectl, etc.)
- **CLI Path** - Custom path to CLI executable
- **Default Args** - Arguments to pass to every command
- **History** - Enable/disable, max size (default: 100 commands)
- **Registry URL** - (mcpjungle only) MCP server endpoint
- **Cache TTLs** - (mcpjungle only) Cache durations

Edit from Settings menu or manually edit config file.

**Auto-Migration**: v1.0 configs (~/.junglectl) automatically migrate to v2.0 (~/.climb)

---

## ⌨️ Keyboard Shortcuts

climb supports intuitive keyboard navigation:

**Navigation:**
- `↑↓` or `j/k` - Navigate through options
- `Enter` - Select/confirm current option  
- **`ESC`** - Go back to previous menu (never exits app)
- `Ctrl+C` - Exit application from main menu

**Multi-Select (Checkboxes):**
- `Space` - Toggle current item on/off
- `a` - Toggle all items
- `i` - Invert selection
- `Enter` - Confirm selection
- **`ESC`** - Cancel and go back

**Search/Filter:**
- Type to start filtering
- `↑↓` - Navigate filtered results
- `Enter` - Select item
- **`ESC`** - Cancel search

**Text Input:**
- `Ctrl+U` - Clear line
- `Ctrl+K` - Clear to end
- **`ESC`** - Cancel input

💡 **Tip:** ESC always goes back one level, Ctrl+C exits the app. Selection counts show "5 selected of 23" in multi-select mode!

---

## 📚 Documentation

- **[CHANGELOG.md](./CHANGELOG.md)** - Version history and changes
- **[WEEK4_SEA_COMPLETE.md](./WEEK4_SEA_COMPLETE.md)** - SEA build pipeline implementation
- **[SEA_MIGRATION_COMPLETE.md](./SEA_MIGRATION_COMPLETE.md)** - node-pty → child_process migration
- **[QOL_IMPROVEMENTS.md](./QOL_IMPROVEMENTS.md)** - Keyboard navigation enhancements
- **[docs/](./docs/)** - Architecture and phase completion documentation

---

## 🛠️ For Developers

### Development Setup

```bash
git clone https://github.com/ain3sh/climb.git
cd climb
npm install
npm run dev  # Run in development mode
```

### Commands

```bash
npm run dev                # Development mode with tsx
npm run build              # Build TypeScript → JavaScript
npm run build:sea:current  # Build SEA binary (current platform)
npm run build:sea          # Build SEA binaries (all platforms, CI only)
npm start                  # Run built version
npm run watch              # Watch mode (rebuild on changes)
npm run type-check         # Type checking only
npm run clean              # Remove build artifacts
```

### Architecture

- **`src/core/`** - Core systems (executor, help parser, cache, config, introspection)
- **`src/commands/`** - Feature implementations (explore, history, switch-cli, invoke, etc.)
- **`src/ui/`** - UI components (prompts, formatters, tables, spinners)
- **`src/types/`** - TypeScript type definitions (config, CLI entities)
- **`scripts/`** - Build scripts (SEA, install)

### Tech Stack

- **TypeScript** - Type-safe development (strict mode, zero errors)
- **child_process** - Command execution (SEA-compatible, no native modules)
- **@inquirer/prompts** - Interactive CLI prompts
- **chalk** - Terminal colors
- **cli-table3** - Beautiful tables
- **ora** - Loading spinners
- **esbuild** - Fast JavaScript bundler (SEA builds)
- **postject** - SEA blob injection tool

---

## 🐛 Troubleshooting

### Binary Not in PATH (SEA install)
```bash
# Add ~/.climb/bin to PATH
echo 'export PATH="$HOME/.climb/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc  # or ~/.zshrc
```

### CLI Tool Not Found
```bash
# climb checks if target CLI exists
# Install missing CLI tools:

# git
sudo apt install git         # Ubuntu/Debian
brew install git             # macOS

# docker
sudo apt install docker.io   # Ubuntu/Debian
brew install docker          # macOS

# kubectl
sudo apt install kubectl     # Ubuntu/Debian
brew install kubectl         # macOS
```

### Config Errors
```bash
# View current config
cat ~/.climb/config.json

# Reset to defaults (delete and restart)
rm -rf ~/.climb
climb  # Creates fresh config
```

### History Issues
```bash
# Clear history
climb → History → Clear History

# Or manually delete
rm ~/.climb/history.json
```

---

## 🤝 Contributing

Contributions welcome! climb is a universal CLI explorer built with extensibility in mind.

### Ideas for Contributions
- Support for more CLI tools (add to POPULAR_CLIS in switch-cli.ts)
- Better help parsing (improve confidence scoring)
- Command templates/favorites
- Plugin system for custom CLIs
- Test coverage
- Documentation improvements

See [WEEK4_SEA_COMPLETE.md](./WEEK4_SEA_COMPLETE.md) for build pipeline details.

---

## 📊 Project Stats

- **Universal architecture** - Works with ANY CLI tool
- **Zero TypeScript errors** in strict mode
- **SEA binaries** - No Node.js required for end users
- **~3,000 lines of code** (core + universal features)
- **Cross-platform** - Linux, macOS (x64 + arm64), Windows support

---

## 📝 License

MIT License - See [LICENSE](./LICENSE) file for details

---

## 🙏 Acknowledgments

Built with ❤️ for CLI enthusiasts everywhere

Special thanks to:
- The Node.js team for SEA support
- @inquirer/prompts for beautiful CLI interactions
- chalk, ora, cli-table3 for terminal aesthetics
- esbuild for lightning-fast bundling

---

**Ready to climb?** 🧗

**Climb — ascend the arg tree**

```bash
# End users (no Node.js required)
curl -fsSL https://raw.githubusercontent.com/ain3sh/climb/main/scripts/install.sh | bash

# Developers
npm install -g climb-cli
climb
```
