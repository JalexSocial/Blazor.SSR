import { describe, expect, test } from '@jest/globals';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { CommentBoundedRange } from '../src/Rendering/DomSynchronizer';
import { synchronizeSsrDomContent, synchronizeSsrStreamingContent } from '../src/Rendering/SsrDomMerging/SsrDomSync';

const repoRoot = path.resolve(__dirname, '..');

describe('SsrDomSync', () => {
  test('replaces normal body content and synchronizes head/body attributes during enhanced navigation', () => {
    const destination = parseDocument('<!doctype html><html><head><title>Old</title><meta name="old" content="remove"></head><body class="old"><main id="old">Old</main></body></html>');
    const source = parseDocument('<!doctype html><html><head><title>New</title><meta name="new" content="add"><script src="/app.js" integrity="sha384-test"></script></head><body class="new" data-page="next"><main id="new">New</main></body></html>');

    synchronizeSsrDomContent(destination, source);

    expect(destination.title).toBe('New');
    expect(destination.head.querySelector('meta[name="old"]')).toBeNull();
    expect(destination.head.querySelector('meta[name="new"]')?.getAttribute('content')).toBe('add');
    expect(destination.head.querySelector('script')?.getAttribute('src')).toBe('/app.js');
    expect(destination.body.className).toBe('new');
    expect(destination.body.getAttribute('data-page')).toBe('next');
    expect(destination.body.innerHTML).toBe('<main id="new">New</main>');
  });

  test('preserves data-permanent content while updating normal sibling content', () => {
    const destination = parseDocument('<html><body><section data-permanent="player"><span>Playing</span></section><p>Old sibling</p></body></html>');
    const permanentElement = destination.querySelector('[data-permanent]');
    const source = parseDocument('<html><body><section data-permanent="player" class="incoming"><span>Stopped</span></section><p>New sibling</p><aside>Added</aside></body></html>');

    synchronizeSsrDomContent(destination, source);

    expect(destination.querySelector('[data-permanent]')).toBe(permanentElement);
    expect(destination.querySelector('[data-permanent]')!.outerHTML).toBe('<section data-permanent="player"><span>Playing</span></section>');
    expect(destination.body.querySelector('p')!.textContent).toBe('New sibling');
    expect(destination.body.querySelector('aside')!.textContent).toBe('Added');
  });

  test('replaces mismatched data-permanent elements predictably', () => {
    const range = makeExistingContent('<section data-permanent="old"><span>Client owned</span></section>');
    const originalPermanentElement = range.startExclusive.nextSibling;

    synchronizeSsrDomContent(range, makeNewContent('<section data-permanent="new"><span>Incoming</span></section>'));

    expect(range.startExclusive.nextSibling).not.toBe(originalPermanentElement);
    expect((range.startExclusive.nextSibling as Element).outerHTML).toBe('<section data-permanent="new"><span>Incoming</span></section>');
  });

  test('updates attributes on normal elements', () => {
    const range = makeExistingContent('<button class="old" disabled>Save</button>');
    const button = range.startExclusive.nextSibling as HTMLButtonElement;

    synchronizeSsrDomContent(range, makeNewContent('<button class="new" title="Save changes">Save</button>'));

    expect(range.startExclusive.nextSibling).toBe(button);
    expect(button.getAttribute('class')).toBe('new');
    expect(button.hasAttribute('disabled')).toBe(false);
    expect(button.getAttribute('title')).toBe('Save changes');
  });

  test('updates text content', () => {
    const range = makeExistingContent('<p>Hello</p>');
    const textNode = range.startExclusive.nextSibling!.firstChild;

    synchronizeSsrDomContent(range, makeNewContent('<p>Goodbye</p>'));

    expect(range.startExclusive.nextSibling!.firstChild).toBe(textNode);
    expect(range.startExclusive.nextSibling!.textContent).toBe('Goodbye');
  });

  test('preserves user-entered form values when the incoming element has no explicit value', () => {
    const range = makeExistingContent('<form><input name="q"><textarea name="notes"></textarea><input type="checkbox" name="ok"><input type="radio" name="choice"></form>');
    const input = range.startExclusive.nextSibling!.firstChild as HTMLInputElement;
    const textarea = input.nextSibling as HTMLTextAreaElement;
    const checkbox = textarea.nextSibling as HTMLInputElement;
    const radio = checkbox.nextSibling as HTMLInputElement;
    input.value = 'typed value';
    textarea.value = 'typed notes';
    checkbox.checked = true;
    radio.checked = true;

    synchronizeSsrDomContent(range, makeNewContent('<form><input name="q" class="updated"><textarea name="notes"></textarea><input type="checkbox" name="ok"><input type="radio" name="choice"></form>'));

    expect(input.value).toBe('typed value');
    expect(textarea.value).toBe('typed notes');
    expect(checkbox.checked).toBe(true);
    expect(radio.checked).toBe(true);
    expect(input.className).toBe('updated');
  });

  test('applies explicit incoming form values when supplied by the server', () => {
    const range = makeExistingContent('<form><input name="q"><textarea name="notes"></textarea><input type="checkbox" name="ok"></form>');
    const input = range.startExclusive.nextSibling!.firstChild as HTMLInputElement;
    const textarea = input.nextSibling as HTMLTextAreaElement;
    const checkbox = textarea.nextSibling as HTMLInputElement;
    input.value = 'typed value';
    textarea.value = 'typed notes';
    checkbox.checked = false;

    synchronizeSsrDomContent(range, makeNewContent('<form><input name="q" value="server value"><textarea name="notes">server notes</textarea><input type="checkbox" name="ok" checked></form>'));

    expect(input.value).toBe('server value');
    expect(textarea.value).toBe('server notes');
    expect(checkbox.checked).toBe(true);
  });

  test('removes elements not present in the new document', () => {
    const range = makeExistingContent('<a></a><remove-me></remove-me><b></b>');

    synchronizeSsrDomContent(range, makeNewContent('<a></a><b></b>'));

    expect(toElementNames(range)).toEqual(['A', 'B']);
  });

  test('adds elements present in the new document', () => {
    const range = makeExistingContent('<a></a><b></b>');

    synchronizeSsrDomContent(range, makeNewContent('<a></a><added></added><b></b><also-added></also-added>'));

    expect(toElementNames(range)).toEqual(['A', 'ADDED', 'B', 'ALSO-ADDED']);
  });

  test('replaces an SSR streaming marker-bounded range with streamed template content', () => {
    document.body.innerHTML = '<section><header>Before</header><!--bl:123--><p>Loading</p><!--/bl:123--><footer>After</footer></section>';
    const template = document.createElement('template');
    template.innerHTML = '<p>Streamed</p><span>Done</span>';

    synchronizeSsrStreamingContent({
      destinationDocument: document,
      componentId: '123',
      template,
    });

    expect(document.body.innerHTML).toBe('<section><header>Before</header><!--bl:123--><p>Streamed</p><span>Done</span><!--/bl:123--><footer>After</footer></section>');
  });

  test('does not throw when a comment-bounded range cannot be synchronized', () => {
    const startExclusive = document.createComment('bl:detached');
    const endExclusive = document.createComment('/bl:detached');

    expect(() => synchronizeSsrDomContent({ startExclusive, endExclusive }, makeNewContent('<p>Incoming</p>'))).not.toThrow();
  });

  test('Boot.Ssr wires enhanced navigation and streaming to the SSR-only synchronizer while Boot.Web keeps the original synchronizer', () => {
    const bootSsr = fs.readFileSync(path.join(repoRoot, 'src/Boot.Ssr.ts'), 'utf8');
    const bootWeb = fs.readFileSync(path.join(repoRoot, 'src/Boot.Web.ts'), 'utf8');
    const navigationEnhancement = fs.readFileSync(path.join(repoRoot, 'src/Services/NavigationEnhancement.ts'), 'utf8');
    const streamingRendering = fs.readFileSync(path.join(repoRoot, 'src/Rendering/StreamingRendering.ts'), 'utf8');

    expect(bootSsr).toContain("import { ssrDomSynchronizer } from './Rendering/SsrDomMerging/SsrDomSync';");
    expect(bootSsr).toContain('attachStreamingRenderingListener({');
    expect(bootSsr).toContain('navigationEnhancementCallbacks, ssrDomSynchronizer');
    expect(bootSsr).toContain('attachProgressivelyEnhancedNavigationListener(navigationEnhancementCallbacks, ssrDomSynchronizer)');
    expect(bootSsr).not.toContain('DomMerging/DomSync');

    expect(bootWeb).toContain("from './Rendering/DomMerging/DomSync'");
    expect(bootWeb).toContain('const webDomSynchronizer = { synchronizeDomContent };');
    expect(bootWeb).toContain('attachStreamingRenderingListener(options?.ssr, navigationEnhancementCallbacks, webDomSynchronizer)');
    expect(bootWeb).toContain('attachProgressivelyEnhancedNavigationListener(navigationEnhancementCallbacks, webDomSynchronizer)');

    expect(navigationEnhancement).toContain("import { DomSynchronizer } from '../Rendering/DomSynchronizer';");
    expect(navigationEnhancement).toContain('domSynchronizer.synchronizeDomContent(document, parsedHtml);');
    expect(navigationEnhancement).not.toContain('DomMerging/DomSync');
    expect(streamingRendering).toContain("import { DomSynchronizer } from './DomSynchronizer';");
    expect(streamingRendering).toContain('domSynchronizer.synchronizeDomContent({ startExclusive: startMarker, endExclusive: endMarker }, docFrag);');
    expect(streamingRendering).not.toContain('DomMerging/DomSync');
  });

  test('passes the standalone SSR boundary check script', () => {
    expect(() => execFileSync('node', ['scripts/check-ssr-boundary.mjs'], {
      cwd: repoRoot,
      stdio: 'pipe',
    })).not.toThrow();
  });
});

function parseDocument(markup: string): Document {
  return new DOMParser().parseFromString(markup, 'text/html');
}

function makeExistingContent(markup: string): CommentBoundedRange {
  document.body.innerHTML = `<!-- start -->${markup}<!-- end -->`;
  return {
    startExclusive: document.body.firstChild as Comment,
    endExclusive: document.body.lastChild as Comment,
  };
}

function makeNewContent(markup: string): DocumentFragment {
  return document.createRange().createContextualFragment(markup);
}

function toElementNames(range: CommentBoundedRange): string[] {
  const names: string[] = [];
  let current = range.startExclusive.nextSibling;
  while (current && current !== range.endExclusive) {
    if (current instanceof Element) {
      names.push(current.tagName);
    }

    current = current.nextSibling;
  }

  return names;
}
