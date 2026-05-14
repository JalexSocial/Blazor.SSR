import { rmSync } from 'node:fs';

for (const path of ['./dist/Debug', './dist/Release', './dist/blazor.ssr.js', './dist/blazor.ssr.js.map', './dist/blazor.ssr.min.js', './dist/blazor.ssr.min.js.map']) {
  rmSync(path, { recursive: true, force: true });
}
