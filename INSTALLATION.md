# Installation Guide

Complete guide for installing and setting up JungleCTL.

---

## Prerequisites

### Required
- **Node.js** 18.0.0 or higher
- **npm** 9.0.0 or higher (comes with Node.js)
- **MCPJungle CLI** installed and accessible in PATH

### Verify Prerequisites

```bash
# Check Node.js version
node --version
# Should output: v18.0.0 or higher

# Check npm version
npm --version
# Should output: 9.0.0 or higher

# Check MCPJungle CLI
mcpjungle --version
# Should output MCPJungle version info
```

### Installing MCPJungle

If you don't have MCPJungle installed yet:

**macOS (Homebrew)**:
```bash
brew install mcpjungle/mcpjungle/mcpjungle
```

**From Source**:
```bash
# Download from GitHub releases
# https://github.com/mcpjungle/MCPJungle/releases
```

---

## Quick Installation

### Option 1: Run with npx (Recommended - No Installation!)

The fastest way to use JungleCTL without installing anything:

```bash
# Run directly from GitHub (always latest)
npx github:ain3sh/junglectl

# Or from npm (once published)
npx junglectl
```

**Benefits of npx:**
- ✅ No installation required
- ✅ Always runs the latest version
- ✅ No global namespace pollution
- ✅ Perfect for one-time or occasional use
- ✅ Works immediately on any machine with Node.js

### Option 2: Global Installation

For frequent use, install globally:

```bash
# From npm Registry (once published)
npm install -g junglectl

# From GitHub
npm install -g github:ain3sh/junglectl

# From Tarball (local testing)
npm install -g ./junglectl-1.0.0.tgz
```

This installs JungleCTL globally, making `junglectl` and `jctl` commands available everywhere.

### Verify Installation

```bash
# With npx (no installation)
npx github:ain3sh/junglectl --version 2>/dev/null || echo "Ready to run!"

# If installed globally
junglectl --version
jctl --version  # Short alias
which junglectl  # Should show installation path
```

---

## Development Installation

For contributing or local development:

### 1. Clone Repository

```bash
git clone https://github.com/ain3sh/junglectl.git
cd junglectl
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Build Project

```bash
npm run build
```

### 4. Link Globally (Optional)

To test as a global command during development:

```bash
npm link
```

This creates symlinks so `junglectl` runs your local development version.

### 5. Development Commands

```bash
# Run in development mode (with hot reload)
npm run dev

# Build TypeScript to JavaScript
npm run build

# Run built version
npm start

# Watch mode (rebuild on changes)
npm run watch

# Type checking only (no build)
npm run type-check

# Clean build artifacts
npm run clean
```

---

## Verification

### Check Installation

```bash
# Check if commands are available
which junglectl
which jctl

# Check version
junglectl --version
# or
jctl --version

