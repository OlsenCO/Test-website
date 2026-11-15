"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { slugify } from "@/lib/format";
import { randomToken } from "@/lib/tokens";

export type FormState = { error?: string; ok?: string } | undefined;

const signupSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export async function signup(_: FormState, form: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  const { name, email, password } = parsed.data;

  if (await db.user.findUnique({ where: { email } })) {
    return { error: "An account with that email already exists. Try logging in." };
  }

  let slug = slugify(name) || "mentor";
  if (await db.mentorProfile.findUnique({ where: { slug } })) {
    slug = `${slug}-${randomToken(3).toLowerCase().replace(/[^a-z0-9]/g, "")}`;
  }

  const user = await db.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      mentor: {
        create: {
          slug,
          sessionTypes: {
            create: {
              title: "20-min resume review",
              description: "Send your resume ahead of time. We'll go line by line and you'll leave with concrete edits.",
              durationMinutes: 20,
              priceCents: 4000,
            },
          },
          availability: {
            create: [1, 2, 3, 4].map((weekday) => ({ weekday, startMinute: 18 * 60, endMinute: 20 * 60 })),
          },
        },
      },
    },
  });
  await createSession(user.id);
  redirect("/dashboard?welcome=1");
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Incorrect email or password." };
  }
  await createSession(user.id);
  const next = String(form.get("next") ?? "");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/");
}
