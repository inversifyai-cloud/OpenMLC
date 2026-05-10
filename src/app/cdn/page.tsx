import type { Metadata } from "next";
import Link from "next/link";
import { CopyButton } from "./CopyButton";
import "./cdn.css";

export const metadata: Metadata = {
  title: "openmlc — public theme · /cdn",
  description: "The minimalist sharp-edges theme behind openmlc, free for anyone to use.",
};

const INSTALL_HTML = `<link rel="stylesheet" href="https://openmlc.cloud/cdn/public.css">`;
const INSTALL_IMPORT = `@import url("https://openmlc.cloud/cdn/public.css");`;

const SCAFFOLD = `<body class="omlc">
  <main class="omlc-container">
    <span class="omlc-hud">section</span>
    <h2>Sharp edges, warm ink.</h2>
    <p>Drop the stylesheet into any page and start composing.</p>
    <button class="omlc-btn omlc-btn--primary">Confirm</button>
  </main>
</body>`;

const TOKEN_GROUPS: Array<{ label: string; rows: Array<{ name: string; value: string; swatch?: string }> }> = [
  {
    label: "ink",
    rows: [
      { name: "--omlc-bg-app",      value: "#F4F3EE", swatch: "#F4F3EE" },
      { name: "--omlc-bg-canvas",   value: "#FAFAF7", swatch: "#FAFAF7" },
      { name: "--omlc-bg-sunken",   value: "#ECEAE3", swatch: "#ECEAE3" },
      { name: "--omlc-fg-1",        value: "#0E0F0C", swatch: "#0E0F0C" },
      { name: "--omlc-fg-3",        value: "#5E5C56", swatch: "#5E5C56" },
      { name: "--omlc-fg-4",        value: "#8E8C84", swatch: "#8E8C84" },
    ],
  },
  {
    label: "accent",
    rows: [
      { name: "--omlc-fg-accent",   value: "#16A34A", swatch: "#16A34A" },
      { name: "--omlc-green-400",   value: "#22C55E", swatch: "#22C55E" },
      { name: "--omlc-green-300",   value: "#4ADE80", swatch: "#4ADE80" },
    ],
  },
  {
    label: "radii",
    rows: [
      { name: "--omlc-r-1", value: "2px" },
      { name: "--omlc-r-3", value: "4px" },
      { name: "--omlc-r-5", value: "8px" },
      { name: "--omlc-r-7", value: "12px" },
    ],
  },
  {
    label: "type",
    rows: [
      { name: "--omlc-t-micro", value: "11px" },
      { name: "--omlc-t-body",  value: "14px" },
      { name: "--omlc-t-h4",    value: "28px" },
      { name: "--omlc-t-h2",    value: "48px" },
    ],
  },
];

