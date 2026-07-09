import type { Metadata } from "next";
import { Suspense } from "react";
import AuthForm from "@/components/auth/AuthForm";

export const metadata: Metadata = { title: "Create your account" };

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <p className="f-label" style={{ color: "var(--ink-faint)" }}>
        Free account
      </p>
      <h1 className="f-display mt-2 text-4xl text-cream-100">Join the desk</h1>
      <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
        Most briefings, the open slice of the prompt library, the assessment, The STAI Brief, and five Ask STAI
        questions a month — free.
      </p>
      <div className="mt-8">
        <Suspense>
          <AuthForm mode="signup" />
        </Suspense>
      </div>
    </div>
  );
}
