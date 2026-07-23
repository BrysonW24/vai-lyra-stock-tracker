'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, CircleAlert } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { BrandLogo } from '@/components/BrandLogo';

const inputClass =
  'w-full rounded-md border border-[#263241] bg-[#0b1016] px-3 py-2.5 text-sm text-[#eef3f8] placeholder:text-[#5a6772] outline-none transition focus:border-[#f3a33a]/60 focus:ring-1 focus:ring-[#f3a33a]/30';

/**
 * Simple, founder-friendly auth: first name, last name, email and a 6-digit PIN.
 * The PIN is the account secret (mapped to the Supabase password, which needs ≥6 chars).
 * In demo mode (no Supabase configured) the form is shown as a preview and the button
 * drops straight into the demo console.
 */
export function AuthForm({ mode, initialError = null }: { mode: 'login' | 'signup'; initialError?: string | null }) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const demo = !supabase;

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(initialError);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (pin.length < 6) {
      setError('Your PIN must be 6 digits.');
      return;
    }

    // Demo mode: no backend yet - route into onboarding (which the demo middleware allows and which
    // sets the onboarded cookie). Pushing to '/' here would bounce back to /welcome (no cookie yet).
    if (!supabase) {
      router.push('/onboarding');
      return;
    }

    setLoading(true);
    if (mode === 'signup') {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password: pin,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            display_name: `${firstName} ${lastName}`.trim() || email.split('@')[0],
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (signUpError) setError(signUpError.message);
      else setNotice(`Account created. We've sent a confirmation link to ${email}. Tap it to verify, then come back and sign in with your PIN.`);
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: pin });
      if (signInError) setError(signInError.message);
      else {
        router.push('/');
        router.refresh();
      }
    }
    setLoading(false);
  }

  return (
    <div className="w-full max-w-sm rounded-xl border border-[#263241] bg-[#0d1117] p-6 shadow-2xl">
      <Link href="/welcome" className="mb-4 inline-flex items-center gap-1 text-xs text-[#8190a0] transition hover:text-[#eef3f8]">
        ← Back
      </Link>
      <div className="mb-5 flex flex-col items-center gap-2 text-center">
        <BrandLogo size={34} showWordmark />
        <p className="text-xs text-[#8190a0]">
          {mode === 'signup' ? 'Create your operator account' : 'Sign in to your console'}
        </p>
      </div>

      {demo && (
        <p className="mb-3 rounded-md border border-[#9a6a1f]/40 bg-[#2a1f0f]/60 px-3 py-2 text-[11px] leading-snug text-[#f3a33a]">
          Solo mode - this Lyra runs without accounts, so there is nothing to sign
          {mode === 'signup' ? ' up for' : ' into'}. Your watchlist, holdings, and trade log stay
          in this browser. Continue straight in; self-hosters can add the Supabase env vars (see
          .env.example) to turn real accounts on.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {mode === 'signup' && (
          <div className="grid grid-cols-2 gap-2">
            <input
              className={inputClass}
              type="text"
              placeholder="First name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              autoComplete="given-name"
              required
            />
            <input
              className={inputClass}
              type="text"
              placeholder="Last name"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              autoComplete="family-name"
              required
            />
          </div>
        )}
        <input
          className={inputClass}
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />
        <div>
          <input
            className={`${inputClass} text-center text-lg tracking-[0.5em]`}
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="••••••"
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            required
          />
          <p className="mt-1 text-center text-[10px] text-[#6f7d8a]">
            {mode === 'signup' ? 'Choose a 6-digit PIN' : 'Enter your 6-digit PIN'}
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-[#7f1d1d] bg-[#2b1214] px-3 py-2.5">
            <CircleAlert size={16} className="mt-px shrink-0 text-[#ff6b6b]" />
            <p className="text-[13px] leading-relaxed text-[#ffb4b4]">{error}</p>
          </div>
        )}
        {notice && (
          <div className="flex items-start gap-2.5 rounded-lg border border-[#1d7f55] bg-[#0d251b] px-3 py-3">
            <CheckCircle2 size={18} className="mt-px shrink-0 text-[#43d18b]" />
            <div>
              <p className="text-[13px] font-semibold text-[#43d18b]">Account created</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-[#a7e9c8]">{notice.replace(/^Account created\.\s*/, '')}</p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-[#7faa92]">Don&apos;t see it within a minute? Check your <span className="font-semibold">spam / junk</span> folder and mark it &ldquo;not junk&rdquo; - new senders sometimes land there.</p>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-gradient-to-r from-[#3b5bdb] via-[#43d18b] to-[#f3a33a] px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.12em] text-[#07090c] shadow-[0_10px_24px_-10px_rgba(67,209,139,0.65)] transition hover:brightness-110 disabled:opacity-50"
        >
          {loading ? 'Working…' : demo ? 'Continue without an account' : mode === 'signup' ? 'Create account' : 'Sign in'}
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-[#8190a0]">
        {mode === 'signup' ? (
          <>Already have an account? <Link href="/auth/login" className="text-[#f3a33a] hover:underline">Sign in</Link></>
        ) : (
          <>New here? <Link href="/auth/signup" className="text-[#f3a33a] hover:underline">Create an account</Link></>
        )}
      </p>
    </div>
  );
}