export default function CdnPage() {
  return (
    <div className="cdn-page">
      <header className="cdn-top">
        <Link href="/" className="cdn-back">← openmlc</Link>
        <span className="cdn-eyebrow">/cdn</span>
      </header>

      <section className="cdn-hero">
        <span className="cdn-eyebrow">public theme · v1</span>
        <h1 className="cdn-title">
          The same sharp-edged<br />
          theme that runs <em>openmlc</em>,<br />
          free for anyone to use.
        </h1>
        <p className="cdn-lede">
          One CSS file. No build step, no JS, no dependencies. Drop it in and you get the
          warm-tinted ink scale, the green accent, the small radii, the mono HUD type — all
          opt-in under an <code>omlc-</code> prefix that won&apos;t collide with your styles.
        </p>

        <div className="cdn-install">
          <div className="cdn-install__row">
            <span className="cdn-install__label">html</span>
            <pre className="cdn-install__code"><code>{INSTALL_HTML}</code></pre>
            <CopyButton value={INSTALL_HTML} />
          </div>
          <div className="cdn-install__row">
            <span className="cdn-install__label">css</span>
            <pre className="cdn-install__code"><code>{INSTALL_IMPORT}</code></pre>
            <CopyButton value={INSTALL_IMPORT} />
          </div>
        </div>

        <div className="cdn-meta">
          <a href="/cdn/public.css" className="cdn-meta__link">view raw →</a>
          <span className="cdn-meta__sep">·</span>
          <span>~12kb uncompressed</span>
          <span className="cdn-meta__sep">·</span>
          <span>MIT</span>
        </div>
      </section>

      <hr className="cdn-rule" />

      <section className="cdn-section">
        <span className="cdn-eyebrow">live · 01</span>
        <h2 className="cdn-h2">Buttons.</h2>
        <p className="cdn-body">
          Three weights. Ghost for tertiary, default for secondary, primary for the one
          action that matters.
        </p>
        <div className="cdn-demo">
          <button className="omlc-btn omlc-btn--ghost">Cancel</button>
          <button className="omlc-btn">Save draft</button>
          <button className="omlc-btn omlc-btn--primary">Publish</button>
        </div>
        <pre className="cdn-snippet"><code>{`<button class="omlc-btn omlc-btn--ghost">Cancel</button>
<button class="omlc-btn">Save draft</button>
<button class="omlc-btn omlc-btn--primary">Publish</button>`}</code></pre>
      </section>

      <hr className="cdn-rule" />

      <section className="cdn-section">
        <span className="cdn-eyebrow">live · 02</span>
        <h2 className="cdn-h2">Inputs.</h2>
        <p className="cdn-body">Hairline borders, accent caret, soft focus halo.</p>
        <div className="cdn-demo cdn-demo--stack">
          <input className="omlc-input" placeholder="email@domain" />
          <textarea className="omlc-textarea" placeholder="leave a note…" />
        </div>
        <pre className="cdn-snippet"><code>{`<input class="omlc-input" placeholder="email@domain" />
<textarea class="omlc-textarea" placeholder="leave a note…"></textarea>`}</code></pre>
      </section>

      <hr className="cdn-rule" />

      <section className="cdn-section">
        <span className="cdn-eyebrow">live · 03</span>
        <h2 className="cdn-h2">Chips, HUD labels, cards.</h2>
        <div className="cdn-demo cdn-demo--gallery">
          <div className="omlc-card">
            <span className="omlc-hud">overview</span>
            <h3 style={{ margin: "6px 0 4px", fontSize: 18, fontWeight: 600 }}>A small card.</h3>
            <p style={{ fontSize: 13, color: "var(--fg-3)", margin: 0 }}>
              Cards keep the hairline border and small radius. No drop shadows, no glass.
            </p>
            <div style={{ marginTop: 14, display: "flex", gap: 6 }}>
              <span className="omlc-chip">draft</span>
              <span className="omlc-chip omlc-chip--accent">live</span>
            </div>
          </div>

          <div className="omlc-card omlc-card--sunken">
            <span className="omlc-hud">terminal</span>
            <pre style={{ margin: "10px 0 0", background: "transparent", border: 0, padding: 0, fontSize: 12 }}>
{`$ npm i openmlc
$ openmlc --help`}
            </pre>
          </div>
        </div>
      </section>

      <hr className="cdn-rule" />

      <section className="cdn-section">
        <span className="cdn-eyebrow">tokens</span>
        <h2 className="cdn-h2">Everything is a CSS variable.</h2>
        <p className="cdn-body">
          Override any token at <code>:root</code>, <code>[data-theme]</code>, or any scope. All names are namespaced with <code>--omlc-</code>.
        </p>

        <div className="cdn-tokens">
          {TOKEN_GROUPS.map((g) => (
            <div key={g.label} className="cdn-tokens__group">
              <span className="cdn-eyebrow">{g.label}</span>
              <ul className="cdn-tokens__list">
                {g.rows.map((r) => (
                  <li key={r.name} className="cdn-tokens__row">
                    {r.swatch ? (
                      <span className="cdn-tokens__swatch" style={{ background: r.swatch }} />
                    ) : (
                      <span className="cdn-tokens__swatch cdn-tokens__swatch--blank" aria-hidden />
                    )}
                    <code className="cdn-tokens__name">{r.name}</code>
                    <span className="cdn-tokens__value">{r.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <hr className="cdn-rule" />

      <section className="cdn-section">
        <span className="cdn-eyebrow">scaffold</span>
        <h2 className="cdn-h2">Five lines to a styled page.</h2>
        <pre className="cdn-snippet"><code>{SCAFFOLD}</code></pre>
        <p className="cdn-body" style={{ color: "var(--fg-3)" }}>
          Apply <code>.omlc</code> (or <code>data-omlc</code>) on a wrapper to get the baseline
          (font, body color, anti-aliasing). Skip it to keep your own typography and just use the
          components and tokens à la carte.
        </p>
      </section>

      <footer className="cdn-foot">
        <span>openmlc.cloud</span>
        <span className="cdn-meta__sep">·</span>
        <span>theme is MIT — fork it, ship it</span>
        <Link href="/" className="cdn-back">return →</Link>
      </footer>
    </div>
  );
}
