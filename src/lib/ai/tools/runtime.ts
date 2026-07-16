/**
 * Fail-closed tool runtime. The ONLY path an agent's tool call may take. Before dispatching it
 * checks canAgentUseTool() (which rejects forbidden tools, unknown tools, and any tool not granted
 * to that agent in AGENT_TOOL_MATRIX). Forbidden tools (create_order, modify_position, ...) have no
 * case here at all - they are structurally unrunnable. This is the runtime enforcement the policy
 * layer was designed for and a hard prerequisite for the paper-trading agent.
 */
import { canAgentUseTool } from '@/lib/ai/policy';
import type { AiAgentName, AiToolName } from '@/lib/ai/policy';
import { searchEvidence, readSignals, readConvergence, readPortfolioOwn, readThemes, readTradingTwin } from './index';

export class ToolDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolDeniedError';
  }
}

/**
 * Execute a read-only tool on behalf of an agent. Throws ToolDeniedError when the policy gate
 * rejects the call, so a denial is loud and auditable rather than silent.
 */
export async function executeTool(
  agent: AiAgentName,
  tool: AiToolName,
  args: Record<string, unknown> = {},
): Promise<unknown> {
  if (!canAgentUseTool(agent, tool)) {
    throw new ToolDeniedError(`agent "${agent}" is not permitted to use tool "${tool}"`);
  }
  switch (tool) {
    case 'search_evidence':
      return searchEvidence(String(args.query ?? ''), typeof args.limit === 'number' ? args.limit : 6);
    case 'read_signals':
      return readSignals(args.symbol ? String(args.symbol) : undefined);
    case 'read_convergence':
      return readConvergence(
        typeof args.limit === 'number' ? args.limit : 6,
        typeof args.minKinds === 'number' ? args.minKinds : 2,
      );
    case 'read_portfolio_own':
      return readPortfolioOwn();
    case 'read_themes':
      return readThemes(args.slug ? String(args.slug) : undefined);
    case 'read_trading_twin':
      return readTradingTwin();
    default:
      // Output-shaping tools (compose_alert_text, draft_research_note, classify_news,
      // explain_order_intent) are produced by the agent's own structured output, not executed here.
      throw new ToolDeniedError(`tool "${tool}" has no read-only runtime implementation`);
  }
}
