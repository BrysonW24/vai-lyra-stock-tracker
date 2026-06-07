import { AuthForm } from '@/components/auth/AuthForm';

export default function SignupPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#080a0d] px-4">
      <AuthForm mode="signup" />
    </main>
  );
}
