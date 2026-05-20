# Blazor SSR runtime demo overlay

Extract this archive at the repository root. It places all files under `samples/ssr-demo`.

## Added pages

- `/ssr-demo`
- `/ssr-demo/enhanced-navigation`
- `/ssr-demo/streaming`
- `/ssr-demo/forms`
- `/ssr-demo/routing`
- `/ssr-demo/routing/{slug}`
- `/ssr-demo/preservation`
- `/ssr-demo/events`

## Files included

- `Components/Pages/SsrDemo.razor`
- `Components/Pages/SsrDemoEnhancedNavigation.razor`
- `Components/Pages/SsrDemoStreaming.razor`
- `Components/Pages/SsrDemoForms.razor`
- `Components/Pages/SsrDemoRouting.razor`
- `Components/Pages/SsrDemoPreservation.razor`
- `Components/Pages/SsrDemoLifecycleEvents.razor`
- `Components/Pages/SsrDemoProbe.razor`
- `Components/Layout/NavMenu.razor`
- `wwwroot/ssr-demo-probe.js`

## Intended validation coverage

- Static SSR route rendering.
- Enhanced navigation link interception and DOM patching.
- Query string and route parameter binding across enhanced navigation.
- `data-enhance-nav="false"` opt-out links.
- Streaming rendering with delayed server updates.
- Enhanced `EditForm` POST handling.
- Enhanced plain HTML form POST handling with `@formname`.
- Antiforgery token rendering for plain HTML forms.
- Server-side validation.
- `data-permanent` DOM preservation.
- `Blazor.addEventListener` compatibility for `enhancednavigationstart`, `enhancedload`, and `enhancednavigationend`.

## Probe usage

Open `/ssr-demo/events` with a hard refresh first. The page installs `wwwroot/ssr-demo-probe.js`, which attaches to `window.Blazor.addEventListener` and writes runtime events into the probe panel.

After the probe is listening, navigate through the SSR demo links and use the browser Back and Forward buttons. The probe panel uses `data-permanent` so it should remain in place across enhanced navigation.
