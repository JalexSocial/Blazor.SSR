# AGENTS.md

## Project purpose

This repository extracts the static SSR enhancement portions of ASP.NET Core's Blazor Web.JS runtime into a standalone SSR-only JavaScript library.

The output is intended for Blazor static server-side rendering scenarios only. It must not grow support for Blazor Server interactivity, Blazor WebAssembly interactivity, InteractiveAuto, SignalR circuits, DotNet JS interop, render batches, or interactive component activation.

## Required SSR capabilities

Keep support for:

- enhanced link navigation
- enhanced forms using `data-enhance`
- enhanced navigation fetch requests using `Accept: text/html; blazor-enhanced-nav=on`
- `blazor-enhanced-nav` response handling
- streaming SSR markers
- `<blazor-ssr>`
- `<blazor-ssr-end>`
- SSR framing boundaries
- DOM-preserving synchronization
- `data-permanent`
- scroll restoration and hash scrolling
- `enhancednavigationstart`
- `enhancedload`
- `enhancednavigationend`
- `blazor-focus-on-navigate`, if practical without pulling in interactive dependencies

## Explicit exclusions

Do not add or retain dependencies on these Blazor interactive capabilities in the SSR-only runtime:

- `@microsoft/dotnet-js-interop`
- SignalR
- Mono or WebAssembly boot
- Blazor Server circuit startup
- `WebRootComponentManager`
- interactive component descriptor activation
- `ComponentDescriptorDiscovery`, except where SSR marker parsing requires a later SSR-specific replacement
- render batches
- `BrowserRenderer`
- `EventDelegator`
- `JSRootComponents`
- `InputFile`
- `Virtualize`
- `NavigationManager` for interactive routing

## Desired public API surface

The SSR-only browser global should expose only:

- `Blazor.start`
- `Blazor.navigateTo`
- `Blazor.addEventListener`
- `Blazor.removeEventListener`

Do not expose `DotNet` from the SSR-only entry point.

## Architecture

Use `src/Boot.Ssr.ts` as the SSR-only entry point. Keep `src/Boot.Web.ts` behavior intact unless a future task explicitly requests otherwise.

## Build and test commands

Run:

- `npm install`
- `npm run build`
- `npm test`, if tests exist

Add or update tests for enhanced navigation, streaming SSR, and DOM sync as the SSR extraction progresses.

## Non-negotiable warning

Do not solve bundle-size reduction or dependency cleanup by deleting SSR features. SSR capabilities listed above are required; remove or replace only interactive dependencies, and preserve the static SSR behavior.
