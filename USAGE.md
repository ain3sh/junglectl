# JungleCTL Usage Guide

Complete guide to using all JungleCTL v1.0.0 features.

---

## 🚀 Quick Start

### Prerequisites

1. **MCPJungle CLI must be installed**
   ```bash
   # Check installation
   mcpjungle version
   
   # If not installed (macOS)
   brew install mcpjungle/mcpjungle/mcpjungle
   ```

2. **MCPJungle server must be running**
   ```bash
   # Start server
   mcpjungle start
   # or
   docker compose up -d
   
   # Verify server is running (should return JSON)
   curl http://localhost:8080/health
   ```

### Installation

**From npm (once published):**
```bash
npm install -g junglectl
```

**From tarball (local/testing):**
```bash
npm install -g ./junglectl-1.0.0.tgz
```

**Verify installation:**
```bash
junglectl --version
which junglectl  # Should show path to binary
```

### First Run

```bash
# Launch JungleCTL
junglectl

# On first run, you'll see:
# - Welcome message
# - Config location (~/.junglectl/config.json)
# - Main menu
```

---

## 📚 All Features (v1.0.0 Complete!)

JungleCTL v1.0.0 includes **60+ features** across all phases:

### ✅ Core Features
- 📋 **Browse Resources** - View servers, tools, groups, prompts with autocomplete
- 🔧 **Invoke Tool** - Execute tools with dynamic forms from JSON Schema
- ➕ **Register Server** - Wizard for HTTP, STDIO, SSE servers
- 📦 **Tool Groups** - Create, view, delete tool collections
- ⚡ **Enable/Disable** - Control tool and server availability
- ⚙️ **Settings** - Persistent configuration editor
- 🔌 **Quick Views** - Instant server/tool tables

### 🎨 UI Features
- 🔍 **Autocomplete Search** - Fuzzy search for all resources
- 📊 **Beautiful Tables** - Color-coded status, formatted output
- ⏳ **Loading Spinners** - Visual feedback for async operations
- 🎨 **Themes** - 5 color choices + enable/disable colors
- 💾 **Smart Caching** - Sub-second cached responses (TTL-based)

### 🛠️ Advanced Features  
- 📝 **Dynamic Forms** - JSON Schema → interactive prompts with validation
- ✅ **Input Validation** - Type checking, min/max, patterns, required fields
- 🔄 **Content Types** - Text, images, audio, resources, structured JSON
- ⏱️ **Timeouts** - Configurable (default: 30s, invoke: 60s)
- 🛡️ **Error Messages** - Detailed troubleshooting with numbered steps

### ⚙️ Configuration
- 💾 **Persistent Settings** - ~/.junglectl/config.json
- 🔧 **Registry URL** - Configurable MCPJungle endpoint
- ⏰ **Cache TTLs** - Per resource type (1-300s)
- 🎨 **Theme** - Color and enable/disable
- ⏱️ **Timeouts** - Adjustable command timeouts

---

## 🎯 Workflows

### Register a New Server

1. **HTTP Server (e.g., context7)**
   ```
   Select: ➕ Register MCP Server
   
   → Name: context7
   → Description: Library documentation MCP server
   → Transport: 🌐 Streamable HTTP
   → URL: https://mcp.context7.com/mcp
   → Authentication: No
   → Confirm: Yes
   ```

2. **STDIO Server (e.g., filesystem)**
   ```
   Select: ➕ Register MCP Server
   
   → Name: filesystem
   → Description: Local filesystem access
   → Transport: 🖥️ STDIO
   → Command: npx
   → Arguments: -y @modelcontextprotocol/server-filesystem /path/to/dir
   → Environment Variables: (optional)
   → Confirm: Yes
   ```

### Invoke a Tool

```
Select: 🔧 Invoke Tool

Step 1: Select Tool
→ Type to search (e.g., "calculator__add")
→ Autocomplete filters as you type

Step 2: Fill Parameters
→ Dynamic form based on tool's JSON Schema
→ Shows field types, descriptions, required markers
→ Validates input (min/max, patterns, types)

Example for calculator__add:
  ✓ a * - First number (number): 5
  ✓ b * - Second number (number): 3

Step 3: Review Input
→ Shows formatted JSON of your input
→ Confirm to execute

Step 4: See Results
→ Formatted output based on content type
→ Text, images, audio, resources, or JSON
```

### Create a Tool Group

