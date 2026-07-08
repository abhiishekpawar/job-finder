import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Job Hunter Daily",
  description: "Track daily jobs across Naukri, Indeed, and LinkedIn."
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
          <header className="mb-10 flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-5 py-4 backdrop-blur">
            <div>
              <Link href="/" className="text-lg font-semibold text-white">
                Job Hunter Daily
              </Link>
              <p className="text-sm text-slate-400">Daily search runs across multiple job sources.</p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <Link href="/" className="rounded-lg border border-white/10 px-3 py-2 text-slate-200 transition hover:border-cyan-400/50">
                Search jobs
              </Link>
            </div>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
