import { describe, it, expect } from 'vitest';
import { classifyFile } from './classify.js';

/**
 * Hermetic table-driven tests for classifyFile.
 * No I/O. Tests role assignment and precedence (boilerplate > wiring > core).
 */

describe('classifyFile', () => {
  // ── Boilerplate ────────────────────────────────────────────────────────────

  it.each<[string, string]>([
    ['package-lock.json', 'package-lock.json'],
    ['yarn.lock', 'yarn.lock'],
    ['pnpm-lock.yaml', 'pnpm-lock.yaml'],
    ['package.json', 'package.json'],
    ['dist/index.js', 'dist output'],
    ['build/index.cjs', 'build output'],
    ['src/__snapshots__/foo.snap', 'nested snapshot dir'],
    ['foo.snap', 'snapshot file'],
    ['bundle.min.js', 'minified JS'],
    ['app.js.map', 'source map'],
    ['nested/package.json', 'nested package.json'],
  ])('classifies %s (%s) as boilerplate', (path) => {
    expect(classifyFile(path)).toBe('boilerplate');
  });

  // ── Wiring ─────────────────────────────────────────────────────────────────

  it.each<[string, string]>([
    ['Dockerfile', 'Dockerfile exact'],
    ['server.ts', 'server.ts exact'],
    ['config.ts', 'config.ts exact'],
    ['index.ts', 'index.ts barrel'],
    ['index.js', 'index.js barrel'],
    ['src/index.ts', 'nested barrel'],
    ['.env', '.env file'],
    ['.env.local', '.env.local file'],
    ['.env.production', '.env.production file'],
    ['tsconfig.json', 'tsconfig exact'],
    ['tsconfig.base.json', 'tsconfig variant'],
    ['.eslintrc.js', '.eslintrc variant'],
    ['.eslintrc.json', '.eslintrc.json'],
    ['vite.config.ts', 'vite config'],
    ['jest.config.js', 'jest config'],
    ['prettier.config.mjs', 'prettier config'],
    ['webpack.config.cjs', 'webpack config'],
    ['.github/workflows/ci.yml', 'CI yml'],
    ['.github/workflows/deploy.yaml', 'CI yaml'],
  ])('classifies %s (%s) as wiring', (path) => {
    expect(classifyFile(path)).toBe('wiring');
  });

  // ── Core ───────────────────────────────────────────────────────────────────

  it.each<[string, string]>([
    ['src/modules/reviews/service.ts', 'domain service'],
    ['src/adapters/llm/openai.ts', 'adapter'],
    ['src/db/schema.ts', 'schema (not a config file)'],
    ['lib/utils.ts', 'utility'],
    ['README.md', 'readme'],
    ['src/components/Button.tsx', 'React component'],
    ['test/helpers/pg.ts', 'test helper'],
    ['src/platform/errors.ts', 'platform errors'],
  ])('classifies %s (%s) as core', (path) => {
    expect(classifyFile(path)).toBe('core');
  });

  // ── Precedence: boilerplate beats wiring ───────────────────────────────────

  it('classifies dist/index.js as boilerplate (not wiring despite index.js name)', () => {
    // index.js would be wiring by exact name, but dist/ dir makes it boilerplate first
    expect(classifyFile('dist/index.js')).toBe('boilerplate');
  });

  it('classifies build/tsconfig.json as boilerplate (build dir wins over tsconfig prefix)', () => {
    expect(classifyFile('build/tsconfig.json')).toBe('boilerplate');
  });

  // ── Windows-style paths (backslash normalisation) ──────────────────────────

  it('normalises backslash paths (Windows)', () => {
    expect(classifyFile('dist\\index.js')).toBe('boilerplate');
    expect(classifyFile('src\\modules\\service.ts')).toBe('core');
  });

  // ── CI yaml: only files directly under .github/workflows/ ─────────────────

  it('classifies a non-CI yaml under .github as core', () => {
    // DEPENDABOT config etc. are not wiring by this rule, they're core
    expect(classifyFile('.github/dependabot.yml')).toBe('core');
  });

  it('classifies .github/workflows/ci.yaml as wiring', () => {
    expect(classifyFile('.github/workflows/ci.yaml')).toBe('wiring');
  });

  // ── Ambiguous / realistic paths that need careful precedence ───────────────

  /**
   * src/index.ts — the exact basename "index.ts" is in WIRING_EXACT.
   * Even though it lives inside src/, the basename match fires first.
   */
  it('classifies src/index.ts as wiring (barrel — exact basename match)', () => {
    expect(classifyFile('src/index.ts')).toBe('wiring');
  });

  /**
   * src/index-handler.ts — NOT an exact basename match for "index.ts";
   * does not contain ".config."; no other wiring prefix/suffix applies.
   * Should fall through to core.
   */
  it('classifies src/index-handler.ts as core (not a barrel)', () => {
    expect(classifyFile('src/index-handler.ts')).toBe('core');
  });

  /**
   * foo.config.ts — basename contains ".config." → wiring.
   */
  it('classifies foo.config.ts as wiring (contains .config. substring)', () => {
    expect(classifyFile('foo.config.ts')).toBe('wiring');
  });

  /**
   * deep/nested/foo.config.js — the ".config." rule applies to the basename
   * regardless of directory depth.
   */
  it('classifies deep/nested/foo.config.js as wiring', () => {
    expect(classifyFile('deep/nested/foo.config.js')).toBe('wiring');
  });

  /**
   * src/__snapshots__/MyComponent.test.ts.snap — the __snapshots__ dir segment
   * fires first (boilerplate dir), even though it also ends in ".snap"
   * (boilerplate file suffix). Either boilerplate path wins.
   */
  it('classifies src/__snapshots__/MyComponent.test.ts.snap as boilerplate', () => {
    expect(classifyFile('src/__snapshots__/MyComponent.test.ts.snap')).toBe('boilerplate');
  });

  /**
   * A .snap file NOT under __snapshots__ is still boilerplate via file suffix.
   */
  it('classifies arbitrary/path/component.snap as boilerplate via file suffix', () => {
    expect(classifyFile('arbitrary/path/component.snap')).toBe('boilerplate');
  });

  /**
   * A deeply nested index.js inside dist/ — boilerplate dir wins over wiring
   * exact name (dist is in BOILERPLATE_DIR_SEGMENTS, checked before wiring).
   */
  it('classifies dist/cjs/index.js as boilerplate (dist dir wins over index.js name)', () => {
    expect(classifyFile('dist/cjs/index.js')).toBe('boilerplate');
  });

  /**
   * A Windows-style path through a wiring file in a nested dir.
   */
  it('normalises backslash path and classifies src\\index.ts as wiring', () => {
    expect(classifyFile('src\\index.ts')).toBe('wiring');
  });
});
