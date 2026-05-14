// Licensed to the .NET Foundation under one or more agreements.
// The .NET Foundation licenses this file to you under the MIT license.

export interface ComponentDescriptor {
  start: Comment;
  end?: Comment;
}

export type ServerComponentDescriptor = ComponentDescriptor;

export type WebAssemblyComponentDescriptor = ComponentDescriptor;

export type AutoComponentDescriptor = ComponentDescriptor;

export type WebAssemblyServerOptions = Record<string, never>;


export function isMetadataComment(node: Node): boolean {
  if (node.nodeType !== Node.COMMENT_NODE) {
    return false;
  }

  const content = node.textContent || '';
  return content.trim().startsWith('Blazor-Server-Component-State:')
    || content.trim().startsWith('Blazor-WebAssembly-Component-State:')
    || content.trim().startsWith('Blazor-Web-Initializers:')
    || content.trim().startsWith('Blazor-WebAssembly:')
    || content.trim().startsWith('Blazor-Configuration:');
}

export function discoverWebAssemblyOptions(_root: Node): WebAssemblyServerOptions | undefined {
  return undefined;
}

export function discoverComponents(_root: Node, _type: 'server' | 'webassembly' | 'auto'): ComponentDescriptor[] {
  return [];
}

export function canMergeDescriptors(_descriptorA: ComponentDescriptor, _descriptorB: ComponentDescriptor): boolean {
  return false;
}

export function mergeDescriptors(destination: ComponentDescriptor, source: ComponentDescriptor): void {
  Object.assign(destination, source);
}
