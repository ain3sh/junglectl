# GitHub Repository Setup Guide

Step-by-step instructions to set up your GitHub repository for npx execution.

---

## 📋 Prerequisites

- GitHub account
- Git installed locally
- Repository created on GitHub: `ain3sh/junglectl`
- Local repository initialized

---

## 🚀 Setup Steps

### 1. Create GitHub Repository

If you haven't already:

```bash
# Via GitHub CLI
gh repo create ain3sh/junglectl --public --description "Interactive terminal UI for MCPJungle"

# Or manually at:
# https://github.com/new
# Repository name: junglectl
# Visibility: Public
```

### 2. Initialize Local Repository (if not done)

```bash
cd /path/to/mcpjungle-cli

# Initialize git if needed
git init

# Add remote
git remote add origin https://github.com/ain3sh/junglectl.git

# Or with SSH
git remote add origin git@github.com:ain3sh/junglectl.git
```

### 3. Verify Repository Configuration

Check that package.json has correct URLs (should already be updated):

```json
{
  "name": "junglectl",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/ain3sh/junglectl.git"
  },
  "bugs": {
    "url": "https://github.com/ain3sh/junglectl/issues"
  },
  "homepage": "https://github.com/ain3sh/junglectl#readme"
}
```

### 4. Ensure Built Files Are Included

**CRITICAL:** For npx to work from GitHub, `dist/` folder must be committed!

```bash
# Build the project
npm run build

# Verify dist exists
ls -la dist/

# Check that dist/index.js has shebang
head -1 dist/index.js
# Should output: #!/usr/bin/env node

# Ensure it's executable
chmod +x dist/index.js
```

### 5. Update .gitignore (Important!)

Your `.gitignore` should **NOT** include `dist/` for npx to work:

```bash
# Check current .gitignore
cat .gitignore

# If dist/ is ignored, remove that line:
# Edit .gitignore and remove the line: dist/
```

**Current `.gitignore` should have:**
```
node_modules/
*.log
.DS_Store
.env
*.tgz
.vscode/
.idea/

# Do NOT ignore dist/ for npx compatibility!
# dist/  <-- This should be commented out or removed
```

### 6. Commit Everything

```bash
# Check status
git status

# Add all files including dist/
git add .

# Commit with proper message
git commit -m "feat: Enable npx execution from GitHub

- Update repository URLs to ain3sh/junglectl
- Add publishConfig for public npm access
- Include dist/ folder for npx compatibility
- Update documentation with npx instructions
- Add NPX_USAGE.md guide

Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>"
```

### 7. Push to GitHub

```bash
# Push to main branch
git push -u origin main

# Or if your default branch is different
git push -u origin master
```

### 8. Verify GitHub Repository

Check on GitHub that:
- ✅ Repository is public
- ✅ `dist/` folder is visible
- ✅ `dist/index.js` exists
- ✅ `package.json` has correct repository URL

Visit: https://github.com/ain3sh/junglectl

### 9. Test npx Execution

```bash
# Clear any cached versions
rm -rf ~/.npm/_npx/*ain3sh*

# Test npx from GitHub
npx github:ain3sh/junglectl

# Should download and run successfully!
```

---

## 🔍 Verification Checklist

Before sharing with users, verify:

- [ ] Repository is public on GitHub
- [ ] `dist/` folder is committed (not in .gitignore)
- [ ] `dist/index.js` has shebang: `#!/usr/bin/env node`
- [ ] `dist/index.js` is executable: `chmod +x`
- [ ] `package.json` has correct `bin` field pointing to `./dist/index.js`
- [ ] `package.json` has correct repository URL
- [ ] `package.json` includes `dist/` in `files` array
- [ ] All dependencies are in `dependencies` (not just `devDependencies`)
- [ ] README.md has npx usage instructions
- [ ] `npx github:ain3sh/junglectl` works from clean cache

---

## 🛠️ Maintenance

### When Making Updates

Every time you make changes:

