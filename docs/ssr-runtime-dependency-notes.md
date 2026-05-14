# SSR runtime dependency notes

This document records the SSR-only boundary for `src/Boot.Ssr.ts` and the DOM synchronization split that keeps static SSR behavior without bundling interactive Blazor rendering concepts.

## Clearly SSR-relevant files

- `src/Boot.Ssr.ts` is the static SSR-only entry point. It owns the reduced browser global, startup guard, SSR event registry hookup, SSR-only DOM synchronizer hookup, streaming listener hookup, enhanced navigation hookup, and optional focus-on-navigate hookup.
- `src/Services/SsrEventRegistry.ts` is a small event registry for `enhancednavigationstart`, `enhancedload`, and `enhancednavigationend`. It exists so the SSR entry point does not need `GlobalExports` or the existing interactive `JSEventRegistry` wiring.
- `src/Services/NavigationEnhancement.ts` is SSR-relevant because it implements enhanced link navigation, `data-enhance` forms, the `Accept: text/html; blazor-enhanced-nav=on` request header, `blazor-enhanced-nav` response validation, DOM-preserving document updates, form post handling, redirect handling, hash scrolling, and completion events. It now receives a `DomSynchronizer` explicitly instead of importing the original DOM merge implementation.
- `src/Rendering/StreamingRendering.ts` is SSR-relevant because it handles `<blazor-ssr>` / `<blazor-ssr-end>` streaming markers, SSR framing redirects and errors, and streaming updates during enhanced navigation. It now receives a `DomSynchronizer` explicitly instead of importing the original DOM merge implementation.
- `src/Rendering/DomSynchronizer.ts` is the small dependency-injection seam shared by the full web boot path and the SSR-only boot path.
- `src/Rendering/SsrDomMerging/SsrDomSync.ts` is the SSR-only DOM synchronization implementation used by `Boot.Ssr.ts`.
- `src/Rendering/SsrDomMerging/SsrAttributeSync.ts`, `src/Rendering/SsrDomMerging/SsrDataPermanentElementSync.ts`, and `src/Rendering/SsrDomMerging/SsrEditScript.ts` contain the SSR-only attribute, `data-permanent`, and edit-script helpers used by `SsrDomSync.ts`.
- `src/Services/NavigationUtils.ts` is partly SSR-relevant because enhanced navigation uses base URI checks, anchor interception, same-page hash checks, programmatic enhanced navigation dispatch, and hash scrolling.
- `src/Rendering/FocusOnNavigate.ts` is SSR-relevant when it can be used without importing interactive Blazor runtime features.
- `src/Rendering/ScrollRestoration.ts` is SSR-relevant because enhanced navigation schedules and applies scroll reset after document updates without importing the interactive renderer.

## SSR DOM sync features kept

The SSR-only DOM synchronizer keeps the static SSR behavior needed by enhanced navigation and streaming:

- document-to-document synchronization for enhanced navigation responses;
- synchronization through `<html>`, `<head>`, and `<body>` by synchronizing the destination document element with the incoming document element;
- element matching by node type, tag name, and compatible `data-permanent` values;
- attribute insertion, update, and removal for retained normal elements;
- text node updates in place;
- comment node retention/update for non-interactive SSR markers;
- `data-permanent` preservation, leaving the destination element's attributes and content intact when the incoming element carries the same permanent key;
- form value preservation when the incoming control does not explicitly provide a value/checked/selected state;
- insertion/removal of normal nodes during enhanced navigation and streaming;
- streaming replacement of content between `<!--bl:{id}-->` and `<!--/bl:{id}-->` markers;
- safe fallback replacement if the merge algorithm encounters an unsupported state.

## Interactive features intentionally excluded from SSR DOM sync

The SSR-only DOM synchronization path intentionally does **not** support or import:

- interactive component descriptor discovery or activation;
- preserving or merging interactive root components;
- Server, WebAssembly, or Auto component descriptors;
- logical elements used by the interactive renderer;
- render batches;
- browser renderer state;
- event delegation for .NET event handlers;
- DotNet interop;
- SignalR or Blazor Server circuit state;
- Mono/WebAssembly boot state.

`src/Rendering/DomMerging/DomSync.ts` remains in place for `src/Boot.Web.ts`. The full Blazor Web boot path still passes the original synchronizer into navigation and streaming so existing `Boot.Web.ts` behavior is not intentionally changed.

## Tests validating SSR-only behavior

`test/SsrDomSync.test.ts` validates the new SSR-only DOM synchronization path. The tests cover:

- replacing normal body content during enhanced navigation;
- preserving matching `data-permanent` content;
- updating attributes on retained normal elements;
- updating text content in place;
- preserving user-entered form values when the incoming markup does not explicitly override them;
- removing elements absent from the incoming document;
- adding elements present in the incoming document;
- replacing SSR streaming marker-bounded content with streamed template content;
- scanning the conservative static import graph rooted at `src/Boot.Ssr.ts` and failing if known interactive-only dependency strings appear in reachable source files.

The dependency-boundary test is intentionally conservative. It follows static relative imports in TypeScript source files and scans file contents for known forbidden strings. It does not parse Rollup aliases, dynamic imports, or generated bundle output, so generated bundle inspection should still remain part of release validation.

## Remaining known dependency contamination

- `src/Boot.Web.ts` is intentionally the full web boot path. It still imports DotNet interop, Server/WebAssembly option setup, `WebRootComponentManager`, `ComponentDescriptorDiscovery`, JS initializers, and interactive startup logic.
- `src/Rendering/DomMerging/DomSync.ts` is still interactive-aware and remains available to `Boot.Web.ts` only. `Boot.Ssr.ts` now uses `src/Rendering/SsrDomMerging/SsrDomSync.ts` instead.
- `src/Services/NavigationUtils.ts` still contains interactive router state (`hasInteractiveRouter` / `setHasInteractiveRouter`) alongside SSR navigation helpers. The SSR entry point uses the shared navigation helpers, and the dependency-boundary test currently allows this file because it does not import the interactive renderer stack.
- `src/Rendering/FocusOnNavigate.ts` has been kept structurally compatible with the small SSR event registry, but it still depends on `DomWrapper` and navigation URL helpers. Those are acceptable for now, but should remain under review as the public SSR surface tightens.
- The temporary Rollup aliases under `src/BuildStubs/` should remain under review. They exist to keep the public npm SSR build independent from interactive component descriptor code during this toolchain stabilization work.
