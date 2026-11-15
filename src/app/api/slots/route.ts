import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { availableSlots, canAcceptBookings } from "@/lib/bookings";
import { groupByDay, isValidTimezone } from "@/lib/slots";

export async function GET(req: NextRequest) {
  const sessionTypeId = req.nextUrl.searchParams.get("sessionTypeId") ?? "";
  const tzParam = req.nextUrl.searchParams.get("tz") ?? "UTC";
  const tz = isValidTimezone(tzParam) ? tzParam : "UTC";

  const sessionType = await db.sessionType.findUnique({
    where: { id: sessionTypeId },
    include: { mentor: true },
  });
  if (!sessionType || !sessionType.active || !canAcceptBookings(sessionType.mentor)) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }
  const slots = await availableSlots(sessionType.mentor, sessionType);
  return NextResponse.json(
    { tz, days: groupByDay(slots, tz) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
