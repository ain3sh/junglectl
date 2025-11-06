# NPX Usage Guide for JungleCTL

Run JungleCTL instantly without installation using npx!

---

## 🚀 Quick Start

The fastest way to use JungleCTL:

```bash
npx github:ain3sh/junglectl
```

That's it! No installation, no configuration, no global packages. Just run and go.

---

## 📦 What is npx?

**npx** is a package runner tool that comes with npm (5.2+). It allows you to:
- Execute packages without installing them globally
- Always use the latest version
- Avoid cluttering your global namespace
- Share commands easily across teams

---

## 🎯 Usage Options

### Option 1: Run from GitHub (Recommended)

```bash
# Always pulls the latest from main branch
npx github:ain3sh/junglectl
```

**Pros:**
- ✅ Always get the latest features and bug fixes
- ✅ No need to wait for npm publish
- ✅ Perfect for development and testing
- ✅ Works even if package isn't on npm yet

**Cons:**
- ⚠️ Requires GitHub to be accessible
- ⚠️ First run downloads the package (subsequent runs are cached)

### Option 2: Run from npm Registry

```bash
# Run published version from npm
npx junglectl
```

**Pros:**
- ✅ Faster first run (npm CDN is optimized)
- ✅ Works offline if cached
- ✅ Version stability (pinned releases)

**Cons:**
- ⚠️ Requires package to be published on npm
- ⚠️ May not have the absolute latest features

### Option 3: Run Specific Version

```bash
# Run a specific version
npx junglectl@1.0.0

# From GitHub, specific branch/tag/commit
npx github:ain3sh/junglectl#v1.0.0
npx github:ain3sh/junglectl#develop
npx github:ain3sh/junglectl#abc1234
```

---

## 🔄 How npx Caching Works

### First Run
```bash
$ npx github:ain3sh/junglectl
# Downloads package (~2-5 seconds)
# Caches in ~/.npm/_npx/
# Runs JungleCTL
```

### Subsequent Runs
```bash
$ npx github:ain3sh/junglectl
# Uses cached version (instant!)
# Runs JungleCTL
```

### Force Fresh Install
```bash
# Clear npx cache for this package
npx --yes github:ain3sh/junglectl

# Or manually clear cache
rm -rf ~/.npm/_npx/*ain3sh*
```

---

## 🆚 npx vs Global Install

| Feature | npx | Global Install |
|---------|-----|----------------|
| Installation Time | None | 5-10 seconds |
| Disk Space | ~0 (cached temporarily) | ~50MB permanent |
| Version Updates | Automatic | Manual (`npm update -g`) |
| Namespace Pollution | None | Adds `junglectl` command |
| Best For | Occasional use, testing | Daily use, stable workflows |
| Internet Required | First run only | Initial install only |

---

## 💡 Common Use Cases

### For End Users

**Trying JungleCTL for the first time:**
```bash
npx github:ain3sh/junglectl
```

**Regular usage (daily/weekly):**
```bash
# Consider global install for convenience
npm install -g github:ain3sh/junglectl
junglectl
```

### For Developers

**Testing latest changes:**
```bash
npx github:ain3sh/junglectl
```

**Testing a specific branch:**
```bash
npx github:ain3sh/junglectl#feature-branch
```

**Testing a pull request:**
```bash
npx github:ain3sh/junglectl#pr-123
```

### For CI/CD

**In scripts/automation:**
```bash
#!/bin/bash
# Always use latest version in CI
npx github:ain3sh/junglectl --some-args
```

**For reproducible builds:**
```bash
# Pin to specific commit
npx github:ain3sh/junglectl#abc1234567890
```

---

## 🐛 Troubleshooting

### "Cannot find package"

```bash
# Verify the repository exists
curl -I https://github.com/ain3sh/junglectl

# Check your GitHub access
gh auth status

# Try with explicit https
npx git+https://github.com/ain3sh/junglectl.git
```

### "ENOENT: no such file or directory"

```bash
# Ensure package.json has correct "bin" field
# Should point to: ./dist/index.js

# Verify dist folder exists in repository
# Build must be committed to git
```

### "Permission Denied"

