import { promises as fs } from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');
const rootPackagePath = path.join(rootDir, 'package.json');

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function copyIfExists(source, destination) {
  if (await exists(source)) {
    await fs.copyFile(source, destination);
    return true;
  }

  return false;
}

async function main() {
  const rootPackage = JSON.parse(await fs.readFile(rootPackagePath, 'utf8'));

  if (!(await exists(distDir))) {
    throw new Error('dist directory does not exist. Run npm run build first.');
  }

  const distEntries = await fs.readdir(distDir, { withFileTypes: true });
  const distFiles = distEntries.filter(entry => entry.isFile()).map(entry => entry.name);

  if (distFiles.length === 0) {
    throw new Error('dist directory is empty. Build output is required before packaging.');
  }

  const packageJson = {
    name: rootPackage.name,
    version: rootPackage.version,
    description: rootPackage.description,
    license: rootPackage.license,
    repository: rootPackage.repository,
    bugs: rootPackage.bugs,
    homepage: rootPackage.homepage,
    sideEffects: rootPackage.sideEffects ?? true,
    publishConfig: rootPackage.publishConfig,
  };

  if (distFiles.includes('blazor.ssr.js')) {
    packageJson.files = ['*.js', '*.map', 'README.md', 'LICENSE*'];
  }

  await fs.writeFile(path.join(distDir, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');

  const copiedReadme = await copyIfExists(path.join(rootDir, 'README.md'), path.join(distDir, 'README.md'));

  if (!copiedReadme) {
    await fs.writeFile(
      path.join(distDir, 'README.md'),
      '# @jalexsocial/blazor.ssr\n\nThis package contains standalone Blazor static SSR runtime build artifacts.\n',
      'utf8');
  }

  const copiedLicense = await copyIfExists(path.join(rootDir, 'LICENSE'), path.join(distDir, 'LICENSE'));

  if (!copiedLicense) {
    await copyIfExists(path.join(rootDir, 'LICENSE.txt'), path.join(distDir, 'LICENSE.txt'));
    await copyIfExists(path.join(rootDir, 'LICENSE.md'), path.join(distDir, 'LICENSE.md'));
  }

  console.log(`Prepared npm package in ${distDir}`);
}

await main();
