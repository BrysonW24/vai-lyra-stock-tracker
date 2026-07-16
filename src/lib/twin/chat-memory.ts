/**
 * Cross-session conversational memory. Durable, owner-only (RLS) chat_turns the copilot can recall on
 * a fresh session so a returning user is not a cold start. OPT-IN: both read and write are gated by
 * user_settings.twin_capture_enabled (the same consent switch as attention capture), so nothing is
 * stored or recalled until the user turns it on. Best-effort throughout - never blocks a chat.
 */
import { createSupabaseServerClient } from '@/lib/supabase/server';

const MAX_CONTENT = 4000;

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** Resolve the signed-in, opted-in user + client, or null (unsigned / unconfigured / not opted in). */
async function memoryContext() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;
  const { data: settings } = await supabase
    .from('user_settings')
    .select('twin_capture_enabled')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!settings?.twin_capture_enabled) return null;
  return { supabase, userId: user.id };
}

/** The user's most recent persisted turns, oldest-first, or [] when unavailable / not opted in. */
export async function loadRecentChatTurns(limit = 8): Promise<ChatTurn[]> {
  try {
    const c = await memoryContext();
    if (!c) return [];
    const { data } = await c.supabase
      .from('chat_turns')
      .select('role, content')
      .eq('user_id', c.userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return (data ?? [])
      .reverse()
      .map((r): ChatTurn => ({
        role: (r as { role?: string }).role === 'assistant' ? 'assistant' : 'user',
        content: String((r as { content?: unknown }).content ?? ''),
      }))
      .filter((t) => t.content.trim().length > 0);
  } catch {
    return [];
  }
}

/** Persist turns best-effort. No-op when not signed in / not opted in. */
export async function appendChatTurns(turns: ChatTurn[]): Promise<void> {
  try {
    const c = await memoryContext();
    if (!c) return;
    const rows = turns
      .filter((t) => t.content?.trim().length > 0)
      .map((t) => ({ user_id: c.userId, role: t.role, content: t.content.slice(0, MAX_CONTENT) }));
    if (rows.length) await c.supabase.from('chat_turns').insert(rows);
  } catch {
    /* best-effort; a failed persist never affects the reply */
  }
}
