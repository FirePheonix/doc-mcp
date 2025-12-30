# Publishing doc-mcp to npm

## Step-by-Step Publishing Guide

### 1. Prepare Your Package

```bash
# Ensure everything builds successfully
npm run build

# Run type checking
npm run typecheck

# Test the package locally
npm pack
# This creates doc-mcp-1.0.0.tgz
```

### 2. Set Up npm Account

```bash
# If you don't have an npm account, create one at https://www.npmjs.com/signup

# Login to npm
npm login
# Enter your username, password, and email
```

### 3. Update Package Information

Before publishing, update `package.json`:

```json
{
  "name": "doc-mcp",
  "version": "1.0.0",
  "author": "Your Name <your.email@example.com>",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/doc-mcp.git"
  },
  "bugs": {
    "url": "https://github.com/yourusername/doc-mcp/issues"
  },
  "homepage": "https://github.com/yourusername/doc-mcp#readme"
}
```

### 4. Check Package Contents

```bash
# See what will be published
npm pack --dry-run

# Should include:
# - dist/ (compiled code)
# - README.md
# - LICENSE
# - package.json
```

### 5. Publish to npm

```bash
# For first-time publish
npm publish

# For scoped packages (e.g., @yourorg/doc-mcp)
npm publish --access public
```

### 6. Verify Publication

```bash
# Check your package page
# https://www.npmjs.com/package/doc-mcp

# Test installation in a new directory
mkdir test-doc-mcp
cd test-doc-mcp
npm init -y
npm install doc-mcp
```

### 7. Future Updates

```bash
# Update version in package.json (follow semver)
npm version patch  # 1.0.0 -> 1.0.1 (bug fixes)
npm version minor  # 1.0.0 -> 1.1.0 (new features)
npm version major  # 1.0.0 -> 2.0.0 (breaking changes)

# Rebuild and publish
npm run build
npm publish
```

## Pre-Publish Checklist

- [ ] All code builds without errors
- [ ] TypeScript types are generated
- [ ] README.md is complete and accurate
- [ ] LICENSE file is present
- [ ] package.json has correct metadata
- [ ] Examples work correctly
- [ ] Version number follows semantic versioning
- [ ] Unnecessary files are excluded (.gitignore, .npmignore)

## npm Scripts Reference

```json
{
  "scripts": {
    "build": "tsup",
    "prepublishOnly": "npm run build",
    "typecheck": "tsc --noEmit"
  }
}
```

The `prepublishOnly` script ensures the package is always built before publishing.

## Publishing Best Practices

1. **Always test locally first** with `npm link` or `npm pack`
2. **Use semantic versioning** (major.minor.patch)
3. **Tag releases** in git: `git tag v1.0.0 && git push --tags`
4. **Maintain changelog** for version history
5. **Consider beta releases** for major changes: `npm publish --tag beta`

## Troubleshooting

### Package name taken?
```bash
# Check if name is available
npm search doc-mcp

# Use a scoped package
# Update package.json: "name": "@yourorg/doc-mcp"
```

### Permission errors?
```bash
# Re-login to npm
npm logout
npm login
```

### Wrong files published?
```bash
# Create .npmignore or use "files" in package.json
echo "src/" >> .npmignore
echo "examples/" >> .npmignore
echo "tsconfig.json" >> .npmignore
```
