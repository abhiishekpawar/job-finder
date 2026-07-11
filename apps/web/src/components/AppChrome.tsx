"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppIcon } from "@/components/AppIcon";
import { LogoutButton } from "@/components/LogoutButton";

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
      <header className="mb-10 flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-5 py-4 backdrop-blur">
        <div>
          <Link href="/" className="flex items-center gap-3 text-lg font-semibold text-white">
            <AppIcon className="h-9 w-9 shrink-0" />
            <span>
              AP Job Hunter
              <p className="text-sm font-normal text-slate-400">Search across multiple job sources.</p>
            </span>
          </Link>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-white/10 px-3 py-2 text-slate-200 transition hover:border-cyan-400/50"
          >
            Search jobs
          </a>
          <a
            href="/resume-checker"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-emerald-400/40 px-3 py-2 text-emerald-200 transition hover:border-emerald-300/60"
          >
            Resume checker
          </a>
          <LogoutButton />
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
