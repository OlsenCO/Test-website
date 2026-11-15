import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { signup } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth";
import { platformFeeBps } from "@/lib/config";

export const metadata = { title: "Become a mentor" };

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  const keep = 100 - platformFeeBps() / 100;
  return (
    <div className="mx-auto grid max-w-5xl gap-12 px-4 py-16 md:grid-cols-2">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Get paid for the advice you already give for free.</h1>
        <ul className="mt-6 space-y-3 text-muted">
          <li>• Set your price for a focused 20-minute call.</li>
          <li>• Pick the hours you&apos;re free. We sync with Google Calendar so you&apos;re never double-booked.</li>
          <li>• Mentees pay upfront. You keep {keep}%, paid out by Stripe.</li>
          <li>• A Google Meet link and invite are created automatically.</li>
        </ul>
      </div>
      <div className="card p-6">
        <h2 className="mb-4 text-lg font-semibold">Create your mentor account</h2>
        <AuthForm action={signup} mode="signup" />
        <p className="mt-4 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-accent underline">
            Log in
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-muted">Looking for advice? You don&apos;t need an account. Just <Link className="underline" href="/mentors">book a mentor</Link>.</p>
      </div>
    </div>
  );
}
