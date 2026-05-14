import path from 'node:path';
import { fileURLToPath } from 'node:url';
import alias from '@rollup/plugin-alias';
import { babel } from '@rollup/plugin-babel';
import { nodeResolve } from '@rollup/plugin-node-resolve';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const environment = process.env.NODE_ENV || process.env.ROLLUP_WATCH || 'development';
const isProduction = environment === 'production';
const outputDir = path.join(__dirname, 'dist', isProduction ? 'Release' : 'Debug');

export default {
  input: path.join(__dirname, 'src/Boot.Ssr.ts'),
  output: {
    file: path.join(outputDir, 'blazor.ssr.js'),
    format: 'iife',
    sourcemap: true,
  },
  plugins: [
    alias({
      entries: [
        // Temporary SSR-build aliases. DomSync still has interactive descriptor hooks that
        // are documented as follow-up cleanup in docs/ssr-runtime-dependency-notes.md.
        {
          find: '../../Services/ComponentDescriptorDiscovery',
          replacement: path.join(__dirname, 'src/BuildStubs/ComponentDescriptorDiscovery.SsrBuild.ts'),
        },
        {
          find: '../Services/ComponentDescriptorDiscovery',
          replacement: path.join(__dirname, 'src/BuildStubs/ComponentDescriptorDiscovery.SsrBuild.ts'),
        },
        {
          find: '../BrowserRenderer',
          replacement: path.join(__dirname, 'src/BuildStubs/BrowserRenderer.SsrBuild.ts'),
        },
      ],
    }),
    nodeResolve({
      extensions: ['.ts', '.js'],
    }),
    babel({
      babelHelpers: 'bundled',
      extensions: ['.ts', '.js'],
      include: ['src/**/*.ts'],
    }),
  ],
};
