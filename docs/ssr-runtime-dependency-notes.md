# SSR runtime dependency notes

This document records the SSR-only boundary established by `src/Boot.Ssr.ts` and the dependency cleanup that still needs to happen in later PRs. This PR creates the entry point and build target, but intentionally does not perform the full DOM sync or component marker refactor.

## Clearly SSR-relevant files

- `src/Boot.Ssr.ts` is the new static SSR-only entry point. It owns the reduced browser global, startup guard, SSR event registry hookup, streaming listener hookup, enhanced navigation hookup, and optional focus-on-navigate hookup.
- `src/Services/SsrEventRegistry.ts` is a small event registry for `enhancednavigationstart`, `enhancedload`, and `enhancednavigationend`. It exists so the SSR entry point does not need `GlobalExports` or the existing interactive `JSEventRegistry` wiring.
- `src/Services/NavigationEnhancement.ts` is SSR-relevant because it implements enhanced link navigation, `data-enhance` forms, the `Accept: text/html; blazor-enhanced-nav=on` request header, `blazor-enhanced-nav` response validation, DOM-preserving document updates, form post handling, redirect handling, hash scrolling, and completion events.
- `src/Rendering/StreamingRendering.ts` is SSR-relevant because it handles `<blazor-ssr>` / `<blazor-ssr-end>` streaming markers, SSR framing redirects and errors, and streaming updates during enhanced navigation.
- `src/Rendering/DomMerging/AttributeSync.ts` is SSR-relevant because DOM-preserving sync must reconcile attributes without unnecessarily replacing preserved elements.
- `src/Rendering/DomMerging/DataPermanentElementSync.ts` is SSR-relevant because `data-permanent` is a required static SSR DOM-preservation feature.
- `src/Services/NavigationUtils.ts` is partly SSR-relevant because enhanced navigation uses base URI checks, anchor interception, same-page hash checks, programmatic enhanced navigation dispatch, and hash scrolling.
- `src/Rendering/FocusOnNavigate.ts` is SSR-relevant when it can be used without importing interactive Blazor runtime features.
- `src/Rendering/ScrollRestoration.ts` is SSR-relevant because enhanced navigation schedules and applies scroll reset after document updates without importing the interactive renderer.

## Clearly interactive-only files

- `src/Boot.Server.Common.ts` is interactive-only because it configures Blazor Server circuit startup.
- `src/Boot.WebAssembly.Common.ts` is interactive-only because it configures Mono/WebAssembly startup.
- `src/Services/WebRootComponentManager.ts` is interactive-only for the SSR-only bundle because it tracks and activates interactive root components after document updates.
- `src/Rendering/BrowserRenderer.ts` is interactive-only because it applies render batches to live interactive components.
- `src/Rendering/Events/EventDelegator.ts` is interactive-only because static SSR does not dispatch .NET event handlers.
- `src/Rendering/JSRootComponents.ts` is interactive-only because static SSR must not activate JS root components.
- `src/InputFile.ts` and `src/Virtualize.ts` are interactive-only features and must not be exposed by the SSR-only global.

## Shared but contaminated by interactive dependencies

- `src/Rendering/DomMerging/DomSync.ts` is required for SSR DOM-preserving synchronization, but it still imports `ComponentDescriptorDiscovery` and `BrowserRenderer` so it can upgrade interactive component comments and preserve interactive root component descriptors. A later PR needs an SSR-specific marker/parser path that keeps streaming and DOM sync while removing interactive activation dependencies.
- `src/Services/ComponentDescriptorDiscovery.ts` contains marker parsing logic that overlaps with SSR marker handling, but its current purpose is interactive Server/WebAssembly/Auto descriptor discovery. SSR needs any reusable marker parsing split into a non-activating helper.
- `src/Boot.Web.ts` is intentionally left as the full web boot path. It still imports DotNet interop, Server/WebAssembly option setup, `WebRootComponentManager`, `ComponentDescriptorDiscovery`, JS initializers, and interactive startup logic. The SSR entry point must not model those parts.
- `src/Services/NavigationUtils.ts` still contains interactive router state (`hasInteractiveRouter` / `setHasInteractiveRouter`) alongside SSR navigation helpers. The SSR entry point uses only the base URI, hash, and programmatic enhanced navigation portions.
- `src/Rendering/FocusOnNavigate.ts` has been kept structurally compatible with the small SSR event registry, but it still depends on `DomWrapper` and navigation URL helpers. Those are acceptable for now, but should remain under review as the public SSR surface tightens.

## Dependencies to sever in later PRs

- Split `DomSync.ts` so SSR DOM preservation no longer imports `BrowserRenderer` or interactive component descriptor activation.
- Split SSR-safe marker parsing out of `ComponentDescriptorDiscovery.ts`, or replace its usage with a static SSR-only parser that does not activate Server, WebAssembly, or Auto components.
- Keep `NavigationEnhancement.ts` free of `Renderer.ts`; SSR should continue using `ScrollRestoration.ts` for scroll reset instead of importing render batches or `BrowserRenderer`.
- Keep the SSR boot path independent from `GlobalExports.ts` so it never exposes `DotNet`, `rootComponents`, `Virtualize`, `InputFile`, SignalR, or runtime internals.
- Verify the generated `blazor.ssr.js` bundle after the DOM sync split and remove any remaining references to `@microsoft/dotnet-js-interop`, SignalR, Mono/WebAssembly boot, Blazor Server circuits, `BrowserRenderer`, `EventDelegator`, render batches, `JSRootComponents`, `InputFile`, `Virtualize`, and interactive `NavigationManager`.
- Remove the temporary Rollup aliases under `src/BuildStubs/` after DOM sync has an SSR-specific marker parsing path; they exist only to keep the public npm SSR build independent from interactive component descriptor code during this toolchain stabilization step.

## Created entry point vs. future DOM sync cleanup

This PR creates the SSR entry point and records the dependency boundary. It does not rewrite DOM synchronization. Any remaining interactive imports reachable through DOM sync are known blockers and should be addressed in focused follow-up PRs rather than by deleting SSR capabilities.
