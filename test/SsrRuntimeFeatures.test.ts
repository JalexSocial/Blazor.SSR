import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '..');

describe('SSR-only runtime surface', () => {
  test('Boot.Ssr exposes only the static SSR public API and supports replace navigation option', () => {
    const bootSsr = fs.readFileSync(path.join(repoRoot, 'src/Boot.Ssr.ts'), 'utf8');

    expect(bootSsr).toContain('start: (options?: SsrOnlyStartOptions) => Promise<void>;');
    expect(bootSsr).toContain('navigateTo: (uri: string, options?: SsrOnlyNavigationOptions | boolean) => void;');
    expect(bootSsr).toContain('addEventListener: typeof SsrEventRegistry.prototype.addEventListener;');
    expect(bootSsr).toContain('removeEventListener: typeof SsrEventRegistry.prototype.removeEventListener;');
    expect(bootSsr).toContain('replace?: boolean;');
    expect(bootSsr).toContain('forceLoad?: boolean;');
    expect(bootSsr).not.toContain("window['DotNet']");
  });

  test('Boot.Ssr warns for interactive component markers without importing descriptor activation', () => {
    const bootSsr = fs.readFileSync(path.join(repoRoot, 'src/Boot.Ssr.ts'), 'utf8');

    expect(bootSsr).toContain('warnIfInteractiveMarkersArePresent');
    expect(bootSsr).toContain('only the static SSR runtime is loaded');
    expect(bootSsr).not.toContain('ComponentDescriptorDiscovery');
  });

  test('enhanced navigation filters non-http links and non-base form actions before intercepting', () => {
    const navigationUtils = fs.readFileSync(path.join(repoRoot, 'src/Services/NavigationUtils.ts'), 'utf8');
    const navigationEnhancement = fs.readFileSync(path.join(repoRoot, 'src/Services/NavigationEnhancement.ts'), 'utf8');

    expect(navigationUtils).toContain('export function isHttpOrHttpsUri');
    expect(navigationUtils).toContain('isHttpOrHttpsUri(absoluteHref) && isWithinBaseUriSpace(absoluteHref)');
    expect(navigationEnhancement).toContain("const method = (event.submitter?.getAttribute('formmethod') || formElem.method).toLowerCase();");
    expect(navigationEnhancement).toContain('!isHttpOrHttpsUri(url.href) || !isWithinBaseUriSpace(url.href)');
  });

  test('production build emits standalone and minified SSR bundle names with size reporting', () => {
    const rollupConfig = fs.readFileSync(path.join(repoRoot, 'rollup.config.mjs'), 'utf8');
    const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));

    expect(rollupConfig).toContain("'dist'");
    expect(rollupConfig).toContain("'blazor.ssr.js'");
    expect(rollupConfig).toContain("'blazor.ssr.min.js'");
    expect(rollupConfig).toContain('terser()');
    expect(packageJson.scripts['size:ssr']).toBe('node scripts/size-ssr-bundle.mjs');
  });
});
