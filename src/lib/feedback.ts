/**
 * Server-side feedback delivery. The in-app feedback box (one textarea, no account
 * needed) fans out to whichever sinks are configured via env; with none configured
 * it just logs so nothing is ever lost while wiring things up.
 *
 * Sinks:
 *  - GitHub issue:  GITHUB_FEEDBACK_TOKEN (fine-grained PAT, Issues write)
 *                   + GITHUB_FEEDBACK_REPO ("owner/repo")
 *  - Slack message: SLACK_FEEDBACK_WEBHOOK_URL (incoming webhook - simplest), or
 *                   SLACK_FEEDBACK_BOT_TOKEN + SLACK_FEEDBACK_CHANNEL (chat.postMessage)
 *
 * All sinks are attempted independently; `filed` is true if at least one landed.
 * Keep this module dependency-free - it runs inside a route handler.
 */

export type FeedbackType = 'idea' | 'bug' | 'other';

export interface FeedbackItem {
  type: FeedbackType;
  message: string;
  email: string;
}

export interface FeedbackDelivery {
  filed: boolean;
  /** GitHub issue URL when that sink succeeded (the only sink with a linkable result). */
  url: string | null;
}

// `tag` (emoji included) titles the GitHub issue; Slack renders `emoji` + plain `name`
// instead, because prefixing the shortcode onto the emoji-bearing tag doubled the icon.
const TAGS: Record<FeedbackType, { tag: string; name: string; label: string; emoji: string }> = {
  bug: { tag: '🐞 Bug', name: 'Bug', label: 'bug', emoji: ':beetle:' },
  other: { tag: '💬 Feedback', name: 'Feedback', label: 'feedback', emoji: ':speech_balloon:' },
  idea: { tag: '💡 Idea', name: 'Idea', label: 'enhancement', emoji: ':bulb:' },
};

export function coerceFeedbackType(raw: unknown): FeedbackType {
  return raw === 'bug' ? 'bug' : raw === 'other' ? 'other' : 'idea';
}

async function fileGitHubIssue(item: FeedbackItem): Promise<{ ok: boolean; url: string | null }> {
  const token = process.env.GITHUB_FEEDBACK_TOKEN;
  const repo = process.env.GITHUB_FEEDBACK_REPO; // "owner/repo"
  if (!token || !repo) return { ok: false, url: null };

  const { tag, label } = TAGS[item.type];
  const snippet = item.message.replace(/\s+/g, ' ').slice(0, 60);
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'lyra-feedback',
      },
      body: JSON.stringify({
        title: `${tag}: ${snippet}${item.message.length > 60 ? '…' : ''}`,
        body: `${item.message}\n\n---\n_Submitted via in-app feedback${item.email ? ` · contact: ${item.email}` : ''}._`,
        labels: [label],
      }),
    });
    if (!res.ok) {
      console.warn('[feedback] GitHub issue failed:', res.status, await res.text());
      return { ok: false, url: null };
    }
    const issue = (await res.json()) as { html_url?: string };
    return { ok: true, url: issue.html_url ?? null };
  } catch (error) {
    console.warn('[feedback] GitHub issue error:', error);
    return { ok: false, url: null };
  }
}

function slackText(item: FeedbackItem, issueUrl: string | null): string {
  const { name, emoji } = TAGS[item.type];
  const lines = [`${emoji} *${name}* via in-app feedback`, '', item.message];
  if (item.email) lines.push('', `Contact: ${item.email}`);
  if (issueUrl) lines.push('', `GitHub issue: ${issueUrl}`);
  return lines.join('\n');
}

async function postToSlack(item: FeedbackItem, issueUrl: string | null): Promise<boolean> {
  const webhook = process.env.SLACK_FEEDBACK_WEBHOOK_URL;
  const botToken = process.env.SLACK_FEEDBACK_BOT_TOKEN;
  const channel = process.env.SLACK_FEEDBACK_CHANNEL;

  try {
    if (webhook) {
      const res = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: slackText(item, issueUrl) }),
      });
      if (res.ok) return true;
      console.warn('[feedback] Slack webhook failed:', res.status, await res.text());
      return false;
    }
    if (botToken && channel) {
      const res = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${botToken}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({ channel, text: slackText(item, issueUrl) }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) return true;
      console.warn('[feedback] Slack postMessage failed:', res.status, data.error ?? '');
      return false;
    }
  } catch (error) {
    console.warn('[feedback] Slack error:', error);
  }
  return false;
}

/** Fan the item out to every configured sink; log-only when none are configured. */
export async function deliverFeedback(item: FeedbackItem): Promise<FeedbackDelivery> {
  const github = await fileGitHubIssue(item);
  const slack = await postToSlack(item, github.url);

  if (!github.ok && !slack) {
    console.log('[feedback]', { type: item.type, email: item.email, message: item.message });
  }
  return { filed: github.ok || slack, url: github.url };
}
