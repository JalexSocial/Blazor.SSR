#!/usr/bin/env node
// Licensed to the .NET Foundation under one or more agreements.
// The .NET Foundation licenses this file to you under the MIT license.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const bundleFiles = [
  'dist/blazor.ssr.js',
  'dist/blazor.ssr.min.js',
];

const forbiddenRuntimeTerms = [
  '@microsoft/dotnet-js-interop',
  'Boot.Server.Common',
  'Boot.WebAssembly.Common',
  'WebRootComponentManager',
  'ComponentDescriptorDiscovery',
  'BrowserRenderer',
  'EventDelegator',
  'JSRootComponents',
  'RenderBatch',
  'Circuit',
  'SignalR',
  'Mono',
  'WebAssemblyStartOptions',
  'InputFile',
  'Virtualize',
  'DotNet',
  'dotnet',
  'InteractiveServer',
  'InteractiveWebAssembly',
  'InteractiveAuto',
];

const expectedSsrTerms = [
  'blazor-enhanced-nav=on',
  'blazor-enhanced-nav',
  'enhancednavigationstart',
  'enhancedload',
  'enhancednavigationend',
  'blazor-ssr',
  'blazor-ssr-end',
  'data-permanent',
  'data-enhance',
  'data-enhance-nav',
  'blazor-focus-on-navigate',
];

const findings = [];
const missingExpectedTerms = [];

for (const relativeFile of bundleFiles) {
  const file = path.join(repoRoot, relativeFile);
  if (!fs.existsSync(file)) {
    findings.push(`${relativeFile}: bundle file is missing; run npm run build first`);
    continue;
  }

  const content = stripComments(fs.readFileSync(file, 'utf8'));
  for (const term of forbiddenRuntimeTerms) {
    if (content.includes(term)) {
      findings.push(`${relativeFile}: forbidden runtime term '${term}'`);
    }
  }

  for (const term of expectedSsrTerms) {
    if (!content.includes(term)) {
      missingExpectedTerms.push(`${relativeFile}: missing expected SSR string '${term}'`);
    }
  }
}

console.log('SSR bundle audit');
for (const relativeFile of bundleFiles) {
  console.log(` - ${relativeFile}`);
}

if (findings.length > 0) {
  console.error('\nForbidden bundle findings:');
  for (const finding of findings) {
    console.error(` - ${finding}`);
  }
}

if (missingExpectedTerms.length > 0) {
  console.error('\nMissing expected SSR protocol strings:');
  for (const missing of missingExpectedTerms) {
    console.error(` - ${missing}`);
  }
}

if (findings.length > 0 || missingExpectedTerms.length > 0) {
  console.error('\nFAIL: SSR bundle audit failed.');
  process.exitCode = 1;
} else {
  console.log('\nPASS: SSR bundle audit passed.');
}


function stripComments(content) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}
