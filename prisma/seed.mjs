// Seeds niche categories and a handful of demo mentors with reviews.
// Run: npm run db:seed   (demo login: maya@example.com / password123)
import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";

const db = new PrismaClient();

function hash(pw) {
  const salt = randomBytes(16);
  return ["scrypt", salt.toString("hex"), scryptSync(pw, salt, 64).toString("hex")].join(":");
}

const categories = [
  {
    slug: "break-into-tech",
    name: "Break into Tech",
    tagline: "Career switchers and new grads landing their first tech role.",
    description: "Bootcamp grads, self-taught devs, and career changers: get a straight answer from someone who hires.",
  },
  {
    slug: "grad-school",
    name: "Grad School Advice",
    tagline: "MBA, PhD and Master's applications from people who got in.",
    description: "Statement of purpose reviews, school selection, and whether grad school is even the right move.",
  },
  {
    slug: "resume-review",
    name: "Resume Review",
    tagline: "Line-by-line edits from people who read hundreds of resumes.",
    description: "",
  },
  {
    slug: "product-management",
    name: "Product Management",
    tagline: "PM interviews, APM programs and moving into product.",
    description: "",
  },
  {
    slug: "design-portfolio",
    name: "Design Portfolio",
    tagline: "Portfolio critiques from senior product designers.",
    description: "",
  },
];

const mentors = [
  {
    name: "Maya Chen",
    email: "maya@example.com",
    slug: "maya-chen",
    company: "Staff Engineer, ex-Meta",
    headline: "I've hired 60+ engineers. Let's make your resume pass the 6-second scan.",
    bio: "Self-taught engineer turned hiring manager. I now run interviews for infra roles and have reviewed thousands of resumes.\n\nBest for: bootcamp grads, career switchers, and new grads who aren't getting callbacks.",
    tz: "America/Los_Angeles",
    cats: ["break-into-tech", "resume-review"],
    sessions: [
      { title: "20-min resume review", priceCents: 4500, description: "Send your resume ahead. You'll leave with concrete line edits and a target-role checklist." },
      { title: "Mock behavioral interview", priceCents: 6000, durationMinutes: 30, description: "A realistic behavioral round with direct feedback on your stories." },
    ],
  },
  {
    name: "Daniel Okafor",
    email: "daniel@example.com",
    slug: "daniel-okafor",
    company: "Wharton MBA '24 · Strategy at a Big 3 firm",
    headline: "MBA admissions strategy from someone who read applications on the committee.",
    bio: "I sat on the student admissions committee and coached 30+ applicants into M7 programs.",
    tz: "America/New_York",
    cats: ["grad-school"],
    sessions: [{ title: "20-min MBA application gut-check", priceCents: 5500, description: "Bring your story, school list and test scores. We'll pressure-test your angle." }],
  },
  {
    name: "Priya Raman",
    email: "priya@example.com",
    slug: "priya-raman",
    company: "Group PM, fintech",
    headline: "From consultant to PM in 9 months. I'll show you the path I took.",
    bio: "I run PM hiring for a 40-person product org and mentor APMs.",
    tz: "Europe/London",
    cats: ["product-management", "break-into-tech"],
    sessions: [{ title: "20-min PM career strategy", priceCents: 5000, description: "Positioning, target companies and how to talk about your non-PM experience." }],
  },
  {
    name: "Sam Rivera",
    email: "sam@example.com",
    slug: "sam-rivera",
    company: "Principal Product Designer",
    headline: "Portfolio critique that gets you to the onsite.",
    bio: "I've reviewed 500+ design portfolios as a hiring manager.",
    tz: "America/Chicago",
    cats: ["design-portfolio"],
    sessions: [{ title: "20-min portfolio teardown", priceCents: 4000, description: "Share your link ahead. Honest notes on case study structure and storytelling." }],
  },
];

const reviewText = [
  [5, "Super actionable. Rewrote my bullets the same night and got two callbacks that week."],
  [5, "Worth every cent. Honest, specific, zero fluff."],
  [4, "Great advice on positioning. Wish we'd had a bit more time!"],
  [5, "Clear framework for what to do next. Already booked a follow-up."],
];
const names = ["Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley"];

async function main() {
  for (const c of categories) {
    await db.category.upsert({ where: { slug: c.slug }, update: c, create: c });
  }
  const passwordHash = hash("password123");

  for (const [i, m] of mentors.entries()) {
    if (await db.user.findUnique({ where: { email: m.email } })) continue;
    const user = await db.user.create({
      data: {
        name: m.name,
        email: m.email,
        passwordHash,
        mentor: {
          create: {
            slug: m.slug,
            company: m.company,
            headline: m.headline,
            bio: m.bio,
            timezone: m.tz,
            published: true,
            stripeAccountId: `acct_test_seed${i}`,
            stripeChargesEnabled: true,
            stripeDetailsSubmitted: true,
            categories: { connect: m.cats.map((slug) => ({ slug })) },
            sessionTypes: {
              create: m.sessions.map((s) => ({ durationMinutes: 20, ...s })),
            },
            availability: {
              create: [
                ...[1, 2, 3, 4].map((weekday) => ({ weekday, startMinute: 17 * 60, endMinute: 20 * 60 })),
                { weekday: 6, startMinute: 9 * 60, endMinute: 12 * 60 },
              ],
            },
          },
        },
      },
      include: { mentor: { include: { sessionTypes: true } } },
    });

    // Past, paid bookings with reviews so ratings render.
    const st = user.mentor.sessionTypes[0];
    for (let r = 0; r < 3 - (i % 2); r++) {
      const [rating, comment] = reviewText[(i + r) % reviewText.length];
      const startAt = new Date(Date.now() - (r + 2) * 7 * 864e5);
      const booking = await db.booking.create({
        data: {
          mentorId: user.mentor.id,
          sessionTypeId: st.id,
          menteeName: `${names[(i + r) % names.length]} Demo`,
          menteeEmail: `mentee${i}${r}@example.com`,
          startAt,
          endAt: new Date(startAt.getTime() + st.durationMinutes * 60000),
          status: "CONFIRMED",
          priceCents: st.priceCents,
          platformFeeCents: Math.round(st.priceCents * 0.15),
          currency: "usd",
          accessToken: randomBytes(18).toString("base64url"),
          meetingUrl: "https://meet.jit.si/demo",
        },
      });
      await db.review.create({
        data: {
          bookingId: booking.id,
          mentorId: user.mentor.id,
          rating,
          comment,
          authorName: names[(i + r) % names.length],
        },
      });
    }
  }
  console.log("Seeded. Demo mentor login: maya@example.com / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
