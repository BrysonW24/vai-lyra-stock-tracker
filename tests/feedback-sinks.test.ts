import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { coerceFeedbackType, deliverFeedback } from '@/lib/feedback';

const ENV_KEYS = [
  'GITHUB_FEEDBACK_TOKEN',
  'GITHUB_FEEDBACK_REPO',
  'SLACK_FEEDBACK_WEBHOOK_URL',
  'SLACK_FEEDBACK_BOT_TOKEN',
  'SLACK_FEEDBACK_CHANNEL',
] as const;

const item = { type: 'bug' as const, message: 'The radar chart is blank on Safari', email: 'a@b.co' };

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('coerceFeedbackType', () => {
  it('maps unknown values to idea and passes known types through', () => {
    expect(coerceFeedbackType('bug')).toBe('bug');
    expect(coerceFeedbackType('other')).toBe('other');
    expect(coerceFeedbackType('idea')).toBe('idea');
    expect(coerceFeedbackType(undefined)).toBe('idea');
    expect(coerceFeedbackType('nonsense')).toBe('idea');
  });
});

describe('deliverFeedback', () => {
  it('log-only when no sink is configured - never throws, never fetches', async () => {
    const result = await deliverFeedback(item);
    expect(result).toEqual({ filed: false, url: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('files a GitHub issue when the GitHub sink is configured', async () => {
    process.env.GITHUB_FEEDBACK_TOKEN = 't';
    process.env.GITHUB_FEEDBACK_REPO = 'owner/repo';
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ html_url: 'https://github.com/owner/repo/issues/1' }), { status: 201 })
    );

    const result = await deliverFeedback(item);
    expect(result).toEqual({ filed: true, url: 'https://github.com/owner/repo/issues/1' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.github.com/repos/owner/repo/issues');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.labels).toEqual(['bug']);
    expect(body.title).toContain('Bug');
  });

  it('posts to a Slack webhook when configured, and includes the issue link when both sinks land', async () => {
    process.env.GITHUB_FEEDBACK_TOKEN = 't';
    process.env.GITHUB_FEEDBACK_REPO = 'owner/repo';
    process.env.SLACK_FEEDBACK_WEBHOOK_URL = 'https://hooks.slack.com/services/x/y/z';
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ html_url: 'https://github.com/owner/repo/issues/2' }), { status: 201 })
      )
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    const result = await deliverFeedback(item);
    expect(result.filed).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [slackUrl, slackInit] = fetchMock.mock.calls[1];
    expect(slackUrl).toBe('https://hooks.slack.com/services/x/y/z');
    const slackBody = JSON.parse((slackInit as RequestInit).body as string);
    expect(slackBody.text).toContain('The radar chart is blank on Safari');
    expect(slackBody.text).toContain('https://github.com/owner/repo/issues/2');
    // Header is shortcode + plain word - the literal emoji lives only in GitHub titles,
    // otherwise Slack shows the icon twice.
    expect(slackBody.text.startsWith(':beetle: *Bug* via in-app feedback')).toBe(true);
    expect(slackBody.text).not.toContain('🐞');
  });

  it('posts via chat.postMessage when a bot token + channel are configured', async () => {
    process.env.SLACK_FEEDBACK_BOT_TOKEN = 'xoxb-test';
    process.env.SLACK_FEEDBACK_CHANNEL = 'C0BH9L1M6KZ';
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const result = await deliverFeedback(item);
    expect(result).toEqual({ filed: true, url: null });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://slack.com/api/chat.postMessage');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.channel).toBe('C0BH9L1M6KZ');
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer xoxb-test' });
  });

  it('still files when one sink fails - sinks are independent', async () => {
    process.env.GITHUB_FEEDBACK_TOKEN = 't';
    process.env.GITHUB_FEEDBACK_REPO = 'owner/repo';
    process.env.SLACK_FEEDBACK_WEBHOOK_URL = 'https://hooks.slack.com/services/x/y/z';
    fetchMock
      .mockResolvedValueOnce(new Response('nope', { status: 401 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    const result = await deliverFeedback(item);
    expect(result).toEqual({ filed: true, url: null });
  });

  it('reports filed=false when every configured sink errors', async () => {
    process.env.SLACK_FEEDBACK_WEBHOOK_URL = 'https://hooks.slack.com/services/x/y/z';
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    const result = await deliverFeedback(item);
    expect(result).toEqual({ filed: false, url: null });
  });
});
