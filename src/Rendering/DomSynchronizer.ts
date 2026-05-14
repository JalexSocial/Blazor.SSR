// Licensed to the .NET Foundation under one or more agreements.
// The .NET Foundation licenses this file to you under the MIT license.

export interface CommentBoundedRange {
  startExclusive: Comment,
  endExclusive: Comment,
}

export interface DomSynchronizer {
  synchronizeDomContent(destination: CommentBoundedRange | Node, newContent: Node): void;
}
