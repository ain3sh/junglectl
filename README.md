# 🌴 JungleCTL

**Interactive Terminal UI for MCPJungle**

Stop memorizing flags, crafting JSON configs, and typing long canonical names. JungleCTL gives you a beautiful, fast, keyboard-driven interface to MCPJungle with autocomplete search, dynamic forms, and smart caching.

---

## 🎯 Why JungleCTL?

### Before (MCPJungle CLI)
```bash
# Register a server (manual JSON crafting)
cat > /tmp/server-config.json << EOF
{
  "name": "my-server",
  "transport": "streamable_http",
  "url": "http://localhost:8080",
  "description": "My HTTP server"
}
EOF
mcpjungle register server -c /tmp/server-config.json

# Invoke a tool (remember flags, type long names)
echo '{"query": "Hello"}' | mcpjungle invoke tool my-server__search-tool --timeout 60

# List tools (parse tables manually)
mcpjungle list tools --server my-server
```

### After (JungleCTL)
```bash
junglectl
# → Interactive menu
# → Autocomplete search
# → Dynamic forms with validation
# → Beautiful tables with colors
# → All in one place
```

---

## ✨ Features

### Core Capabilities
- 🚀 **Tool Invocation** - Dynamic forms generated from JSON Schema with validation
- 📦 **Tool Groups** - Organize tools by project, team, or workflow
- ⚡ **Enable/Disable** - Control tool availability with granular management
- 🔌 **Server Registration** - Wizard for HTTP, STDIO, and SSE servers
- 📋 **Resource Browsing** - Search servers, tools, groups, and prompts

### User Experience
- 🔍 **Autocomplete Search** - Find resources instantly with fuzzy search
- 🎨 **Beautiful UI** - Color-coded status, loading spinners, formatted tables
- ⚡ **Fast** - Smart caching with TTL (sub-second cached responses)
- ⚙️ **Configurable** - Persistent settings (registry URL, cache, timeouts, theme)
- 🛡️ **Helpful Errors** - Detailed troubleshooting hints with step-by-step guidance

### Technical
- 🌐 **Cross-Platform** - Linux, macOS, Windows support
- 📝 **Type-Safe** - TypeScript strict mode with zero errors
- 🎯 **Schema-Aware** - Supports all JSON Schema types (string, number, boolean, enum, array)
- 🔧 **No MCPJungle Changes** - Pure CLI wrapper, zero coupling

---

## 🚀 Installation

### Prerequisites

- **Node.js** 18.0.0 or higher
- **npm** 9.0.0 or higher
- **MCPJungle CLI** installed and accessible

### Quick Install

#### Option 1: Run with npx (Recommended - No Installation Required!)

```bash
# Run directly from GitHub (latest version)
npx github:ain3sh/junglectl

# Run from npm (once published)
npx junglectl
```

#### Option 2: Global Installation

```bash
# From npm (once published)
npm install -g junglectl

# From GitHub
npm install -g github:ain3sh/junglectl

# From tarball (local testing)
npm install -g ./junglectl-1.0.0.tgz
```

### Verify Installation

```bash
# If installed globally
junglectl --version
jctl --version  # Short alias also available

# With npx
npx junglectl --version
```

### First Run

```bash
# With npx (no installation needed)
npx github:ain3sh/junglectl

# Or if installed globally
junglectl
```

On first run:
- Creates config at `~/.junglectl/config.json`
- Shows welcome message
- Uses default settings

---

## 📖 Quick Start Guide

### 1. Start MCPJungle Server

```bash
mcpjungle start
# or: docker compose up -d
```

### 2. Launch JungleCTL

```bash
junglectl
```

### 3. Register Your First Server

From the main menu:
1. Select **"Register New Server"**
2. Choose transport type (HTTP/STDIO/SSE)
3. Fill in details (guided wizard)
4. Confirm and create

### 4. Invoke a Tool

From the main menu:
1. Select **"Invoke Tool"**
2. Search/select tool (autocomplete)
3. Fill in parameters (dynamic form with validation)
4. Review and execute
5. See formatted results

### 5. Explore More

- **Browse Tools** - See all available tools with status
- **Manage Groups** - Create tool collections
- **Enable/Disable** - Control tool availability
- **Settings** - Customize registry URL, cache, theme

---

## 📋 What You Get

### Main Menu
```
┌─────────────────────────────────────────────┐
│  🌴 JungleCTL v1.0.0                       │
│  MCPJungle Server: http://127.0.0.1:8080   │
│  Status: ✅ Connected | 5 servers, 23 tools │
└─────────────────────────────────────────────┘

? What would you like to do?
  ❯ 📋 Browse Tools
    🔧 Invoke Tool
    ➕ Register MCP Server
    📦 Manage Tool Groups
    🔌 Manage Servers
    🎯 Enable/Disable Tools
    ⚙️  Settings
    ❌ Exit
```

