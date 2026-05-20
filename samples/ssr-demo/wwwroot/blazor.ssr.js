(function () {
  'use strict';

  // Licensed to the .NET Foundation under one or more agreements.
  // The .NET Foundation licenses this file to you under the MIT license.

  // Tells you if the script was added without <script src="..." autostart="false"></script>
  function shouldAutoStart() {
    return !!(document && document.currentScript && document.currentScript.getAttribute('autostart') !== 'false');
  }

  // Licensed to the .NET Foundation under one or more agreements.
  // The .NET Foundation licenses this file to you under the MIT license.

  const domFunctions = {
    focus,
    focusBySelector
  };
  function focus(element, preventScroll) {
    if (element instanceof HTMLElement) {
      element.focus({
        preventScroll
      });
    } else if (element instanceof SVGElement) {
      if (element.hasAttribute('tabindex')) {
        element.focus({
          preventScroll
        });
      } else {
        throw new Error('Unable to focus an SVG element that does not have a tabindex.');
      }
    } else {
      throw new Error('Unable to focus an invalid element.');
    }
  }
  function focusBySelector(selector) {
    const element = document.querySelector(selector);
    if (element) {
      // If no explicit tabindex is defined, mark it as programmatically-focusable.
      // This does actually add a new HTML attribute, but it shouldn't interfere with
      // diffing because diffing only deals with the attributes you have in your code.
      if (!element.hasAttribute('tabindex')) {
        element.tabIndex = -1;
      }
      element.focus({
        preventScroll: true
      });
    }
  }

  // Licensed to the .NET Foundation under one or more agreements.
  // The .NET Foundation licenses this file to you under the MIT license.

  let programmaticEnhancedNavigationHandler;

  /**
   * Checks if a click event corresponds to an <a> tag referencing a URL within the base href, and that interception
   * isn't bypassed (e.g., by a 'download' attribute or the user holding a meta key while clicking).
   * @param event The event that occurred
   * @param callbackIfIntercepted A callback that will be invoked if the event corresponds to a click on an <a> that can be intercepted.
   */
  function handleClickForNavigationInterception(event, callbackIfIntercepted) {
    if (event.button !== 0 || eventHasSpecialKey(event)) {
      // Don't stop ctrl/meta-click (etc) from opening links in new tabs/windows
      return;
    }
    if (event.defaultPrevented) {
      return;
    }

    // Intercept clicks on all <a> elements where the href is within the <base href> URI space
    // We must explicitly check if it has an 'href' attribute, because if it doesn't, the result might be null or an empty string depending on the browser
    const anchorTarget = findAnchorTarget(event);
    if (anchorTarget && canProcessAnchor(anchorTarget)) {
      const anchorHref = anchorTarget.getAttribute('href');
      const absoluteHref = toAbsoluteUri(anchorHref);
      if (isHttpOrHttpsUri(absoluteHref) && isWithinBaseUriSpace(absoluteHref)) {
        event.preventDefault();
        callbackIfIntercepted(absoluteHref);
      }
    }
  }
  function isHttpOrHttpsUri(href) {
    try {
      const url = new URL(href);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }
  function isWithinBaseUriSpace(href) {
    const baseUriWithoutTrailingSlash = toBaseUriWithoutTrailingSlash(document.baseURI);
    const nextChar = href.charAt(baseUriWithoutTrailingSlash.length);
    return href.startsWith(baseUriWithoutTrailingSlash) && (nextChar === '' || nextChar === '/' || nextChar === '?' || nextChar === '#');
  }
  function isSamePageWithHash(oldUrl, newUrl) {
    const a = new URL(oldUrl);
    const b = new URL(newUrl);
    return a.origin === b.origin && a.pathname === b.pathname && a.search === b.search && b.hash !== '';
  }
  function isForSamePath(url1, url2) {
    // We are going to use the scheme, host, port and path to determine if the two URLs are compatible.
    // We do not account for the query string as we want to allow for the query string to change.
    // (Blazor doesn't use the query string for routing purposes).
    const parsedUrl1 = new URL(url1);
    const parsedUrl2 = new URL(url2);
    return parsedUrl1.protocol === parsedUrl2.protocol && parsedUrl1.host === parsedUrl2.host && parsedUrl1.port === parsedUrl2.port && parsedUrl1.pathname === parsedUrl2.pathname;
  }
  function performScrollToElementOnTheSamePage(absoluteHref) {
    const hashIndex = absoluteHref.indexOf('#');
    if (hashIndex === absoluteHref.length - 1) {
      return;
    }
    const identifier = absoluteHref.substring(hashIndex + 1);
    scrollToElement(identifier);
  }
  function scrollToElement(identifier) {
    document.getElementById(identifier)?.scrollIntoView();
  }
  function hasProgrammaticEnhancedNavigationHandler() {
    return programmaticEnhancedNavigationHandler !== undefined;
  }
  function attachProgrammaticEnhancedNavigationHandler(handler) {
    programmaticEnhancedNavigationHandler = handler;
  }
  function performProgrammaticEnhancedNavigation$1(absoluteInternalHref, replace) {
    if (!programmaticEnhancedNavigationHandler) {
      throw new Error('No enhanced programmatic navigation handler has been attached');
    }
    programmaticEnhancedNavigationHandler(absoluteInternalHref, replace);
  }
  function toBaseUriWithoutTrailingSlash(baseUri) {
    return baseUri.substring(0, baseUri.lastIndexOf('/'));
  }
  let testAnchor;
  function toAbsoluteUri(relativeUri) {
    testAnchor = testAnchor || document.createElement('a');
    testAnchor.href = relativeUri;
    return testAnchor.href;
  }
  function eventHasSpecialKey(event) {
    return event.ctrlKey || event.shiftKey || event.altKey || event.metaKey;
  }
  function canProcessAnchor(anchorTarget) {
    const targetAttributeValue = anchorTarget.getAttribute('target');
    const opensInSameFrame = !targetAttributeValue || targetAttributeValue === '_self';
    return opensInSameFrame && anchorTarget.hasAttribute('href') && !anchorTarget.hasAttribute('download');
  }
  function findAnchorTarget(event) {
    const path = event.composedPath && event.composedPath();
    if (path) {
      // This logic works with events that target elements within a shadow root,
      // as long as the shadow mode is 'open'. For closed shadows, we can't possibly
      // know what internal element was clicked.
      for (let i = 0; i < path.length; i++) {
        const candidate = path[i];
        if (candidate instanceof HTMLAnchorElement || candidate instanceof SVGAElement) {
          return candidate;
        }
      }
    }
    return null;
  }

  // Licensed to the .NET Foundation under one or more agreements.
  // The .NET Foundation licenses this file to you under the MIT license.

  const customElementName = 'blazor-focus-on-navigate';
  let currentFocusOnNavigateElement = null;
  let locationOnLastNavigation = location.href;
  let allowApplyFocusAfterEnhancedNavigation = false;
  function enableFocusOnNavigate(jsEventRegistry) {
    customElements.define(customElementName, FocusOnNavigateElement);
    jsEventRegistry.addEventListener('enhancednavigationstart', onEnhancedNavigationStart);
    jsEventRegistry.addEventListener('enhancednavigationend', onEnhancedNavigationEnd);
    document.addEventListener('focusin', onFocusIn);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', onInitialPageLoad, {
        once: true
      });
    } else {
      onInitialPageLoad();
    }
  }
  function onInitialPageLoad() {
    // On the initial page load, we only want to apply focus if there isn't already
    // a focused element.
    // See also: https://developer.mozilla.org/docs/Web/API/Document/activeElement#value
    if (document.activeElement !== null && document.activeElement !== document.body) {
      return;
    }

    // If an element on the page is requesting autofocus, but hasn't yet been focused,
    // we'll respect that.
    if (document.querySelector('[autofocus]')) {
      return;
    }
    tryApplyFocus();
  }
  function onEnhancedNavigationStart() {
    // Only move focus when navigating to a new page.
    if (!isForSamePath(locationOnLastNavigation, location.href)) {
      allowApplyFocusAfterEnhancedNavigation = true;
    }
    locationOnLastNavigation = location.href;
  }
  function onEnhancedNavigationEnd() {
    if (allowApplyFocusAfterEnhancedNavigation) {
      tryApplyFocus();
    }
  }
  function onFocusIn() {
    // If the user explicitly focuses a different element before a navigation completes,
    // don't move focus again.
    allowApplyFocusAfterEnhancedNavigation = false;
  }
  function tryApplyFocus() {
    const selector = currentFocusOnNavigateElement?.getAttribute('selector');
    if (selector) {
      domFunctions.focusBySelector(selector);
    }
  }
  class FocusOnNavigateElement extends HTMLElement {
    connectedCallback() {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      currentFocusOnNavigateElement = this;
    }
    disconnectedCallback() {
      if (currentFocusOnNavigateElement === this) {
        currentFocusOnNavigateElement = null;
      }
    }
  }

  // Licensed to the .NET Foundation under one or more agreements.
  // The .NET Foundation licenses this file to you under the MIT license.

  let ScrollResetSchedule = /*#__PURE__*/function (ScrollResetSchedule) {
    ScrollResetSchedule[ScrollResetSchedule["None"] = 0] = "None";
    ScrollResetSchedule[ScrollResetSchedule["AfterBatch"] = 1] = "AfterBatch";
    // Reset scroll after interactive components finish rendering (interactive navigation)
    ScrollResetSchedule[ScrollResetSchedule["AfterDocumentUpdate"] = 2] = "AfterDocumentUpdate"; // Reset scroll after enhanced navigation updates the DOM (enhanced navigation)
    return ScrollResetSchedule;
  }({});
  let pendingScrollResetTiming = ScrollResetSchedule.None;
  function scheduleScrollReset(timing) {
    if (timing !== ScrollResetSchedule.AfterBatch) {
      pendingScrollResetTiming = timing;
      return;
    }
    if (pendingScrollResetTiming !== ScrollResetSchedule.AfterDocumentUpdate) {
      pendingScrollResetTiming = ScrollResetSchedule.AfterBatch;
    }
  }
  function resetScrollIfNeeded(triggerTiming) {
    if (pendingScrollResetTiming !== triggerTiming) {
      return;
    }
    pendingScrollResetTiming = ScrollResetSchedule.None;

    // This assumes the scroller is on the window itself. There isn't a general way to know
    // if some other element is playing the role of the primary scroll region.
    window.scrollTo && window.scrollTo(0, 0);
  }

  // Licensed to the .NET Foundation under one or more agreements.
  // The .NET Foundation licenses this file to you under the MIT license.

  function synchronizeAttributes(destination, source) {
    const destAttrs = destination.attributes;
    const sourceAttrs = source.attributes;

    // Skip most of the work in the common case where all attributes are unchanged and are even still in the same order
    if (!attributeSetsAreIdentical(destAttrs, sourceAttrs)) {
      // Certain element types may have special rules about how to update their attributes,
      // or might require us to synchronize DOM properties as well as attributes
      if (destination instanceof HTMLLinkElement || destination instanceof HTMLScriptElement) {
        destination.integrity = source.integrity;
      }

      // Now do generic unordered attribute synchronization
      const remainingDestAttrs = new Map();
      for (const destAttr of destination.attributes) {
        remainingDestAttrs.set(destAttr.name, destAttr);
      }
      for (const sourceAttr of source.attributes) {
        const existingDestAttr = sourceAttr.namespaceURI ? destination.getAttributeNodeNS(sourceAttr.namespaceURI, sourceAttr.localName) : destination.getAttributeNode(sourceAttr.name);
        if (existingDestAttr) {
          if (existingDestAttr.value !== sourceAttr.value) {
            // Update
            applyAttribute(destination, sourceAttr);
          }
          remainingDestAttrs.delete(existingDestAttr.name);
        } else {
          // Insert
          applyAttribute(destination, sourceAttr);
        }
      }
      for (const attrToDelete of remainingDestAttrs.values()) {
        // Delete
        removeAttribute(destination, attrToDelete);
      }
    }
  }
  function attributeSetsAreIdentical(destAttrs, sourceAttrs) {
    const destAttrsLength = destAttrs.length;
    if (destAttrsLength !== sourceAttrs.length) {
      return false;
    }
    for (let i = 0; i < destAttrsLength; i++) {
      const sourceAttr = sourceAttrs.item(i);
      const destAttr = destAttrs.item(i);
      if (sourceAttr.name !== destAttr.name || sourceAttr.value !== destAttr.value) {
        return false;
      }
    }
    return true;
  }
  function applyAttribute(element, attr) {
    if (attr.namespaceURI) {
      element.setAttributeNS(attr.namespaceURI, attr.name, attr.value);
    } else {
      element.setAttribute(attr.name, attr.value);
    }
  }
  function removeAttribute(element, attr) {
    if (attr.namespaceURI) {
      element.removeAttributeNS(attr.namespaceURI, attr.localName);
    } else {
      element.removeAttribute(attr.name);
    }
  }

  // Licensed to the .NET Foundation under one or more agreements.
  // The .NET Foundation licenses this file to you under the MIT license.

  const dataPermanentAttributeName = 'data-permanent';
  function isDataPermanentElement(elem) {
    return elem.hasAttribute(dataPermanentAttributeName);
  }
  function cannotMergeDueToDataPermanentAttributes(elementA, elementB) {
    const dataPermanentAttributeValueA = elementA.getAttribute(dataPermanentAttributeName);
    const dataPermanentAttributeValueB = elementB.getAttribute(dataPermanentAttributeName);
    return dataPermanentAttributeValueA !== dataPermanentAttributeValueB;
  }

  // Licensed to the .NET Foundation under one or more agreements.
  // The .NET Foundation licenses this file to you under the MIT license.

  function computeEditScript(before, after, updateCost) {
    // In common cases where nothing has changed or only one thing changed, we can reduce the task dramatically
    // by identifying the common prefix/suffix, and only doing Levenshtein on the subset in between. The end results can entirely
    // ignore any trailing identical entries.
    const commonPrefixLength = lengthOfCommonPrefix(before, after, updateCost);
    if (commonPrefixLength === before.length && commonPrefixLength === after.length) {
      // If by now we know there are no edits, bail out early
      return {
        skipCount: commonPrefixLength
      };
    }
    const commonSuffixLength = lengthOfCommonSuffix(before, after, commonPrefixLength, commonPrefixLength, updateCost);
    before = ItemListSubset.create(before, commonPrefixLength, before.length - commonPrefixLength - commonSuffixLength);
    after = ItemListSubset.create(after, commonPrefixLength, after.length - commonPrefixLength - commonSuffixLength);
    const operations = computeOperations(before, after, updateCost);
    const edits = toEditScript(operations);
    return {
      skipCount: commonPrefixLength,
      edits
    };
  }
  function lengthOfCommonPrefix(before, after, updateCost) {
    const shorterLength = Math.min(before.length, after.length);
    for (let index = 0; index < shorterLength; index++) {
      if (updateCost(before.item(index), after.item(index)) !== UpdateCost.None) {
        return index;
      }
    }
    return shorterLength;
  }
  function lengthOfCommonSuffix(before, after, beforeStartIndex, afterStartIndex, updateCost) {
    let beforeIndex = before.length - 1;
    let afterIndex = after.length - 1;
    let count = 0;
    while (beforeIndex >= beforeStartIndex && afterIndex >= afterStartIndex) {
      if (updateCost(before.item(beforeIndex), after.item(afterIndex)) !== UpdateCost.None) {
        break;
      }
      beforeIndex--;
      afterIndex--;
      count++;
    }
    return count;
  }
  function computeOperations(before, after, updateCost) {
    // Initialize matrices
    const costs = [];
    const operations = [];
    const beforeLength = before.length;
    const afterLength = after.length;
    if (beforeLength === 0 && afterLength === 0) {
      return [];
    }
    for (let beforeIndex = 0; beforeIndex <= beforeLength; beforeIndex++) {
      (costs[beforeIndex] = Array(afterLength + 1))[0] = beforeIndex;
      operations[beforeIndex] = Array(afterLength + 1);
    }
    const rowZero = costs[0];
    for (let afterIndex = 1; afterIndex <= afterLength; afterIndex++) {
      rowZero[afterIndex] = afterIndex;
    }
    for (let beforeIndex = 1; beforeIndex <= beforeLength; beforeIndex++) {
      for (let afterIndex = 1; afterIndex <= afterLength; afterIndex++) {
        const comparisonResult = updateCost(before.item(beforeIndex - 1), after.item(afterIndex - 1));
        const costAsDelete = costs[beforeIndex - 1][afterIndex] + 1;
        const costAsInsert = costs[beforeIndex][afterIndex - 1] + 1;
        let costAsRetain;
        switch (comparisonResult) {
          case UpdateCost.None:
            costAsRetain = costs[beforeIndex - 1][afterIndex - 1];
            break;
          case UpdateCost.Some:
            costAsRetain = costs[beforeIndex - 1][afterIndex - 1] + 1;
            break;
          case UpdateCost.Infinite:
            costAsRetain = Number.MAX_VALUE;
            break;
        }
        if (costAsRetain < costAsInsert && costAsRetain < costAsDelete) {
          costs[beforeIndex][afterIndex] = costAsRetain;
          operations[beforeIndex][afterIndex] = comparisonResult === UpdateCost.None ? Operation.Keep : Operation.Update;
        } else if (costAsInsert < costAsDelete) {
          costs[beforeIndex][afterIndex] = costAsInsert;
          operations[beforeIndex][afterIndex] = Operation.Insert;
        } else {
          costs[beforeIndex][afterIndex] = costAsDelete;
          operations[beforeIndex][afterIndex] = Operation.Delete;
        }
      }
    }
    return operations;
  }
  function toEditScript(operations) {
    // Start in the bottom-right corner, and work backwards
    const result = [];
    let beforeIndex = operations.length - 1;
    let afterIndex = operations[beforeIndex]?.length - 1;
    while (beforeIndex > 0 || afterIndex > 0) {
      const operation = beforeIndex === 0 ? Operation.Insert : afterIndex === 0 ? Operation.Delete : operations[beforeIndex][afterIndex];
      result.unshift(operation);
      switch (operation) {
        case Operation.Keep:
        case Operation.Update:
          beforeIndex--;
          afterIndex--;
          break;
        case Operation.Insert:
          afterIndex--;
          break;
        case Operation.Delete:
          beforeIndex--;
          break;
      }
    }
    return result;
  }

  // Levenshtein naturally deals with these three specific cost values, so they are the only ones allowed.
  // If we allowed arbitrary cost numbers, things quickly get very unpredictable.
  let UpdateCost = /*#__PURE__*/function (UpdateCost) {
    UpdateCost[UpdateCost["None"] = 0] = "None";
    // Implemented as cost 0
    UpdateCost[UpdateCost["Some"] = 1] = "Some";
    // Implemented as cost 1 (same as a single insertion or deletion)
    UpdateCost[UpdateCost["Infinite"] = 2] = "Infinite"; // Implemented as cost infinity (so we would always choose to insert+delete instead of update)
    return UpdateCost;
  }({});
  let Operation = /*#__PURE__*/function (Operation) {
    Operation["Keep"] = "keep";
    Operation["Update"] = "update";
    Operation["Insert"] = "insert";
    Operation["Delete"] = "delete";
    return Operation;
  }({});
  class ItemListSubset {
    static create(source, startIndex, length) {
      return startIndex === 0 && length === source.length ? source // No need for a wrapper
      : new ItemListSubset(source, startIndex, length);
    }
    constructor(source, startIndex, length) {
      this.source = source;
      this.startIndex = startIndex;
      this.length = length;
    }
    item(index) {
      return this.source.item(index + this.startIndex);
    }
    forEach(callbackfn, _thisArg) {
      for (let i = 0; i < this.length; i++) {
        callbackfn(this.item(i), i, this);
      }
    }
  }

  // Licensed to the .NET Foundation under one or more agreements.
  // The .NET Foundation licenses this file to you under the MIT license.

  const ssrDomSynchronizer = {
    synchronizeDomContent: synchronizeSsrDomContent
  };
  function synchronizeSsrDomContent(destination, source) {
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
  function synchronizeSsrDomElement(destination, source) {
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
  function synchronizeSsrDocument(destination, source) {
    if (!destination.documentElement || !source.documentElement) {
      replaceSsrDomContent(destination, source);
      return;
    }
    synchronizeSsrDomElement(destination.documentElement, source.documentElement);
  }
  function synchronizeSsrDomChildren(destination, source) {
    const destinationParent = destination instanceof Node ? destination : destination.startExclusive.parentNode;
    if (!destinationParent) {
      throw new Error('Cannot synchronize a comment-bounded range without a parent node.');
    }
    let originalNodesForDiff = destinationParent.childNodes;
    if (!(destination instanceof Node)) {
      originalNodesForDiff = new SiblingSubsetNodeList(originalNodesForDiff, destination);
    }
    const newNodesForDiff = source.childNodes;
    const editScript = computeEditScript(originalNodesForDiff, newNodesForDiff, ssrDomNodeComparer);
    const destinationWalker = new DomNodeEditWalker(originalNodesForDiff.item(0));
    const sourceWalker = new DomNodeEditWalker(newNodesForDiff.item(0));
    for (let i = 0; i < editScript.skipCount; i++) {
      treatAsSsrMatch(destinationWalker.current, sourceWalker.current);
      destinationWalker.advance();
      sourceWalker.advance();
    }
    if (editScript.edits) {
      for (const operation of editScript.edits) {
        switch (operation) {
          case Operation.Keep:
            treatAsSsrMatch(destinationWalker.current, sourceWalker.current);
            destinationWalker.advance();
            sourceWalker.advance();
            break;
          case Operation.Update:
            treatAsSsrSubstitution(destinationWalker.current, sourceWalker.current);
            destinationWalker.advance();
            sourceWalker.advance();
            break;
          case Operation.Delete:
            {
              const nodeToRemove = destinationWalker.current;
              destinationWalker.advance();
              destinationParent.removeChild(nodeToRemove);
              break;
            }
          case Operation.Insert:
            {
              const nodeToInsert = sourceWalker.current;
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
        treatAsSsrMatch(destinationWalker.current, sourceWalker.current);
        destinationWalker.advance();
        sourceWalker.advance();
      }
      if (sourceWalker.current) {
        throw new Error('Updating the DOM failed because the sets of trailing nodes had inconsistent lengths.');
      }
    }
  }
  function treatAsSsrMatch(destination, source) {
    switch (destination.nodeType) {
      case Node.TEXT_NODE:
        break;
      case Node.COMMENT_NODE:
        // Comments include SSR framing and streaming markers. If the comparer says they match,
        // leave marker identity and text in place.
        break;
      case Node.ELEMENT_NODE:
        synchronizeSsrDomElement(destination, source);
        break;
      case Node.DOCUMENT_TYPE_NODE:
        break;
      default:
        throw new Error(`Not implemented: matching nodes of type ${destination.nodeType}`);
    }
  }
  function treatAsSsrSubstitution(destination, source) {
    switch (destination.nodeType) {
      case Node.TEXT_NODE:
      case Node.COMMENT_NODE:
        destination.textContent = source.textContent;
        break;
      default:
        throw new Error(`Not implemented: substituting nodes of type ${destination.nodeType}`);
    }
  }
  function ssrDomNodeComparer(a, b) {
    if (a.nodeType !== b.nodeType) {
      return UpdateCost.Infinite;
    }
    switch (a.nodeType) {
      case Node.TEXT_NODE:
        return a.textContent === b.textContent ? UpdateCost.None : UpdateCost.Some;
      case Node.COMMENT_NODE:
        return a.textContent === b.textContent ? UpdateCost.None : UpdateCost.Some;
      case Node.ELEMENT_NODE:
        if (a.tagName !== b.tagName) {
          return UpdateCost.Infinite;
        }
        return cannotMergeDueToDataPermanentAttributes(a, b) ? UpdateCost.Infinite : UpdateCost.None;
      case Node.DOCUMENT_TYPE_NODE:
        return UpdateCost.None;
      default:
        return UpdateCost.Infinite;
    }
  }
  function replaceSsrDomContent(destination, source) {
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
  function ensureEditableValueSynchronized(destination, value) {
    if (destination instanceof HTMLTextAreaElement && destination.value !== value) {
      destination.value = value;
    } else if (destination instanceof HTMLSelectElement && destination.selectedIndex !== value) {
      destination.selectedIndex = value;
    } else if (destination instanceof HTMLInputElement) {
      if (destination.type === 'checkbox' || destination.type === 'radio') {
        if (destination.checked !== value) {
          destination.checked = value;
        }
      } else if (destination.value !== value) {
        destination.value = value;
      }
    }
  }
  function getEditableElementValue(destination, source) {
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
  class DomNodeEditWalker {
    constructor(startNode) {
      this.current = startNode;
    }
    advance() {
      if (!this.current) {
        throw new Error('Cannot advance beyond the end of the sibling array');
      }
      this.current = this.current.nextSibling;
    }
  }
  class SiblingSubsetNodeList {
    constructor(childNodes, range) {
      this.siblings = childNodes;
      this.startIndex = Array.prototype.indexOf.call(this.siblings, range.startExclusive) + 1;
      this.endIndexExcl = Array.prototype.indexOf.call(this.siblings, range.endExclusive);
      this.length = this.endIndexExcl - this.startIndex;
    }
    item(index) {
      return this.siblings.item(this.startIndex + index);
    }
    forEach(callbackfn, thisArg) {
      for (let i = 0; i < this.length; i++) {
        callbackfn.call(thisArg, this.item(i), i, this);
      }
    }
  }

  // Licensed to the .NET Foundation under one or more agreements.
  // The .NET Foundation licenses this file to you under the MIT license.


  /*
  In effect, we have two separate client-side navigation mechanisms:

  [1] Interactive client-side routing. This is the traditional Blazor Server/WebAssembly navigation mechanism for SPAs.
      It is enabled whenever you have a <Router/> rendering as interactive. This intercepts all navigation within the
      base href URI space and tries to display a corresponding [Route] component or the NotFoundContent.
  [2] Progressively-enhanced navigation. This is a new mechanism in .NET 8 and is only relevant for multi-page apps.
      It is enabled when you load blazor.web.js and don't have an interactive <Router/>. This intercepts navigation within
      the base href URI space and tries to load it via a `fetch` request and DOM syncing.

  Only one of these can be enabled at a time, otherwise both would be trying to intercept click/popstate and act on them.
  In fact even if we made the event handlers able to coexist, the two together would still not produce useful behaviors because
  [1] implies you have a <Router/>, and that will try to supply UI content for all pages or NotFoundContent if the URL doesn't
  match a [Route] component, so there would be nothing left for [2] to handle.

  So, whenever [1] is enabled, we automatically disable [2].

  However, a single site can use both [1] and [2] on different URLs.
   - You can navigate from [1] to [2] by setting up the interactive <Router/> not to know about any [Route] components in your MPA,
     and so it will fall back on a full-page load to get from the SPA URLs to the MPA URLs.
   - You can navigate from [2] to [1] in that it just works by default. A <Router/> can be added dynamically and will then take
     over and disable [2].

  Note that we don't reference NavigationManager.ts from NavigationEnhancement.ts or vice-versa. This is to ensure we could produce
  different bundles that only contain minimal content.
  */

  const acceptHeader = 'text/html; blazor-enhanced-nav=on';
  let currentEnhancedNavigationAbortController;
  let navigationEnhancementCallbacks$1;
  let domSynchronizer$1;

  // This gets initialized to the current URL when we load.
  // After that, it gets updated every time we successfully complete a navigation.
  let currentContentUrl = location.href;
  function hasNeverStartedAnyEnhancedPageLoad() {
    return !currentEnhancedNavigationAbortController;
  }
  function attachProgressivelyEnhancedNavigationListener(callbacks, synchronizer) {
    navigationEnhancementCallbacks$1 = callbacks;
    domSynchronizer$1 = synchronizer;
    document.addEventListener('click', onDocumentClick);
    document.addEventListener('submit', onDocumentSubmit);
    window.addEventListener('popstate', onPopState);
    attachProgrammaticEnhancedNavigationHandler(performProgrammaticEnhancedNavigation);
  }
  function performProgrammaticEnhancedNavigation(absoluteInternalHref, replace) {
    const originalLocation = location.href;
    if (replace) {
      history.replaceState(null, /* ignored title */'', absoluteInternalHref);
    } else {
      history.pushState(null, /* ignored title */'', absoluteInternalHref);
    }
    if (!isForSamePath(absoluteInternalHref, originalLocation)) {
      scheduleScrollReset(ScrollResetSchedule.AfterDocumentUpdate);
    }
    performEnhancedPageLoad(absoluteInternalHref);
  }
  function onDocumentClick(event) {
    if (event.target instanceof Element && !enhancedNavigationIsEnabledForElement(event.target)) {
      return;
    }
    handleClickForNavigationInterception(event, absoluteInternalHref => {
      const originalLocation = location.href;
      const shouldScrollToHash = isSamePageWithHash(originalLocation, absoluteInternalHref);
      history.pushState(null, /* ignored title */'', absoluteInternalHref);
      if (shouldScrollToHash) {
        performScrollToElementOnTheSamePage(absoluteInternalHref);
      } else {
        const isSelfNavigation = isForSamePath(absoluteInternalHref, originalLocation);
        performEnhancedPageLoad(absoluteInternalHref);
        if (!isSelfNavigation) {
          scheduleScrollReset(ScrollResetSchedule.AfterDocumentUpdate);
        }
      }
    });
  }
  function onPopState(state) {
    if (state.state == null && isSamePageWithHash(currentContentUrl, location.href)) {
      currentContentUrl = location.href;
      return;
    }

    // load the new page
    performEnhancedPageLoad(location.href);
  }
  function onDocumentSubmit(event) {
    if (event.defaultPrevented) {
      return;
    }

    // We need to be careful not to interfere with existing interactive forms. As it happens, Blazor's interactive
    // event infrastructure uses a capturing event handler for 'submit', so it will necessarily run before this handler, and so we won't
    // even get here if there's an interactive submit (because it will have set defaultPrevented which we check above).
    // However if we ever change that, we would need to change this code to integrate properly with that event infrastructure
    // to make sure this handler only ever runs after interactive handlers.
    const formElem = event.target;
    if (formElem instanceof HTMLFormElement) {
      if (!enhancedNavigationIsEnabledForForm(formElem)) {
        return;
      }
      const method = (event.submitter?.getAttribute('formmethod') || formElem.method).toLowerCase();
      if (method === 'dialog') {
        console.warn('A form cannot be enhanced when its method is "dialog".');
        return;
      }
      const target = event.submitter?.getAttribute('formtarget') || formElem.target;
      if (target !== '' && target !== '_self') {
        console.warn('A form cannot be enhanced when its target is different from the default value "_self".');
        return;
      }
      const url = new URL(event.submitter?.getAttribute('formaction') || formElem.action, document.baseURI);
      if (!isHttpOrHttpsUri(url.href) || !isWithinBaseUriSpace(url.href)) {
        return;
      }
      event.preventDefault();
      const fetchOptions = {
        method: method
      };
      const formData = new FormData(formElem);
      const submitterName = event.submitter?.getAttribute('name');
      const submitterValue = event.submitter?.getAttribute('value');
      if (submitterName && submitterValue) {
        formData.append(submitterName, submitterValue);
      }
      const urlSearchParams = new URLSearchParams(formData).toString();
      if (fetchOptions.method === 'get') {
        // method is always returned as lowercase
        url.search = urlSearchParams;

        // For forms with method=get, we need to push a URL history entry equivalent to how it
        // would be pushed for a native <form method=get> submission. This is also equivalent to
        // how we push a URL history entry before starting enhanced page load on an <a> click.
        history.pushState(null, /* ignored title */'', url.toString());
      } else {
        // Setting request body and content-type header depending on enctype
        const enctype = event.submitter?.getAttribute('formenctype') || formElem.enctype;
        if (enctype === 'multipart/form-data') {
          // Content-Type header will be set to 'multipart/form-data'
          fetchOptions.body = formData;
        } else {
          fetchOptions.body = urlSearchParams;
          fetchOptions.headers = {
            'content-type': enctype,
            // Setting Accept header here as well so it wouldn't be lost when coping headers
            'accept': acceptHeader
          };
        }
      }
      performEnhancedPageLoad(url.toString(), /* interceptedLink */false, fetchOptions);
    }
  }
  async function performEnhancedPageLoad(internalDestinationHref, interceptedLink, fetchOptions, treatAsRedirectionFromMethod, changeUrl = true) {

    // First, stop any preceding enhanced page load
    currentEnhancedNavigationAbortController?.abort();

    // Notify handlers that enhanced navigation is starting
    navigationEnhancementCallbacks$1.enhancedNavigationStarted();

    // Now request the new page via fetch, and a special header that tells the server we want it to inject
    // framing boundaries to distinguish the initial document and each subsequent streaming SSR update.
    currentEnhancedNavigationAbortController = new AbortController();
    const abortSignal = currentEnhancedNavigationAbortController.signal;
    const responsePromise = fetch(internalDestinationHref, Object.assign({
      signal: abortSignal,
      mode: 'no-cors',
      // If there's a redirection to an external origin, even if it enables CORS, we don't want to receive its content and patch it into our DOM on this origin
      headers: {
        // Because of no-cors, we can only send CORS-safelisted headers, so communicate the info about
        // enhanced nav as a MIME type parameter
        'accept': acceptHeader
      }
    }, fetchOptions));
    let isNonRedirectedPostToADifferentUrlMessage = null;
    await getResponsePartsWithFraming(responsePromise, abortSignal, (response, initialContent) => {
      const isGetRequest = !fetchOptions?.method || fetchOptions.method === 'get';
      const isSuccessResponse = response.status >= 200 && response.status < 300;

      // For true 301/302/etc redirections to external URLs, we'll receive an opaque response
      // (even if it has CORS enabled, since we passed no-cors), and the browser won't disclose
      // the target URL to JS code. We must therefore retry as a non-enhanced-nav page load to reach
      // the destination. This also has the benefit that we can be certain not to introduce content
      // from an external origin into the DOM here.
      if (response.type === 'opaque') {
        if (isGetRequest) {
          retryEnhancedNavAsFullPageLoad(internalDestinationHref);
          return;
        } else {
          throw new Error('Enhanced navigation does not support making a non-GET request to an endpoint that redirects to an external origin. Avoid enabling enhanced navigation for form posts that may perform external redirections.');
        }
      }
      if (isSuccessResponse && response.headers.get('blazor-enhanced-nav') !== 'allow') {
        // This appears to be a non-Blazor-Endpoint success response. We don't want to use enhanced nav
        // because the content we receive is not designed to be patched into an existing frame,
        // and may be incompatible with the Blazor JS that's already here.
        // The reason we don't apply the same logic for non-success responses is that:
        //  - We don't want to retry as then developers will get double-failures in logs
        //  - We really want to show error pages to avoid losing vital debugging info
        // ... and since error pages can be considered terminally fatal, we don't have to worry about
        // whether the page has complex client-side behaviors that are incompatible with our JS.
        if (isGetRequest) {
          retryEnhancedNavAsFullPageLoad(internalDestinationHref);
          return;
        } else {
          throw new Error('Enhanced navigation does not support making a non-GET request to a non-Blazor endpoint. Avoid enabling enhanced navigation for forms that post to a non-Blazor endpoint.');
        }
      }

      // For 301/302/etc redirections to internal URLs, the browser will already have followed the chain of redirections
      // to the end, and given us the final content. We do still need to update the current URL to match the final location,
      // then let the rest of enhanced nav logic run to patch the new content into the DOM.
      if (changeUrl && (response.redirected || treatAsRedirectionFromMethod)) {
        const treatAsGet = treatAsRedirectionFromMethod ? treatAsRedirectionFromMethod === 'get' : isGetRequest;
        if (treatAsGet) {
          // For gets, the intermediate (redirecting) URL is already in the address bar, so we have to use 'replace'
          // so that 'back' would go to the page before the redirection
          history.replaceState(null, '', response.url);
        } else {
          // For non-gets, we're still on the source page, so need to append a whole new history entry
          if (response.url !== location.href) {
            history.pushState(null, '', response.url);
          }
        }
        internalDestinationHref = response.url;
      }

      // For enhanced nav redirecting to an external URL, we'll get a special Blazor-specific redirection command
      const externalRedirectionUrl = response.headers.get('blazor-enhanced-nav-redirect-location');
      if (changeUrl && externalRedirectionUrl) {
        location.replace(externalRedirectionUrl);
        return;
      }
      if (changeUrl && !response.redirected && !isGetRequest && isSuccessResponse) {
        // If this is the result of a form post that didn't trigger a redirection.
        if (!isForSamePath(response.url, currentContentUrl)) {
          // In this case we don't want to push the currentContentUrl to the history stack because we don't know if this is a location
          // we can navigate back to (as we don't know if the location supports GET) and we are not able to replicate the Resubmit form?
          // browser behavior.
          // The only case where this is acceptable is when the last content URL, is the same as the URL for the form we posted to.
          isNonRedirectedPostToADifferentUrlMessage = `Cannot perform enhanced form submission that changes the URL (except via a redirection), because then back/forward would not work. Either remove this form's 'action' attribute, or change its method to 'get', or do not mark it as enhanced.\nOld URL: ${location.href}\nNew URL: ${response.url}`;
        } else {
          if (location.href !== currentContentUrl) {
            // The url on the browser might be out of data, so push an entry to the stack to update the url in place.
            history.pushState(null, '', currentContentUrl);
          }
        }
      }

      // Set the currentContentUrl to the location of the last completed navigation.
      if (changeUrl) {
        currentContentUrl = response.url;
      }
      const responseContentType = response.headers.get('content-type');
      if (responseContentType?.startsWith('text/html') && initialContent) {
        // For HTML responses, regardless of the status code, display it
        const parsedHtml = new DOMParser().parseFromString(initialContent, 'text/html');
        domSynchronizer$1.synchronizeDomContent(document, parsedHtml);
        navigationEnhancementCallbacks$1.documentUpdated();
      } else if (responseContentType?.startsWith('text/') && initialContent) {
        // For any other text-based content, we'll just display it, because that's what
        // would happen if this was a non-enhanced request.
        replaceDocumentWithPlainText(initialContent);
      } else if (!isSuccessResponse && !initialContent) {
        // For any non-success response that has no content at all, make up our own error UI
        replaceDocumentWithPlainText(`Error: ${response.status} ${response.statusText}`);
      } else {
        // For any other response, it's not HTML and we don't know what to do. It might be plain text,
        // or an image, or something else.
        if (isGetRequest) {
          // If it's a get request, we'll trust that it's idempotent and cheap enough to request
          // a second time, so we can fall back on a full reload.
          retryEnhancedNavAsFullPageLoad(internalDestinationHref);
        } else {
          // For non-get requests, we can't safely re-request, so just treat it as an error
          replaceDocumentWithPlainText(`Error: ${fetchOptions.method} request to ${internalDestinationHref} returned non-HTML content of type ${responseContentType || 'unspecified'}.`);
        }
      }
    }, streamingElementMarkup => {
      const fragment = document.createRange().createContextualFragment(streamingElementMarkup);
      while (fragment.firstChild) {
        document.body.appendChild(fragment.firstChild);
      }
    });
    if (!abortSignal.aborted) {
      // The whole response including any streaming SSR is now finished, and it was not aborted (no other navigation
      // has since started). So finally, recreate the native "scroll to hash" behavior.
      const hashPosition = internalDestinationHref.indexOf('#');
      if (hashPosition >= 0) {
        const hash = internalDestinationHref.substring(hashPosition + 1);
        const targetElem = document.getElementById(hash);
        targetElem?.scrollIntoView();
      }
      navigationEnhancementCallbacks$1.enhancedNavigationCompleted();

      // For non-GET requests, the destination has to be the same URL you're already on, or result in a redirection
      // (post/redirect/get). You're not allowed to POST to a different URL without redirecting, because then back/forwards
      // won't work - we can't recreate the "Resubmit form?" behavior.
      // See https://github.com/dotnet/aspnetcore/issues/50945
      // The reason we delay throwing until after SSR completes is that SSR might include a redirection signal. If we get
      // here without navigating away, it's an error.
      if (isNonRedirectedPostToADifferentUrlMessage) {
        throw new Error(isNonRedirectedPostToADifferentUrlMessage);
      }
    }
  }
  async function getResponsePartsWithFraming(responsePromise, abortSignal, onInitialDocument, onStreamingElement) {
    let response;
    try {
      response = await responsePromise;
      if (!response.body) {
        // Not sure how this can happen, but the TypeScript annotations suggest it can
        onInitialDocument(response, '');
        return;
      }
      const frameBoundary = response.headers.get('ssr-framing');
      if (!frameBoundary) {
        // Shouldn't happen, but perhaps some proxy stripped the headers. In that case we just won't respect streaming and will
        // wait for the whole response.
        const allResponseText = await response.text();
        onInitialDocument(response, allResponseText);
        return;
      }

      // This is going to be a framed response, so split it into chunks based on our framing boundaries
      let isFirstFramedChunk = true;
      await response.body.pipeThrough(new TextDecoderStream()).pipeThrough(splitStream(`<!--${frameBoundary}-->`)).pipeTo(new WritableStream({
        write(chunk) {
          // Inside here, we know the chunks correspond precisely to frames within our message framing mechanism.
          // The first one is always the initial document that we will merge into the existing DOM. All subsequent ones
          // are blocks of <blazor-ssr>...</blazor-ssr> markup whose insertion would trigger a streaming SSR DOM update.
          if (isFirstFramedChunk) {
            isFirstFramedChunk = false;
            onInitialDocument(response, chunk);
          } else {
            onStreamingElement(chunk);
          }
        }
      }));
    } catch (ex) {
      if (ex.name === 'AbortError' && abortSignal.aborted) {
        // Not an error. This happens if a different navigation started before this one completed.
        return;
      } else {
        throw ex;
      }
    }
  }
  function replaceDocumentWithPlainText(text) {
    document.documentElement.textContent = text;
    const docStyle = document.documentElement.style;
    docStyle.fontFamily = 'consolas, monospace';
    docStyle.whiteSpace = 'pre-wrap';
    docStyle.padding = '1rem';
  }
  function splitStream(frameBoundaryMarker) {
    let buffer = '';
    return new TransformStream({
      transform(chunk, controller) {
        buffer += chunk;

        // Only call 'split' if we can see at least one marker, and only look for it within the new content (allowing for it to split over chunks)
        if (buffer.indexOf(frameBoundaryMarker, buffer.length - chunk.length - frameBoundaryMarker.length) >= 0) {
          const frames = buffer.split(frameBoundaryMarker);
          frames.slice(0, -1).forEach(part => controller.enqueue(part));
          buffer = frames[frames.length - 1];
        }
      },
      flush(controller) {
        controller.enqueue(buffer);
      }
    });
  }
  function enhancedNavigationIsEnabledForElement(element) {
    // For links, they default to being enhanced, but you can override at any ancestor level (both positively and negatively)
    const closestOverride = element.closest('[data-enhance-nav]');
    if (closestOverride) {
      const attributeValue = closestOverride.getAttribute('data-enhance-nav');
      return attributeValue === '' || attributeValue.toLowerCase() === 'true';
    } else {
      return true;
    }
  }
  function enhancedNavigationIsEnabledForForm(form) {
    // For forms, they default *not* to being enhanced, and must be enabled explicitly on the form element itself (not an ancestor).
    const attributeValue = form.getAttribute('data-enhance');
    return typeof attributeValue === 'string' && attributeValue === '' || attributeValue?.toLowerCase() === 'true';
  }
  function retryEnhancedNavAsFullPageLoad(internalDestinationHref) {
    // The ? trick here is the same workaround as described in #10839, and without it, the user
    // would not be able to use the back button afterwards.
    console.warn(`Enhanced navigation failed for destination ${internalDestinationHref}. Falling back to full page load.`);
    history.replaceState(null, '', internalDestinationHref + '?');
    location.replace(internalDestinationHref);
  }

  // Licensed to the .NET Foundation under one or more agreements.
  // The .NET Foundation licenses this file to you under the MIT license.

  let enableDomPreservation = true;
  let navigationEnhancementCallbacks;
  let domSynchronizer;
  function attachStreamingRenderingListener(options, callbacks, synchronizer) {
    navigationEnhancementCallbacks = callbacks;
    domSynchronizer = synchronizer;
    if (options?.disableDomPreservation) {
      enableDomPreservation = false;
    }

    // By the time <blazor-ssr-end> is in the DOM, we know all the preceding content within the same <blazor-ssr> is also there,
    // so it's time to process it. We can't simply listen for <blazor-ssr>, because connectedCallback may fire before its content
    // is present, and even listening for a later slotchange event doesn't work because the presence of <script> elements in the
    // content can cause slotchange to fire before the rest of the content is added.
    customElements.define('blazor-ssr-end', BlazorStreamingUpdate);
  }
  class BlazorStreamingUpdate extends HTMLElement {
    connectedCallback() {
      const blazorSsrElement = this.parentNode;

      // Synchronously remove this from the DOM to minimize our chance of affecting anything else
      blazorSsrElement.parentNode?.removeChild(blazorSsrElement);

      // When this element receives content, if it's <template blazor-component-id="...">...</template>,
      // insert the template content into the DOM
      blazorSsrElement.childNodes.forEach(node => {
        if (node instanceof HTMLTemplateElement) {
          const componentId = node.getAttribute('blazor-component-id');
          if (componentId) {
            // For enhanced nav page loads, we automatically cancel the response stream if another enhanced nav supersedes it. But there's
            // no way to cancel the original page load. So, to avoid continuing to process <blazor-ssr> blocks from the original page load
            // if an enhanced nav supersedes it, we must explicitly check whether this content is from the original page load, and if so,
            // ignore it if any enhanced nav has started yet. Fixes https://github.com/dotnet/aspnetcore/issues/50733
            const isFromEnhancedNav = node.getAttribute('enhanced-nav') === 'true';
            if (isFromEnhancedNav || hasNeverStartedAnyEnhancedPageLoad()) {
              insertStreamingContentIntoDocument(componentId, node.content);
            }
          } else {
            const isEnhancedNav = node.getAttribute('enhanced') === 'true';
            switch (node.getAttribute('type')) {
              case 'redirection':
                redirect(node, true, isEnhancedNav);
                break;
              case 'not-found':
                // not-found template has enhanced nav set to true by default,
                // check for the options to avoid overriding user settings
                const useEnhancedNav = isEnhancedNav && enableDomPreservation;
                redirect(node, false, useEnhancedNav);
                break;
              case 'error':
                // This is kind of brutal but matches what happens without progressive enhancement
                replaceDocumentWithPlainText(node.content.textContent || 'Error');
                break;
            }
          }
        }
      });
    }
  }
  function redirect(node, changeUrl, isEnhancedNav) {
    // We use 'replace' here because it's closest to the non-progressively-enhanced behavior, and will make the most sense
    // if the async delay was very short, as the user would not perceive having been on the intermediate page.
    const destinationUrl = toAbsoluteUri(node.content.textContent);
    const isFormPost = node.getAttribute('from') === 'form-post';
    if (isEnhancedNav && isWithinBaseUriSpace(destinationUrl)) {
      // At this point the destinationUrl might be an opaque URL so we don't know whether it's internal/external or
      // whether it's even going to the same URL we're currently on. So we don't know how to update the history.
      // Defer that until the redirection is resolved by performEnhancedPageLoad.
      const treatAsRedirectionFromMethod = isFormPost ? 'post' : 'get';
      const fetchOptions = undefined;
      performEnhancedPageLoad(destinationUrl, /* interceptedLink */false, fetchOptions, treatAsRedirectionFromMethod, changeUrl);
    } else {
      if (isFormPost) {
        // The URL is not yet updated. Push a whole new entry so that 'back' goes back to the pre-redirection location.
        // WARNING: The following check to avoid duplicating history entries won't work if the redirection is to an opaque URL.
        // We could change the server-side logic to return URLs in plaintext if they match the current request URL already,
        // but it's arguably easier to understand that history non-duplication only works for enhanced nav, which is also the
        // case for non-streaming responses.
        if (destinationUrl !== location.href) {
          location.assign(destinationUrl);
        }
      } else {
        // The URL was already updated on the original link click. Replace so that 'back' goes to the pre-redirection location.
        location.replace(destinationUrl);
      }
    }
  }
  function insertStreamingContentIntoDocument(componentIdAsString, docFrag) {
    const markers = findStreamingMarkers(componentIdAsString);
    if (markers) {
      const {
        startMarker,
        endMarker
      } = markers;
      if (enableDomPreservation) {
        domSynchronizer.synchronizeDomContent({
          startExclusive: startMarker,
          endExclusive: endMarker
        }, docFrag);
      } else {
        // In this mode we completely delete the old content before inserting the new content
        const destinationRoot = endMarker.parentNode;
        const existingContent = new Range();
        existingContent.setStart(startMarker, startMarker.textContent.length);
        existingContent.setEnd(endMarker, 0);
        existingContent.deleteContents();
        while (docFrag.childNodes[0]) {
          destinationRoot.insertBefore(docFrag.childNodes[0], endMarker);
        }
      }
      navigationEnhancementCallbacks.documentUpdated();
    }
  }
  function findStreamingMarkers(componentIdAsString) {
    // Find start marker
    const expectedStartText = `bl:${componentIdAsString}`;
    const iterator = document.createNodeIterator(document, NodeFilter.SHOW_COMMENT);
    let startMarker = null;
    while (startMarker = iterator.nextNode()) {
      if (startMarker.textContent === expectedStartText) {
        break;
      }
    }
    if (!startMarker) {
      return null;
    }

    // Find end marker
    const expectedEndText = `/bl:${componentIdAsString}`;
    let endMarker = null;
    while (endMarker = iterator.nextNode()) {
      if (endMarker.textContent === expectedEndText) {
        break;
      }
    }
    return endMarker ? {
      startMarker,
      endMarker
    } : null;
  }

  // Licensed to the .NET Foundation under one or more agreements.
  // The .NET Foundation licenses this file to you under the MIT license.

  class SsrEventRegistry {
    eventListeners = new Map();
    addEventListener(type, listener) {
      let listenersForEventType = this.eventListeners.get(type);
      if (!listenersForEventType) {
        listenersForEventType = new Set();
        this.eventListeners.set(type, listenersForEventType);
      }
      listenersForEventType.add(listener);
    }
    removeEventListener(type, listener) {
      this.eventListeners.get(type)?.delete(listener);
    }
    dispatchEvent(type, ev) {
      const listenersForEventType = this.eventListeners.get(type);
      if (!listenersForEventType) {
        return;
      }
      const event = {
        ...ev,
        type
      };
      for (const listener of listenersForEventType) {
        listener(event);
      }
    }
  }

  // Licensed to the .NET Foundation under one or more agreements.
  // The .NET Foundation licenses this file to you under the MIT license.

  let started = false;
  const ssrEventRegistry = new SsrEventRegistry();
  const Blazor = {
    start,
    navigateTo,
    addEventListener: ssrEventRegistry.addEventListener.bind(ssrEventRegistry),
    removeEventListener: ssrEventRegistry.removeEventListener.bind(ssrEventRegistry)
  };
  window['Blazor'] = Blazor;
  function start(options) {
    if (started) {
      throw new Error('Blazor has already started.');
    }
    started = true;
    const resolvedOptions = options || {};
    const navigationEnhancementCallbacks = {
      enhancedNavigationStarted: () => {
        dispatchSsrEvent('enhancednavigationstart', {});
      },
      documentUpdated: () => {
        resetScrollIfNeeded(ScrollResetSchedule.AfterDocumentUpdate);
        dispatchSsrEvent('enhancedload', {});
      },
      enhancedNavigationCompleted: () => {
        dispatchSsrEvent('enhancednavigationend', {});
      }
    };
    if (resolvedOptions.streaming !== false) {
      attachStreamingRenderingListener({
        disableDomPreservation: resolvedOptions.disableDomPreservation
      }, navigationEnhancementCallbacks, ssrDomSynchronizer);
    }
    if (!resolvedOptions.disableDomPreservation && resolvedOptions.enhancedNavigation !== false) {
      attachProgressivelyEnhancedNavigationListener(navigationEnhancementCallbacks, ssrDomSynchronizer);
    }
    if (resolvedOptions.focusOnNavigate !== false) {
      enableFocusOnNavigate(ssrEventRegistry);
    }
    warnIfInteractiveMarkersArePresent();
    return Promise.resolve();
  }
  function navigateTo(uri, options) {
    const absoluteUri = toAbsoluteUri(uri);
    const normalizedOptions = normalizeNavigationOptions(options);
    const replace = normalizedOptions.replace || normalizedOptions.replaceHistoryEntry || false;
    if (normalizedOptions.forceLoad || !isHttpOrHttpsUri(absoluteUri) || !isWithinBaseUriSpace(absoluteUri) || !hasProgrammaticEnhancedNavigationHandler()) {
      if (replace) {
        location.replace(absoluteUri);
      } else {
        location.href = absoluteUri;
      }
      return;
    }
    performProgrammaticEnhancedNavigation$1(absoluteUri, replace);
  }
  function normalizeNavigationOptions(options) {
    if (typeof options === 'boolean') {
      return {
        forceLoad: options
      };
    }
    return options || {};
  }
  function dispatchSsrEvent(type, ev) {
    ssrEventRegistry.dispatchEvent(type, ev);
  }
  function warnIfInteractiveMarkersArePresent() {
    const interactiveMarkerPattern = /\\?"type\\?"\s*:\s*\\?"(server|webassembly|auto)\\?"/i;
    const iterator = document.createNodeIterator(document, NodeFilter.SHOW_COMMENT);
    let node = iterator.nextNode();
    while (node) {
      if (node.textContent?.includes('Blazor:') && interactiveMarkerPattern.test(node.textContent)) {
        console.warn('This page appears to contain interactive Blazor component markers, but only the static SSR runtime is loaded. Interactive components will not be activated.');
        return;
      }
      node = iterator.nextNode();
    }
  }
  if (shouldAutoStart()) {
    start();
  }

})();
//# sourceMappingURL=blazor.ssr.js.map
