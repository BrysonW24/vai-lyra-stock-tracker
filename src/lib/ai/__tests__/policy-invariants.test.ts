import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Structural policy invariants - the guarantees that a code change (a new route, a refactor) can
 * SILENTLY break. These assert, from the source itself, that no AI surface reaches the model without
 * (a) an auth/credential gate and (b) an output guard, and that the guard delegates actually guard.
 * If someone adds a route that calls the gateway raw, this goes red.
 */
const API_ROOT = join(process.cwd(), 'src', 'app', 'api');

function walkRoutes(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walkRoutes(p));
    else if (entry === 'route.ts') out.push(p);
  }
  return out;
}

const ROUTE_FILES = walkRoutes(API_ROOT);
const src = (f: string) => readFileSync(f, 'utf8');

// A route reaches the model if it calls the gateway directly or delegates to a model-calling helper.
function reachesModel(code: string): boolean {
  return /\bcomplete\s*\(/.test(code) || /\brun(?:ResearchAnalyst|TradeReadiness|PaperBotCommand|Structured)\b/.test(code);
}
const callsGatewayDirectly = (code: string) => /\bcomplete\s*\(/.test(code) && /@\/lib\/ai\/gateway/.test(code);

const AUTH_GATES = /\bguardAiRoute\b|\bresolveAiCredentials\b|\bgetSessionUser\b/;
const OUTPUT_GUARDS = /\bguardProse\b|\bevaluateGuardrails\b|\bvalidateGenUIView\b|\bvalidateAgentOutput\b/;

describe('AI policy invariants · routes', () => {
  it('found the AI route surface', () => {
    expect(ROUTE_FILES.length).toBeGreaterThan(3);
  });

  it('every model-reaching route is auth/credential gated', () => {
    const offenders = ROUTE_FILES.filter((f) => reachesModel(src(f)) && !AUTH_GATES.test(src(f)));
    expect(offenders, `ungated model routes: ${offenders.join(', ')}`).toEqual([]);
  });

  it('every route that calls the gateway directly guards its output', () => {
    const offenders = ROUTE_FILES.filter((f) => callsGatewayDirectly(src(f)) && !OUTPUT_GUARDS.test(src(f)));
    expect(offenders, `unguarded-output gateway routes: ${offenders.join(', ')}`).toEqual([]);
  });

  it('no route imports a forbidden tool as an executable path', () => {
    // create_order / submit_order / modify_position have no implementation; a route referencing one
    // as a call would be a red flag. (They may appear in comments/policy - match call-shaped usage.)
    const offenders = ROUTE_FILES.filter((f) => /\b(?:create_order|submit_order|modify_position)\s*\(/.test(src(f)));
    expect(offenders).toEqual([]);
  });
});

describe('AI policy invariants · guard delegates actually guard', () => {
  it('run-agent enforces the guardrails verdict + schema validation', () => {
    const code = src(join(process.cwd(), 'src', 'lib', 'ai', 'run-agent.ts'));
    expect(code).toMatch(/evaluateGuardrails/);
    expect(code).toMatch(/validateAgentOutput/);
  });

  it('the free-text prose guard runs the full guardrails engine', () => {
    const code = src(join(process.cwd(), 'src', 'lib', 'ai', 'guardrails', 'prose.ts'));
    expect(code).toMatch(/evaluateGuardrails/);
  });
});
