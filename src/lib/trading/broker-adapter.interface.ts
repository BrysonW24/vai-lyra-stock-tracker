/**
 * Future broker adapter - INTERFACE ONLY. No live broker integration exists.
 *
 * Rules for any future implementation (see docs/integrations/broker-adapter-spec.md):
 * - API keys server-side only, in managed secret storage - never Supabase rows,
 *   never the frontend bundle, never logs.
 * - Sandbox/paper brokers before any live broker.
 * - Every call carries an idempotency key; retries must never duplicate orders.
 * - Every call and every error is written to execution_audit_logs.
 * - An adapter only ever receives an OrderIntent that already PASSED the deterministic
 *   pre-trade engine and (where configured) explicit human approval. AI has no path here.
 */
import type { OrderIntent, PreTradeReport } from './types';

export interface BrokerStatus {
  connected: boolean;
  brokerName: string;
  environment: 'none' | 'sandbox' | 'live';
  detail: string;
}

export interface BrokerExecutionResult {
  accepted: boolean;
  brokerOrderId?: string;
  detail: string;
}

export interface BrokerAdapter {
  getStatus(): Promise<BrokerStatus>;
  /** Must verify report.passed AND approval before anything else. */
  submitOrder(intent: OrderIntent, report: PreTradeReport, idempotencyKey: string): Promise<BrokerExecutionResult>;
  cancelOrder(brokerOrderId: string): Promise<BrokerExecutionResult>;
}

/** The only adapter that exists today: it refuses everything, loudly. */
export class NullBrokerAdapter implements BrokerAdapter {
  async getStatus(): Promise<BrokerStatus> {
    return {
      connected: false,
      brokerName: 'none',
      environment: 'none',
      detail: 'Live broker execution is not implemented. Paper trading and research only.',
    };
  }

  async submitOrder(): Promise<BrokerExecutionResult> {
    return { accepted: false, detail: 'Refused: live execution is disabled in this build.' };
  }

  async cancelOrder(): Promise<BrokerExecutionResult> {
    return { accepted: false, detail: 'Refused: live execution is disabled in this build.' };
  }
}
