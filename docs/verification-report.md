# Static SSR runtime verification report

Date: 2026-05-14

## Executive summary

The static SSR-only runtime verification pass completed successfully. The repository builds `dist/blazor.ssr.js` and `dist/blazor.ssr.min.js`, the automated SSR source-boundary audit passes, the generated bundle audit passes, and the Jest behavior suite passes.

The verified SSR entry point remains `src/Boot.Ssr.ts`. It exposes the minimal static SSR browser API only:

- `Blazor.start`
- `Blazor.navigateTo`
- `Blazor.addEventListener`
- `Blazor.removeEventListener`

The SSR-only bundle does not assign `window.DotNet` and the bundle scan did not find obvious interactive runtime strings for DotNet interop, Server/WebAssembly boot, SignalR/circuits, render batches, browser rendering, root components, input file, virtualize, or interactive render modes.

## Build and verification commands run

- `npm install`
- `npm run build`
- `npm test -- --runInBand`
- `npm run check:ssr-boundary`
- `npm run check:ssr-bundle`
- `npm run lint`
- `npm run size:ssr`

`npm install` completed with npm deprecation/audit warnings from third-party packages, but dependency installation succeeded. `npm run lint` completed with warnings only and no errors; the warnings are existing TypeScript lint warnings in the SSR DOM merge files for `any` usage and non-null assertions.

## Bundle outputs and sizes

Production build outputs:

| Bundle | Raw bytes | Gzip bytes |
| --- | ---: | ---: |
| `dist/blazor.ssr.js` | 62,650 | 16,065 |
| `dist/blazor.ssr.min.js` | 17,571 | 6,199 |

Debug build output:

- `dist/Debug/blazor.ssr.js`

There is no enforced bundle-size budget in this repository. The bundle audit reports sizes but only fails on missing required output, forbidden runtime terms, or missing expected SSR protocol strings.

## Dependency audit results

`npm run check:ssr-boundary` starts at `src/Boot.Ssr.ts`, follows static relative TypeScript imports/exports, and inspected 15 files:

- `src/Boot.Ssr.ts`
- `src/BootCommon.ts`
- `src/DomWrapper.ts`
- `src/Platform/SsrStartOptions.ts`
- `src/Rendering/DomSynchronizer.ts`
- `src/Rendering/FocusOnNavigate.ts`
- `src/Rendering/ScrollRestoration.ts`
- `src/Rendering/SsrDomMerging/SsrAttributeSync.ts`
- `src/Rendering/SsrDomMerging/SsrDataPermanentElementSync.ts`
- `src/Rendering/SsrDomMerging/SsrDomSync.ts`
- `src/Rendering/SsrDomMerging/SsrEditScript.ts`
- `src/Rendering/StreamingRendering.ts`
- `src/Services/NavigationEnhancement.ts`
- `src/Services/NavigationUtils.ts`
- `src/Services/SsrEventRegistry.ts`

Result: **PASS**.

The dependency audit confirmed the SSR-only entry path does not import or require the forbidden interactive source paths or terms scanned by the script, including:

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
- `DotNet` / `dotnet`
- `InteractiveServer`
- `InteractiveWebAssembly`
- `InteractiveAuto`
- the original interactive `Rendering/DomMerging/DomSync` import path

The audit also confirmed the SSR-only DOM synchronization files are reachable from `src/Boot.Ssr.ts`.

### Dependency audit limitations

The source-boundary audit is intentionally conservative. It follows static relative TypeScript imports/exports and literal dynamic imports, then scans reachable source text after comment stripping. It does not execute Rollup transforms, evaluate arbitrary runtime control flow, or prove that every browser behavior is correct. The generated bundle audit and Jest behavior tests remain required companion checks.

## Bundle audit results

`npm run check:ssr-bundle` inspected:

- `dist/blazor.ssr.js`
- `dist/blazor.ssr.min.js`

Result: **PASS**.

### Forbidden runtime string scan

The generated bundle scan did not find these forbidden runtime strings in either production bundle:

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

### Expected SSR string scan

The generated bundle scan found these expected static SSR protocol and markup strings in both production bundles:

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

## Behavior test results

`npm test -- --runInBand` result: **PASS**.

The Jest suite passed 4 test suites and 26 tests.

