import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { Suspense } from "react";
import AuthForm from "@/components/auth/AuthForm";

export const metadata: Metadata = pageMeta({
  title: "Sign in",
  description: "Sign in to your STAI account.",
  path: "/login",
  noIndex: true,
});

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <p className="f-label" style={{ color: "var(--ink-faint)" }}>
        Member access
      </p>
      <h1 className="f-display mt-2 text-4xl text-cream-100">Sign in</h1>
      <div className="mt-8">
        <Suspense>
          <AuthForm mode="login" />
        </Suspense>
      </div>
    </div>
  );
}
