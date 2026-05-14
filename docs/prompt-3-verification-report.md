# Prompt 3 verification report

Date: 2026-05-14

## 1. Intended Prompt 3 scope

Prompt 3 was intended to complete the static-SSR-only runtime extraction and produce a standalone `blazor.ssr.js` bundle that supports static SSR enhanced navigation, `data-enhance` forms, direct streaming SSR, streaming SSR during enhanced navigation, SSR-only DOM synchronization, `data-permanent`, scroll/hash behavior, lifecycle events, `Blazor.navigateTo`, and `blazor-focus-on-navigate` without importing or exposing interactive Blazor capabilities.

## 2. Bundle output verification

Result: **Pass**.

Actual build outputs from `npm run build`:

- `dist/Debug/blazor.ssr.js` for development builds.
- `dist/blazor.ssr.js` for production unminified builds.
- `dist/blazor.ssr.min.js` for production minified builds.

The Rollup input remains `src/Boot.Ssr.ts`, so the bundle is built from the SSR-only entry point. It is not produced by renaming or aliasing `blazor.web.js`.

`npm run size:ssr` reported:

- `dist/blazor.ssr.js`: 62,650 bytes, 16,065 bytes gzip.
- `dist/blazor.ssr.min.js`: 17,571 bytes, 6,199 bytes gzip.

## 3. Public browser API verification

Result: **Pass**.

The SSR-only global exposes:

- `window.Blazor.start`
- `window.Blazor.navigateTo`
- `window.Blazor.addEventListener`
- `window.Blazor.removeEventListener`

Verified behavior:

- `Blazor.start(options?)` exists.
- `Blazor.start` has a duplicate-start guard.
- the script auto-starts unless `autostart="false"` is present.
- `Blazor.navigateTo(url)` exists.
- `Blazor.navigateTo(url, { replace: true })` routes to replacement enhanced navigation for eligible URLs.
- `Blazor.navigateTo(url, { forceLoad: true })` uses normal browser navigation.
- `replaceHistoryEntry` remains accepted as a compatibility alias for `replace`.
- `Blazor.addEventListener` and `Blazor.removeEventListener` are backed by the SSR event registry.
- `window.DotNet` is not assigned by `src/Boot.Ssr.ts` and is absent from the generated bundle audit.

Correction made in this pass: programmatic navigation now checks HTTP(S) eligibility before attempting enhanced navigation, matching link/form eligibility.

## 4. Dependency boundary verification

Result: **Pass**.

`npm run check:ssr-boundary` inspects the static TypeScript import graph rooted at `src/Boot.Ssr.ts`. It passed after strengthening the forbidden term list to include:

- `DotNet`
- `dotnet`
- `InteractiveServer`
- `InteractiveWebAssembly`
- `InteractiveAuto`

The source-level boundary check strips comments before term scanning so documentation-like source comments containing issue URLs do not create false failures.

Inspected runtime files do not import Server, WebAssembly, Auto, SignalR, circuits, Mono/WASM boot, DotNet interop, render batches, `EventDelegator`, `BrowserRenderer`, `WebRootComponentManager`, `JSRootComponents`, `InputFile`, `Virtualize`, or interactive component descriptor activation.

## 5. Generated bundle audit

Result: **Pass**.

A new `npm run check:ssr-bundle` command verifies the generated SSR bundles after build. It scans `dist/blazor.ssr.js` and `dist/blazor.ssr.min.js` for interactive-only runtime terms and confirms required static SSR protocol strings are present.

Forbidden runtime terms checked include:

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
- `DotNet`
- `dotnet`
- `InteractiveServer`
- `InteractiveWebAssembly`
- `InteractiveAuto`

Expected static SSR strings confirmed in both generated bundles:

- `blazor-enhanced-nav=on`
- `blazor-enhanced-nav`
- `enhancednavigationstart`
- `enhancedload`
- `enhancednavigationend`
- `blazor-ssr`
- `blazor-ssr-end`
- `data-permanent`
- `data-enhance`
- `data-enhance-nav`
- `blazor-focus-on-navigate`

## 6. Enhanced navigation verification

Result: **Pass for covered behavior**.

Automated tests now verify:

- eligible same-base HTTP links are intercepted;
- external links are not intercepted;
- modified clicks are not intercepted;
- download links are not intercepted;
- unsupported protocols such as `mailto:` are not intercepted;
- links outside the app base URI are not intercepted;
- `data-enhance-nav="false"` prevents enhanced navigation fetches;
- enhanced navigation sends `Accept: text/html; blazor-enhanced-nav=on`;
- HTML responses are parsed and merged into the current document through the SSR-only DOM synchronizer;
- browser history is updated for normal enhanced navigation;
- popstate-driven navigation uses the enhanced navigation pipeline;
- hash-only behavior remains delegated to the navigation utilities;
- lifecycle event order for successful enhanced navigation is `enhancednavigationstart`, `enhancedload`, `enhancednavigationend`.

Known test limitation: browser full-page fallback for external redirects and native browser navigation cannot be fully exercised in jsdom. The runtime path remains the inherited enhanced navigation fallback behavior and is covered by source and bundle boundary checks.

