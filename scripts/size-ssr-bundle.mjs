#!/usr/bin/env node
// Licensed to the .NET Foundation under one or more agreements.
// The .NET Foundation licenses this file to you under the MIT license.

import { gzipSync } from 'node:zlib';
import { readFileSync, statSync } from 'node:fs';

const files = [
  'dist/blazor.ssr.js',
  'dist/blazor.ssr.min.js',
];

for (const file of files) {
  try {
    const bytes = statSync(file).size;
    const gzipBytes = gzipSync(readFileSync(file)).length;
    console.log(`${file}: ${bytes} bytes (${gzipBytes} bytes gzip)`);
  } catch (error) {
    console.warn(`${file}: not found; run npm run build:production first`);
  }
}
