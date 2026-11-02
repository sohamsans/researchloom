---
name: release-management
description: Automated protocol for maintaining GitHub Releases, release notes, and CHANGELOG.md for ResearchLoom across releases.
---

# Release Management & GitHub Maintenance Protocol

## 1. Golden Rule
Every time a release tag (e.g. `v4.x.x`) is created or updated on GitHub, **never leave the release description blank (`body: null`)**. Users and contributors must immediately know what changed, what was fixed, and what binary packages are provided for each operating system.

## 2. Release Notes Construction Standard
Every GitHub Release description MUST include:
1. **Title & Summary**: 2-3 sentences summarizing the major milestone or purpose of the release.
2. **Key Highlights & Changes**:
   - Explicit sections: `Added`, `Changed`, `Fixed`, `Performance/Security`.
   - Technical details (e.g., APIs added, formula models, hardware curves, UI refactors).
3. **Platform Packages Table**:
   - List each compiled asset:
     - `ResearchLoom.exe` (Windows Standalone)
     - `ResearchLoom-windows-x64.zip` (Windows Archive)
     - `ResearchLoom-macOS-arm64.dmg` (macOS Apple Silicon)
     - `ResearchLoom-android-tablet.apk` (Android Tablet Standalone)
4. **Minimum Requirements & Launch Instructions**:
   - Notes on SmartScreen/Gatekeeper prompts for unsigned open-source binaries.

## 3. Workflow Checklist on Every Release
Whenever code changes warrant a new release:
1. **Update `CHANGELOG.md`**: Add the new version heading matching [Keep a Changelog](https://keepachangelog.com) conventions with categorized bullets.
2. **Commit and Push to `main`**: Ensure working tree is clean.
3. **Tag Release**: Create an annotated tag `git tag -a vX.Y.Z -m "Release vX.Y.Z: ..."` and push with `git push origin vX.Y.Z`.
4. **Publish Release Notes via GitHub API**:
   - Use `git credential fill` to safely retrieve GitHub authentication.
   - Send `PATCH /repos/:owner/:repo/releases/:id` with formatted Markdown release notes matching the changelog.
5. **Verify Assets**: Inspect `https://api.github.com/repos/:owner/:repo/releases/tags/vX.Y.Z` to ensure all CI build runners attached their respective packages.
