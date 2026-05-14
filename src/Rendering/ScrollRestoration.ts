// Licensed to the .NET Foundation under one or more agreements.
// The .NET Foundation licenses this file to you under the MIT license.

export enum ScrollResetSchedule {
  None,
  AfterBatch, // Reset scroll after interactive components finish rendering (interactive navigation)
  AfterDocumentUpdate, // Reset scroll after enhanced navigation updates the DOM (enhanced navigation)
}

let pendingScrollResetTiming: ScrollResetSchedule = ScrollResetSchedule.None;

export function scheduleScrollReset(timing: ScrollResetSchedule): void {
  if (timing !== ScrollResetSchedule.AfterBatch) {
    pendingScrollResetTiming = timing;
    return;
  }

  if (pendingScrollResetTiming !== ScrollResetSchedule.AfterDocumentUpdate) {
    pendingScrollResetTiming = ScrollResetSchedule.AfterBatch;
  }
}

export function resetScrollIfNeeded(triggerTiming: ScrollResetSchedule) {
  if (pendingScrollResetTiming !== triggerTiming) {
    return;
  }

  pendingScrollResetTiming = ScrollResetSchedule.None;

  // This assumes the scroller is on the window itself. There isn't a general way to know
  // if some other element is playing the role of the primary scroll region.
  window.scrollTo && window.scrollTo(0, 0);
}
