"use client";

import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const login = async () => {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (!res.ok) {
      setError("Invalid password");
      return;
    }

    window.location.href = "/admin";
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--page-bg)] text-[var(--text-main)]">
      <div className="w-96 space-y-4 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]">
        <h1 className="text-xl font-semibold">Admin Login</h1>

        <input
          type="password"
          className="w-full rounded border border-[var(--border-soft)] bg-[var(--surface-raised)] px-3 py-2 text-[var(--text-main)]"
          placeholder="Admin password"
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}

        <button
          onClick={login}
          className="inline-flex rounded bg-[var(--accent)] px-4 py-2 text-[var(--accent-contrast)] hover:bg-[var(--accent-soft)] active:bg-[var(--accent-strong)]"
        >
          Login
        </button>
      </div>
    </main>
  );
}
