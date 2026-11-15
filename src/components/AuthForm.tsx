"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions/auth";

export function AuthForm({
  action,
  mode,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  mode: "login" | "signup";
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-4">
      {mode === "signup" && (
        <div>
          <label className="label" htmlFor="name">
            Full name
          </label>
          <input id="name" name="name" className="input" required autoComplete="name" />
        </div>
      )}
      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <input id="email" name="email" type="email" className="input" required autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          className="input"
          required
          minLength={mode === "signup" ? 8 : undefined}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
        />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "One sec…" : mode === "signup" ? "Create mentor account" : "Log in"}
      </button>
    </form>
  );
}