## 7. Programmatic navigation verification

Result: **Pass for implemented behavior**.

Verified by source tests and runtime API tests:

- `Blazor.navigateTo('/some-page')` uses enhanced navigation when the URL is HTTP(S), inside the base URI, and an enhanced navigation handler is attached.
- `{ replace: true }` is mapped to replacement enhanced navigation.
- `{ forceLoad: true }` bypasses enhanced navigation and uses browser navigation.
- non-base and non-HTTP(S) URLs fall back to normal browser navigation.
- `replaceHistoryEntry` is documented and preserved as a compatibility alias.

Correction made in this pass: `Blazor.navigateTo` now uses `isHttpOrHttpsUri` before enhanced navigation and `isHttpOrHttpsUri` safely returns `false` for URLs that `new URL(...)` cannot parse.

Known test limitation: jsdom does not implement full browser navigation, so force-load and external fallback are verified by code path/source tests rather than by observing an actual page load.

## 8. Enhanced forms verification

Result: **Pass for covered behavior**.

Automated tests now verify:

- a form without `data-enhance` is not intercepted;
- a GET form with `data-enhance` is enhanced;
- a POST form with `data-enhance` is enhanced;
- submitter name/value are included;
- `method="dialog"` is not enhanced;
- non-`_self` form targets are not enhanced;
- multipart forms send a `FormData` body;
- unsupported/out-of-base/non-HTTP(S) actions fall back before `preventDefault`;
- GET submissions update the URL;
- POST redirect responses are handled through the enhanced navigation path;
- enhanced form responses use the same SSR-only DOM synchronization path;
- enhanced form submissions dispatch lifecycle events in the expected order.

## 9. Direct streaming SSR verification

Result: **Pass for covered behavior**.

Automated tests now verify:

- `<blazor-ssr-end>` is registered as a custom element by the streaming listener;
- inserting streaming SSR markup triggers processing;
- `<template blazor-component-id="...">` replaces the matching `<!--bl:id-->` / `<!--/bl:id-->` marker-bounded range;
- DOM before and after the marker range is preserved;
- missing target markers fail safely without throwing or dispatching `enhancedload`;
- `enhancedload` fires after successful streaming updates.

The inherited runtime also contains streamed redirection, not-found, and error template branches. These were audited in source but not exhaustively simulated in jsdom during this pass.

## 10. Streaming during enhanced navigation verification

Result: **Pass for happy-path framed streaming; malformed/incomplete stream coverage remains a recommended next step**.

Automated tests now verify:

- the `ssr-framing` response header is detected;
- the streamed response body is split into frames using the framing marker;
- the first frame is treated as the initial replacement document;
- later frames are appended as streaming SSR updates;
- the document is not left in the placeholder state;
- `enhancedload` fires after the initial document update;
- `enhancedload` fires again after the streaming update;
- `enhancednavigationend` fires after streaming frame processing completes.

Known limitation: malformed or incomplete framed responses and overlapping aborted framed responses are not yet exhaustively covered by automated tests. The implementation has an abort path inherited from `performEnhancedPageLoad`, but adding explicit malformed/abort fixtures is recommended.

## 11. SSR-only DOM preservation verification

Result: **Pass**.

Existing and new tests cover:

- normal body content updates;
- attribute updates;
- text-node updates;
- removed nodes;
- added nodes;
- matching `data-permanent` preservation;
- preservation of client-owned content inside retained permanent elements;
- normal sibling updates around preserved permanent elements;
- form field state preservation when incoming markup does not explicitly override it;
- comment markers remaining usable for streaming SSR replacement;
- streaming marker-bounded content synchronization through the SSR-only synchronizer.

Known limitation: script execution behavior is documented as matching enhanced-navigation expectations, but jsdom is not a reliable browser script-execution model for full validation.

## 12. Focus-on-navigate verification

Result: **Pass for covered behavior**.

Automated tests verify:

- `blazor-focus-on-navigate` is registered as a custom element;
- the `selector` attribute is read;
- after enhanced navigation events, the selected element receives focus;
- missing selector targets do not throw.

Known limitation: duplicate handler registration is controlled by the single `Blazor.start` duplicate-start guard. The focus module itself does not expose a detach API, so repeated direct calls to `enableFocusOnNavigate` outside `Blazor.start` remain unsupported test-only misuse.

## 13. Defensive interactive-marker warning verification

Result: **Pass**.

Verified behavior:

- the warning does not import interactive descriptor parsing;
- it uses simple DOM comment inspection only;
- normal static SSR pages do not warn because they lack obvious interactive marker comment payloads;
- obvious `server`, `webassembly`, or `auto` marker types warn clearly;
- the warning is non-fatal.

## 14. Sample or fixture verification

Result: **Pass with static-fixture caveat**.

`samples/static-ssr/index.html` demonstrates:

- loading `blazor.ssr.js` with `autostart="false"`;
- `Blazor.addEventListener('enhancedload', ...)`;
- enhanced links;
- a `data-enhance` form;
- `data-permanent`;
- `blazor-focus-on-navigate`;
- streaming SSR marker replacement via a local button.

