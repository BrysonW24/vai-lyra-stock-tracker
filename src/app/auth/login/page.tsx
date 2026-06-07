import { AuthForm } from '@/components/auth/AuthForm';

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#080a0d] px-4">
      <AuthForm mode="login" />
    </main>
  );
}