Covered behavior includes:

### Enhanced navigation

- Eligible same-origin/base-URI links are intercepted.
- External, outside-base, `mailto:`, and `download` links are not intercepted.
- Modified clicks are not intercepted.
- `data-enhance-nav="false"` prevents enhanced interception.
- Enhanced navigation sends `Accept: text/html; blazor-enhanced-nav=on`.
- Enhanced navigation patches the document using the SSR DOM synchronizer.
- Enhanced navigation dispatches lifecycle events in order: `enhancednavigationstart`, `enhancedload`, `enhancednavigationend`.
- Redirect-style response URL updates are covered in enhanced form POST tests.
- Hash/same-page URL helpers are covered by navigation utility behavior.
- Popstate/back-forward behavior is exercised by the framed enhanced-navigation streaming test.

### Enhanced forms

- A form without `data-enhance` is not intercepted.
- GET forms with `data-enhance` are enhanced and submit query-string data.
- POST forms with `data-enhance` are enhanced.
- `method="dialog"` is not enhanced.
- Non-`_self` targets are not enhanced.
- Submitter name/value data is included.
- Multipart form bodies use `FormData`.

### DOM synchronization

- Normal body content is updated.
- Head and body attributes are updated.
- Text nodes are updated.
- Removed nodes are removed.
- Added nodes are added.
- `data-permanent` elements are preserved when matching.
- Mismatched `data-permanent` elements are replaced predictably.
- User-entered form values are preserved when incoming markup has no explicit values.
- Explicit server form values are applied.
- Script elements in `<head>` are synchronized as DOM elements and attributes.
- `<head>` changes, including title and meta changes, are synchronized.

### Streaming SSR

- `<blazor-ssr-end>` triggers custom-element processing.
- Streamed template content replaces the marker-bounded range for the matching `blazor-component-id`.
- Surrounding DOM is preserved.
- Streaming updates dispatch `enhancedload`.
- Missing marker ranges fail safely without throwing.

### Streaming during enhanced navigation

- The `ssr-framing` response header is detected.
- The first frame is treated as the initial document.
- Later frames are appended as streaming SSR updates.
- The completion event is dispatched after streamed updates, not before them.
- The tested event order is `enhancednavigationstart`, `enhancedload` for the initial document, `enhancedload` for the streamed frame, and `enhancednavigationend`.

### Focus on navigate

- `<blazor-focus-on-navigate selector="h1">` focuses the selected element after enhanced navigation completes.
- Missing selectors do not throw.

### Programmatic navigation

Source-level tests confirm the SSR-only public API includes `Blazor.navigateTo(url, options?)`, supports `{ replace: true }`, `{ replaceHistoryEntry: true }`, and `{ forceLoad: true }`, and does not expose `window.DotNet`. The navigation implementation routes eligible internal URLs through the enhanced-navigation handler and falls back to browser navigation for forced or ineligible URLs.

## Sample verification

The static fixture at `samples/static-ssr/index.html` was manually inspected. It demonstrates:

- Loading `../../dist/blazor.ssr.js` with `autostart="false"`.
- Registering an `enhancedload` event handler.
- Calling `Blazor.start()`.
- Enhanced link markup and fallback external/mail links.
- An enhanced GET form using `data-enhance`.
- A `data-permanent` island.
- `<blazor-focus-on-navigate selector="h1">`.
- A client-side fixture that appends `<blazor-ssr>` / `<blazor-ssr-end>` markup to demonstrate marker replacement.

The sample is a static fixture, not a full server implementation. Enhanced navigation and enhanced form submissions require a compatible server response that emits the expected headers and HTML.

## Documentation audit

Reviewed documentation:

- `README.md`
- `docs/static-ssr-runtime.md`
- `docs/ssr-runtime-dependency-notes.md`
- `AGENTS.md`

Result: **PASS**.

The docs accurately describe that this runtime is for static SSR only and is not a drop-in replacement for `blazor.web.js` on interactive pages. They document unsupported render modes (`InteractiveServer`, `InteractiveWebAssembly`, `InteractiveAuto`), unsupported capabilities (Blazor component event handlers, SignalR circuits, WebAssembly components, DotNet JS interop, render batches, interactive activation), supported static SSR capabilities, required markup conventions, events, enhanced forms, enhanced navigation, streaming SSR, `data-permanent`, known limitations, and ASP.NET Core compatibility assumptions.