The sample now explicitly states that it is a static markup fixture. Enhanced navigation and form round trips require a compatible server response; the streaming marker replacement can be demonstrated client-side.

## 15. Documentation audit

Result: **Pass**.

Reviewed and updated:

- `README.md`
- `docs/static-ssr-runtime.md`
- `docs/ssr-runtime-dependency-notes.md`
- sample comments in `samples/static-ssr/index.html`

Documentation now clearly states:

- the runtime is only for Blazor static SSR enhancement;
- it is not a drop-in replacement for `blazor.web.js` on interactive pages;
- unsupported features include `InteractiveServer`, `InteractiveWebAssembly`, `InteractiveAuto`, Blazor component event handlers, SignalR circuits, WebAssembly components, DotNet JS interop, render batches, and interactive activation;
- supported features include enhanced navigation, enhanced forms, streaming SSR, DOM preservation, `data-permanent`, lifecycle events, and focus-on-navigate;
- expected protocol conventions include `Accept: text/html; blazor-enhanced-nav=on`, `blazor-enhanced-nav`, `<blazor-ssr>`, `<blazor-ssr-end>`, `<template blazor-component-id="...">`, marker-bounded SSR ranges, `data-enhance`, `data-enhance-nav`, and `data-permanent`;
- compatibility assumes the ASP.NET Core Blazor static SSR protocol represented by the sources in this repository.

## 16. Commands run

| Command | Result | Notes |
| --- | --- | --- |
| `npm install` | Pass | Installed dependencies from `package-lock.json`; npm reported existing low-severity audit findings. |
| `npm run build` | Pass | Produced debug, production, and minified SSR bundles. |
| `npm test -- --runInBand` | Pass | 4 suites, 26 tests. |
| `npm test` | Pass | Run as part of `npm run verify:toolchain`; 4 suites, 26 tests. |
| `npm run lint` | Pass with warnings | 0 errors; existing warnings remain in SSR DOM merging files. |
| `npm run check:ssr-boundary` | Pass | Static import graph rooted at `src/Boot.Ssr.ts` passed. |
| `npm run check:ssr-bundle` | Pass | Generated bundle forbidden-term and SSR-string audit passed. |
| `npm run size:ssr` | Pass | Reported bundle and gzip sizes. |
| `npm run verify:toolchain` | Pass | Build, tests, lint, source boundary, and bundle audit all passed. |

## 17. Corrections made during this verification pass

- Strengthened `Blazor.navigateTo` to require HTTP(S) before enhanced navigation.
- Made `isHttpOrHttpsUri` safe for unparsable URLs.
- Strengthened the SSR source boundary check with additional forbidden terms and comment stripping.
- Added a generated SSR bundle audit script and wired it into `verify:toolchain`.
- Added integration tests for enhanced navigation, enhanced forms, direct streaming SSR, framed streaming during enhanced navigation, lifecycle events, and focus-on-navigate.
- Clarified static fixture limitations and version/protocol compatibility documentation.

## 18. Explicit answers

- Is `blazor.ssr.js` a true SSR-only bundle rather than a renamed `blazor.web.js`? **Yes.** Rollup uses `src/Boot.Ssr.ts` as input.
- Does the SSR-only bundle avoid DotNet, Server, WebAssembly, Auto, SignalR, and interactive component activation dependencies? **Yes.** Source boundary and generated bundle audits pass.
- Does enhanced navigation work? **Yes for tested static SSR enhanced navigation paths.** Full browser fallback is limited by jsdom.
- Do enhanced forms work? **Yes for tested GET, POST, submitter, multipart, and fallback cases.**
- Does direct streaming SSR work? **Yes for marker-bounded template replacement and safe missing-marker behavior.**
- Does streaming during enhanced navigation work? **Yes for framed happy-path responses.** Malformed/abort edge cases need additional fixtures.
- Are lifecycle events dispatched correctly? **Yes for successful enhanced navigation, forms, direct streaming, and framed streaming tests.**
- Does `data-permanent` preservation work? **Yes, covered by existing SSR DOM sync tests.**
- Is `Blazor.navigateTo` implemented and correct? **Yes for the documented minimal SSR-compatible semantics.**
- Is `blazor-focus-on-navigate` implemented and correct? **Yes for custom element recognition, selector focus, and missing target tolerance.**
- Is the documentation accurate? **Yes, with added static-fixture and protocol-version caveats.**
- What remains incomplete or risky? **Malformed/incomplete framed stream tests, explicit aborted-overlapping-framed-stream tests, streamed redirect/not-found/error jsdom fixtures, and real-browser verification for native full-page fallback/script behavior are recommended next steps.**

## 19. Recommended next steps

1. Add malformed and incomplete SSR framed response tests.
2. Add explicit overlapping/aborted framed navigation tests.
3. Add streamed redirection, not-found, and error behavioral fixtures.
4. Add a real-browser smoke test harness for native full-page fallback, script execution behavior, scroll restoration, and hash scrolling.
5. Re-run the bundle audit against future ASP.NET Core protocol changes before publishing a versioned package.
