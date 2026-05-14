# Static SSR runtime

This runtime is a standalone, static-server-side-rendering-only subset of ASP.NET Core Blazor's browser runtime. It preserves the browser features needed by static SSR pages while intentionally excluding all interactive Blazor startup paths.

## What it is

`blazor.ssr.js` progressively enhances already-rendered HTML. It can intercept eligible navigation and form submissions, fetch replacement HTML, merge that HTML into the current document, process streaming SSR markers, preserve selected DOM state, and dispatch static SSR navigation events.

Use it when your page is a static SSR Blazor page and does not need .NET code running interactively in the browser or over a SignalR circuit.

## What it intentionally does not support

This runtime must not be used for pages that require any of the following:

- `InteractiveServer`
- `InteractiveWebAssembly`
- `InteractiveAuto`
- Blazor component event handlers such as `@onclick`
- SignalR circuits
- WebAssembly components
- `DotNet` JavaScript interop
- render batches
- interactive component activation

Unlike `blazor.web.js`, the SSR-only bundle does not start Blazor Server, Blazor WebAssembly, Auto mode, circuits, Mono/WASM boot, interactive descriptors, render batches, browser renderers, or `DotNet` interop. The browser global intentionally exposes only static SSR APIs.

## Loading and startup

```html
<script src="/dist/blazor.ssr.min.js"></script>
```

The script starts automatically unless the script tag has `autostart="false"`:

```html
<script src="/dist/blazor.ssr.min.js" autostart="false"></script>
<script>
  Blazor.start({
    enhancedNavigation: true,
    streaming: true,
    focusOnNavigate: true
  });
</script>
```

`Blazor.start` has a duplicate-start guard and throws if called more than once.

## Public API

```js
Blazor.start(options?)
Blazor.navigateTo(url)
Blazor.navigateTo(url, { replace: true })
Blazor.navigateTo(url, { forceLoad: true })
Blazor.addEventListener(type, callback)
Blazor.removeEventListener(type, callback)
```

`replaceHistoryEntry` is also accepted as a compatibility alias for `replace`.

`forceLoad: true` uses normal browser navigation. Eligible internal navigation uses enhanced navigation. If enhanced navigation cannot be used, the runtime falls back to browser navigation.

## Events

The runtime dispatches these events through `Blazor.addEventListener`:

- `enhancednavigationstart`
- `enhancedload`
- `enhancednavigationend`

`enhancedload` fires after enhanced navigation updates the document and after streaming SSR updates change the document.

```html
<script>
  Blazor.addEventListener('enhancedload', () => {
    console.log('Static SSR document content was updated.');
  });
</script>
```

## Enhanced navigation

Eligible same-origin links inside the document base URI are intercepted and fetched with:

```http
Accept: text/html; blazor-enhanced-nav=on
```

The server must opt in with the expected `blazor-enhanced-nav` response header. If a successful response is not an enhanced Blazor endpoint, the runtime falls back to full browser navigation for GET requests.

The runtime does not intercept:

- modified clicks such as Ctrl-click, Meta-click, Shift-click, or Alt-click
- non-primary mouse-button clicks
- links with `download`
- links targeting another frame or window
- external links
- non-HTTP(S) links such as `mailto:`
- links outside the base URI space
- links under an ancestor with `data-enhance-nav="false"`

Links are enhanced by default. Use `data-enhance-nav="false"` on a link or ancestor to opt out, or `data-enhance-nav="true"`/empty to opt back in inside an opted-out subtree.

Enhanced navigation updates browser history, handles back and forward navigation, follows internal redirects, supports Blazor enhanced-navigation external redirect headers, scrolls to hashes, and resets scroll for normal page changes.

## Enhanced forms

Forms are enhanced only when the form itself is marked with `data-enhance` or `data-enhance="true"`:

```html
<form data-enhance method="post" action="/contact">
  <input name="message">
  <button type="submit" name="intent" value="send">Send</button>
</form>
```

Supported behavior includes:

- GET forms by encoding fields into the URL query string
- POST forms
- submitter attributes such as `formaction`, `formmethod`, `formenctype`, and `formtarget`
- multipart form data when the form encoding is `multipart/form-data`
- safe fallback for unsupported configurations

The runtime does not enhance `method="dialog"`, non-`_self` targets, external actions, non-HTTP(S) actions, or actions outside the base URI space.

## Streaming SSR

The runtime supports Blazor static SSR streaming markers:

```html
<!--bl:1-->
<p>Loading...</p>
<!--/bl:1-->

<blazor-ssr>
  <template blazor-component-id="1">
    <p>Loaded content</p>
  </template>
  <blazor-ssr-end></blazor-ssr-end>
</blazor-ssr>
```

When a `<blazor-ssr-end>` element connects, the runtime finds the matching comment markers and replaces the marker-bounded region using the SSR-only DOM synchronizer. It also supports streamed redirection, not-found, and error templates present in the current source behavior.

During enhanced navigation, the runtime detects the `ssr-framing` response header. The first frame is parsed as the replacement document and merged into the current document. Later frames are appended as streaming SSR update markup so the custom streaming elements process them. Final enhanced navigation completion is delayed until the framed response stream has been processed.

## DOM preservation

The SSR-only DOM synchronizer preserves important browser state while updating the document, including:

- elements marked with `data-permanent`
- reasonable form field state
- matching reusable elements
- normal document, head, and body patching behavior
- script behavior consistent with enhanced navigation expectations

Use `data-permanent` for client-owned DOM islands that should survive enhanced navigation updates:

```html
<div id="clock" data-permanent></div>
```

## Focus on navigate

Static SSR pages can request focus after navigation:

```html
<blazor-focus-on-navigate selector="h1"></blazor-focus-on-navigate>
```

After enhanced navigation to a different path completes, the runtime focuses the first element matching the selector unless the user has already focused another element.

## Defensive interactive marker warning

If simple Blazor marker comments indicate Server, WebAssembly, or Auto interactive component activation, the runtime logs this warning and continues:

> This page appears to contain interactive Blazor component markers, but only the static SSR runtime is loaded. Interactive components will not be activated.

This detection is intentionally lightweight and does not import the interactive component descriptor system.

## Version compatibility and limitations

This extraction follows the static SSR enhancement protocol represented by the ASP.NET Core Blazor Web.JS sources in this repository. It assumes compatible server behavior for enhanced navigation (`blazor-enhanced-nav`), SSR framing (`ssr-framing`), and streaming marker markup. If ASP.NET Core changes those protocol names or marker shapes in a future version, this standalone runtime must be updated and revalidated against that version.

Known limitations:

- This is not a drop-in replacement for `blazor.web.js` on pages that contain interactive render modes or .NET event handlers.
- The sample under `samples/static-ssr` is a static fixture. It demonstrates markup and client-side streaming marker replacement, but enhanced navigation and enhanced form round trips require a server that emits compatible Blazor static SSR enhanced responses.
- The defensive interactive marker warning is intentionally simple and may not identify every possible future interactive marker format.
