// Licensed to the .NET Foundation under one or more agreements.
// The .NET Foundation licenses this file to you under the MIT license.

import { CommentBoundedRange, DomSynchronizer } from '../DomSynchronizer';
import { synchronizeAttributes } from './SsrAttributeSync';
import { cannotMergeDueToDataPermanentAttributes, isDataPermanentElement } from './SsrDataPermanentElementSync';
import { ItemList, Operation, UpdateCost, computeEditScript } from './SsrEditScript';

export const ssrDomSynchronizer: DomSynchronizer = {
  synchronizeDomContent: synchronizeSsrDomContent,
};

export function synchronizeSsrDomContent(destination: CommentBoundedRange | Node, source: Node): void {
  try {
    if (destination instanceof Document && source instanceof Document) {
      synchronizeSsrDocument(destination, source);
    } else if (destination instanceof Element && source instanceof Element) {
      synchronizeSsrDomElement(destination, source);
    } else {
      synchronizeSsrDomChildren(destination, source);
    }
  } catch {
    replaceSsrDomContent(destination, source);
  }
}

export function synchronizeSsrDomElement(destination: Element, source: Element): void {
  if (destination.tagName !== source.tagName || cannotMergeDueToDataPermanentAttributes(destination, source)) {
    destination.replaceWith(source.cloneNode(true));
    return;
  }

  if (isDataPermanentElement(destination)) {
    return;
  }

  const editableElementValue = getEditableElementValue(destination, source);
  synchronizeAttributes(destination, source);
  synchronizeSsrDomChildren(destination, source);

  if (editableElementValue !== null) {
    ensureEditableValueSynchronized(destination, editableElementValue);
  }
}

export function synchronizeSsrStreamingContent(options: {
  destinationDocument: Document;
  componentId: string;
  template: HTMLTemplateElement;
}): void {
  const markers = findSsrStreamingMarkers(options.destinationDocument, options.componentId);
  if (!markers) {
    return;
  }

  synchronizeSsrDomContent(markers, options.template.content);
}

function synchronizeSsrDocument(destination: Document, source: Document): void {
  if (!destination.documentElement || !source.documentElement) {
    replaceSsrDomContent(destination, source);
    return;
  }

  synchronizeSsrDomElement(destination.documentElement, source.documentElement);
}

function synchronizeSsrDomChildren(destination: CommentBoundedRange | Node, source: Node): void {
  const destinationParent = destination instanceof Node ? destination : destination.startExclusive.parentNode;
  if (!destinationParent) {
    throw new Error('Cannot synchronize a comment-bounded range without a parent node.');
  }

  let originalNodesForDiff: ItemList<Node> = destinationParent.childNodes;
  if (!(destination instanceof Node)) {
    originalNodesForDiff = new SiblingSubsetNodeList(originalNodesForDiff, destination);
  }

  const newNodesForDiff = source.childNodes;
  const editScript = computeEditScript(originalNodesForDiff, newNodesForDiff, ssrDomNodeComparer);
  const destinationWalker = new DomNodeEditWalker(originalNodesForDiff.item(0));
  const sourceWalker = new DomNodeEditWalker(newNodesForDiff.item(0));

  for (let i = 0; i < editScript.skipCount; i++) {
    treatAsSsrMatch(destinationWalker.current!, sourceWalker.current!);
    destinationWalker.advance();
    sourceWalker.advance();
  }

  if (editScript.edits) {
    for (const operation of editScript.edits) {
      switch (operation) {
        case Operation.Keep:
          treatAsSsrMatch(destinationWalker.current!, sourceWalker.current!);
          destinationWalker.advance();
          sourceWalker.advance();
          break;
        case Operation.Update:
          treatAsSsrSubstitution(destinationWalker.current!, sourceWalker.current!);
          destinationWalker.advance();
          sourceWalker.advance();
          break;
        case Operation.Delete: {
          const nodeToRemove = destinationWalker.current!;
          destinationWalker.advance();
          destinationParent.removeChild(nodeToRemove);
          break;
        }
        case Operation.Insert: {
          const nodeToInsert = sourceWalker.current!;
          sourceWalker.advance();
          destinationParent.insertBefore(nodeToInsert, destinationWalker.current);
          break;
        }
        default:
          throw new Error(`Unexpected operation: '${operation}'`);
      }
    }

    const endAtNodeExclOrNull = destination instanceof Node ? null : destination.endExclusive;
    while (destinationWalker.current !== endAtNodeExclOrNull) {
      treatAsSsrMatch(destinationWalker.current!, sourceWalker.current!);
      destinationWalker.advance();
      sourceWalker.advance();
    }

    if (sourceWalker.current) {
      throw new Error('Updating the DOM failed because the sets of trailing nodes had inconsistent lengths.');
    }
  }
}

function treatAsSsrMatch(destination: Node, source: Node): void {
  switch (destination.nodeType) {
    case Node.TEXT_NODE:
      break;
    case Node.COMMENT_NODE:
      // Comments include SSR framing and streaming markers. If the comparer says they match,
      // leave marker identity and text in place.
      break;
    case Node.ELEMENT_NODE:
      synchronizeSsrDomElement(destination as Element, source as Element);
      break;
    case Node.DOCUMENT_TYPE_NODE:
      break;
    default:
      throw new Error(`Not implemented: matching nodes of type ${destination.nodeType}`);
  }
}

