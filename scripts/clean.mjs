import { rmSync } from 'node:fs';

for (const path of ['./dist/Debug', './dist/Release']) {
  rmSync(path, { recursive: true, force: true });
}
