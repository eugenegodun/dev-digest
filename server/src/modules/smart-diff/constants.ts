/**
 * Smart Diff classification constants.
 *
 * Patterns use plain string predicates (endsWith / includes / segment checks)
 * to avoid ReDoS-prone dynamic regex construction. SPLIT_TOO_BIG_LINES is
 * the core-files line threshold above which the split-suggestion banner fires.
 */

// ---- Boilerplate patterns --------------------------------------------------
// Checked first (highest precedence): lock files, build outputs, snapshots,
// minified assets.

/** Path segments or suffixes that indicate a boilerplate file. */
export const BOILERPLATE_SUFFIXES: readonly string[] = [
  '-lock.json',
  '.lock',
];

/** Exact filenames that are always boilerplate. */
export const BOILERPLATE_EXACT: readonly string[] = [
  'pnpm-lock.yaml',
  'package.json',
];

/**
 * Path-prefix segments that mark every file beneath them as boilerplate.
 * Matched by splitting on '/' and checking whether any leading segment equals
 * one of these values.
 */
export const BOILERPLATE_DIR_SEGMENTS: readonly string[] = [
  'dist',
  'build',
  '__snapshots__',
];

/** File suffixes that classify a file as boilerplate regardless of directory. */
export const BOILERPLATE_FILE_SUFFIXES: readonly string[] = [
  '.snap',
  '.min.js',
  '.map',
];

// ---- Wiring patterns -------------------------------------------------------
// Checked second: config files, CI, infrastructure, barrel re-exports.

/** Exact filenames that are always wiring. */
export const WIRING_EXACT: readonly string[] = [
  'Dockerfile',
  'server.ts',
  'config.ts',
  'index.ts',
  'index.js',
];

/**
 * File suffixes that classify a file as wiring.
 * Uses multi-segment endings (e.g. `.config.ts`) where the extension is not
 * just one dot-segment.
 */
export const WIRING_SUFFIXES: readonly string[] = [
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
  '.env.test',
];

/**
 * Filename patterns matched via `basename.startsWith(prefix)` for wiring
 * detection (e.g. "tsconfig.json", "tsconfig.base.json", ".eslintrc.js").
 */
export const WIRING_BASENAME_PREFIXES: readonly string[] = [
  'tsconfig',
  '.eslintrc',
];

/**
 * Partial filename segments for wiring: if the basename contains one of these
 * substrings we treat the file as wiring (e.g. "vite.config.ts",
 * "jest.config.js", "prettier.config.mjs").
 */
export const WIRING_CONFIG_SUBSTRING = '.config.';

/**
 * CI YAML directory prefix. Files under `.github/workflows/` with a YAML
 * extension are wiring.
 */
export const WIRING_CI_DIR = '.github/workflows/';
export const WIRING_CI_EXTENSIONS: readonly string[] = ['.yml', '.yaml'];

// ---- Split threshold -------------------------------------------------------

/** Core-file total lines (additions + deletions) above which `too_big` fires. */
export const SPLIT_TOO_BIG_LINES = 400;

/**
 * Stable bucket name for core files that sit at the repository root (no
 * directory component). Referenced by both service.ts and the integration test.
 */
export const ROOT_BUCKET = '(root)';
