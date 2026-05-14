# Blazor.SSR

Blazor.SSR extracts the static server-side rendering (static SSR) enhancement portions of ASP.NET Core's `blazor.web.js` runtime into a standalone browser script.

The generated bundle is for **static SSR pages only**. It is intended for Blazor apps that render HTML on the server and want progressive enhancement for navigation, forms, DOM preservation, streaming SSR updates, and focus management without loading the interactive Blazor Server, WebAssembly, Auto, SignalR circuit, render-batch, or .NET JavaScript interop runtime.

## Bundle output

Production builds emit:

- `dist/blazor.ssr.js`
- `dist/blazor.ssr.min.js`

Debug builds emit `dist/Debug/blazor.ssr.js`.

## Basic usage

```html
<script src="/dist/blazor.ssr.min.js"></script>
```

The script auto-starts by default. To start manually:

```html
<script src="/dist/blazor.ssr.min.js" autostart="false"></script>
<script>
  Blazor.start();
</script>
```

The static SSR global exposes only:

- `Blazor.start(options?)`
- `Blazor.navigateTo(url, options?)`
- `Blazor.addEventListener(type, callback)`
- `Blazor.removeEventListener(type, callback)`

It does **not** expose `window.DotNet`.

## Supported static SSR behavior

- Enhanced same-origin link navigation within the document base URI.
- Enhanced forms explicitly marked with `data-enhance`.
- Enhanced navigation requests with `Accept: text/html; blazor-enhanced-nav=on`.
- `blazor-enhanced-nav` response handling.
- SSR streaming markers (`<blazor-ssr>`, `<blazor-ssr-end>`, and `<template blazor-component-id="...">`).
- SSR framing during enhanced navigation when the server returns the `ssr-framing` header.
- DOM-preserving synchronization, including `data-permanent`.
- Browser history, redirects, scroll reset, and hash scrolling for enhanced navigation.
- `enhancednavigationstart`, `enhancedload`, and `enhancednavigationend` events.
- `<blazor-focus-on-navigate selector="h1"></blazor-focus-on-navigate>`.

## Unsupported interactive behavior

Do **not** use this runtime on pages that require:

- `InteractiveServer`
- `InteractiveWebAssembly`
- `InteractiveAuto`
- Blazor component event handlers
- SignalR circuits
- WebAssembly components
- DotNet JS interop
- interactive component activation
- render batches

If the runtime sees simple interactive Blazor marker comments, it logs a non-fatal warning that interactive components will not be activated.

## Documentation and fixture

- See [docs/static-ssr-runtime.md](docs/static-ssr-runtime.md) for detailed protocol and API notes.
- See [samples/static-ssr/index.html](samples/static-ssr/index.html) for a minimal static HTML fixture.

## Toolchain

See [docs/toolchain.md](docs/toolchain.md) for public npm install, build, test, lint, and SSR boundary-check instructions.
