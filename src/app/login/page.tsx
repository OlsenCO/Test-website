import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { login } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Log in" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <div className="card p-6">
        <h1 className="mb-4 text-lg font-semibold">Mentor log in</h1>
        <AuthForm action={login} mode="login" />
        <p className="mt-4 text-center text-sm text-muted">
          New here?{" "}
          <Link href="/signup" className="text-accent underline">
            Become a mentor
          </Link>
        </p>
      </div>
    </div>
  );
}
