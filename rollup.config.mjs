import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { babel } from '@rollup/plugin-babel';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const environment = process.env.NODE_ENV || process.env.ROLLUP_WATCH || 'development';
const isProduction = environment === 'production';
const outputDir = path.join(__dirname, 'dist', isProduction ? '' : 'Debug');

const commonPlugins = [
  nodeResolve({
    extensions: ['.ts', '.js'],
  }),
  babel({
    babelHelpers: 'bundled',
    extensions: ['.ts', '.js'],
    include: ['src/**/*.ts'],
  }),
];

const commonConfig = {
  input: path.join(__dirname, 'src/Boot.Ssr.ts'),
};

const debugConfig = {
  ...commonConfig,
  output: {
    file: path.join(outputDir, 'blazor.ssr.js'),
    format: 'iife',
    sourcemap: true,
  },
  plugins: commonPlugins,
};

const productionConfig = [
  {
    ...commonConfig,
    output: {
      file: path.join(outputDir, 'blazor.ssr.js'),
      format: 'iife',
      sourcemap: true,
    },
    plugins: commonPlugins,
  },
  {
    ...commonConfig,
    output: {
      file: path.join(outputDir, 'blazor.ssr.min.js'),
      format: 'iife',
      sourcemap: true,
    },
    plugins: [...commonPlugins, terser()],
  },
];

export default isProduction ? productionConfig : debugConfig;
