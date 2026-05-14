#!/usr/bin/env node
// Licensed to the .NET Foundation under one or more agreements.
// The .NET Foundation licenses this file to you under the MIT license.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const entrypoint = path.join(repoRoot, 'src', 'Boot.Ssr.ts');

const requiredFiles = [
  'src/Rendering/SsrDomMerging/SsrDomSync.ts',
  'src/Rendering/SsrDomMerging/SsrAttributeSync.ts',
  'src/Rendering/SsrDomMerging/SsrDataPermanentElementSync.ts',
  'src/Rendering/SsrDomMerging/SsrEditScript.ts',
].map(file => path.join(repoRoot, file));

const forbiddenTerms = [
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
  'LogicalElements',
  'Rendering/DomMerging/DomSync',
  './DomMerging/DomSync',
  '../DomMerging/DomSync',
];

const { visitedFiles, externalImports } = collectStaticDependencyGraph(entrypoint);
const inspectedFiles = Array.from(visitedFiles).sort();
const missingRequiredFiles = requiredFiles.filter(file => !visitedFiles.has(file));
const findings = [];

for (const file of inspectedFiles) {
  const content = fs.readFileSync(file, 'utf8');
  for (const term of forbiddenTerms) {
    if (content.includes(term)) {
      findings.push({ file, term });
    }
  }
}

for (const specifier of externalImports) {
  for (const term of forbiddenTerms) {
    if (specifier.includes(term)) {
      findings.push({ file: '(external import)', term: specifier });
    }
  }
}

console.log('SSR boundary check');
console.log(`Entrypoint: ${path.relative(repoRoot, entrypoint)}`);
console.log(`Files inspected: ${inspectedFiles.length}`);
for (const file of inspectedFiles) {
  console.log(` - ${path.relative(repoRoot, file)}`);
}

if (missingRequiredFiles.length > 0) {
  console.error('\nMissing expected SSR-only DOM synchronization files from dependency graph:');
  for (const file of missingRequiredFiles) {
    console.error(` - ${path.relative(repoRoot, file)}`);
  }
}

if (findings.length > 0) {
  console.error('\nForbidden terms found in the SSR-only dependency path:');
  for (const finding of findings) {
    const fileName = finding.file === '(external import)' ? finding.file : path.relative(repoRoot, finding.file);
    console.error(` - ${fileName}: ${finding.term}`);
  }
}

if (missingRequiredFiles.length > 0 || findings.length > 0) {
  console.error('\nFAIL: SSR boundary check failed.');
  process.exitCode = 1;
} else {
  console.log('\nPASS: SSR boundary check passed.');
}

function collectStaticDependencyGraph(entryFile) {
  const visitedFiles = new Set();
  const externalImports = new Set();
  visit(entryFile);
  return { visitedFiles, externalImports };

  function visit(file) {
    if (visitedFiles.has(file)) {
      return;
    }

    visitedFiles.add(file);
    const directory = path.dirname(file);
    const content = fs.readFileSync(file, 'utf8');
    const importPattern = /(?:import|export)(?:\s+type)?(?:[\s\S]*?from\s*)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
    let match;
    while (match = importPattern.exec(content)) {
      const specifier = match[1] || match[2];
      if (!specifier) {
        continue;
      }

      if (!specifier.startsWith('.')) {
        externalImports.add(specifier);
        continue;
      }

      const resolved = resolveTypeScriptImport(path.resolve(directory, specifier));
      if (resolved) {
        visit(resolved);
      }
    }
  }
}

function resolveTypeScriptImport(importPath) {
  const candidates = [
    importPath,
    `${importPath}.ts`,
    `${importPath}.js`,
    path.join(importPath, 'index.ts'),
    path.join(importPath, 'index.js'),
  ];

  return candidates.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || null;
}