# Show help
junglectl --help
```

### Test Run

```bash
# Start JungleCTL
junglectl
```

You should see:
- Welcome message (first run only)
- Main menu with server status
- List of available actions

---

## First Run

### What Happens

On first run, JungleCTL will:
1. Create configuration directory: `~/.junglectl/`
2. Create config file: `~/.junglectl/config.json`
3. Show welcome message
4. Use default settings

### Configuration File

Location: `~/.junglectl/config.json`

Default contents:
```json
{
  "version": "1.0.0",
  "registryUrl": "http://localhost:3000",
  "cacheTTL": {
    "servers": 60000,
    "tools": 60000,
    "groups": 60000,
    "prompts": 30000,
    "schemas": 300000
  },
  "theme": {
    "primaryColor": "cyan",
    "enableColors": true
  },
  "timeout": {
    "default": 30000,
    "invoke": 60000
  },
  "experimental": {
    "enableDebug": false
  }
}
```

You can edit settings anytime from the main menu: **Settings** → **View/Edit Configuration**

---

## Updating

### Update Global Installation

```bash
npm update -g junglectl
```

### Update Development Installation

```bash
cd junglectl
git pull
npm install
npm run build
```

---

## Uninstalling

### Remove Global Installation

```bash
npm uninstall -g junglectl
```

**Note**: This removes the binaries but **preserves** your configuration file at `~/.junglectl/`.

### Remove Configuration (Optional)

To completely remove all JungleCTL data:

```bash
rm -rf ~/.junglectl/
```

---

## Troubleshooting

### Command Not Found

**Problem**: `junglectl: command not found` after installation

**Solutions**:

1. **Check npm global bin path is in PATH**:
   ```bash
   npm config get prefix
   # Should be in your PATH, typically:
   # - macOS/Linux: /usr/local or ~/.npm-global
   # - Windows: %APPDATA%\npm
   ```

2. **Add npm global bin to PATH** (if missing):
   ```bash
   # For bash (~/.bashrc or ~/.bash_profile)
   export PATH="$(npm config get prefix)/bin:$PATH"
   
   # For zsh (~/.zshrc)
   export PATH="$(npm config get prefix)/bin:$PATH"
   
   # Reload shell
   source ~/.bashrc  # or ~/.zshrc
   ```

3. **Verify installation location**:
   ```bash
   npm list -g junglectl
   ```

### Permission Denied

**Problem**: `EACCES: permission denied` during installation

**Solutions**:

1. **Use sudo** (quick fix, not recommended):
   ```bash
   sudo npm install -g junglectl
   ```

2. **Configure npm to use different directory** (recommended):
   ```bash
   mkdir ~/.npm-global
   npm config set prefix '~/.npm-global'
   export PATH=~/.npm-global/bin:$PATH
   # Add export line to ~/.bashrc or ~/.zshrc
   ```

### MCPJungle Not Found

**Problem**: JungleCTL can't find MCPJungle CLI

**Solutions**:

1. **Verify MCPJungle is installed**:
   ```bash
   which mcpjungle
   mcpjungle --version
   ```

2. **Install MCPJungle**:
   ```bash
   brew install mcpjungle/mcpjungle/mcpjungle
   # or download from GitHub releases
   ```

3. **Add MCPJungle to PATH**:
   ```bash
   export PATH="/path/to/mcpjungle:$PATH"
   ```

### Module Not Found (Development)

**Problem**: `Cannot find module` errors after cloning

**Solutions**:

1. **Reinstall dependencies**:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Rebuild project**:
   ```bash
   npm run clean
   npm run build
   ```

### Configuration Errors

**Problem**: Config file corrupted or invalid

**Solutions**:

1. **Reset configuration**:
   ```bash
   # From JungleCTL menu
   Settings → Reset to Defaults
   ```

2. **Manually delete config** (will recreate with defaults):
   ```bash
   rm ~/.junglectl/config.json
   junglectl  # Will create fresh config
   ```

---

## Platform-Specific Notes

### macOS
- ✅ Fully tested and supported
- Use Homebrew for easiest MCPJungle installation
- May need to allow Terminal in System Preferences → Privacy

### Linux
- ✅ Tested on Ubuntu 24.04 LTS (WSL2)
- Works on most distributions with Node.js 18+
- May need to add npm global bin to PATH manually

### Windows
- ⚠️ Should work but not extensively tested
- Use PowerShell or Windows Terminal
- May need to run as Administrator for global install
- Path separators handled automatically

---

## Getting Help

### Documentation
- [Usage Guide](./USAGE.md) - How to use JungleCTL features
- [Changelog](./CHANGELOG.md) - Version history and changes
- [README](./README.md) - Project overview

### Support
- Report bugs: [GitHub Issues](https://github.com/username/junglectl/issues)
- Feature requests: [GitHub Issues](https://github.com/username/junglectl/issues)

---

## Next Steps

After installation:

1. **Start MCPJungle server**:
   ```bash
   mcpjungle start
   # or: docker compose up -d
   ```

2. **Launch JungleCTL**:
   ```bash
   junglectl
   ```

3. **Register your first server** (if none exist):
   - Select "Register New Server" from main menu
   - Follow the wizard

4. **Explore features**:
   - Browse Tools - See available tools
   - Invoke Tool - Run tools with dynamic forms
   - Create Group - Organize tools
   - Settings - Customize JungleCTL

Enjoy! 🌴
