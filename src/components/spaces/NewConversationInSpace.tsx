"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewConversationInSpace({ spaceId }: { spaceId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    setPending(true);
    setErr(null);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ spaceId }),
      });
      if (!res.ok) {
        setErr("could not create chat");
        return;
      }
      const data = await res.json();
      if (data?.conversation?.id) {
        router.push(`/chat/${data.conversation.id}`);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      className="spc-btn spc-btn--primary"
      onClick={go}
      disabled={pending}
    >
      {pending ? "opening…" : "+ new chat in this space"}
      {err && <span style={{ color: "var(--signal-err)", marginLeft: 6 }}>{err}</span>}
    </button>
  );
}
