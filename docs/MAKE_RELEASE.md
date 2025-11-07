# Release Process

This document provides the **complete, step-by-step process** for creating a new release after merging a PR. Follow these steps exactly to avoid common pitfalls.

## Prerequisites

Before starting, ensure you have:
- GitHub Personal Access Token with `repo` scope exported as `GITHUB_API_KEY`
- Latest main branch checked out locally
- All changes merged and pushed to main

## Step-by-Step Release Process

### 1. Verify You're on Latest Main

```bash
git checkout main
git pull origin main
```

### 2. Determine Release Version

Decide on the version number following semantic versioning (e.g., `v2.0.1`, `v2.1.0`, `v3.0.0`).

```bash
VERSION="v2.0.1"  # Replace with your target version
```

### 3. Get Current Commit SHA

```bash
COMMIT_SHA=$(git rev-parse HEAD)
echo "Current commit SHA: $COMMIT_SHA"
```

### 4. Check if Release/Tag Already Exists

```bash
# List existing releases
curl -s -H "Authorization: token $GITHUB_API_KEY" \
  https://api.github.com/repos/ain3sh/climb/releases | \
  jq -r '.[] | "\(.tag_name) - Release ID: \(.id)"'
```

If your target version already exists, proceed to delete it in the next step.

### 5. Delete Existing Release (if needed)

⚠️ **CRITICAL:** You MUST use the GitHub API to delete releases and tags. **DO NOT use `git push`** - it will fail with 403 errors.

```bash
# Get the release ID for your version
RELEASE_ID=$(curl -s -H "Authorization: token $GITHUB_API_KEY" \
  https://api.github.com/repos/ain3sh/climb/releases | \
  jq -r ".[] | select(.tag_name == \"$VERSION\") | .id")

# Delete the release
curl -X DELETE \
  -H "Authorization: token $GITHUB_API_KEY" \
  https://api.github.com/repos/ain3sh/climb/releases/$RELEASE_ID

echo "Deleted release $VERSION (ID: $RELEASE_ID)"

# Delete the tag
curl -X DELETE \
  -H "Authorization: token $GITHUB_API_KEY" \
  https://api.github.com/repos/ain3sh/climb/git/refs/tags/$VERSION

echo "Deleted tag $VERSION"
```

### 6. Create New Tag

Now create the tag pointing to your target commit:

```bash
curl -X POST \
  -H "Authorization: token $GITHUB_API_KEY" \
  -H "Content-Type: application/json" \
  https://api.github.com/repos/ain3sh/climb/git/refs \
  -d "{
    \"ref\": \"refs/tags/$VERSION\",
    \"sha\": \"$COMMIT_SHA\"
  }"

echo "Created tag $VERSION pointing to $COMMIT_SHA"
```

### 7. Wait for GitHub Actions Workflow

The tag creation triggers the `release.yml` workflow which builds binaries for all platforms:
- `linux-x64`
- `darwin-x64` (Intel Mac)
- `darwin-arm64` (Apple Silicon)
- `win32-x64`

**Monitor the workflow:**

```bash
# Check workflow status
gh run list --workflow=release.yml --limit 1
```

Or visit: https://github.com/ain3sh/climb/actions/workflows/release.yml

Wait until all jobs complete successfully (✓ green checkmarks).

### 8. Verify Release Creation

Once the workflow completes, verify the release was created:

```bash
curl -s -H "Authorization: token $GITHUB_API_KEY" \
  https://api.github.com/repos/ain3sh/climb/releases/tags/$VERSION | \
  jq -r '.name, .tag_name, .assets[].name'
```

You should see all four binary assets:
- `climb-linux-x64`
- `climb-darwin-x64`
- `climb-darwin-arm64`
- `climb-win32-x64.exe`

### 9. Update Release Body (Optional)

If you want to customize the release notes or add the shortened install URL:

