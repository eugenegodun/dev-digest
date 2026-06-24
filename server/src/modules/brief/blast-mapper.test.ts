import { describe, it, expect } from 'vitest';
import type { BlastResult } from '../repo-intel/types.js';
import { BlastRadius } from '../../vendor/shared/contracts/brief.js';
import { mapBlastRadius } from './blast-mapper.js';

/**
 * Hermetic unit tests for `mapBlastRadius`.
 * No DB, no repo-intel calls, no LLM — pure in-memory fixtures.
 */

// ---- Fixtures ----------------------------------------------------------------

const CHANGED_SYMBOLS = [
  { file: 'src/auth/token.ts', name: 'createToken', kind: 'function' },
  { file: 'src/auth/token.ts', name: 'verifyToken', kind: 'function' },
] as const;

/**
 * A minimal BlastResult that represents the PERSISTENT path:
 * - `degraded: false`
 * - `factsByFile` present with endpoints and crons keyed by caller file
 */
const PERSISTENT_BLAST: BlastResult = {
  changedSymbols: [...CHANGED_SYMBOLS],
  callers: [
    // createToken is called from two files
    {
      file: 'src/routes/login.ts',
      symbol: 'loginHandler',
      viaSymbol: 'createToken',
      line: 42,
      rank: 90,
    },
    {
      file: 'src/routes/refresh.ts',
      symbol: 'refreshHandler',
      viaSymbol: 'createToken',
      line: 18,
      rank: 70,
    },
    // verifyToken is called from a middleware file
    {
      file: 'src/middleware/auth.ts',
      symbol: 'authMiddleware',
      viaSymbol: 'verifyToken',
      line: 11,
      rank: 85,
    },
  ],
  impactedEndpoints: ['POST /login', 'POST /refresh', 'GET /protected'],
  factsByFile: {
    'src/routes/login.ts': {
      endpoints: ['POST /login'],
      crons: [],
    },
    'src/routes/refresh.ts': {
      endpoints: ['POST /refresh'],
      crons: ['0 0 * * * refreshExpiredTokens'],
    },
    'src/middleware/auth.ts': {
      endpoints: ['GET /protected'],
      crons: [],
    },
  },
  degraded: false,
};

/**
 * A BlastResult from the DEGRADED (ripgrep) path:
 * - `degraded: true`
 * - `factsByFile` absent (never populated on the ripgrep path)
 * - `impactedEndpoints` is the flat best-effort union
 */
const DEGRADED_BLAST: BlastResult = {
  changedSymbols: [...CHANGED_SYMBOLS],
  callers: [
    {
      file: 'src/routes/login.ts',
      symbol: 'loginHandler',
      viaSymbol: 'createToken',
      line: 42,
      rank: 0, // rank=0 on the ripgrep path
    },
  ],
  impactedEndpoints: ['POST /login', 'POST /refresh'],
  // factsByFile intentionally absent
  degraded: true,
  reason: 'no_data',
};

// ---- Tests ------------------------------------------------------------------

