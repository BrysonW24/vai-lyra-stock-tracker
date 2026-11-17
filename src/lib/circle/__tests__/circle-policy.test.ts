import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Structural invariants for the circle - the guarantees a refactor could break silently, asserted
 * from the source itself (the same idea as src/lib/ai/__tests__/policy-invariants.test.ts):
 *   * every circle module that asks a model guards what comes back (guardProse);
 *   * the conversation is charged per chat, so friends never share one allowance;
 *   * the circle only ever uses the free pool - never the hosted (paid) key or a caller's key;
 *   * nothing in the circle can reach an order, a broker or a setting.
 */
const DIR = join(process.cwd(), 'src', 'lib', 'circle');
const files = readdirSync(DIR).filter((name) => name.endsWith('.ts'));
const source = (name: string) => readFileSync(join(DIR, name), 'utf8');

describe('circle policy invariants', () => {
  it('found the circle modules', () => {
    expect(files).toEqual(expect.arrayContaining(['converse.ts', 'reads.ts', 'handle.ts', 'broadcast.ts', 'store.ts']));
  });

  it('every module that calls the pool guards the output', () => {
    const callers = files.filter((name) => /\bcompleteFromPool\s*\(/.test(source(name)));
    expect(callers.length).toBeGreaterThan(0);
    for (const name of callers) expect(source(name), `${name} calls the pool without guardProse`).toMatch(/\bguardProse\s*\(/);
  });

  it('charges the conversation to the chat, not to an IP address', () => {
    expect(source('converse.ts')).toMatch(/chargeCaps\(`tg:\$\{member\.chatId\}`\)/);
  });

  it('never reaches a paid or caller-supplied key', () => {
    for (const name of files) {
      const code = source(name);
      expect(code, name).not.toMatch(/resolveAiCredentials|answerWith|OPENAI_API_KEY|ANTHROPIC_API_KEY|@\/lib\/ai\/gateway/);
    }
  });

  it('cannot place an order or touch settings', () => {
    for (const name of files) expect(source(name), name).not.toMatch(/\b(?:create_order|submit_order|modify_position|change_settings)\b|@\/lib\/trading\//);
  });
});
