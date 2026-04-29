"use client";

import { getModel } from "@/lib/providers/registry";

const PROVIDER_LABEL: Record<string, string> = {
  openai: "openai",
  anthropic: "anthropic",
  google: "google",
  xai: "xai",
  fireworks: "fireworks",
  openrouter: "openrouter",
  ollama: "ollama",
};

function fmtCtx(n?: number): string {
  if (!n) return "—";
  if (n >= 1_000_000) return `${Math.round(n / 1_000_000)}m`;
  return `${Math.round(n / 1000)}k`;
}

export function RightPanel({
  modelId,
  status,
  messageCount,
}: {
  modelId: string;
  status: "ready" | "submitted" | "streaming" | "error";
  messageCount: number;
}) {
  const model = getModel(modelId);
  const provider = model ? (PROVIDER_LABEL[model.providerId] ?? model.providerId) : "—";

  return (
    <aside className="right">
      <span className="corner tl" />
      <span className="corner tr" />
      <span className="corner bl" />
      <span className="corner br" />

      <section className="panel-section">
        <div className="panel-title">
          <span>active model</span>
          <div className="bracket" />
        </div>
        <div className="model-card">
          <div className="model-name">
            <span className="reticle" aria-hidden />
            <span>{model?.name?.toLowerCase() ?? modelId}</span>
            <span className="editorial">{provider}</span>
          </div>
          <div className="model-meta">
            <div className="meta-cell"><span className="l">CONTEXT</span><span className="v">{fmtCtx(model?.contextWindow)}</span></div>
            <div className="meta-cell"><span className="l">COST</span><span className="v cyan">{model?.costTier ?? "—"}</span></div>
            <div className="meta-cell"><span className="l">VISION</span><span className="v">{model?.capabilities.includes("vision") ? "yes" : "no"}</span></div>
            <div className="meta-cell"><span className="l">TOOLS</span><span className="v">{model?.capabilities.includes("tools") ? "yes" : "no"}</span></div>
          </div>
        </div>
      </section>

      <section className="panel-section">
        <div className="panel-title">
          <span>session</span>
          <div className="bracket" />
        </div>
        <div className="telemetry-block">
          <div className="telemetry-row">
            <span className="l">status</span>
            <span className="v">
              {status === "streaming" || status === "submitted" ? <span className="live-dot" /> : null}
              {status}
            </span>
          </div>
          <div className="telemetry-row">
            <span className="l">messages</span>
            <span className="v">{messageCount}</span>
          </div>
          <div className="telemetry-row">
            <span className="l">provider</span>
            <span className="v">{provider}</span>
          </div>
        </div>
      </section>

      <div className="panel-foot">
        <span><b>● local</b> · 0 telemetry</span>
        <span>v0.1.0</span>
      </div>
    </aside>
  );
}
