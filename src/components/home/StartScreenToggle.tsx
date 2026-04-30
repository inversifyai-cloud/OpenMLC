"use client";

import { useState, useTransition } from "react";

type StartScreen = "home" | "chat";

type Props = {
  initial: StartScreen;
};

export function StartScreenToggle({ initial }: Props) {
  const [value, setValue] = useState<StartScreen>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "ok" | "err">("idle");
  const [, startTransition] = useTransition();

  function update(next: StartScreen) {
    if (next === value) return;
    const prev = value;
    setValue(next);
    setStatus("saving");
    startTransition(() => {
      void (async () => {
        try {
          const res = await fetch("/api/profile/start-screen", {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ startScreen: next }),
          });
          if (!res.ok) throw new Error(String(res.status));
          setStatus("ok");
          setTimeout(() => setStatus("idle"), 1800);
        } catch {
          setValue(prev);
          setStatus("err");
          setTimeout(() => setStatus("idle"), 2400);
        }
      })();
    });
  }

  return (
    <div className="start-screen-toggle">
      <span className="start-screen-toggle__title">Open into</span>
      <span className="start-screen-toggle__desc">
        Choose what you see when you sign in. Home gives you a calm dashboard;
        last chat drops you straight into the conversation.
      </span>
      <div className="start-screen-toggle__row" role="radiogroup" aria-label="Default start screen">
        <label className="start-screen-toggle__opt">
          <input
            type="radio"
            name="start-screen"
            value="home"
            checked={value === "home"}
            onChange={() => update("home")}
          />
          Home <span style={{ color: "var(--fg-4)", marginLeft: 4 }}>(default)</span>
        </label>
        <label className="start-screen-toggle__opt">
          <input
            type="radio"
            name="start-screen"
            value="chat"
            checked={value === "chat"}
            onChange={() => update("chat")}
          />
          Last chat
        </label>
        <span
          className="start-screen-toggle__status"
          data-state={status === "ok" ? "ok" : status === "err" ? "err" : undefined}
          aria-live="polite"
        >
          {status === "saving" ? "saving…" : status === "ok" ? "saved" : status === "err" ? "error" : ""}
        </span>
      </div>
    </div>
  );
}
