import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { ResetPasswordForm } from "@/components/auth-forms";

export const metadata = {
  title: "Reset Password | Zord SprintView"
};

export default async function ResetPasswordPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const token = resolvedSearchParams?.token || "";

  return (
    <AuthShell
      eyebrow="Secure Access"
      title="Reset password"
      description="Choose a new password to restore access to your sprint intelligence workspace."
      footer={
        <p>
          Return to <Link href="/signin">sign in</Link>
        </p>
      }
    >
      <div className="auth-card-header">
        <h2>Create new password</h2>
        <p>Use at least 12 characters with a mix of letters, numbers, and symbols.</p>
      </div>

      <ResetPasswordForm initialToken={token} />
    </AuthShell>
  );
}