### Example: Tool Invocation

```
📝 Fill in tool parameters:

✓ query * - Search query text (string): user research
✓ limit - Maximum number of results (number): 10
✓ includeArchived - Include archived items (boolean): Yes

📦 Input Parameters:
{
  "query": "user research",
  "limit": 10,
  "includeArchived": true
}

✓ Execute this tool? … yes

🚀 Executing Tool

✨ Result:

Found 3 results:
1. User Research Plan Q4
2. Customer Interview Notes
3. Usability Testing Report
```

---

## ⚙️ Configuration

**Location**: `~/.junglectl/config.json`

**Customizable Settings**:
- **Registry URL** - MCPJungle server endpoint
- **Cache TTLs** - How long to cache servers, tools, groups, schemas
- **Timeouts** - Default and tool invocation timeouts
- **Theme** - Primary color and color enable/disable

Edit from Settings menu or manually edit config file.

---

## 📚 Documentation

- **[Installation Guide](./INSTALLATION.md)** - Complete setup instructions
- **[Usage Guide](./USAGE.md)** - Detailed feature documentation
- **[NPX Usage Guide](./NPX_USAGE.md)** - Run without installation using npx
- **[GitHub Setup Guide](./GITHUB_SETUP.md)** - For repository maintainers
- **[Changelog](./CHANGELOG.md)** - Version history and changes
- **[MCPJungle Docs](./docs/MCPJUNGLE_README.md)** - MCPJungle CLI reference

---

## 🛠️ For Developers

### Development Setup

```bash
git clone https://github.com/username/junglectl.git
cd junglectl
npm install
npm run dev  # Run in development mode
```

### Commands

```bash
npm run dev         # Development mode with tsx
npm run build       # Build TypeScript → JavaScript
npm start           # Run built version
npm run watch       # Watch mode (rebuild on changes)
npm run type-check  # Type checking only
npm run clean       # Remove build artifacts
npm run pack-test   # Create tarball and inspect
```

### Architecture

- **`src/core/`** - Core systems (executor, parser, cache, config)
- **`src/commands/`** - Feature implementations (invoke, register, groups, etc.)
- **`src/ui/`** - UI components (prompts, formatters, form builder, spinners)
- **`src/types/`** - TypeScript type definitions
- **`src/utils/`** - Error handling utilities

### Tech Stack

- **TypeScript** - Type-safe development (strict mode)
- **node-pty** - PTY-based command execution (cross-platform)
- **@inquirer/prompts** - Interactive CLI prompts
- **chalk** - Terminal colors
- **cli-table3** - Beautiful tables
- **ora** - Loading spinners

---

## 🐛 Troubleshooting

### Command Not Found
```bash
# Check npm global bin is in PATH
echo $PATH | grep npm

# Add if missing (bash)
export PATH="$(npm config get prefix)/bin:$PATH"
```

### MCPJungle Not Found
```bash
# Verify MCPJungle is installed
which mcpjungle
mcpjungle --version

# Install if missing (macOS)
brew install mcpjungle/mcpjungle/mcpjungle
```

### Config Errors
```bash
# Reset configuration to defaults
junglectl
# → Settings → Reset to Defaults

# Or manually delete
rm ~/.junglectl/config.json
```

See [Installation Guide](./INSTALLATION.md) for comprehensive troubleshooting.

---

## 🤝 Contributing

Contributions welcome! JungleCTL is a pure CLI wrapper with zero MCPJungle source modifications.

### Ideas for Contributions
- Additional transport types
- More JSON Schema validators
- Performance optimizations
- Test coverage
- Documentation improvements

---

## 📊 Project Stats

- **60+ features** across 4 implementation phases
- **Zero TypeScript errors** in strict mode
- **Sub-second cached responses** with smart caching
- **~8,000 lines of code** including documentation
- **Cross-platform** Linux, macOS, Windows support

---

## 📝 License

MIT License - See [LICENSE](./LICENSE) file for details

---

## 🙏 Acknowledgments

Built with ❤️ for the MCPJungle community

- MCPJungle CLI - The foundation this builds upon
- All the amazing open-source libraries used

---

**Ready to tame the jungle?** 🌴

```bash
# Quick start with npx (no installation required!)
npx github:ain3sh/junglectl

# Or install globally
npm install -g junglectl
junglectl
```
