import { test } from "node:test";
import assert from "node:assert/strict";
import { generateSlots, groupByDay } from "../src/lib/slots.ts";

// Monday 2026-03-02 08:00 in New York (EST, UTC-5).
const NOW = new Date("2026-03-02T13:00:00Z");
const base = {
  mentorTz: "America/New_York",
  durationMinutes: 20,
  bufferMinutes: 0,
  minNoticeHours: 0,
  maxDaysAhead: 6,
  busy: [],
  now: NOW,
};

test("generates 30-minute-aligned slots inside the window", () => {
  const slots = generateSlots({ ...base, rules: [{ weekday: 1, startMinute: 9 * 60, endMinute: 10 * 60 }] });
  assert.deepEqual(
    slots.map((s) => s.toISOString()),
    ["2026-03-02T14:00:00.000Z", "2026-03-02T14:30:00.000Z"],
  );
});

test("slot must fit entirely within the window", () => {
  const slots = generateSlots({ ...base, rules: [{ weekday: 1, startMinute: 9 * 60, endMinute: 9 * 60 + 40 }] });
  assert.equal(slots.length, 1);
});

test("respects minimum notice", () => {
  const slots = generateSlots({
    ...base,
    minNoticeHours: 2, // earliest 10:00 local
    rules: [{ weekday: 1, startMinute: 9 * 60, endMinute: 11 * 60 }],
  });
  assert.deepEqual(
    slots.map((s) => s.toISOString()),
    ["2026-03-02T15:00:00.000Z", "2026-03-02T15:30:00.000Z"],
  );
});

test("busy intervals and buffers block overlapping slots", () => {
  const slots = generateSlots({
    ...base,
    bufferMinutes: 10,
    rules: [{ weekday: 1, startMinute: 9 * 60, endMinute: 11 * 60 }],
    busy: [{ start: new Date("2026-03-02T14:30:00Z"), end: new Date("2026-03-02T14:50:00Z") }],
  });
  // 9:00 ends 9:20 (+10 buffer = 9:30) touches but doesn't overlap 9:30 → allowed.
  // 9:30 busy. 10:00 starts with -10 buffer = 9:50 → touches 9:50 end → allowed.
  assert.deepEqual(
    slots.map((s) => s.toISOString()),
    ["2026-03-02T14:00:00.000Z", "2026-03-02T15:00:00.000Z", "2026-03-02T15:30:00.000Z"],
  );
});

test("handles DST: 9am local stays 9am after clocks change", () => {
  // US DST starts Sunday 2026-03-08. Monday 03-09 9:00 EDT = 13:00Z.
  const slots = generateSlots({
    ...base,
    maxDaysAhead: 8,
    rules: [{ weekday: 1, startMinute: 9 * 60, endMinute: 9 * 60 + 20 }],
  });
  assert.deepEqual(
    slots.map((s) => s.toISOString()),
    ["2026-03-02T14:00:00.000Z", "2026-03-09T13:00:00.000Z"],
  );
});

test("groups by day in the viewer's timezone", () => {
  const slots = [new Date("2026-03-03T03:00:00Z"), new Date("2026-03-03T15:00:00Z")];
  assert.deepEqual(Object.keys(groupByDay(slots, "America/Los_Angeles")), ["2026-03-02", "2026-03-03"]);
  assert.deepEqual(Object.keys(groupByDay(slots, "Asia/Tokyo")), ["2026-03-03", "2026-03-04"]);
});
