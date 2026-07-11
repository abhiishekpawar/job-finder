"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onLogout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={loading}
      className="rounded-lg border border-white/10 px-3 py-2 text-slate-300 transition hover:border-rose-400/50 hover:text-rose-200 disabled:opacity-60"
    >
      {loading ? "Signing out..." : "Logout"}
    </button>
  );
}
