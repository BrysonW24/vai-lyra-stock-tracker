import { NextRequest, NextResponse } from 'next/server';
import { complete, type AiProvider } from '@/lib/ai/gateway';
import { resolveAiCredentials } from '@/lib/ai/credentials';
import { chargeHostedBudgetShared } from '@/lib/ai/budget-tracker';
import { guardAiRoute } from '@/lib/api/ai-guard';
import { getDemoFinding } from '@/lib/findings/demo-findings';
import { getLiveFindings } from '@/lib/findings/server';
import { buildDefaultGenUIView, buildGenUIPrompt, validateGenUIView, type GenUIFraming } from '@/lib/findings/genui';
import { getUserConstraints } from '@/lib/ai/user-context';
import { loadTwinReflection } from '@/lib/twin/repo';
import type { Finding } from '@/lib/findings/types';

/**
 * GenUI-in-drawer compose endpoint. [Phase 4b]
 * Resolves the finding SERVER-SIDE (demo fixture or the user's live projected findings) so the numbers
 * are engine-owned, asks the model to compose only the LAYOUT (referencing allow-listed metric keys),
 * validates + fabrication-guards the result, and falls back to the deterministic default view when
 * there is no key or the model misbehaves. The view never contains a number Lyra did not compute.
 */

interface GenUIRequest {
  findingId: string;
  // mode is accepted from the client payload but ignored by resolveAiCredentials (provider-keyed).
  ai?: { provider?: AiProvider; apiKey?: string; model?: string };
}

async function resolveFinding(findingId: string): Promise<Finding | null> {
  const demo = getDemoFinding(findingId);
  if (demo) return demo;
  const live = await getLiveFindings().catch(() => [] as Finding[]);
  return live.find((f) => f.id === findingId) ?? null;
}

function parseJsonLoose(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await guardAiRoute<GenUIRequest>(request);
    if (!guard.ok) return guard.response;
    const body = guard.body;
    if (!body.findingId) return NextResponse.json({ ok: false, error: 'Missing finding id.' }, { status: 400 });

    const finding = await resolveFinding(body.findingId);
    if (!finding) return NextResponse.json({ ok: false, error: 'Finding not found.' }, { status: 404 });

    const fallback = buildDefaultGenUIView(finding);

    const creds = resolveAiCredentials(body.ai, { authenticated: guard.authenticated });
    if (!creds.apiKey) {
      return NextResponse.json({ ok: true, view: fallback, reason: 'no_key' });
    }

    // Hosted/shared key rides the house budget (was skipped here - any signed-in user could
    // burn the server key through GenUI with no ceiling); BYOK spends the user's own quota.
    // A budget block degrades to the deterministic default view, never an error.
    if (creds.source !== 'user') {
      const budget = await chargeHostedBudgetShared(creds.source, 800);
      if (budget.decision === 'block') return NextResponse.json({ ok: true, view: fallback, reason: 'budget' });
    }

    // Read-only twin framing (authenticated users only). It tunes emphasis, never the numbers.
    let framing: GenUIFraming | undefined;
    if (guard.authenticated) {
      const [constraints, twin] = await Promise.all([
        getUserConstraints().catch(() => null),
        loadTwinReflection().catch(() => null),
      ]);
      framing = {
        riskPosture: twin?.reconciliation.statedRisk && twin.reconciliation.statedRisk !== 'unknown'
          ? twin.reconciliation.statedRisk
          : constraints?.riskComfort,
        preferredSignalKinds: twin?.topSignalKinds.map((k) => k.label),
      };
    }

    try {
      const { text } = await complete({
        provider: creds.provider,
        apiKey: creds.apiKey,
        model: creds.model,
        system: 'You compose compact research UIs as strict JSON. You never invent numbers and never give financial advice.',
        prompt: buildGenUIPrompt(finding, framing),
        maxTokens: 500,
      });
      const validated = validateGenUIView(parseJsonLoose(text), finding);
      return NextResponse.json({ ok: true, view: validated ?? fallback });
    } catch {
      return NextResponse.json({ ok: true, view: fallback, reason: 'ai_error' });
    }
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
