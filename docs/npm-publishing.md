# npm publishing

Package name: `@jalexsocial/blazor.ssr`

## Build locally

```bash
npm ci
npm run build
npm run prepare:npm-package
npm pack ./dist --dry-run
```

## Publish manually

```bash
npm publish ./dist --access public
```

## Automated publishing

Pushes to `main` (and manual workflow dispatch) run `verify:toolchain`, prepare `./dist` as the npm package, check whether the current version already exists on npm, and publish only when the version is new.

## Configure npm token for GitHub Actions

Repository Settings → Secrets and variables → Actions → New repository secret → `NPM_TOKEN`

## Versioning note

A version bump is required for each new npm publication because npm will reject republishing an existing version.
