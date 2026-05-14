// Licensed to the .NET Foundation under one or more agreements.
// The .NET Foundation licenses this file to you under the MIT license.

interface SsrEvent {
  type: keyof SsrEventMap;
}

export interface SsrEventMap {
  'enhancedload': SsrEvent;
  'enhancednavigationstart': SsrEvent;
  'enhancednavigationend': SsrEvent;
}

export class SsrEventRegistry {
  private readonly eventListeners = new Map<keyof SsrEventMap, Set<(ev: SsrEvent) => void>>();

  public addEventListener<K extends keyof SsrEventMap>(type: K, listener: (ev: SsrEventMap[K]) => void): void {
    let listenersForEventType = this.eventListeners.get(type);
    if (!listenersForEventType) {
      listenersForEventType = new Set();
      this.eventListeners.set(type, listenersForEventType);
    }

    listenersForEventType.add(listener as (ev: SsrEvent) => void);
  }

  public removeEventListener<K extends keyof SsrEventMap>(type: K, listener: (ev: SsrEventMap[K]) => void): void {
    this.eventListeners.get(type)?.delete(listener as (ev: SsrEvent) => void);
  }

  public dispatchEvent<K extends keyof SsrEventMap>(type: K, ev: Omit<SsrEventMap[K], keyof SsrEvent>): void {
    const listenersForEventType = this.eventListeners.get(type);
    if (!listenersForEventType) {
      return;
    }

    const event = {
      ...ev,
      type,
    };

    for (const listener of listenersForEventType) {
      listener(event);
    }
  }
}
