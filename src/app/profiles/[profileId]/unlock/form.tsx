"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/chrome/Input";
import { Button } from "@/components/chrome/Button";
import { HudLabel } from "@/components/chrome/HudLabel";

export function UnlockForm({ username }: { username: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/chat";
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "login failed");
      router.push(next);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "something went wrong");
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <HudLabel>password</HudLabel>
        <Input
          autoFocus
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="·······"
        />
      </div>
      {err && (
        <p className="text-[13px]" style={{ color: "var(--signal-err)" }}>
          · {err}
        </p>
      )}
      <Button type="submit" disabled={busy || !password}>
        {busy ? "unlocking…" : "unlock"}
      </Button>
    </form>
  );
}
