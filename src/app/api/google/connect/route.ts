import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { appUrl, isGoogleConfigured } from "@/lib/config";
import { googleAuthUrl } from "@/lib/google";
import { randomToken } from "@/lib/tokens";

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.mentor) return NextResponse.redirect(`${appUrl()}/login`);
  if (!isGoogleConfigured()) return NextResponse.redirect(`${appUrl()}/dashboard/integrations?google=unconfigured`);

  const state = randomToken(16);
  (await cookies()).set("mm_google_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/google",
    maxAge: 600,
  });
  return NextResponse.redirect(googleAuthUrl(state));
}
