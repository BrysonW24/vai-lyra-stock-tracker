import { afterEach, describe, expect, it, vi } from 'vitest';
import { deliverFeedback, forGitHubIssue, forSlack } from '@/lib/feedback';

/**
 * The GitHub sink's default target is this repository, which is public. Whatever is sent there is
 * published. The Slack sink is the private one.
 */
describe('feedback sinks', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function captureFetch() {
    const sent: Array<{ url: string; body: string; hasDeadline: boolean }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      sent.push({ url: String(url), body: String(init.body), hasDeadline: init.signal instanceof AbortSignal });
      return new Response(JSON.stringify({ html_url: 'https://github.com/o/r/issues/1', ok: true }), { status: 201 });
    }));
    return sent;
  }

  it('never puts the sender email in the (public) GitHub issue, and still gives it to Slack', async () => {
    vi.stubEnv('GITHUB_FEEDBACK_TOKEN', 'ghp_x');
    vi.stubEnv('GITHUB_FEEDBACK_REPO', 'owner/repo');
    vi.stubEnv('SLACK_FEEDBACK_WEBHOOK_URL', 'https://hooks.slack.com/services/T/B/x');
    const sent = captureFetch();

    await deliverFeedback({ type: 'bug', message: 'the chart is blank', email: 'private.person@example.com' });

    const github = sent.find((call) => call.url.includes('api.github.com'))!;
    const slack = sent.find((call) => call.url.includes('hooks.slack.com'))!;
    expect(github.body).not.toContain('private.person@example.com');
    expect(github.body).not.toContain('example.com');
    expect(slack.body).toContain('private.person@example.com');
  });

  it('gives every sink call a deadline', async () => {
    vi.stubEnv('GITHUB_FEEDBACK_TOKEN', 'ghp_x');
    vi.stubEnv('GITHUB_FEEDBACK_REPO', 'owner/repo');
    vi.stubEnv('SLACK_FEEDBACK_WEBHOOK_URL', 'https://hooks.slack.com/services/T/B/x');
    const sent = captureFetch();

    await deliverFeedback({ type: 'idea', message: 'hello', email: '' });

    expect(sent).toHaveLength(2);
    expect(sent.every((call) => call.hasDeadline)).toBe(true);
  });

  it('cannot be used to ping GitHub users or the Slack channel', () => {
    expect(forGitHubIssue('thanks @torvalds and @octocat')).not.toMatch(/@[a-z]/i);
    expect(forSlack('<!channel> urgent & <https://evil.example|click>')).toBe('&lt;!channel&gt; urgent &amp; &lt;https://evil.example|click&gt;');
  });
});
