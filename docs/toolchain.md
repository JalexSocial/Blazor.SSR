# Public npm toolchain

This repository is now configured to install, build, test, and lint with public npm packages and standard Node.js tooling.

## Supported Node.js version

Use Node.js 20 or newer. The cleanup script uses the built-in `fs.rmSync(..., { recursive: true, force: true })` API, so no external cleanup utility is required.

## Package manager

Use npm. The committed `package-lock.json` records the public package graph.

## Commands

- Install dependencies: `npm install`
- Build the SSR bundle: `npm run build`
- Run tests: `npm test`
- Run lint: `npm run lint`

`npm run lint` intentionally targets the SSR entry point, SSR support files, and local build stubs while the copied interactive Blazor sources remain in the repository as migration reference material. The interactive files are not part of the public SSR build target.

- Run all toolchain checks: `npm run verify:toolchain`

The build writes `dist/Debug/blazor.ssr.js` and `dist/Release/blazor.ssr.js`.

## Removed DotNet/WebAssembly runtime packages

`@microsoft/dotnet-runtime` was removed because it is not available from the public npm registry used by this standalone repository and because it belongs to Blazor WebAssembly, Mono, and internal ASP.NET Core runtime boot infrastructure. Those capabilities are intentionally outside the static SSR-only runtime boundary.

The package manifest also omits DotNet JS interop, SignalR, Mono, WebAssembly boot, and Blazor Server circuit packages. The SSR-only runtime must not depend on those packages to install or build.

## Current SSR build compatibility aliases

`DomSync.ts` still contains interactive component descriptor hooks from the original Blazor Web.JS source. The SSR bundle build uses local Rollup aliases under `src/BuildStubs/` to keep those interactive hooks out of the public npm toolchain while preserving the existing source file for a focused follow-up cleanup.

These aliases are temporary and are documented in `docs/ssr-runtime-dependency-notes.md` as dependency blockers to remove when DOM sync receives an SSR-specific marker parsing path.
