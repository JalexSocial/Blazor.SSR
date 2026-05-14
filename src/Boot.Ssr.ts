// Licensed to the .NET Foundation under one or more agreements.
// The .NET Foundation licenses this file to you under the MIT license.

import { shouldAutoStart } from './BootCommon';
import { enableFocusOnNavigate } from './Rendering/FocusOnNavigate';
import { resetScrollIfNeeded, ScrollResetSchedule } from './Rendering/ScrollRestoration';
import { ssrDomSynchronizer } from './Rendering/SsrDomMerging/SsrDomSync';
import { attachStreamingRenderingListener } from './Rendering/StreamingRendering';
import { NavigationEnhancementCallbacks, attachProgressivelyEnhancedNavigationListener } from './Services/NavigationEnhancement';
import { hasProgrammaticEnhancedNavigationHandler, isHttpOrHttpsUri, isWithinBaseUriSpace, performProgrammaticEnhancedNavigation, toAbsoluteUri } from './Services/NavigationUtils';
import { SsrEventMap, SsrEventRegistry } from './Services/SsrEventRegistry';

export interface SsrOnlyStartOptions {
  disableDomPreservation?: boolean;
  enhancedNavigation?: boolean;
  streaming?: boolean;
  focusOnNavigate?: boolean;
}

interface SsrOnlyBlazorGlobal {
  start: (options?: SsrOnlyStartOptions) => Promise<void>;
  navigateTo: (uri: string, options?: SsrOnlyNavigationOptions | boolean) => void;
  addEventListener: typeof SsrEventRegistry.prototype.addEventListener;
  removeEventListener: typeof SsrEventRegistry.prototype.removeEventListener;
}

export interface SsrOnlyNavigationOptions {
  forceLoad?: boolean;
  replace?: boolean;
  replaceHistoryEntry?: boolean;
}

let started = false;
const ssrEventRegistry = new SsrEventRegistry();

const Blazor: SsrOnlyBlazorGlobal = {
  start,
  navigateTo,
  addEventListener: ssrEventRegistry.addEventListener.bind(ssrEventRegistry),
  removeEventListener: ssrEventRegistry.removeEventListener.bind(ssrEventRegistry),
};

window['Blazor'] = Blazor;

function start(options?: SsrOnlyStartOptions): Promise<void> {
  if (started) {
    throw new Error('Blazor has already started.');
  }

  started = true;

  const resolvedOptions = options || {};
  const navigationEnhancementCallbacks: NavigationEnhancementCallbacks = {
    enhancedNavigationStarted: () => {
      dispatchSsrEvent('enhancednavigationstart', {});
    },
    documentUpdated: () => {
      resetScrollIfNeeded(ScrollResetSchedule.AfterDocumentUpdate);
      dispatchSsrEvent('enhancedload', {});
    },
    enhancedNavigationCompleted: () => {
      dispatchSsrEvent('enhancednavigationend', {});
    },
  };

  if (resolvedOptions.streaming !== false) {
    attachStreamingRenderingListener({
      disableDomPreservation: resolvedOptions.disableDomPreservation,
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

function navigateTo(uri: string, options?: SsrOnlyNavigationOptions | boolean): void {
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

  performProgrammaticEnhancedNavigation(absoluteUri, replace);
}

function normalizeNavigationOptions(options?: SsrOnlyNavigationOptions | boolean): SsrOnlyNavigationOptions {
  if (typeof options === 'boolean') {
    return { forceLoad: options };
  }

  return options || {};
}

function dispatchSsrEvent<K extends keyof SsrEventMap>(type: K, ev: Omit<SsrEventMap[K], 'type'>): void {
  ssrEventRegistry.dispatchEvent(type, ev);
}

function warnIfInteractiveMarkersArePresent(): void {
  const interactiveMarkerPattern = /\\?"type\\?"\s*:\s*\\?"(server|webassembly|auto)\\?"/i;
  const iterator = document.createNodeIterator(document, NodeFilter.SHOW_COMMENT);
  let node = iterator.nextNode() as Comment | null;

  while (node) {
    if (node.textContent?.includes('Blazor:') && interactiveMarkerPattern.test(node.textContent)) {
      console.warn('This page appears to contain interactive Blazor component markers, but only the static SSR runtime is loaded. Interactive components will not be activated.');
      return;
    }

    node = iterator.nextNode() as Comment | null;
  }
}

if (shouldAutoStart()) {
  start();
}