```
Select: 📦 Manage Tool Groups → ➕ Create Group

Step 1: Basic Information
→ Name: my-project-tools
→ Description: Tools for my project

Step 2: Choose Strategy
→ 🔧 Specific Tools - Cherry-pick individual tools
→ 🔌 Entire Servers - Include all tools from servers
→ 🎭 Mixed Approach - Combine tools + servers + exclusions

Step 3: Select Resources
→ Multi-select with checkboxes
→ Space to select, Enter when done

Step 4: Review & Confirm
→ Shows full configuration as JSON
→ Confirm to create
```

### Enable/Disable Tools

```
Select: 🎯 Enable/Disable Tools

Options:
→ Disable Tool - Turn off specific tool
→ Enable Tool - Turn on specific tool  
→ Disable Server - Turn off ALL tools from server
→ Enable Server - Turn on ALL tools from server

(Shows confirmation prompts for destructive operations)
```

### Browse Resources

```
Select: 📋 Browse Resources

Options:
  • 🔌 Servers - All registered servers
  • 🔧 Tools - All tools (filter by server available)
  • 📦 Groups - Tool collections
  • 💬 Prompts - Available prompts

(All with autocomplete search)
```

### Settings

```
Select: ⚙️ Settings

Options:
  • View Configuration - See all current settings
  • Edit Registry URL - Change MCPJungle endpoint
  • Edit Cache TTLs - Adjust cache duration (individual or all)
  • Edit Theme - Change colors (cyan/blue/green/magenta/yellow)
  • Edit Timeouts - Adjust default and invoke timeouts
  • Reset to Defaults - Restore factory settings

(All changes persist immediately to ~/.junglectl/config.json)
```

## 🎨 UI Examples

### Main Menu
```
  🌴 JungleCTL v1.0.0

  Server: http://127.0.0.1:8080 | Status: ✓ Connected | 5 servers, 23 tools

? What would you like to do?
  ❯ 📋 Browse Resources
    🔧 Invoke Tool
    ➕ Register MCP Server
    📦 Manage Tool Groups
    🎯 Enable/Disable Tools
    ⚙️  Settings
    ❌ Exit
```

### Servers Table
```
┌──────────────────┬──────────────────┬────────────────────────────────────┬────────────┐
│ Name             │ Transport        │ URL/Command                        │ Status     │
├──────────────────┼──────────────────┼────────────────────────────────────┼────────────┤
│ context7         │ streamable_http  │ https://mcp.context7.com/mcp       │ ✓ Enabled  │
│ filesystem       │ stdio            │ npx -y @modelcontextprotocol/se... │ ✓ Enabled  │
│ calculator       │ streamable_http  │ http://localhost:8000/mcp          │ ✓ Enabled  │
└──────────────────┴──────────────────┴────────────────────────────────────┴────────────┘
```

### Tools Table
```
┌──────────────────────────────┬──────────────────┬────────────────────────────────────┬──────────┐
│ Tool Name                    │ Server           │ Description                        │ Status   │
├──────────────────────────────┼──────────────────┼────────────────────────────────────┼──────────┤
│ context7__get-library-docs   │ context7         │ Get documentation for libraries    │ ✓ On     │
│ filesystem__read_file        │ filesystem       │ Read file contents                 │ ✓ On     │
│ calculator__add              │ calculator       │ Add two numbers                    │ ✓ On     │
│ calculator__multiply         │ calculator       │ Multiply two numbers               │ ✓ On     │
└──────────────────────────────┴──────────────────┴────────────────────────────────────┴──────────┘
```

## ⌨️ Keyboard Controls

- **Arrow Keys** - Navigate menus
- **Enter** - Select option
- **Type** - Filter/search in autocomplete prompts
- **Ctrl+C** - Exit gracefully
- **Tab** - (In some prompts) Next field

## 🔧 Configuration

Current settings (view via Settings menu):
```json
{
  "Registry URL": "http://127.0.0.1:8080",
  "Cache TTL": {
    "servers": "60s",
    "tools": "30s"
  },
  "Theme": "cyan"
}
```

---

## 🐛 Troubleshooting

### "MCPJungle CLI not found"
```bash
# Check PATH
which mcpjungle

# Install MCPJungle (macOS)
brew install mcpjungle/mcpjungle/mcpjungle

# Or download from releases
# https://github.com/mcpjungle/MCPJungle/releases
```

### "Cannot connect to MCPJungle server"
```bash
# Check if server is running
curl http://localhost:8080/health

# Start server
mcpjungle start
# or
docker compose up -d

# Check server logs
mcpjungle logs
```

