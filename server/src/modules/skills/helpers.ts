import AdmZip from 'adm-zip';
import type { Skill, SkillType, SkillSource } from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import type { SkillRow } from '../../db/rows.js';
import type { UpdateSkill } from './repository.js';

/**
 * Pure helpers for the skills module — DB row ⇄ DTO mapping and the
 * body-version-bump rule. No I/O; body_tokens is computed via the injected tokenizer.
 */

// ---- Import parsing helpers ----

export interface ParsedSkill {
  name: string;
  description: string;
  type: string;
  body: string;
}

export interface ParsedZipSkill extends ParsedSkill {
  ignored_files: string[];
}

/** Safety limits for zip extraction. */
const ZIP_MAX_ENTRIES = 50;
const ZIP_MAX_ENTRY_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Parse a markdown skill file.
 * Extracts YAML frontmatter fields: name, description, type.
 * Body = everything after the closing `---` delimiter.
 * When frontmatter is absent, returns defaults: name='', description='', type='custom'.
 */
export function parseMarkdownSkill(content: string): ParsedSkill {
  const DELIMITER = '---';

  // Must start with '---' and contain a second '---'
  if (!content.startsWith(DELIMITER + '\n') && !content.startsWith(DELIMITER + '\r\n')) {
    return { name: '', description: '', type: 'custom', body: content };
  }

  // Find the closing delimiter
  const afterOpening = content.indexOf('\n') + 1;
  const closingIdx = content.indexOf('\n' + DELIMITER, afterOpening);
  if (closingIdx === -1) {
    return { name: '', description: '', type: 'custom', body: content };
  }

  const frontmatterRaw = content.slice(afterOpening, closingIdx);
  const bodyStart = closingIdx + '\n'.length + DELIMITER.length;
  // Strip the newline right after the closing delimiter and any blank lines before the body
  const bodyRaw = content.slice(bodyStart).replace(/^(\r?\n)+/, '');

  // Parse frontmatter as simple key: value pairs (no nested YAML)
  const fm: Record<string, string> = {};
  for (const line of frontmatterRaw.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key) fm[key] = val;
  }

  return {
    name: fm['name'] ?? '',
    description: fm['description'] ?? '',
    type: fm['type'] ?? 'custom',
    body: bodyRaw,
  };
}

/**
 * Parse a zip archive that wraps a skill.
 * Safety: ≤50 entries, ≤10 MB per entry, no path traversal.
 * Locates SKILL.md (preferred) or the first top-level .md file as the skill core.
 * All non-core entries are listed as ignored_files.
 */
export async function parseZipSkill(buffer: Buffer): Promise<ParsedZipSkill> {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();

  if (entries.length > ZIP_MAX_ENTRIES) {
    throw new Error(`Zip contains too many entries (max ${ZIP_MAX_ENTRIES})`);
  }

  // Security: reject path traversal entries
  for (const entry of entries) {
    const name = entry.entryName;
    if (name.includes('..') || name.startsWith('/') || name.startsWith('\\')) {
      throw new Error(`Zip entry has unsafe path: ${name}`);
    }
  }

  // Find the skill core: SKILL.md first, then first top-level .md
  let coreEntry = entries.find(
    (e) => !e.isDirectory && e.entryName.toLowerCase() === 'skill.md',
  );
  if (!coreEntry) {
    coreEntry = entries.find(
      (e) =>
        !e.isDirectory &&
        e.entryName.toLowerCase().endsWith('.md') &&
        !e.entryName.includes('/'),
    );
  }

  if (!coreEntry) {
    throw new Error('No markdown skill file found in zip (expected SKILL.md or a top-level .md file)');
  }

  // Check size limit
  if (coreEntry.header.size > ZIP_MAX_ENTRY_BYTES) {
    throw new Error(`Skill file too large (max 10 MB)`);
  }

  const coreContent = coreEntry.getData().toString('utf8');
  const parsed = parseMarkdownSkill(coreContent);

  // Ignored files: all entries except the core
  const ignored_files = entries
    .filter((e) => e.entryName !== coreEntry!.entryName && !e.isDirectory)
    .map((e) => e.entryName);

  return { ...parsed, ignored_files };
}

/** Map a persisted skill row to the public `Skill` DTO. */
export function toSkillDto(row: SkillRow, container: Container): Skill {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type as SkillType,
    source: row.source as SkillSource,
    body: row.body,
    enabled: row.enabled,
    version: row.version,
    evidence_files: (row.evidenceFiles ?? null) as string[] | null,
    body_tokens: container.tokenizer.count(row.body),
  };
}

/**
 * True when a patch changes config (body/type/description) relative to the
 * existing row — a config change bumps the version and snapshots skill_versions.
 * enabled-only changes do NOT bump.
 */
export function isConfigChange(existing: SkillRow, patch: UpdateSkill): boolean {
  return (
    (patch.body !== undefined && patch.body !== existing.body) ||
    (patch.type !== undefined && patch.type !== existing.type) ||
    (patch.description !== undefined && patch.description !== existing.description)
  );
}
