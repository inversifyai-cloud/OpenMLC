"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; hint?: string };
type Section = { label: string; items: Item[] };

const NAV_SECTIONS: Section[] = [
  {
    label: "account",
    items: [
      { href: "/settings/profile", label: "profile", hint: "name, monogram, theme" },
      { href: "/settings/api-keys", label: "api keys", hint: "openai, anthropic, etc." },
      { href: "/settings/custom-providers", label: "custom providers", hint: "openai-compatible endpoints" },
      { href: "/settings/ollama", label: "local models", hint: "install ollama models" },
      { href: "/settings/huggingface", label: "huggingface", hint: "inference endpoints" },
    ],
  },
  {
    label: "conversation",
    items: [
      { href: "/settings/personas", label: "personas", hint: "system prompts" },
      { href: "/settings/prompts", label: "prompt library", hint: "reusable snippets" },
      { href: "/settings/memory", label: "memory", hint: "long-term facts" },
      { href: "/settings/knowledge", label: "knowledge", hint: "uploaded files" },
      { href: "/settings/voice", label: "voice", hint: "tts and stt" },
    ],
  },
  {
    label: "tools",
    items: [
      { href: "/settings/connectors", label: "connectors", hint: "github, gmail, …" },
      { href: "/settings/mcp", label: "mcp servers", hint: "external tool servers" },
      { href: "/settings/sandbox", label: "code sandbox" },
      { href: "/settings/computer", label: "computer agent", hint: "control host machine" },
    ],
  },
  {
    label: "automation",
    items: [
      { href: "/settings/workflows", label: "workflows", hint: "schedules + webhooks" },
      { href: "/settings/swarm", label: "swarm", hint: "multi-agent runs" },
    ],
  },
  {
    label: "insights",
    items: [
      { href: "/settings/usage", label: "usage", hint: "spend + limits" },
    ],
  },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav className="settings-nav" aria-label="settings sections">
      {NAV_SECTIONS.map((section) => (
        <div key={section.label} className="settings-nav__group">
          <span className="settings-nav__group-label">{section.label}</span>
          <ul className="settings-nav__list">
            {section.items.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`settings-nav__item${active ? " is-active" : ""}`}
                    prefetch={false}
                  >
                    <span className="settings-nav__indicator" aria-hidden />
                    <span className="settings-nav__text">
                      <span className="settings-nav__label">{item.label}</span>
                      {item.hint ? (
                        <span className="settings-nav__hint">{item.hint}</span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <div className="settings-nav__group settings-nav__group--foot">
        <Link href="/chat" className="settings-nav__back" prefetch={false}>
          ← back to chat
        </Link>
      </div>
    </nav>
  );
}