### "Command not found: junglectl"
```bash
# Check npm global bin in PATH
echo $PATH | grep npm

# Add to PATH if missing (bash/zsh)
export PATH="$(npm config get prefix)/bin:$PATH"

# Verify installation
which junglectl
npm list -g junglectl
```

### Config Issues
```bash
# View config location
ls ~/.junglectl/config.json

# Reset to defaults
junglectl
# → Settings → Reset to Defaults

# Or manually delete (will recreate)
rm ~/.junglectl/config.json
```

### Tool Invocation Errors
```bash
# Check tool schema
mcpjungle get tool <tool-name>

# Adjust timeout if tool is slow
junglectl
# → Settings → Edit Timeouts → Invoke Timeout
```

See [INSTALLATION.md](./INSTALLATION.md) for comprehensive troubleshooting.

---

## 💡 Tips & Tricks

### Keyboard Shortcuts
- **Arrow Keys** - Navigate menus
- **Enter** - Select/confirm
- **Type** - Filter in autocomplete prompts
- **Ctrl+C** - Exit gracefully (anytime)
- **Space** - Toggle checkboxes (in multi-select)

### Performance
- **First Load** - May take 200-500ms (network + parsing)
- **Cached Loads** - <10ms (instant)
- **Cache Hit Rate** - Typically 90%+ in normal usage
- **Cache Invalidation** - Automatic on create/update/delete operations

### Best Practices
1. **Register servers first** - Before invoking tools
2. **Use autocomplete** - Type to filter, don't scroll
3. **Check tool schemas** - Use "Browse Resources" to see tool details before invoking
4. **Create groups** - For tools you use together often
5. **Adjust timeouts** - If tools take >30s to execute
6. **Customize theme** - Pick your favorite color!

### Power User Features
- **Short Alias** - Use `jctl` instead of `junglectl`
- **Config Location** - `~/.junglectl/config.json` (edit manually if needed)
- **Cache Control** - Adjust TTLs per resource type in Settings
- **Batch Operations** - Use "Edit All Cache TTLs" for quick tuning

---

## 🎓 Advanced Usage

### Working with Complex Tools

**Tools with Many Parameters:**
- Dynamic form will present them one by one
- Required fields marked with *
- Optional fields can be skipped (press Enter)
- See field type and description for each

**Tools with Arrays:**
- Input as comma-separated values
- Example: `item1, item2, item3`
- Type coercion happens automatically (numbers, booleans)

**Tools with Enums:**
- Shows dropdown with valid choices
- Arrow keys to navigate, Enter to select

### Group Strategies

**Specific Tools** - Best for:
- Cross-server collections
- Curated tool sets
- Project-specific tools

**Entire Servers** - Best for:
- Including all tools from trusted servers
- Quick setup
- Server-based organization

**Mixed Approach** - Best for:
- Complex scenarios
- Include multiple servers but exclude specific tools
- Maximum flexibility

### Configuration Tuning

**Registry URL:**
- Default: `http://127.0.0.1:8080`
- Change if MCPJungle runs elsewhere
- Supports http and https

**Cache TTLs:**
- Servers: 60s (changes rarely)
- Tools: 30s (changes moderately)
- Groups: 60s (changes rarely)
- Prompts: 60s (changes rarely)
- Schemas: 300s (never change unless tool updates)

**Timeouts:**
- Default: 30s (for list/browse operations)
- Invoke: 60s (for tool execution)
- Increase if you have slow tools/network

---

## 📝 Developer Notes

### Project Structure
```
src/
├── core/           # PTY execution, parsing, caching
├── commands/       # Feature implementations
├── ui/             # Prompts, formatters, spinners
├── types/          # TypeScript definitions
└── index.ts        # Main entry point
```

### Key Technologies
- **node-pty** - Cross-platform PTY management
- **@inquirer/prompts** - Modern interactive prompts
- **chalk** - Terminal colors
- **cli-table3** - Beautiful tables
- **ora** - Loading spinners

### Development
```bash
# Type checking
npm run type-check

# Watch mode
npm run watch

# Clean build
npm run clean && npm run build
```

## 🤝 Contributing

JungleCTL wraps MCPJungle without modifying its source. All interactions happen via the official CLI.

Contributions welcome for:
- New features (invoke, groups, etc.)
- UI improvements
- Bug fixes
- Documentation
- Testing

## 📄 License

MIT License - See LICENSE file
