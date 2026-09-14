import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/layout/logo';
import { RegisterForm } from '@/features/auth/components/register-form';

export const metadata: Metadata = {
  title: 'Sign up',
};

export default function RegisterPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2">
          <Logo />
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Create an account
          </h1>
          <p className="text-[13px] text-muted-foreground">
            Get started with your new workspace.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-5">
          <RegisterForm />
        </div>

        <p className="text-center text-[13px] text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-foreground hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