function treatAsSsrSubstitution(destination: Node, source: Node): void {
  switch (destination.nodeType) {
    case Node.TEXT_NODE:
    case Node.COMMENT_NODE:
      destination.textContent = source.textContent;
      break;
    default:
      throw new Error(`Not implemented: substituting nodes of type ${destination.nodeType}`);
  }
}

function ssrDomNodeComparer(a: Node, b: Node): UpdateCost {
  if (a.nodeType !== b.nodeType) {
    return UpdateCost.Infinite;
  }

  switch (a.nodeType) {
    case Node.TEXT_NODE:
      return a.textContent === b.textContent ? UpdateCost.None : UpdateCost.Some;
    case Node.COMMENT_NODE:
      return a.textContent === b.textContent ? UpdateCost.None : UpdateCost.Some;
    case Node.ELEMENT_NODE:
      if ((a as Element).tagName !== (b as Element).tagName) {
        return UpdateCost.Infinite;
      }

      return cannotMergeDueToDataPermanentAttributes(a as Element, b as Element)
        ? UpdateCost.Infinite
        : UpdateCost.None;
    case Node.DOCUMENT_TYPE_NODE:
      return UpdateCost.None;
    default:
      return UpdateCost.Infinite;
  }
}

function replaceSsrDomContent(destination: CommentBoundedRange | Node, source: Node): void {
  if (destination instanceof Document && source instanceof Document) {
    destination.documentElement.replaceWith(source.documentElement.cloneNode(true));
  } else if (destination instanceof Element && source instanceof Element) {
    destination.replaceWith(source.cloneNode(true));
  } else {
    const destinationParent = destination instanceof Node ? destination : destination.startExclusive.parentNode;
    if (!destinationParent) {
      return;
    }

    if (destination instanceof Node) {
      destination.textContent = '';
      while (source.firstChild) {
        destination.appendChild(source.firstChild);
      }
    } else {
      const range = document.createRange();
      range.setStartAfter(destination.startExclusive);
      range.setEndBefore(destination.endExclusive);
      range.deleteContents();
      while (source.firstChild) {
        destinationParent.insertBefore(source.firstChild, destination.endExclusive);
      }
    }
  }
}

function ensureEditableValueSynchronized(destination: Element, value: string | boolean | number): void {
  if (destination instanceof HTMLTextAreaElement && destination.value !== value) {
    destination.value = value as string;
  } else if (destination instanceof HTMLSelectElement && destination.selectedIndex !== value) {
    destination.selectedIndex = value as number;
  } else if (destination instanceof HTMLInputElement) {
    if (destination.type === 'checkbox' || destination.type === 'radio') {
      if (destination.checked !== value) {
        destination.checked = value as boolean;
      }
    } else if (destination.value !== value) {
      destination.value = value as string;
    }
  }
}

function getEditableElementValue(destination: Element, source: Element): string | boolean | number | null {
  if (destination instanceof HTMLSelectElement && source instanceof HTMLSelectElement) {
    return source.querySelector('option[selected]') ? source.selectedIndex : destination.selectedIndex;
  } else if (destination instanceof HTMLInputElement && source instanceof HTMLInputElement) {
    if (destination.type === 'checkbox' || destination.type === 'radio') {
      return source.hasAttribute('checked') ? source.checked : destination.checked;
    }

    return source.hasAttribute('value') ? source.getAttribute('value') || '' : destination.value;
  } else if (destination instanceof HTMLTextAreaElement && source instanceof HTMLTextAreaElement) {
    return source.textContent ? source.value : destination.value;
  } else {
    return null;
  }
}

function findSsrStreamingMarkers(destinationDocument: Document, componentId: string): CommentBoundedRange | null {
  const expectedStartText = `bl:${componentId}`;
  const expectedEndText = `/bl:${componentId}`;
  const iterator = destinationDocument.createNodeIterator(destinationDocument, NodeFilter.SHOW_COMMENT);
  let startMarker: Comment | null = null;
  let current: Comment | null;

  while (current = iterator.nextNode() as Comment | null) {
    if (current.textContent === expectedStartText) {
      startMarker = current;
      break;
    }
  }

  if (!startMarker) {
    return null;
  }

  while (current = iterator.nextNode() as Comment | null) {
    if (current.textContent === expectedEndText) {
      return { startExclusive: startMarker, endExclusive: current };
    }
  }

  return null;
}

class DomNodeEditWalker {
  current: Node | null;

  constructor(startNode: Node | null) {
    this.current = startNode;
  }

  advance(): void {
    if (!this.current) {
      throw new Error('Cannot advance beyond the end of the sibling array');
    }

    this.current = this.current.nextSibling;
  }
}

class SiblingSubsetNodeList implements ItemList<Node> {
  private readonly siblings: ItemList<Node>;
  private readonly startIndex: number;
  private readonly endIndexExcl: number;
  readonly length: number;

  constructor(childNodes: ItemList<Node>, range: CommentBoundedRange) {
    this.siblings = childNodes;
    this.startIndex = Array.prototype.indexOf.call(this.siblings, range.startExclusive) + 1;
    this.endIndexExcl = Array.prototype.indexOf.call(this.siblings, range.endExclusive);
    this.length = this.endIndexExcl - this.startIndex;
  }

  item(index: number): Node | null {
    return this.siblings.item(this.startIndex + index);
  }

  forEach(callbackfn: (value: Node, key: number, parent: ItemList<Node>) => void, thisArg?: any): void {
    for (let i = 0; i < this.length; i++) {
      callbackfn.call(thisArg, this.item(i)!, i, this);
    }
  }
}
