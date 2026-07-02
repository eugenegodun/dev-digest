import type { SmartDiffRole } from '@devdigest/shared';
import {
  BOILERPLATE_SUFFIXES,
  BOILERPLATE_EXACT,
  BOILERPLATE_DIR_SEGMENTS,
  BOILERPLATE_FILE_SUFFIXES,
  WIRING_EXACT,
  WIRING_SUFFIXES,
  WIRING_BASENAME_PREFIXES,
  WIRING_CONFIG_SUBSTRING,
  WIRING_CI_DIR,
  WIRING_CI_EXTENSIONS,
} from './constants.js';

/**
 * Classify a file path into one of three roles: core, wiring, or boilerplate.
 *
 * Precedence (highest → lowest):
 *   1. boilerplate — lock files, build outputs, snapshots, source maps, minified JS
 *   2. wiring      — config files, CI, barrel exports, infrastructure
 *   3. core        — everything else (the actual logic)
 *
 * All checks use plain string operations (endsWith / includes / split/segment)
 * to avoid ReDoS-prone dynamic regex. Paths are normalised to forward slashes.
 */
export function classifyFile(filePath: string): SmartDiffRole {
  const normalised = filePath.replace(/\\/g, '/');
  const basename = normalised.includes('/')
    ? normalised.slice(normalised.lastIndexOf('/') + 1)
    : normalised;

  // ── 1. Boilerplate (highest precedence) ────────────────────────────────────

  // Exact filename match
  if (BOILERPLATE_EXACT.includes(basename)) return 'boilerplate';

  // Suffix match on the full path (e.g. "-lock.json", ".lock")
  for (const suffix of BOILERPLATE_SUFFIXES) {
    if (normalised.endsWith(suffix)) return 'boilerplate';
  }

  // Directory segment match: any leading segment equals a boilerplate dir
  const segments = normalised.split('/');
  for (const segment of BOILERPLATE_DIR_SEGMENTS) {
    if (segments.includes(segment)) return 'boilerplate';
  }

  // File suffix match (e.g. ".snap", ".min.js", ".map")
  for (const suffix of BOILERPLATE_FILE_SUFFIXES) {
    if (basename.endsWith(suffix)) return 'boilerplate';
  }

  // ── 2. Wiring (second precedence) ──────────────────────────────────────────

  // Exact basename match
  if (WIRING_EXACT.includes(basename)) return 'wiring';

  // Suffix match on the full path (e.g. ".env", ".env.local")
  for (const suffix of WIRING_SUFFIXES) {
    if (normalised.endsWith(suffix)) return 'wiring';
  }

  // Basename prefix match (e.g. "tsconfig.json", ".eslintrc.js")
  for (const prefix of WIRING_BASENAME_PREFIXES) {
    if (basename.startsWith(prefix)) return 'wiring';
  }

  // Basename substring for *.config.* files (e.g. "vite.config.ts")
  if (basename.includes(WIRING_CONFIG_SUBSTRING)) return 'wiring';

  // CI YAML: path starts with .github/workflows/ and ends with .yml / .yaml
  if (normalised.startsWith(WIRING_CI_DIR)) {
    for (const ext of WIRING_CI_EXTENSIONS) {
      if (basename.endsWith(ext)) return 'wiring';
    }
  }

  // ── 3. Core (default) ──────────────────────────────────────────────────────
  return 'core';
}