## Code quality audit

The implementation was reviewed for the verification scope. No interactive Blazor capability was reintroduced.

Positive findings:

- The SSR entry point imports the SSR-only DOM synchronizer rather than the original interactive DOM merge path.
- The public SSR global remains minimal.
- Navigation supports aborting in-flight enhanced navigation when superseded.
- Enhanced navigation falls back to full navigation for unsupported enhanced responses where safe.
- Streaming SSR and enhanced navigation share callback wiring so lifecycle events remain coherent.
- `data-permanent` preservation is isolated in SSR-specific DOM merge code.

Small maintenance improvement made in this pass:

- `scripts/check-ssr-bundle.mjs` now prints raw bytes, gzip bytes, per-term forbidden scan results, and per-term expected SSR string results while preserving failure behavior for missing outputs, forbidden terms, or missing expected protocol strings.

## Explicit questions

1. **Does the SSR-only runtime build?** Yes. `npm run build` passed and emitted `dist/blazor.ssr.js`, `dist/blazor.ssr.min.js`, and `dist/Debug/blazor.ssr.js`.
2. **Does it avoid DotNet, Server, WebAssembly, Auto, SignalR, and interactive component activation dependencies?** Yes. Both the source-boundary audit and generated bundle audit passed.
3. **Does enhanced navigation work?** Yes, within the tested static SSR scenarios for eligible links, fetch headers, DOM patching, history URL updates, event ordering, and fallbacks for ineligible links.
4. **Do enhanced forms work?** Yes, within the tested GET, POST, submitter, multipart, dialog, target, and non-enhanced scenarios.
5. **Does streaming SSR work?** Yes. Marker-bounded replacement via `<blazor-ssr>` / `<blazor-ssr-end>` is covered and passes.
6. **Does streaming during enhanced navigation work?** Yes. Framed responses treat the first frame as the document and subsequent frames as streaming SSR updates, with final completion after streamed updates.
7. **Are lifecycle events dispatched correctly?** Yes for the tested scenarios. Event order is verified for normal enhanced navigation and framed streaming enhanced navigation.
8. **Is the documentation accurate?** Yes. The reviewed docs describe the supported static SSR scope and excluded interactive features.
9. **What remains risky or incomplete?** See the known limitations and recommended next steps below.

## Known limitations and risks

- The dependency-boundary script is a conservative source-level graph scan. It does not replace generated bundle inspection or browser end-to-end testing.
- The behavior tests run in jsdom. They cover core DOM, navigation, forms, and streaming logic but do not prove every browser-native behavior such as real network redirects, native scroll positioning, focus timing across all browsers, or actual compressed transfer behavior.
- The sample page is a static fixture. It does not include a runnable ASP.NET Core server that emits real enhanced navigation responses or framed streaming responses.
- Script synchronization is DOM-based. The SSR-only synchronizer does not add a separate script re-execution framework.
- Some navigation-helper source comments still explain coexistence with interactive routing because the helper is shared with the broader source tree. The SSR entry path does not import the interactive renderer stack, but these shared comments should remain under review to avoid confusion.
- Lint currently reports warnings in SSR DOM merge files for non-null assertions and `any` usage. These are not build-breaking, but reducing them would improve maintainability.
- Streaming redirect, not-found, and error template handling are implemented, but deeper browser-level coverage would be valuable.
- Programmatic navigation has source-level verification and is exercised through the underlying enhanced-navigation handler, but direct `Blazor.navigateTo` browser-level tests would be a useful addition.

## Recommended next steps

1. Add browser-level end-to-end tests against a small ASP.NET Core static SSR fixture server that can emit enhanced navigation, enhanced form, and framed streaming responses.
2. Add direct `Blazor.navigateTo` tests for enhanced, replace, force-load, and ineligible URL cases in a browser-like environment that can observe location changes safely.
3. Add explicit tests for streaming redirect, not-found, and error templates.
4. Reduce lint warnings in the SSR DOM merge implementation by tightening types and removing non-null assertions where practical.
5. Keep `npm run check:ssr-boundary` and `npm run check:ssr-bundle` in release validation to prevent interactive dependency regressions.
