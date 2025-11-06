#!/bin/bash
# climb installer - downloads and installs the appropriate binary
# Usage: curl -fsSL https://raw.githubusercontent.com/ain3sh/climb/main/scripts/install.sh | bash

set -e

REPO="ain3sh/climb"
INSTALL_DIR="$HOME/.climb/bin"
BINARY_NAME="climb"

echo "🧗 climb installer"
echo ""

# Detect OS and architecture
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Linux*)
    PLATFORM="linux"
    ;;
  Darwin*)
    PLATFORM="darwin"
    ;;
  MINGW*|MSYS*|CYGWIN*)
    PLATFORM="win32"
    BINARY_NAME="climb.exe"
    ;;
  *)
    echo "❌ Unsupported OS: $OS"
    echo "Supported: Linux, macOS, Windows"
    exit 1
    ;;
esac

case "$ARCH" in
  x86_64|amd64)
    ARCH_NAME="x64"
    ;;
  arm64|aarch64)
    ARCH_NAME="arm64"
    ;;
  *)
    echo "❌ Unsupported architecture: $ARCH"
    echo "Supported: x86_64, arm64"
    exit 1
    ;;
esac

# Special case: macOS arm64 falls back to x64 if arm64 not available
if [ "$PLATFORM" = "darwin" ] && [ "$ARCH_NAME" = "arm64" ]; then
  echo "📍 Detected: macOS Apple Silicon (arm64)"
else
  echo "📍 Detected: $PLATFORM-$ARCH_NAME"
fi

echo ""

# Get latest release
echo "🔍 Fetching latest release..."
LATEST_URL="https://api.github.com/repos/$REPO/releases/latest"
DOWNLOAD_URL=$(curl -s "$LATEST_URL" | grep "browser_download_url.*climb-$PLATFORM-$ARCH_NAME\"" | cut -d '"' -f 4)

if [ -z "$DOWNLOAD_URL" ]; then
  echo "❌ Could not find binary for $PLATFORM-$ARCH_NAME"
  echo ""
  echo "Available binaries at: https://github.com/$REPO/releases"
  echo ""
  echo "Or install via npm:"
  echo "  npm install -g climb-cli"
  exit 1
fi

echo "📥 Downloading from GitHub releases..."
echo "   $DOWNLOAD_URL"
echo ""

# Create install directory
mkdir -p "$INSTALL_DIR"

# Download binary
if ! curl -fsSL "$DOWNLOAD_URL" -o "$INSTALL_DIR/$BINARY_NAME"; then
  echo "❌ Download failed"
  exit 1
fi

# Make executable
chmod +x "$INSTALL_DIR/$BINARY_NAME"

echo "✅ Binary installed to: $INSTALL_DIR/$BINARY_NAME"
echo ""

# Add to PATH
# Check if already in PATH
if echo "$PATH" | grep -q ".climb/bin"; then
  echo "✅ climb is already in your PATH"
else
  # Update all existing shell config files
  UPDATED=false

  for SHELL_RC in "$HOME/.zshrc" "$HOME/.bashrc"; do
    if [ -f "$SHELL_RC" ]; then
      if ! grep -q ".climb/bin" "$SHELL_RC" 2>/dev/null; then
        echo "" >> "$SHELL_RC"
        echo "# climb CLI" >> "$SHELL_RC"
        echo "export PATH=\"\$HOME/.climb/bin:\$PATH\"" >> "$SHELL_RC"
        echo "✅ Added climb to PATH in $SHELL_RC"
        UPDATED=true
      fi
    fi
  done

  # If no rc files were updated, try .profile as fallback
  if [ "$UPDATED" = false ]; then
    SHELL_RC="$HOME/.profile"
    if ! grep -q ".climb/bin" "$SHELL_RC" 2>/dev/null; then
      echo "" >> "$SHELL_RC"
      echo "# climb CLI" >> "$SHELL_RC"
      echo "export PATH=\"\$HOME/.climb/bin:\$PATH\"" >> "$SHELL_RC"
      echo "✅ Added climb to PATH in $SHELL_RC"
      UPDATED=true
    fi
  fi

  if [ "$UPDATED" = true ]; then
    echo ""
    echo "⚡ Run this to update your current shell:"
    if [ -f "$HOME/.zshrc" ]; then
      echo "   source ~/.zshrc"
    elif [ -f "$HOME/.bashrc" ]; then
      echo "   source ~/.bashrc"
    else
      echo "   source ~/.profile"
    fi
  else
    echo "⚠️  Could not add to PATH automatically"
    echo "   Please add this to your shell config:"
    echo "   export PATH=\"\$HOME/.climb/bin:\$PATH\""
  fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ climb installed successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Get started:"
echo "  climb              # Start the TUI"
echo "  climb --help       # Show help"
echo "  climb --version    # Show version"
echo ""
echo "Explore any CLI:"
echo "  • git, docker, npm, kubectl, etc."
echo "  • Universal self-adapting interface"
echo ""
