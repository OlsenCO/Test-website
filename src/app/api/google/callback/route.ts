import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/config";
import { exchangeCode } from "@/lib/google";
import { safeEqual } from "@/lib/tokens";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.mentor) return NextResponse.redirect(`${appUrl()}/login`);

  const jar = await cookies();
  const expected = jar.get("mm_google_state")?.value ?? "";
  jar.delete({ name: "mm_google_state", path: "/api/google" });
  const state = req.nextUrl.searchParams.get("state") ?? "";
  const code = req.nextUrl.searchParams.get("code");
  const back = `${appUrl()}/dashboard/integrations`;

  if (!code || !expected || !safeEqual(state, expected)) {
    return NextResponse.redirect(`${back}?google=error`);
  }
  try {
    const { refreshToken, email } = await exchangeCode(code);
    if (!refreshToken) return NextResponse.redirect(`${back}?google=error`);
    await db.mentorProfile.update({
      where: { id: user.mentor.id },
      data: { googleRefreshToken: refreshToken, googleEmail: email },
    });
    return NextResponse.redirect(`${back}?google=connected`);
  } catch (err) {
    console.error("[google] oauth callback failed", err);
    return NextResponse.redirect(`${back}?google=error`);
  }
}
