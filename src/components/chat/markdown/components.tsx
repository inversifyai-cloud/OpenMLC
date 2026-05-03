import ReactMarkdown from "react-markdown";
import { CodeBlock } from "../CodeBlock";

type MdComponents = React.ComponentProps<typeof ReactMarkdown>["components"];

// Pull the raw text out of whatever ReactMarkdown handed us as `children`.
// For fenced blocks, this is typically a single string in an array.
function childrenToString(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(childrenToString).join("");
  if (children && typeof children === "object" && "props" in children) {
    const c = (children as { props?: { children?: React.ReactNode } }).props?.children;
    return childrenToString(c);
  }
  return "";
}

// `language-ts file=foo.ts` → { lang: "ts", filename: "foo.ts" }
function parseLangSpec(className: string | undefined): { lang: string; filename?: string } {
  const raw = (className ?? "").replace(/^language-/, "").trim();
  if (!raw) return { lang: "" };
  const [lang, ...rest] = raw.split(/\s+/);
  const fileTag = rest.find((p) => p.startsWith("file="));
  return { lang, filename: fileTag?.slice("file=".length) || undefined };
}

/**
 * Build a complete markdown components map for ReactMarkdown.
 * This module can be reused by any consumer (MessageBubble, artifacts, system previews).
 */
export function buildMarkdownComponents(opts: { streaming: boolean }): MdComponents {
  const { streaming } = opts;

  return {
    pre: ({ children }) => {
      // ReactMarkdown wraps fenced blocks in <pre><code class="language-x">...</code></pre>.
      // We unwrap and route to <CodeBlock> so we can own the chrome + highlighting.
      if (children && typeof children === "object" && "props" in children) {
        const codeProps = (children as { props?: { className?: string; children?: React.ReactNode } }).props;
        const { lang, filename } = parseLangSpec(codeProps?.className);
        const code = childrenToString(codeProps?.children).replace(/\n$/, "");
        return <CodeBlock code={code} lang={lang} filename={filename} streaming={streaming} />;
      }
      return <pre>{children}</pre>;
    },
    code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
      // Only inline code reaches here in practice (block code is intercepted by `pre` above).
      const isBlock = !!className?.startsWith("language-");
      if (isBlock) {
        const { lang, filename } = parseLangSpec(className);
        const code = childrenToString(children).replace(/\n$/, "");
        return <CodeBlock code={code} lang={lang} filename={filename} streaming={streaming} />;
      }
      return <code className={className}>{children}</code>;
    },
    p: ({ children }) => <p>{children}</p>,
    table: ({ children }) => (
      <div className="md-table-wrap">
        <table className="md-table">{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th
        style={{
          padding: "6px 12px",
          textAlign: "left",
          borderBottom: "1px solid var(--stroke-2)",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--fg-3)",
          fontWeight: 500,
        }}
      >
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td
        style={{
          padding: "6px 12px",
          borderBottom: "1px solid var(--stroke-1)",
          color: "var(--fg-1)",
          verticalAlign: "top",
        }}
      >
        {children}
      </td>
    ),
    h1: ({ children }) => (
      <h1
        style={{
          fontSize: 20,
          fontWeight: 600,
          margin: "16px 0 8px",
          color: "var(--fg-1)",
          letterSpacing: "-0.02em",
        }}
      >
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2
        className="md-heading"
        style={{
          fontSize: 16,
          fontWeight: 600,
          margin: "14px 0 6px",
          color: "var(--fg-1)",
        }}
      >
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3
        className="md-heading"
        style={{
          fontSize: 14,
          fontWeight: 500,
          margin: "12px 0 4px",
          color: "var(--fg-1)",
        }}
      >
        {children}
      </h3>
    ),
    ul: ({ children }) => (
      <ul
        style={{
          margin: "8px 0",
          paddingLeft: 20,
          lineHeight: 1.7,
        }}
      >
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol
        style={{
          margin: "8px 0",
          paddingLeft: 20,
          lineHeight: 1.7,
        }}
      >
        {children}
      </ol>
    ),
    li: ({ children }) => {
      // Detect GFM task lists: check if first child is <input type="checkbox">
      const childArray = Array.isArray(children) ? children : [children];
      const firstChild = childArray[0];
      const isTaskList =
        firstChild &&
        typeof firstChild === "object" &&
        "props" in firstChild &&
        (firstChild as { type?: string; props?: { type?: string } }).type === "input" &&
        (firstChild as { type?: string; props?: { type?: string } }).props?.type === "checkbox";

      if (isTaskList) {
        return (
          <li
            className="md-task-li"
            style={{
              margin: "4px 0",
            }}
          >
            {children}
          </li>
        );
      }
      return (
        <li
          className="md-li"
          style={{
            margin: "2px 0",
            color: "var(--fg-1)",
          }}
        >
          {children}
        </li>
      );
    },
    blockquote: ({ children }) => <blockquote className="md-blockquote">{children}</blockquote>,
    hr: () => (
      <hr
        style={{
          border: 0,
          borderTop: "1px solid var(--stroke-1)",
          margin: "16px 0",
        }}
      />
    ),
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="md-link"
        style={{
          color: "var(--fg-accent)",
          textDecoration: "underline",
          textUnderlineOffset: 3,
        }}
      >
        {children}
      </a>
    ),
    img: ({ src, alt }: { src?: string | Blob; alt?: string }) => (
      <img
        src={typeof src === "string" ? src : undefined}
        alt={alt ?? ""}
        className="msg-attachment-img"
        style={{ display: "block", marginTop: 8 }}
      />
    ),
  };
}
