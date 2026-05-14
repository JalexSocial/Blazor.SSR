import { attachStreamingRenderingListener } from '../src/Rendering/StreamingRendering';
import { attachProgressivelyEnhancedNavigationListener, detachProgressivelyEnhancedNavigationListener } from '../src/Services/NavigationEnhancement';
import { handleClickForNavigationInterception } from '../src/Services/NavigationUtils';
import { enableFocusOnNavigate } from '../src/Rendering/FocusOnNavigate';
import { ssrDomSynchronizer } from '../src/Rendering/SsrDomMerging/SsrDomSync';
import { SsrEventRegistry } from '../src/Services/SsrEventRegistry';
import { TextEncoder } from 'node:util';
import { ReadableStream, TextDecoderStream, TransformStream, WritableStream } from 'node:stream/web';

const acceptHeader = 'text/html; blazor-enhanced-nav=on';
(global as typeof globalThis & { TextDecoderStream: typeof TextDecoderStream }).TextDecoderStream = TextDecoderStream;
(global as typeof globalThis & { TransformStream: typeof TransformStream }).TransformStream = TransformStream;
(global as typeof globalThis & { WritableStream: typeof WritableStream }).WritableStream = WritableStream;

const nextTick = () => new Promise(resolve => setTimeout(resolve, 0));

function setAppDocument(html = '<main id="app"><h1>Current</h1></main>') {
  document.documentElement.innerHTML = `<head><base href="http://localhost/app/"><title>Current</title></head><body>${html}</body>`;
  history.replaceState(null, '', 'http://localhost/app/current');
}

function makeHeaders(headers: Record<string, string>) {
  const normalizedHeaders = new Map(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  return {
    get(name: string) {
      return normalizedHeaders.get(name.toLowerCase()) || null;
    },
  };
}

function makeHtmlResponse(html: string, url = 'http://localhost/app/next', headers: Record<string, string> = {}, redirected = false) {
  return {
    body: {},
    headers: makeHeaders({
      'content-type': 'text/html',
      'blazor-enhanced-nav': 'allow',
      ...headers,
    }),
    redirected,
    status: 200,
    statusText: 'OK',
    text: () => Promise.resolve(html),
    type: 'basic',
    url,
  } as unknown as Response;
}

function makeFramedResponse(frames: string[], boundary = 'SSR-BOUNDARY') {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(frames.join(`<!--${boundary}-->`)));
      controller.close();
    },
  });

  return {
    body,
    headers: makeHeaders({
      'content-type': 'text/html',
      'blazor-enhanced-nav': 'allow',
      'ssr-framing': boundary,
    }),
    redirected: false,
    status: 200,
    statusText: 'OK',
    text: () => Promise.resolve(frames.join(`<!--${boundary}-->`)),
    type: 'basic',
    url: 'http://localhost/app/framed',
  } as unknown as Response;
}

function makeSubmitEvent(submitter?: HTMLElement): Event {
  const event = new Event('submit', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'submitter', { value: submitter });
  return event;
}

async function waitFor(predicate: () => boolean) {
  for (let i = 0; i < 20; i++) {
    if (predicate()) {
      return;
    }
    await nextTick();
  }

  throw new Error('Timed out waiting for condition.');
}

