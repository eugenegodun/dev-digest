import { describe, it, expect } from 'vitest';
import { assemblePrompt } from './prompt.js';

const MINIMAL_PARTS = {
  system: 'You are a code reviewer.',
  diff: 'diff --git a/foo.ts b/foo.ts\n+const x = 1;',
};

describe('assemblePrompt', () => {
  it('returns tokens_by_block with at least system and user keys', () => {
    const { assembly } = assemblePrompt(MINIMAL_PARTS);
    expect(assembly.tokens_by_block).toBeDefined();
    expect(assembly.tokens_by_block?.system).toBeGreaterThan(0);
    expect(assembly.tokens_by_block?.user).toBeGreaterThan(0);
  });

  it('returns tokens_total as sum of system + user chars / 4', () => {
    const { assembly, messages } = assemblePrompt(MINIMAL_PARTS);
    const sysMsg = messages.find((m) => m.role === 'system')?.content ?? '';
    const userMsg = messages.find((m) => m.role === 'user')?.content ?? '';
    expect(assembly.tokens_total).toBe(Math.ceil((sysMsg.length + userMsg.length) / 4));
  });

  it('includes skills key in tokens_by_block when skills are provided', () => {
    const { assembly } = assemblePrompt({
      ...MINIMAL_PARTS,
      skills: ['## Rule 1\nDo not allow raw SQL.', '## Rule 2\nRequire error handling.'],
    });
    expect(assembly.tokens_by_block?.skills).toBeDefined();
    expect(assembly.tokens_by_block?.skills).toBeGreaterThan(0);
    // skills block content in assembly should be non-null
    expect(assembly.skills).not.toBeNull();
  });

  it('omits skills key from tokens_by_block when no skills provided', () => {
    const { assembly } = assemblePrompt(MINIMAL_PARTS);
    expect(assembly.tokens_by_block?.skills).toBeUndefined();
    expect(assembly.skills).toBeNull();
  });

  it('omits skills key from tokens_by_block when empty skills array provided', () => {
    const { assembly } = assemblePrompt({ ...MINIMAL_PARTS, skills: [] });
    expect(assembly.tokens_by_block?.skills).toBeUndefined();
    expect(assembly.skills).toBeNull();
  });

  it('approximate token counts use chars/4 heuristic', () => {
    const text = 'a'.repeat(400);
    const { assembly } = assemblePrompt({
      ...MINIMAL_PARTS,
      skills: [text],
    });
    expect(assembly.tokens_by_block?.skills).toBe(100); // 400 / 4
  });

  it('includes memory key in tokens_by_block when memory is provided', () => {
    const { assembly } = assemblePrompt({
      ...MINIMAL_PARTS,
      memory: ['rate-limit public endpoints'],
    });
    expect(assembly.tokens_by_block?.memory).toBeDefined();
    expect(assembly.tokens_by_block?.memory).toBeGreaterThan(0);
  });

  it('omits memory key when no memory provided', () => {
    const { assembly } = assemblePrompt(MINIMAL_PARTS);
    expect(assembly.tokens_by_block?.memory).toBeUndefined();
  });

  it('includes pr_description key when prDescription is provided', () => {
    const { assembly } = assemblePrompt({
      ...MINIMAL_PARTS,
      prDescription: 'This PR adds a feature.',
    });
    expect(assembly.tokens_by_block?.pr_description).toBeDefined();
    expect(assembly.tokens_by_block?.pr_description).toBeGreaterThan(0);
  });

  it('assembles system message with injection guard appended', () => {
    const { messages, assembly } = assemblePrompt(MINIMAL_PARTS);
    expect(assembly.system).toContain('SECURITY');
    expect(messages[0]?.role).toBe('system');
    expect(messages[0]?.content).toContain('SECURITY');
  });

  it('assembles user message with diff section', () => {
    const { messages } = assemblePrompt(MINIMAL_PARTS);
    expect(messages[1]?.role).toBe('user');
    expect(messages[1]?.content).toContain('Diff to review');
    expect(messages[1]?.content).toContain('diff --git');
  });
});
