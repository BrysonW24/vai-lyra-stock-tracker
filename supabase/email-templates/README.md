# Lyra-branded auth emails

These replace Supabase's generic auth emails with Lyra branding (per the "nothing shipped unbranded"
rule). There are **two independent things** that make the default email say *"Supabase Auth"* with a
plain body:

| What you see | Controlled by | Needs |
|---|---|---|
| The email **body / look** | Supabase email **templates** | Dashboard only - do now |
| The **sender name** ("Supabase Auth") + from-address | The email **provider** | Custom **SMTP** (5-min setup) |

## 1. Brand the email body (no extra setup)

Supabase Dashboard → **Authentication → Email Templates**. For each template, set the **Subject** and
paste the matching HTML file's body (everything below its comment block):

| Template | Subject | File |
|---|---|---|
| Confirm signup | `Confirm your Lyra account` | `confirm-signup.html` |
| Magic Link | `Your Lyra sign-in link` | `magic-link.html` |
| Reset Password | `Reset your Lyra PIN` | `recovery.html` |

Save each. The next email sent uses the new look immediately. (Change Email / Invite can reuse the
same shell - copy `confirm-signup.html` and tweak the heading/copy.)

The templates use only Supabase's `{{ .ConfirmationURL }}` variable, use a table+inline-style layout
for email-client compatibility, and the brand gradient falls back to a solid `#1E63FF` button in
clients that strip gradients (Outlook), so the CTA always renders.

## 2. Rename the sender to "Lyra" (custom SMTP)

The from-name "Supabase Auth" + from-address come from the sending provider, so renaming needs custom
SMTP. Easiest path is **Resend** (generous free tier):

1. Create a Resend account → verify a domain (or use their onboarding domain to start).
2. Get SMTP credentials (host `smtp.resend.com`, port `465`, user `resend`, pass = your API key).
3. Supabase Dashboard → **Project Settings → Authentication → SMTP Settings** → enable custom SMTP:
   - **Sender name:** `Lyra`
   - **Sender email:** `noreply@<your-domain>` (or the Resend onboarding address to start)
   - Host / port / user / pass from step 2.
4. Save. New auth emails now arrive from **Lyra**, not Supabase Auth.

Until custom SMTP is configured, the body is fully Lyra-branded but the sender label stays
"Supabase Auth" (Supabase's shared sending domain).

> Tip: while testing, you can turn off email confirmation entirely at
> **Authentication → Sign In / Providers → Email → "Confirm email" (off)** so signups are instant -
> turn it back on before sharing the link publicly.
