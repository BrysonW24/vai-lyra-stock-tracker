import { type NextRequest, NextResponse } from 'next/server';

/**
 * In-app feedback intake. The point: a non-technical user types one box and hits
 * send - and it lands as a clean GitHub issue in your repo (no GitHub account
 * needed on their end). Set GITHUB_FEEDBACK_TOKEN (a fine-grained PAT with Issues
 * write) + GITHUB_FEEDBACK_REPO ("owner/repo") to enable. Without them it just
 * logs, so nothing is lost while you wire it up (swap for a Supabase insert later).
 */

type FeedbackType = 'idea' | 'bug' | 'other';

export async function POST(request: NextRequest) {
  let body: { type?: string; message?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 });
  }

  const message = (body.message ?? '').trim();
  if (!message) return NextResponse.json({ ok: false, error: 'Please enter a message.' }, { status: 400 });
  if (message.length > 4000) return NextResponse.json({ ok: false, error: 'Message too long.' }, { status: 400 });

  const type: FeedbackType = body.type === 'bug' ? 'bug' : body.type === 'other' ? 'other' : 'idea';
  const email = (body.email ?? '').trim().slice(0, 200);

  const token = process.env.GITHUB_FEEDBACK_TOKEN;
  const repo = process.env.GITHUB_FEEDBACK_REPO; // "owner/repo"

  if (token && repo) {
    try {
      const tag = type === 'bug' ? '🐞 Bug' : type === 'other' ? '💬 Feedback' : '💡 Idea';
      const label = type === 'bug' ? 'bug' : type === 'other' ? 'feedback' : 'enhancement';
      const snippet = message.replace(/\s+/g, ' ').slice(0, 60);
      const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': 'lyra-feedback',
        },
        body: JSON.stringify({
          title: `${tag}: ${snippet}${message.length > 60 ? '…' : ''}`,
          body: `${message}\n\n---\n_Submitted via in-app feedback${email ? ` · contact: ${email}` : ''}._`,
          labels: [label],
        }),
      });
      if (!res.ok) {
        console.warn('[feedback] GitHub issue failed:', res.status, await res.text());
        return NextResponse.json({ ok: true, filed: false });
      }
      const issue = (await res.json()) as { html_url?: string };
      return NextResponse.json({ ok: true, filed: true, url: issue.html_url ?? null });
    } catch (error) {
      console.warn('[feedback] issue error:', error);
      return NextResponse.json({ ok: true, filed: false });
    }
  }

  console.log('[feedback]', { type, email, message });
  return NextResponse.json({ ok: true, filed: false });
}
