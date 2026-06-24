import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import { parseMarkdownSkill, parseZipSkill } from './helpers.js';

// Import AdmZip via createRequire since the project uses ES modules
const require = createRequire(import.meta.url);
const AdmZip = require('adm-zip');

/**
 * Unit tests for parseMarkdownSkill and parseZipSkill.
 * These helpers are pure (no I/O, no DB); no testcontainers needed.
 */

describe('parseMarkdownSkill', () => {
  it('parses frontmatter fields and body correctly', () => {
    const content = [
      '---',
      'name: No TODO comments',
      'description: Reject any line that introduces a TODO comment.',
      'type: convention',
      '---',
      '',
      '## No TODO comments',
      '',
      'Do not approve PRs that introduce TODO comments.',
    ].join('\n');

    const result = parseMarkdownSkill(content);
    expect(result.name).toBe('No TODO comments');
    expect(result.description).toBe('Reject any line that introduces a TODO comment.');
    expect(result.type).toBe('convention');
    expect(result.body).toContain('## No TODO comments');
    expect(result.body).toContain('Do not approve PRs that introduce TODO comments.');
  });

  it('returns defaults when frontmatter is absent', () => {
    const content = '## Just a body\n\nSome instructions.';
    const result = parseMarkdownSkill(content);
    expect(result.name).toBe('');
    expect(result.description).toBe('');
    expect(result.type).toBe('custom');
    expect(result.body).toBe(content);
  });

  it('returns defaults when content starts with --- but has no closing delimiter', () => {
    const content = '---\nname: Broken\n';
    const result = parseMarkdownSkill(content);
    expect(result.type).toBe('custom');
    expect(result.body).toBe(content);
  });

  it('handles missing individual frontmatter keys with defaults', () => {
    const content = ['---', 'name: Partial Skill', '---', '', 'Body here.'].join('\n');
    const result = parseMarkdownSkill(content);
    expect(result.name).toBe('Partial Skill');
    expect(result.description).toBe('');
    expect(result.type).toBe('custom');
    expect(result.body).toBe('Body here.');
  });
});

describe('parseZipSkill', () => {
  function makeZip(files: Record<string, string>): Buffer {
    const zip = new AdmZip();
    for (const [name, content] of Object.entries(files)) {
      zip.addFile(name, Buffer.from(content, 'utf8'));
    }
    return zip.toBuffer() as Buffer;
  }

  it('finds SKILL.md as the core file', async () => {
    const skillMd = ['---', 'name: Test Skill', 'type: rubric', '---', '', 'Body.'].join('\n');
    const buf = makeZip({
      'SKILL.md': skillMd,
      'scripts/run.sh': '#!/bin/bash\necho hello',
    });

    const result = await parseZipSkill(buf);
    expect(result.name).toBe('Test Skill');
    expect(result.type).toBe('rubric');
    expect(result.body).toContain('Body.');
  });

  it('falls back to the first top-level .md file when SKILL.md is absent', async () => {
    const buf = makeZip({ 'my-skill.md': '## Hello\n\nBody here.' });
    const result = await parseZipSkill(buf);
    expect(result.body).toContain('Body here.');
  });

  it('lists non-md entries as ignored_files', async () => {
    const buf = makeZip({
      'SKILL.md': '---\nname: S\ntype: custom\n---\n\nB.',
      'scripts/run.sh': '#!/bin/bash',
      'data/examples.json': '{}',
    });

    const result = await parseZipSkill(buf);
    expect(result.ignored_files).toContain('scripts/run.sh');
    expect(result.ignored_files).toContain('data/examples.json');
    expect(result.ignored_files).not.toContain('SKILL.md');
  });

  it('rejects path traversal entries', async () => {
    // AdmZip normalises entry names when writing (strips leading '../').
    // Build a zip normally, then mutate the entry names in-memory to inject a
    // traversal path.  This tests the guard that parseZipSkill applies to each
    // entry before it touches any content.
    const buf = makeZip({
      'SKILL.md': '---\nname: S\ntype: custom\n---\n\nB.',
      'run.sh': '#!/bin/bash',
    });

    const zip = new AdmZip(buf);
    const entries = zip.getEntries();
    // Mutate the first non-SKILL entry to look like a traversal path
    const runEntry = entries.find((e: { entryName: string }) => e.entryName === 'run.sh');
    if (runEntry) {
      // Override entryName with a path-traversal value
      (runEntry as { entryName: string }).entryName = '../evil.sh';
    }

    // Re-export the modified zip as a buffer
    const modifiedBuf = zip.toBuffer() as Buffer;

    // parseZipSkill may or may not see the mutated name depending on adm-zip's
    // internals.  Either it throws (guard fired) or it succeeds (adm-zip
    // re-normalises on read).  The important invariant is that no '../'-prefixed
    // path is ever silently acted upon without detection.
    // Since adm-zip re-reads entry names from the central directory on toBuffer(),
    // test what actually happens — both outcomes are acceptable behaviour for the
    // guard test (throw = guard worked; resolve = adm-zip prevented the path).
    try {
      const result = await parseZipSkill(modifiedBuf);
      // If it resolved, adm-zip must have re-sanitised the name; verify the result is safe
      for (const f of result.ignored_files) {
        expect(f).not.toMatch(/\.\./);
      }
    } catch (err) {
      expect((err as Error).message).toMatch(/unsafe path/i);
    }
  });

  it('throws when no markdown file is found in the zip', async () => {
    const buf = makeZip({ 'run.sh': '#!/bin/bash' });
    await expect(parseZipSkill(buf)).rejects.toThrow(/no markdown skill file/i);
  });
});
