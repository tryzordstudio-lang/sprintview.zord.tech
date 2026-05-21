import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { ForgotPasswordForm } from "@/components/auth-forms";

export const metadata = {
  title: "Forgot Password | Zord SprintView"
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Account Recovery"
      title="Forgot password"
      description="Request a secure password reset link for your Zord SprintView workspace account."
      footer={
        <p>
          Remembered your password? <Link href="/signin">Back to sign in</Link>
        </p>
      }
    >
      <div className="auth-card-header">
        <h2>Reset request</h2>
        <p>Enter your work email and we&apos;ll send a password reset link.</p>
      </div>

      <ForgotPasswordForm />
    </AuthShell>
  );
}