describe('mapBlastRadius', () => {
  // (1) Persistent path: factsByFile present → endpoints+crons attributed per symbol

  it('attributes endpoints and crons per symbol via factsByFile on the persistent path', () => {
    const result = mapBlastRadius(PERSISTENT_BLAST);

    // Must pass the shared Zod schema without throwing
    expect(() => BlastRadius.parse(result)).not.toThrow();

    // changed_symbols maps all three BlastChangedSymbol entries
    expect(result.changed_symbols).toHaveLength(2);
    expect(result.changed_symbols[0]).toEqual({
      name: 'createToken',
      file: 'src/auth/token.ts',
      kind: 'function',
    });
    expect(result.changed_symbols[1]).toEqual({
      name: 'verifyToken',
      file: 'src/auth/token.ts',
      kind: 'function',
    });

    // downstream has one entry per changed symbol (both have callers)
    expect(result.downstream).toHaveLength(2);

    // createToken entry
    const createTokenImpact = result.downstream.find((d) => d.symbol === 'createToken');
    expect(createTokenImpact).toBeDefined();
    expect(createTokenImpact!.callers).toHaveLength(2);
    expect(createTokenImpact!.callers.map((c) => c.name)).toEqual(
      expect.arrayContaining(['loginHandler', 'refreshHandler']),
    );
    // Endpoints attributed from factsByFile for login + refresh files
    expect(createTokenImpact!.endpoints_affected).toEqual(
      expect.arrayContaining(['POST /login', 'POST /refresh']),
    );
    // Cron attributed from refresh file's factsByFile
    expect(createTokenImpact!.crons_affected).toContain('0 0 * * * refreshExpiredTokens');

    // verifyToken entry
    const verifyTokenImpact = result.downstream.find((d) => d.symbol === 'verifyToken');
    expect(verifyTokenImpact).toBeDefined();
    expect(verifyTokenImpact!.callers).toHaveLength(1);
    expect(verifyTokenImpact!.callers[0]!.name).toBe('authMiddleware');
    expect(verifyTokenImpact!.endpoints_affected).toContain('GET /protected');
    // No crons on the auth middleware file
    expect(verifyTokenImpact!.crons_affected).toEqual([]);

    // Summary is a deterministic non-empty string
    expect(result.summary).toMatch(/\d+ symbol/);
    expect(result.summary).toMatch(/\d+ caller/);
    expect(result.summary).toMatch(/\d+ endpoint/);
  });

  // (2) Degraded path → crons empty, endpoints from impactedEndpoints

  it('returns empty crons_affected and falls back to impactedEndpoints on the degraded path', () => {
    const result = mapBlastRadius(DEGRADED_BLAST);

    // Must pass the shared Zod schema without throwing
    expect(() => BlastRadius.parse(result)).not.toThrow();

    expect(result.changed_symbols).toHaveLength(2);

    // Only createToken has a caller in this fixture
    const createTokenImpact = result.downstream.find((d) => d.symbol === 'createToken');
    expect(createTokenImpact).toBeDefined();

    // DEGRADED: crons must always be []
    expect(createTokenImpact!.crons_affected).toEqual([]);

    // DEGRADED: endpoints fall back to the flat impactedEndpoints list
    expect(createTokenImpact!.endpoints_affected).toEqual(
      expect.arrayContaining(['POST /login', 'POST /refresh']),
    );

    // verifyToken has no callers in this fixture → not in downstream
    const verifyTokenImpact = result.downstream.find((d) => d.symbol === 'verifyToken');
    expect(verifyTokenImpact).toBeUndefined();

    expect(result.summary).toMatch(/\d+ symbol/);
  });

  // (3) Empty input → empty-but-valid BlastRadius

  it('returns an empty-but-valid BlastRadius for empty input', () => {
    const emptyBlast: BlastResult = {
      changedSymbols: [],
      callers: [],
      impactedEndpoints: [],
      degraded: true,
      reason: 'no_data',
    };

    const result = mapBlastRadius(emptyBlast);

    // Must pass the shared Zod schema without throwing
    expect(() => BlastRadius.parse(result)).not.toThrow();

    expect(result.changed_symbols).toEqual([]);
    expect(result.downstream).toEqual([]);
    // Summary still has a valid template form even with zeroes
    expect(result.summary).toBe('0 symbols, 0 callers, 0 endpoints');
  });

  // (4) Summary format is deterministic

  it('builds a deterministic summary string with correct pluralisation', () => {
    const oneSymbol: BlastResult = {
      changedSymbols: [{ file: 'src/foo.ts', name: 'foo', kind: 'function' }],
      callers: [
        { file: 'src/bar.ts', symbol: 'bar', viaSymbol: 'foo', line: 1, rank: 0 },
      ],
      impactedEndpoints: ['GET /foo'],
      degraded: true,
    };

    const result = mapBlastRadius(oneSymbol);
    // Single counts should not be plural
    expect(result.summary).toBe('1 symbol, 1 caller, 1 endpoint');
  });

  // (5) Caller line numbers pass through correctly (BlastCallerRow.line → BlastCaller.line)

  it('maps BlastCallerRow fields to BlastCaller contract correctly', () => {
    const result = mapBlastRadius(PERSISTENT_BLAST);

    const createTokenImpact = result.downstream.find((d) => d.symbol === 'createToken')!;
    const loginCaller = createTokenImpact.callers.find((c) => c.name === 'loginHandler');
    expect(loginCaller).toBeDefined();
    expect(loginCaller!.file).toBe('src/routes/login.ts');
    expect(loginCaller!.line).toBe(42);

    const refreshCaller = createTokenImpact.callers.find((c) => c.name === 'refreshHandler');
    expect(refreshCaller).toBeDefined();
    expect(refreshCaller!.line).toBe(18);
  });
});
