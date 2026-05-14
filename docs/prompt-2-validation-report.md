# Prompt 2 validation report: SSR-only DOM synchronization

## 1. Summary of Prompt 2 changes

Prompt 2 separated the DOM-preserving synchronization path used by the static SSR runtime from the original interactive Blazor DOM merge implementation.

The resulting shape is:

- `src/Boot.Ssr.ts` imports `ssrDomSynchronizer` from the SSR-only DOM merge implementation.
- `src/Services/NavigationEnhancement.ts` and `src/Rendering/StreamingRendering.ts` receive a `DomSynchronizer` through a small explicit seam instead of importing `DomSync.ts` directly.
- `src/Boot.Web.ts` still passes the original `synchronizeDomContent` from `src/Rendering/DomMerging/DomSync.ts`, preserving the full Blazor Web boot path.
- SSR-only DOM synchronization lives under `src/Rendering/SsrDomMerging/` and does not import interactive component activation, logical element, render batch, SignalR, DotNet interop, or WebAssembly startup modules.

## 2. Does `Boot.Ssr.ts` use the SSR-only DOM sync path?

Yes. `src/Boot.Ssr.ts` imports `ssrDomSynchronizer` from `src/Rendering/SsrDomMerging/SsrDomSync.ts` and passes it to both streaming and enhanced navigation setup.

`src/Boot.Ssr.ts` does **not** import `src/Rendering/DomMerging/DomSync.ts`, and the dependency-boundary check verifies that the original interactive DOM sync path is not present in the static import graph rooted at `src/Boot.Ssr.ts`.

## 3. SSR-only DOM sync files

The SSR-only DOM sync path consists of:

- `src/Rendering/DomSynchronizer.ts` — small seam shared by boot/navigation/streaming code.
- `src/Rendering/SsrDomMerging/SsrDomSync.ts` — SSR document, element, range, and streaming marker synchronization.
- `src/Rendering/SsrDomMerging/SsrAttributeSync.ts` — SSR-safe attribute synchronization helper.
- `src/Rendering/SsrDomMerging/SsrDataPermanentElementSync.ts` — SSR-safe `data-permanent` matching helper.
- `src/Rendering/SsrDomMerging/SsrEditScript.ts` — edit-script diff helper used by the SSR-only synchronizer.

## 4. Forbidden dependency checks performed

The validation pass added `scripts/check-ssr-boundary.mjs` and `npm run check:ssr-boundary`.

The script:

1. starts at `src/Boot.Ssr.ts`;
2. follows static relative TypeScript imports/exports;
3. reports every source file inspected;
4. verifies that the expected SSR-only DOM sync files are reachable;
5. fails if any inspected source file contains forbidden interactive dependency terms;
6. fails if the original `DomMerging/DomSync` import path appears in the SSR entry graph.

Forbidden terms checked include:

- `@microsoft/dotnet-js-interop`
- `Boot.Server.Common`
- `Boot.WebAssembly.Common`
- `WebRootComponentManager`
- `ComponentDescriptorDiscovery`
- `BrowserRenderer`
- `EventDelegator`
- `JSRootComponents`
- `RenderBatch`
- `Circuit`
- `SignalR`
- `Mono`
- `WebAssemblyStartOptions`
- `InputFile`
- `Virtualize`
- `LogicalElements`
- `Rendering/DomMerging/DomSync`

## 5. Forbidden dependency scan result

`npm run check:ssr-boundary` passed.

The scan inspected 16 files in the `Boot.Ssr.ts` dependency path and found no forbidden interactive terms. It also confirmed that the SSR-only DOM sync files are present in the dependency graph.

## 6. Test commands run

- `npm install`
- `npm test`
- `npm run lint`
- `npm run check:ssr-boundary`
- `npm run verify:toolchain`

## 7. Build commands run

- `npm run build`
- `npm run verify:toolchain` (which also runs `npm run build`)

## 8. Test results

The Jest suite passed after the validation updates:

- 2 test suites passed.
- 15 tests passed.

`npm run lint` also completed with exit code 0. It currently reports warnings in the copied/extracted SSR DOM merge helpers for `any` and non-null assertions, but no lint errors.

The SSR DOM sync tests validate:

- enhanced navigation-style document synchronization of body content;
- head and body attribute/content synchronization;
- attribute updates;
- text node updates;
- element removal;
- element insertion;
- matching `data-permanent` preservation with normal sibling updates;
- mismatched `data-permanent` replacement behavior;
- text input, textarea, checkbox, and radio preservation when incoming markup does not explicitly override values;
- explicit incoming form value application;
- streaming marker-bounded range replacement with surrounding content preserved;
- safe no-throw behavior for an unsynchronizable detached comment-bounded range;
- source-level wiring of `Boot.Ssr.ts`, `Boot.Web.ts`, navigation, and streaming;
- execution of the standalone SSR boundary check script.

## 9. Explicit answers

- Does the SSR-only runtime still depend on the original interactive `DomSync.ts`? **No.** The SSR-only static import graph uses `src/Rendering/SsrDomMerging/SsrDomSync.ts` and the boundary check fails if `DomMerging/DomSync` appears.
- Does the SSR-only dependency path import `WebRootComponentManager`? **No.**
- Does the SSR-only dependency path import `ComponentDescriptorDiscovery`? **No.**
- Does the SSR-only dependency path import `BrowserRenderer`? **No.**
- Does the SSR-only dependency path import DotNet JS interop? **No.**
- Does the SSR-only DOM sync support enhanced navigation document replacement? **Yes.** It synchronizes document elements and recursively updates `<head>` and `<body>` content and attributes.
- Does the SSR-only DOM sync support streaming SSR marker replacement? **Yes.** `synchronizeSsrStreamingContent` and the injected streaming synchronizer replace content between matching `<!--bl:{id}-->` and `<!--/bl:{id}-->` comments.
- Does `data-permanent` preservation work? **Yes.** Matching permanent elements preserve destination content/attributes, while non-permanent siblings continue to update.
- Are the remaining limitations documented? **Yes.** See `docs/ssr-runtime-dependency-notes.md` for known limitations and the boundary-check scope.

## 10. Corrections made during this validation pass

- Added `scripts/check-ssr-boundary.mjs` and the `check:ssr-boundary` npm script.
- Updated `verify:toolchain` to include the SSR boundary check.
- Expanded `test/SsrDomSync.test.ts` with deeper SSR behavior coverage and a script-level boundary check.
- Expanded `npm run lint` coverage to include `src/Rendering/DomSynchronizer.ts` and `src/Rendering/SsrDomMerging/*.ts`.
- Fixed lint errors in the new SSR-only DOM sync files that were exposed by the expanded lint coverage.
- Removed obsolete Rollup aliases that were previously needed only while the SSR bundle still risked reaching the interactive DOM sync path.
- Updated `docs/ssr-runtime-dependency-notes.md` to document the boundary script, the removed Rollup aliases, and known SSR-only DOM sync limitations.

## 11. Known issues and limitations

- The SSR-only synchronizer intentionally does not discover, merge, preserve, or activate interactive Server/WebAssembly/Auto component descriptors.
- The SSR-only synchronizer does not use interactive logical elements. SSR comments are handled as regular DOM comments.
- Script elements are synchronized as DOM nodes and attributes, but there is no additional script re-execution framework in the SSR-only synchronizer.
- The dependency-boundary check is a conservative static source-graph scan. It does not replace generated bundle auditing or browser end-to-end tests.
