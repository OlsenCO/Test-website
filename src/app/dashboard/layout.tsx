import Link from "next/link";
import { requireMentor } from "@/lib/auth";

const NAV = [
  ["/dashboard", "Overview"],
  ["/dashboard/profile", "Profile"],
  ["/dashboard/sessions", "Sessions & pricing"],
  ["/dashboard/availability", "Availability"],
  ["/dashboard/integrations", "Payments & calendar"],
] as const;

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const { mentor } = await requireMentor();
  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:grid-cols-[200px_1fr]">
      <aside>
        <nav className="flex gap-1 overflow-x-auto md:flex-col">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm hover:bg-surface">
              {label}
            </Link>
          ))}
          <Link href={`/m/${mentor.slug}`} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm text-accent hover:bg-surface">
            View public page →
          </Link>
        </nav>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