describe('SSR runtime integration behavior', () => {
  let events: string[];
  let registry: SsrEventRegistry;

  beforeAll(() => {
    registry = new SsrEventRegistry();
    const callbacks = {
      enhancedNavigationStarted: () => {
        events.push('enhancednavigationstart');
        registry.dispatchEvent('enhancednavigationstart', {});
      },
      documentUpdated: () => {
        events.push('enhancedload');
        registry.dispatchEvent('enhancedload', {});
      },
      enhancedNavigationCompleted: () => {
        events.push('enhancednavigationend');
        registry.dispatchEvent('enhancednavigationend', {});
      },
    };

    attachStreamingRenderingListener(undefined, callbacks, ssrDomSynchronizer);
    enableFocusOnNavigate(registry);
  });

  beforeEach(() => {
    events = [];
    setAppDocument();
    jest.restoreAllMocks();
    (global as typeof globalThis & { fetch: jest.Mock }).fetch = jest.fn();
    detachProgressivelyEnhancedNavigationListener();
  });

  test('click interception accepts eligible base-URI HTTP links and rejects unsafe links', () => {
    const intercepted: string[] = [];
    const cases = [
      ['<a id="link" href="/app/next">Next</a>', true],
      ['<a id="link" href="https://example.com/app/next">External</a>', false],
      ['<a id="link" href="/outside">Outside base</a>', false],
      ['<a id="link" href="/app/file" download>Download</a>', false],
      ['<a id="link" href="mailto:test@example.com">Mail</a>', false],
    ] as const;

    for (const [markup, shouldIntercept] of cases) {
      setAppDocument(markup);
      intercepted.length = 0;
      const link = document.getElementById('link')!;
      const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
      Object.defineProperty(click, 'composedPath', { value: () => [link] });
      handleClickForNavigationInterception(click, href => intercepted.push(href));
      expect(click.defaultPrevented).toBe(shouldIntercept);
      expect(intercepted.length).toBe(shouldIntercept ? 1 : 0);
    }

    setAppDocument('<a id="link" href="/app/next">Next</a>');
    const modifiedClick = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ctrlKey: true });
    Object.defineProperty(modifiedClick, 'composedPath', { value: () => [document.getElementById('link')!] });
    handleClickForNavigationInterception(modifiedClick, href => intercepted.push(href));
    expect(modifiedClick.defaultPrevented).toBe(false);
  });

  test('enhanced link navigation fetches with the SSR accept header, patches the document, updates history, and dispatches ordered lifecycle events', async () => {
    setAppDocument('<a id="next" href="/app/next">Next</a><main id="app"><h1>Current</h1></main>');
    const fetchMock = (global.fetch as jest.Mock).mockResolvedValue(makeHtmlResponse('<!doctype html><html><head><title>Next</title></head><body><main id="app"><h1>Next page</h1></main></body></html>'));
    attachProgressivelyEnhancedNavigationListener({
      enhancedNavigationStarted: () => events.push('enhancednavigationstart'),
      documentUpdated: () => events.push('enhancedload'),
      enhancedNavigationCompleted: () => events.push('enhancednavigationend'),
    }, ssrDomSynchronizer);

    document.getElementById('next')!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));

    await waitFor(() => events.includes('enhancednavigationend'));
    expect(fetchMock).toHaveBeenCalledWith('http://localhost/app/next', expect.objectContaining({
      headers: { accept: acceptHeader },
    }));
    expect(document.querySelector('h1')?.textContent).toBe('Next page');
    expect(location.href).toBe('http://localhost/app/next');
    expect(events).toEqual(['enhancednavigationstart', 'enhancedload', 'enhancednavigationend']);
  });

  test('data-enhance-nav false prevents enhanced link interception', async () => {
    setAppDocument('<div data-enhance-nav="false"><a id="next" href="#not-enhanced">Next</a></div><div id="not-enhanced"></div>');
    const fetchMock = (global.fetch as jest.Mock).mockResolvedValue(makeHtmlResponse('<html><body>unused</body></html>'));
    attachProgressivelyEnhancedNavigationListener({
      enhancedNavigationStarted: () => events.push('enhancednavigationstart'),
      documentUpdated: () => events.push('enhancedload'),
      enhancedNavigationCompleted: () => events.push('enhancednavigationend'),
    }, ssrDomSynchronizer);

    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    document.addEventListener('click', event => event.preventDefault(), { once: true });
    document.getElementById('next')!.dispatchEvent(click);
    await nextTick();

    expect(click.defaultPrevented).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });

  test('enhanced forms require data-enhance and support GET, POST, submitter values, targets, dialog, and multipart bodies', async () => {
    attachProgressivelyEnhancedNavigationListener({
      enhancedNavigationStarted: () => events.push('enhancednavigationstart'),
      documentUpdated: () => events.push('enhancedload'),
      enhancedNavigationCompleted: () => events.push('enhancednavigationend'),
    }, ssrDomSynchronizer);

    setAppDocument('<form id="plain" method="get" action="/app/search"><input name="q" value="plain"><button>Go</button></form>');
    let fetchMock = (global.fetch as jest.Mock).mockResolvedValue(makeHtmlResponse('<html><body>unused</body></html>'));
    document.getElementById('plain')!.dispatchEvent(makeSubmitEvent());
    await nextTick();
    expect(fetchMock).not.toHaveBeenCalled();
    (global.fetch as jest.Mock).mockClear();

    setAppDocument('<form id="get" data-enhance method="get" action="/app/search"><input name="q" value="term"><button id="submit" name="go" value="1">Go</button></form>');
    fetchMock = (global.fetch as jest.Mock).mockResolvedValue(makeHtmlResponse('<html><body><main><h1>Search</h1></main></body></html>', 'http://localhost/app/search?q=term&go=1'));
    document.getElementById('get')!.dispatchEvent(makeSubmitEvent(document.getElementById('submit') as HTMLElement));
    await waitFor(() => events.includes('enhancednavigationend'));
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost/app/search?q=term&go=1');
    expect(location.href).toBe('http://localhost/app/search?q=term&go=1');
    (global.fetch as jest.Mock).mockClear();

    events = [];
    setAppDocument('<form id="post" data-enhance method="post" action="/app/post"><input name="message" value="hello"><button id="save" name="intent" value="save">Save</button></form>');
    fetchMock = (global.fetch as jest.Mock).mockResolvedValue(makeHtmlResponse('<html><body><main><h1>Saved</h1></main></body></html>', 'http://localhost/app/saved', {}, true));
    document.getElementById('post')!.dispatchEvent(makeSubmitEvent(document.getElementById('save') as HTMLElement));
    await waitFor(() => events.includes('enhancednavigationend'));
    expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({ method: 'post', body: 'message=hello&intent=save' }));
    expect(events).toEqual(['enhancednavigationstart', 'enhancedload', 'enhancednavigationend']);
    (global.fetch as jest.Mock).mockClear();

    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    setAppDocument('<form id="dialog" data-enhance method="dialog"><button>Close</button></form><form id="target" data-enhance target="_blank"><button>Open</button></form>');
    fetchMock = (global.fetch as jest.Mock).mockResolvedValue(makeHtmlResponse('<html><body>unused</body></html>'));
    document.getElementById('dialog')!.dispatchEvent(makeSubmitEvent());
    document.getElementById('target')!.dispatchEvent(makeSubmitEvent());
    await nextTick();
    expect(fetchMock).not.toHaveBeenCalled();
    (global.fetch as jest.Mock).mockClear();
    events = [];

    setAppDocument('<form id="multi" data-enhance method="post" enctype="multipart/form-data" action="/app/upload"><input name="name" value="file"><button>Upload</button></form>');
    fetchMock = (global.fetch as jest.Mock).mockResolvedValue(makeHtmlResponse('<html><body><main><h1>Uploaded</h1></main></body></html>', 'http://localhost/app/uploaded', {}, true));
    document.getElementById('multi')!.dispatchEvent(makeSubmitEvent());
    await waitFor(() => events.includes('enhancednavigationend'));
    expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({ method: 'post', body: expect.any(FormData) }));
  });

  test('streaming SSR replaces marker-bounded content, preserves surrounding DOM, and fires enhancedload', async () => {
    setAppDocument('<div id="before">Before</div><!--bl:abc--><div id="old">Old</div><!--/bl:abc--><div id="after">After</div>');

    document.body.insertAdjacentHTML('beforeend', '<blazor-ssr><template blazor-component-id="abc" enhanced-nav="true"><div id="new">New streamed content</div></template><blazor-ssr-end></blazor-ssr-end></blazor-ssr>');
    await nextTick();

    expect(document.getElementById('before')?.textContent).toBe('Before');
    expect(document.getElementById('old')).toBeNull();
    expect(document.getElementById('new')?.textContent).toBe('New streamed content');
    expect(document.getElementById('after')?.textContent).toBe('After');
    expect(events).toContain('enhancedload');

    events = [];
    expect(() => document.body.insertAdjacentHTML('beforeend', '<blazor-ssr><template blazor-component-id="missing" enhanced-nav="true"><div>Missing</div></template><blazor-ssr-end></blazor-ssr-end></blazor-ssr>')).not.toThrow();
    await nextTick();
    expect(events).toEqual([]);
  });

  test('streaming during enhanced navigation processes the initial frame, later SSR frames, and completes navigation last', async () => {
    setAppDocument('<main><h1>Current</h1></main>');
    attachProgressivelyEnhancedNavigationListener({
      enhancedNavigationStarted: () => events.push('enhancednavigationstart'),
      documentUpdated: () => events.push('enhancedload'),
      enhancedNavigationCompleted: () => events.push('enhancednavigationend'),
    }, ssrDomSynchronizer);
    (global.fetch as jest.Mock).mockResolvedValue(makeFramedResponse([
      '<!doctype html><html><head><title>Framed</title></head><body><main><h1>Initial frame</h1><!--bl:stream--><p id="placeholder">Loading</p><!--/bl:stream--></main></body></html>',
      '<blazor-ssr><template blazor-component-id="stream" enhanced-nav="true"><p id="streamed">Streamed frame</p></template><blazor-ssr-end></blazor-ssr-end></blazor-ssr>',
    ]));

    history.pushState(null, '', 'http://localhost/app/framed');
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));

    await waitFor(() => events.includes('enhancednavigationend'));
    expect(document.querySelector('h1')?.textContent).toBe('Initial frame');
    expect(document.getElementById('placeholder')).toBeNull();
    expect(document.getElementById('streamed')?.textContent).toBe('Streamed frame');
    expect(events).toEqual(['enhancednavigationstart', 'enhancedload', 'enhancedload', 'enhancednavigationend']);
  });

  test('focus-on-navigate focuses the configured selector and tolerates missing targets', () => {
    setAppDocument('<blazor-focus-on-navigate selector="h1"></blazor-focus-on-navigate><main><h1 tabindex="-1" id="heading">Focusable heading</h1></main>');
    history.pushState(null, '', 'http://localhost/app/focus');

    registry.dispatchEvent('enhancednavigationstart', {});
    registry.dispatchEvent('enhancednavigationend', {});

    expect(document.activeElement).toBe(document.getElementById('heading'));

    setAppDocument('<blazor-focus-on-navigate selector=".missing"></blazor-focus-on-navigate><main><h1>Missing target</h1></main>');
    expect(() => {
      history.pushState(null, '', 'http://localhost/app/missing-focus');
      registry.dispatchEvent('enhancednavigationstart', {});
      registry.dispatchEvent('enhancednavigationend', {});
    }).not.toThrow();
  });
});
