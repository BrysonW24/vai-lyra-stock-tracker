/**
 * The briefing subscription's confirmation email - the same brand shell as the auth emails
 * (supabase/email-templates/*.html): table layout, inline styles, a solid-colour fallback behind
 * the gradient button so the CTA renders in clients that strip gradients. Every value that came
 * from the form is escaped before it is placed in markup.
 */
import { escapeHtml } from '@/lib/notifications/telegram-templates';

export interface ConfirmEmailInput {
  confirmUrl: string;
  /** Plain-language summary of what they asked for (describeSubscription). */
  summary: string;
}

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

export function confirmSubscriptionEmail({ confirmUrl, summary }: ConfirmEmailInput): EmailContent {
  const url = escapeHtml(confirmUrl);
  const what = escapeHtml(summary);
  const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F6F2;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;border:1px solid #e7e9ef;overflow:hidden;">
        <tr><td style="height:4px;background-color:#1E63FF;background:linear-gradient(90deg,#3b5bdb,#43d18b,#f3a33a);">&nbsp;</td></tr>
        <tr>
          <td style="padding:30px 32px 6px;">
            <span style="font-size:22px;font-weight:700;letter-spacing:-0.02em;color:#0E1E3A;">Lyra</span>
            <span style="font-size:12px;color:#8290a0;">&nbsp; by Vivacity.ai</span>
          </td>
        </tr>
        <tr>
          <td style="padding:6px 32px 0;">
            <h1 style="margin:0;font-size:22px;line-height:1.25;color:#0E1E3A;font-weight:600;">Confirm your evening briefing</h1>
            <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#5A6B82;">One tap and the AI briefing starts arriving around 8pm Sydney, Tuesday to Saturday: what moved in AI for investors, every item checked against the source it came from. You asked for ${what}.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 6px;">
            <a href="${url}" style="display:inline-block;background-color:#1E63FF;background:linear-gradient(90deg,#3b5bdb,#43d18b,#f3a33a);color:#07090c;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:0.06em;text-transform:uppercase;padding:14px 28px;border-radius:10px;">Start my briefing &rarr;</a>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 32px 0;">
            <p style="margin:0;font-size:12px;line-height:1.6;color:#8290a0;">Or paste this link into your browser:<br><a href="${url}" style="color:#1E63FF;word-break:break-all;">${url}</a></p>
          </td>
        </tr>
        <tr>
          <td style="padding:22px 32px 30px;">
            <div style="border-top:1px solid #eef0f4;padding-top:16px;">
              <p style="margin:0;font-size:11px;line-height:1.6;color:#9aa6b6;">If you didn't ask for this, ignore it - nothing is sent until the link is opened. Every briefing carries an unsubscribe link.<br>Lyra is research software, not financial advice. &copy; Vivacity.ai</p>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
  const text = [
    'Confirm your Lyra evening briefing',
    '',
    `Open this link to start receiving the AI briefing around 8pm Sydney, Tuesday to Saturday (${summary}):`,
    confirmUrl,
    '',
    "If you didn't ask for this, ignore it - nothing is sent until the link is opened. Every briefing carries an unsubscribe link.",
    'Lyra is research software, not financial advice.',
  ].join('\n');
  return { subject: 'Confirm your Lyra evening briefing', html, text };
}
