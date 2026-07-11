"use client";

import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppIcon } from "@/components/AppIcon";

function LoginForm() {
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
        credentials: "same-origin"
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Login failed");
      }

      const nextPath = searchParams.get("next");
      const destination = nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/";
      window.location.assign(destination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-8 shadow-2xl shadow-cyan-950/20">
        <div className="mb-8 flex items-center gap-3">
          <AppIcon className="h-10 w-10" />
          <div>
            <h1 className="text-2xl font-semibold text-white">AP Job Hunter</h1>
            <p className="text-sm text-slate-400">Sign in to continue</p>
          </div>
        </div>

        <form className="space-y-5" onSubmit={onSubmit}>
          <div>
            <label className="mb-2 block text-sm text-slate-300" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 outline-none"
            />
          </div>

          <button
            disabled={loading}
            className="w-full rounded-xl bg-cyan-400 px-4 py-3 font-medium text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        {error ? <p className="mt-4 text-sm text-rose-300">Error: {error}</p> : null}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-slate-300">Loading...</div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
