\# AGENTS.md



\## Project goal



This repository extracts the static SSR enhancement portions of ASP.NET Core's Blazor Web.JS runtime into a standalone SSR-only JavaScript library.



The output should not support Blazor Server, Blazor WebAssembly, InteractiveAuto, render batches, SignalR circuits, or DotNet JS interop.



\## Required SSR capabilities



Keep support for:



\- enhanced link navigation

\- enhanced forms using `data-enhance`

\- `Accept: text/html; blazor-enhanced-nav=on`

\- `blazor-enhanced-nav` response handling

\- streaming SSR markers

\- `<blazor-ssr>`

\- `<blazor-ssr-end>`

\- SSR framing boundaries

\- DOM-preserving sync

\- `data-permanent`

\- scroll restoration and hash scrolling

\- `enhancednavigationstart`

\- `enhancedload`

\- `enhancednavigationend`

\- `blazor-focus-on-navigate`, if practical



\## Exclusions



Remove all dependencies on:



\- `@microsoft/dotnet-js-interop`

\- SignalR

\- Mono/WASM boot

\- Blazor Server circuit startup

\- WebRootComponentManager

\- ComponentDescriptorDiscovery, except where SSR marker parsing requires a replacement

\- BrowserRenderer

\- EventDelegator

\- RenderBatch

\- JSRootComponents

\- InputFile

\- Virtualize



\## Architecture



Create a new entry point:



\- `src/Boot.Ssr.ts`



The public browser global should expose only:



\- `Blazor.start`

\- `Blazor.navigateTo`

\- `Blazor.addEventListener`

\- `Blazor.removeEventListener`



Do not expose `DotNet`.



\## Build expectations



Run:



\- `npm install`

\- `npm run build`

\- `npm test`, if tests exist



Add or update tests for enhanced navigation, streaming SSR, and DOM sync.

