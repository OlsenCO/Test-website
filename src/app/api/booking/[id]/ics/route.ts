import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { safeEqual } from "@/lib/tokens";
import { buildIcs } from "@/lib/ics";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/booking/[id]/ics">) {
  const { id } = await ctx.params;
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const booking = await db.booking.findUnique({
    where: { id },
    include: { sessionType: true, mentor: { include: { user: { select: { name: true } } } } },
  });
  if (!booking || !token || !safeEqual(booking.accessToken, token) || booking.status !== "CONFIRMED") {
    return new NextResponse("Not found", { status: 404 });
  }
  const ics = buildIcs({
    uid: booking.id,
    start: booking.startAt,
    end: booking.endAt,
    summary: `${booking.sessionType.title} with ${booking.mentor.user.name}`,
    description: `Join: ${booking.meetingUrl ?? ""}`,
    url: booking.meetingUrl,
  });
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="mentor-call.ics"`,
    },
  });
}
