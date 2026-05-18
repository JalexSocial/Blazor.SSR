#!/usr/bin/env node
// Licensed to the .NET Foundation under one or more agreements.
// The .NET Foundation licenses this file to you under the MIT license.

import fs from 'node:fs';
import { gzipSync } from 'node:zlib';
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
const bundleResults = [];

for (const relativeFile of bundleFiles) {
  const file = path.join(repoRoot, relativeFile);
  if (!fs.existsSync(file)) {
    findings.push(`${relativeFile}: bundle file is missing; run npm run build first`);
    continue;
  }

  const rawContent = fs.readFileSync(file);
  const content = stripComments(rawContent.toString('utf8'));
  const forbiddenResults = forbiddenRuntimeTerms.map(term => ({ term, present: content.includes(term) }));
  const expectedResults = expectedSsrTerms.map(term => ({ term, present: content.includes(term) }));

  for (const result of forbiddenResults) {
    if (result.present) {
      findings.push(`${relativeFile}: forbidden runtime term '${result.term}'`);
    }
  }

  for (const result of expectedResults) {
    if (!result.present) {
      missingExpectedTerms.push(`${relativeFile}: missing expected SSR string '${result.term}'`);
    }
  }

  bundleResults.push({
    relativeFile,
    rawBytes: rawContent.length,
    gzipBytes: gzipSync(rawContent).length,
    forbiddenResults,
    expectedResults,
  });
}

console.log('SSR bundle audit');
for (const result of bundleResults) {
  console.log(` - ${result.relativeFile}: ${result.rawBytes} bytes (${result.gzipBytes} bytes gzip)`);
  console.log('   Forbidden runtime terms:');
  for (const termResult of result.forbiddenResults) {
    console.log(`    ${termResult.present ? 'FAIL' : 'PASS'} ${termResult.term}`);
  }
  console.log('   Expected SSR protocol strings:');
  for (const termResult of result.expectedResults) {
    console.log(`    ${termResult.present ? 'PASS' : 'FAIL'} ${termResult.term}`);
  }
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
