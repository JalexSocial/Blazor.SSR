import { describe, expect, test } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { CommentBoundedRange } from '../src/Rendering/DomSynchronizer';
import { synchronizeSsrDomContent, synchronizeSsrStreamingContent } from '../src/Rendering/SsrDomMerging/SsrDomSync';

describe('SsrDomSync', () => {
  test('replaces normal body content during enhanced navigation', () => {
    const destination = parseDocument('<!doctype html><html><head><title>Old</title></head><body><main id="old">Old</main></body></html>');
    const source = parseDocument('<!doctype html><html><head><title>New</title></head><body><main id="new">New</main></body></html>');

    synchronizeSsrDomContent(destination, source);

    expect(destination.title).toBe('New');
    expect(destination.body.innerHTML).toBe('<main id="new">New</main>');
  });

  test('preserves data-permanent content when a matching permanent element appears in the incoming document', () => {
    const destination = parseDocument('<html><body><section data-permanent="player"><span>Playing</span></section></body></html>');
    const permanentElement = destination.querySelector('[data-permanent]');
    const source = parseDocument('<html><body><section data-permanent="player" class="incoming"><span>Stopped</span></section></body></html>');

    synchronizeSsrDomContent(destination, source);

    expect(destination.querySelector('[data-permanent]')).toBe(permanentElement);
    expect(destination.querySelector('[data-permanent]')!.outerHTML).toBe('<section data-permanent="player"><span>Playing</span></section>');
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
    const range = makeExistingContent('<form><input name="q"><textarea name="notes"></textarea><input type="checkbox" name="ok"></form>');
    const input = range.startExclusive.nextSibling!.firstChild as HTMLInputElement;
    const textarea = input.nextSibling as HTMLTextAreaElement;
    const checkbox = textarea.nextSibling as HTMLInputElement;
    input.value = 'typed value';
    textarea.value = 'typed notes';
    checkbox.checked = true;

    synchronizeSsrDomContent(range, makeNewContent('<form><input name="q" class="updated"><textarea name="notes"></textarea><input type="checkbox" name="ok"></form>'));

    expect(input.value).toBe('typed value');
    expect(textarea.value).toBe('typed notes');
    expect(checkbox.checked).toBe(true);
    expect(input.className).toBe('updated');
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
    document.body.innerHTML = '<section><!--bl:123--><p>Loading</p><!--/bl:123--></section>';
    const template = document.createElement('template');
    template.innerHTML = '<p>Streamed</p><span>Done</span>';

    synchronizeSsrStreamingContent({
      destinationDocument: document,
      componentId: '123',
      template,
    });

    expect(document.body.innerHTML).toBe('<section><!--bl:123--><p>Streamed</p><span>Done</span><!--/bl:123--></section>');
  });

  test('does not import known interactive-only modules from the SSR-only entry point dependency graph', () => {
    const forbiddenStrings = [
      'Boot.Server',
      'Boot.WebAssembly',
      'WebRootComponentManager',
      'ComponentDescriptorDiscovery',
      'BrowserRenderer',
      'EventDelegator',
      'JSRootComponents',
      'RenderBatch',
      'Circuit',
      'SignalR',
      'dotnet-js-interop',
      'Mono',
      'WebAssemblyStartOptions',
    ];
    const importedFiles = collectStaticImports(path.resolve(__dirname, '../src/Boot.Ssr.ts'));
    const offenders = importedFiles.flatMap(file => {
      const content = fs.readFileSync(file, 'utf8');
      return forbiddenStrings
        .filter(forbidden => content.includes(forbidden))
        .map(forbidden => `${path.relative(path.resolve(__dirname, '..'), file)} contains ${forbidden}`);
    });

    expect(offenders).toEqual([]);
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

function collectStaticImports(entrypoint: string): string[] {
  const visited = new Set<string>();
  visit(entrypoint);
  return Array.from(visited).sort();

  function visit(file: string): void {
    if (visited.has(file)) {
      return;
    }

    visited.add(file);
    const directory = path.dirname(file);
    const content = fs.readFileSync(file, 'utf8');
    const importPattern = /import(?:\s+type)?(?:[\s\S]*?from\s*)?['"]([^'"]+)['"]/g;
    let match: RegExpExecArray | null;
    while (match = importPattern.exec(content)) {
      const specifier = match[1];
      if (!specifier.startsWith('.')) {
        continue;
      }

      const resolved = resolveTypeScriptImport(path.resolve(directory, specifier));
      if (resolved) {
        visit(resolved);
      }
    }
  }
}

function resolveTypeScriptImport(importPath: string): string | null {
  const candidates = [
    importPath,
    `${importPath}.ts`,
    path.join(importPath, 'index.ts'),
  ];

  return candidates.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || null;
}
