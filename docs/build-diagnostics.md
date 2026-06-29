# Seraph Nexus Build Diagnostics

Last updated: 2026-06-28

## Current Dependency Baseline

- Next.js: `16.1.6`
- React: `19.2.3`
- React DOM: `19.2.3`
- eslint-config-next: `16.1.6`

The versions above are pinned in both `package.json` and `package-lock.json`.

## Observed Windows Build Behavior

On Windows PowerShell from `K:\projects\SeraphNexus`:

```powershell
cmd /c npm run build
```

The build uses Next.js 16 Turbopack and repeatedly exceeds the local timeout while still at:

```text
Creating an optimized production build ...
```

It does not reach route collection, static generation, or page output. That makes the current failure look like a compile/bundler/filesystem issue rather than a specific Supabase route, static generation query, or build-time data fetch.

The webpack diagnostic command:

```powershell
cmd /c "npx next build --webpack > logs\build-diagnostic-webpack-final.log 2>&1"
```

returns sooner, but fails with:

```text
Error: EISDIR: illegal operation on a directory, readlink 'K:\projects\SeraphNexus\app\auth\callback\page.tsx'
```

The referenced path has been inspected and is a normal tracked file, not a directory or reparse point. No reparse points were found under `app`.

## Non-Destructive Next Diagnostics

Use these commands before changing application code or dependencies.

### Windows PowerShell

Run from the repository root:

```powershell
git status --short
cmd /c npm run lint
git diff --check
cmd /c "npm run build > logs\build-diagnostic-turbopack.log 2>&1"
cmd /c "npx next build --webpack > logs\build-diagnostic-webpack.log 2>&1"
```

If testing whether the `K:` drive is involved, copy or clone the project onto a local SSD path such as `C:\dev\SeraphNexus-build-check`, install dependencies there, and run:

```powershell
git clone <repo-url> C:\dev\SeraphNexus-build-check
cd C:\dev\SeraphNexus-build-check
npm ci
cmd /c npm run lint
cmd /c "npm run build > logs\build-diagnostic-local-ssd.log 2>&1"
cmd /c "npx next build --webpack > logs\build-diagnostic-local-ssd-webpack.log 2>&1"
```

### WSL or Linux

Run from a Linux filesystem path, not a mounted Windows path, to avoid Windows filesystem semantics:

```bash
git clone <repo-url> ~/seraph-nexus-build-check
cd ~/seraph-nexus-build-check
npm ci
npm run lint
npm run build 2>&1 | tee logs/build-diagnostic-linux.log
npx next build --webpack 2>&1 | tee logs/build-diagnostic-linux-webpack.log
```

### CI

Use a clean Linux runner with `npm ci` and no cache for the first diagnostic run:

```bash
npm ci
npm run lint
npm run build
git diff --check
```

If CI passes while Windows fails, treat the issue as local Windows/K-drive/builder specific. If CI fails at the same step, treat it as project or dependency specific.

## Optional Next Patch-Version Test

Do not test a Next patch change on the active cleanup branch. Use a separate branch:

```powershell
git switch -c diagnostic/next-build-patch
npm install next@latest eslint-config-next@latest --save-exact
cmd /c npm run lint
cmd /c "npm run build > logs\build-diagnostic-next-latest.log 2>&1"
cmd /c "npx next build --webpack > logs\build-diagnostic-next-latest-webpack.log 2>&1"
```

Only keep the dependency change if it fixes the build in a clean environment and the resulting lockfile diff is reviewed separately from UI cleanup.
