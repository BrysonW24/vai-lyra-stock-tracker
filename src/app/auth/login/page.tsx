import { AuthForm } from '@/components/auth/AuthForm';

export const metadata = { title: 'Sign in' };

// Human wording for /auth/callback failure codes - a failed confirmation link used to
// bounce silently to /welcome with no explanation at all.
const CALLBACK_ERRORS: Record<string, string> = {
  confirm_failed:
    "That confirmation link didn't work - it may have expired or already been used. Try signing in with your PIN; if that fails, sign up again to get a fresh link.",
  missing_code: 'That link was incomplete - open the most recent confirmation email and tap the button again.',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center bg-ground px-4">
      <AuthForm mode="login" initialError={error ? (CALLBACK_ERRORS[error] ?? null) : null} />
    </main>
  );
}