```bash
# Ensure dist/index.js has executable permissions
chmod +x dist/index.js

# Verify shebang is present
head -1 dist/index.js
# Should output: #!/usr/bin/env node
```

### Slow First Run

```bash
# This is normal! npx needs to:
# 1. Clone from GitHub (~2-5s)
# 2. Install dependencies (~5-10s)
# 3. Build if needed (~5s)

# Subsequent runs will be instant (cached)

# To speed up, use npm registry instead (once published):
npx junglectl
```

### "old lockfile" or "invalid package-lock.json"

```bash
# Clear npx cache
rm -rf ~/.npm/_npx/

# Or use --yes flag to force reinstall
npx --yes github:ain3sh/junglectl
```

---

## 📝 Best Practices

### For Repository Maintainers

1. **Always commit `dist/` folder:**
   ```bash
   npm run build
   git add dist/
   git commit -m "build: Update dist files"
   ```

2. **Ensure `dist/index.js` is executable:**
   ```bash
   chmod +x dist/index.js
   git add --chmod=+x dist/index.js
   ```

3. **Test before pushing:**
   ```bash
   # Test locally
   node dist/index.js
   
   # Test via npx (from clean cache)
   rm -rf ~/.npm/_npx/*ain3sh*
   npx github:ain3sh/junglectl
   ```

4. **Update `package.json` properly:**
   ```json
   {
     "name": "junglectl",
     "version": "1.0.0",
     "bin": {
       "junglectl": "./dist/index.js",
       "jctl": "./dist/index.js"
     },
     "files": ["dist/", "docs/", "README.md"],
     "repository": {
       "type": "git",
       "url": "git+https://github.com/ain3sh/junglectl.git"
     }
   }
   ```

### For Users

1. **Alias for convenience:**
   ```bash
   # Add to ~/.bashrc or ~/.zshrc
   alias jungle='npx github:ain3sh/junglectl'
   
   # Then just run:
   jungle
   ```

2. **Use in npm scripts:**
   ```json
   {
     "scripts": {
       "jungle": "npx github:ain3sh/junglectl"
     }
   }
   ```
   ```bash
   npm run jungle
   ```

3. **Clear cache periodically:**
   ```bash
   # Once a week/month to get updates
   rm -rf ~/.npm/_npx/
   ```

---

## 🔗 Alternative Syntaxes

All these work the same:

```bash
# GitHub shorthand (recommended)
npx github:ain3sh/junglectl

# Full GitHub URL
npx git+https://github.com/ain3sh/junglectl.git

# SSH (if you have GitHub SSH keys)
npx git+ssh://git@github.com/ain3sh/junglectl.git

# Specific branch/tag
npx github:ain3sh/junglectl#main
npx github:ain3sh/junglectl#v1.0.0
npx github:ain3sh/junglectl#develop

# Specific commit
npx github:ain3sh/junglectl#abc1234567890
```

---

## 📚 Additional Resources

- [npx documentation](https://docs.npmjs.com/cli/v8/commands/npx)
- [npm package.json guide](https://docs.npmjs.com/cli/v8/configuring-npm/package-json)
- [GitHub packages with npm](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)

---

## ❓ FAQ

**Q: Does npx install the package permanently?**  
A: No, it's cached temporarily in `~/.npm/_npx/` but doesn't pollute your global packages.

**Q: Do I need to clear cache to get updates?**  
A: Yes, for GitHub packages. Either clear cache manually or use `npx --yes`.

**Q: Can I use npx offline?**  
A: Yes, if the package is already cached. First run requires internet.

**Q: Is npx slower than a global install?**  
A: First run is slower (download time), but subsequent runs are nearly instant.

**Q: Should I use npx or global install?**  
A: npx for trying out or occasional use. Global install for daily usage.

**Q: Does this work on Windows?**  
A: Yes! npx works on Windows, macOS, and Linux.

**Q: Can I use this in production scripts?**  
A: Yes, but pin to a specific commit/tag for stability:
```bash
npx github:ain3sh/junglectl#v1.0.0
```

---

**Ready to try it?** 🌴

```bash
npx github:ain3sh/junglectl
```

No installation, no commitment, just instant access to JungleCTL!
