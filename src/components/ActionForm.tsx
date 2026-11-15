"use client";

import { useActionState } from "react";
import type { ActionState } from "@/app/actions/mentor";

/** Form wrapper that shows a save button plus inline success/error state. */
export function ActionForm({
  action,
  children,
  submitLabel = "Save",
  className = "space-y-4",
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  submitLabel?: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className={className}>
      {children}
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </button>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state?.ok && !pending && <p className="text-sm text-accent">{state.ok} ✓</p>}
      </div>
    </form>
  );
}