```bash
# Get the release ID
RELEASE_ID=$(curl -s -H "Authorization: token $GITHUB_API_KEY" \
  https://api.github.com/repos/ain3sh/climb/releases/tags/$VERSION | \
  jq -r '.id')

# Update the release body
curl -X PATCH \
  -H "Authorization: token $GITHUB_API_KEY" \
  -H "Content-Type: application/json" \
  https://api.github.com/repos/ain3sh/climb/releases/$RELEASE_ID \
  -d @- <<'EOF'
{
  "body": "## 🧗 climb $VERSION\n\nSingle executable binaries for all platforms (no Node.js required!)\n\n### Installation\n\n**One-line install (Linux/macOS):**\n```bash\ncurl -fsSL https://ain3sh.com/climb/install.sh | bash\n```\n\n**Manual download:**\n- **Linux x64**: `climb-linux-x64`\n- **macOS Intel**: `climb-darwin-x64`\n- **macOS Apple Silicon**: `climb-darwin-arm64`\n- **Windows**: `climb-win32-x64.exe`\n\n### For Contributors\n```bash\nnpm install -g climb-cli\n```\n\n---\n\n### What's Changed\n\n[Auto-generated release notes will appear here]\n"
}
EOF
```

Replace `$VERSION` with your actual version string in the body.

### 10. Announce Release

Share the release URL:
```
https://github.com/ain3sh/climb/releases/tag/$VERSION
```

## Common Pitfalls and How to Avoid Them

### ❌ DO NOT: Use git push for tags

```bash
# THIS WILL FAIL WITH 403 ERRORS
git push origin v2.0.0  # ❌ WRONG
```

### ✅ DO: Use GitHub API

```bash
# THIS IS THE CORRECT WAY
curl -X POST \
  -H "Authorization: token $GITHUB_API_KEY" \
  https://api.github.com/repos/ain3sh/climb/git/refs \
  -d "{\"ref\": \"refs/tags/$VERSION\", \"sha\": \"$COMMIT_SHA\"}"
```

### ❌ DO NOT: Forget to delete existing release before recreating

If you try to create a tag that already exists, you'll get errors. Always delete both the release AND the tag first.

### ❌ DO NOT: Create tag before verifying commit

Always verify you're on the correct commit with `git log` before creating a tag.

### ✅ DO: Export GitHub token correctly

```bash
export GITHUB_API_KEY="github_pat_YOUR_TOKEN_HERE"
```

## Full Script (Copy-Paste Template)

Here's a complete script you can copy and modify:

```bash
#!/bin/bash
set -e

# Configuration
VERSION="v2.0.1"  # ⬅️ CHANGE THIS
export GITHUB_API_KEY="github_pat_YOUR_TOKEN_HERE"  # ⬅️ SET YOUR TOKEN

# Verify we're on latest main
git checkout main
git pull origin main
COMMIT_SHA=$(git rev-parse HEAD)

echo "Creating release $VERSION from commit $COMMIT_SHA"

# Delete existing release if it exists
RELEASE_ID=$(curl -s -H "Authorization: token $GITHUB_API_KEY" \
  https://api.github.com/repos/ain3sh/climb/releases | \
  jq -r ".[] | select(.tag_name == \"$VERSION\") | .id")

if [ -n "$RELEASE_ID" ]; then
  echo "Deleting existing release $RELEASE_ID"
  curl -X DELETE \
    -H "Authorization: token $GITHUB_API_KEY" \
    https://api.github.com/repos/ain3sh/climb/releases/$RELEASE_ID

  curl -X DELETE \
    -H "Authorization: token $GITHUB_API_KEY" \
    https://api.github.com/repos/ain3sh/climb/git/refs/tags/$VERSION

  echo "Waiting 2 seconds for GitHub to propagate deletion..."
  sleep 2
fi

# Create new tag
echo "Creating tag $VERSION"
curl -X POST \
  -H "Authorization: token $GITHUB_API_KEY" \
  -H "Content-Type: application/json" \
  https://api.github.com/repos/ain3sh/climb/git/refs \
  -d "{
    \"ref\": \"refs/tags/$VERSION\",
    \"sha\": \"$COMMIT_SHA\"
  }"

echo ""
echo "✅ Tag created successfully!"
echo "🔄 Workflow started: https://github.com/ain3sh/climb/actions/workflows/release.yml"
echo ""
echo "Wait for the workflow to complete, then check:"
echo "https://github.com/ain3sh/climb/releases/tag/$VERSION"
```

## Troubleshooting

### "Reference already exists" error

The tag already exists. Follow step 5 to delete it first.

### "401 Unauthorized" error

Your GitHub token is invalid or not exported. Check:
```bash
echo $GITHUB_API_KEY  # Should print your token
```

### Workflow doesn't start

Check that:
1. The tag was created successfully (visit https://github.com/ain3sh/climb/tags)
2. The tag name matches the pattern in `.github/workflows/release.yml` (should start with `v`)
3. You have push permissions to the repository

### Binaries are missing from release

The workflow may have failed. Check the Actions tab for errors:
https://github.com/ain3sh/climb/actions

## Reference Documentation

- GitHub API - Releases: https://docs.github.com/en/rest/releases/releases
- GitHub API - Git References: https://docs.github.com/en/rest/git/refs
- GitHub Actions - Release Workflow: `.github/workflows/release.yml`
