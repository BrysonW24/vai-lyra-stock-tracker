/**
 * Notification delivery audit log - every send attempt is recorded.  [NOTIF-03]
 *
 * Append-only by design: sent, failed, suppressed, and demo-logged attempts all
 * land here so the full delivery history of any event is reconstructable. The
 * store is pluggable - the in-memory default is swapped for a Supabase-backed
 * writer over an `outbound_messages` table at boot via
 * `setNotificationAuditStore`, and no call site changes. The interface is
 * Promise-based for exactly that reason.
 *
 * No secrets ever belong in a DeliveryRecord - destinations are chat ids /
 * phone numbers, never tokens.
 */
import type { DeliveryRecord } from './types';

/** Contract any persistence backend (in-memory, Supabase, ...) must satisfy. */
export interface NotificationAuditStore {
  /** Append one delivery attempt. Never mutates or replaces prior records. */
  recordDelivery(record: DeliveryRecord): Promise<void>;
  /** All delivery attempts for a user, newest first. */
  listDeliveries(userId: string): Promise<DeliveryRecord[]>;
}

/** Default store - process-local, suitable for dev, demo mode, and tests. */
export class InMemoryNotificationAuditStore implements NotificationAuditStore {
  private records: DeliveryRecord[] = [];

  recordDelivery(record: DeliveryRecord): Promise<void> {
    // Defensive copy so later caller-side mutation cannot rewrite the log.
    this.records.push({ ...record });
    return Promise.resolve();
  }

  listDeliveries(userId: string): Promise<DeliveryRecord[]> {
    const matches = this.records
      .filter((record) => record.userId === userId)
      .map((record) => ({ ...record }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return Promise.resolve(matches);
  }

  /** Test/demo helper - wipe the log. Not part of NotificationAuditStore. */
  clear(): void {
    this.records = [];
  }

  /** Total records across all users. Not part of NotificationAuditStore. */
  get size(): number {
    return this.records.length;
  }
}

let activeStore: NotificationAuditStore = new InMemoryNotificationAuditStore();

/** Swap the backing store (e.g. for the Supabase outbound_messages writer) at boot. */
export function setNotificationAuditStore(store: NotificationAuditStore): void {
  activeStore = store;
}

/** The currently active store - mainly for diagnostics and tests. */
export function getNotificationAuditStore(): NotificationAuditStore {
  return activeStore;
}

/** Restore the in-memory default - test isolation helper. */
export function resetNotificationAuditStore(): void {
  activeStore = new InMemoryNotificationAuditStore();
}

/** Record one delivery attempt against the active store. */
export function recordDelivery(record: DeliveryRecord): Promise<void> {
  return activeStore.recordDelivery(record);
}

/** List a user's delivery attempts (newest first) from the active store. */
export function listDeliveries(userId: string): Promise<DeliveryRecord[]> {
  return activeStore.listDeliveries(userId);
}