```bash
# 1. Make your code changes in src/

# 2. Rebuild
npm run build

# 3. Test locally
node dist/index.js

# 4. Commit BOTH src/ and dist/
git add src/ dist/
git commit -m "feat: Your feature description"

# 5. Push to GitHub
git push

# 6. Test via npx (clear cache first)
rm -rf ~/.npm/_npx/*ain3sh*
npx github:ain3sh/junglectl
```

### Creating Releases

For stable versions:

```bash
# 1. Update version in package.json
npm version patch  # or minor, or major

# 2. Rebuild
npm run build

# 3. Create git tag
git add .
git commit -m "chore: Release v1.0.1"
git tag v1.0.1
git push --tags

# 4. Users can now install specific version
npx github:ain3sh/junglectl#v1.0.1
```

---

## 📚 Additional Repository Configuration

### Add Repository Topics

On GitHub, add topics for discoverability:
- `mcp`
- `mcpjungle`
- `cli`
- `terminal-ui`
- `tui`
- `nodejs`
- `typescript`

### Set Up GitHub Actions (Optional)

Create `.github/workflows/build.yml`:

```yaml
name: Build and Test

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Type check
      run: npm run type-check
    
    - name: Build
      run: npm run build
    
    - name: Verify dist exists
      run: ls -la dist/
    
    - name: Test execution
      run: node dist/index.js --version || echo "Ready"
```

### Enable GitHub Pages (Optional)

If you want to host documentation:

1. Go to repository Settings
2. Navigate to Pages
3. Set source to: `main` branch, `/docs` folder
4. Your docs will be at: `https://ain3sh.github.io/junglectl`

---

## 🐛 Troubleshooting

### "Cannot find package" error

**Problem:** npx can't find the package on GitHub.

**Solutions:**
```bash
# 1. Verify repository is public
curl -I https://github.com/ain3sh/junglectl
# Should return 200, not 404

# 2. Check repository URL in package.json
grep "repository" package.json

# 3. Try full URL format
npx git+https://github.com/ain3sh/junglectl.git
```

### "Missing script: install" or build errors

**Problem:** Package has build step but dependencies aren't installed.

**Solutions:**
```bash
# 1. Ensure all dependencies are in "dependencies", not "devDependencies"
# TypeScript and build tools should be in devDependencies
# Runtime dependencies should be in dependencies

# 2. Add postinstall script if needed
# In package.json:
{
  "scripts": {
    "postinstall": "npm run build"
  }
}

# However, for npx from GitHub, it's better to commit pre-built dist/
```

### "No such file or directory: dist/index.js"

**Problem:** dist folder not committed to git.

**Solutions:**
```bash
# 1. Remove dist/ from .gitignore
sed -i '/^dist\/$/d' .gitignore

# 2. Build and commit
npm run build
git add dist/
git commit -m "build: Add dist folder for npx compatibility"
git push
```

### "Permission denied" when running

**Problem:** dist/index.js is not executable.

**Solutions:**
```bash
# 1. Make it executable
chmod +x dist/index.js

# 2. Commit with executable flag
git add --chmod=+x dist/index.js
git commit -m "fix: Make dist/index.js executable"
git push

# 3. Verify shebang is present
head -1 dist/index.js
# Should output: #!/usr/bin/env node
```

---

## 📖 Documentation Links

After setup, users can run:

```bash
# Latest from main branch
npx github:ain3sh/junglectl

# Specific version tag
npx github:ain3sh/junglectl#v1.0.0

# Specific branch
npx github:ain3sh/junglectl#develop

# Specific commit
npx github:ain3sh/junglectl#abc1234
```

Share this simple command with your users! 🚀

---

## ✅ Final Verification

Run this checklist before announcing:

```bash
# 1. Clear all caches
rm -rf ~/.npm/_npx/*

# 2. Test fresh install from GitHub
npx github:ain3sh/junglectl

# 3. Verify it runs without errors
# 4. Test on different machine if possible
# 5. Update README with the command
# 6. Create a GitHub release for v1.0.0
```

---

**Your repository is now ready for npx distribution!** 🎉

Users can run:
```bash
npx github:ain3sh/junglectl
```

No installation required! 🌴
