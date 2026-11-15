import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { APP_NAME, platformFeeBps } from "@/lib/config";
import { logout } from "./actions/auth";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: `${APP_NAME} · 20-minute career calls`, template: `%s · ${APP_NAME}` },
  description:
    "Book a paid 20-minute call with someone who has done the thing you're trying to do. Resume reviews, breaking into tech, grad school advice.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="border-b border-line bg-surface/80 backdrop-blur">
          <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-xs font-bold text-accent-ink">
                20
              </span>
              {APP_NAME}
            </Link>
            <Link href="/mentors" className="text-sm text-muted hover:text-foreground">
              Find a mentor
            </Link>
            <div className="ml-auto flex items-center gap-3 text-sm">
              {user ? (
                <>
                  <Link href="/dashboard" className="btn-secondary">
                    Dashboard
                  </Link>
                  <form action={logout}>
                    <button className="text-muted hover:text-foreground">Log out</button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/login" className="text-muted hover:text-foreground">
                    Log in
                  </Link>
                  <Link href="/signup" className="btn-primary">
                    Become a mentor
                  </Link>
                </>
              )}
            </div>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line py-8 text-center text-xs text-muted">
          {APP_NAME} · Paid micro-mentorship. Mentors keep {100 - platformFeeBps() / 100}% of every session.
        </footer>
      </body>
    </html>
  );
}
