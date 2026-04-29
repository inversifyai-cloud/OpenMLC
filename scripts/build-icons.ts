#!/usr/bin/env -S npx tsx
/**
 * Generates one React component per SVG in public/brand/icons/.
 * Output: src/components/icons/<Name>.tsx + src/components/icons/index.ts
 *
 * Each component renders the SVG inline, strips fixed colors so currentColor
 * can drive it, and accepts size + className.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, basename, extname } from "node:path";

const ICON_DIR = "public/brand/icons";
const OUT_DIR = "src/components/icons";

function pascalCase(name: string): string {
  return name
    .split(/[-_]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join("") + "Icon";
}

function transformSvg(svg: string): { inner: string; viewBox: string } {
  const viewBoxMatch = svg.match(/viewBox="([^"]+)"/);
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : "0 0 24 24";

  const innerMatch = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
  let inner = innerMatch ? innerMatch[1] : svg;

  // Convert kebab-case attrs to camelCase JSX
  inner = inner
    .replace(/stroke-width=/g, "strokeWidth=")
    .replace(/stroke-linecap=/g, "strokeLinecap=")
    .replace(/stroke-linejoin=/g, "strokeLinejoin=")
    .replace(/stroke-dasharray=/g, "strokeDasharray=")
    .replace(/stroke-opacity=/g, "strokeOpacity=")
    .replace(/fill-opacity=/g, "fillOpacity=")
    .replace(/fill-rule=/g, "fillRule=")
    .replace(/clip-rule=/g, "clipRule=")
    .replace(/text-anchor=/g, "textAnchor=")
    .replace(/font-family=/g, "fontFamily=")
    .replace(/font-size=/g, "fontSize=")
    .replace(/font-weight=/g, "fontWeight=")
    .replace(/letter-spacing=/g, "letterSpacing=")
    // Self-close empty path/circle/line/rect/etc. that come as <tag></tag>
    .replace(/<(path|circle|line|rect|polyline|polygon|ellipse)([^>]*)><\/\1>/g, "<$1$2 />");

  return { inner: inner.trim(), viewBox };
}

function generateComponent(name: string, raw: string): string {
  const Component = pascalCase(name);
  const { inner, viewBox } = transformSvg(raw);
  return `import type { SVGProps } from "react";

export function ${Component}({ size = 24, className, ...rest }: { size?: number; className?: string } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="${viewBox}"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      {...rest}
    >
      ${inner}
    </svg>
  );
}
`;
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const files = readdirSync(ICON_DIR).filter((f) => f.endsWith(".svg"));
  const exports: string[] = [];

  for (const file of files) {
    const name = basename(file, extname(file));
    const Component = pascalCase(name);
    const raw = readFileSync(join(ICON_DIR, file), "utf-8");
    const code = generateComponent(name, raw);
    writeFileSync(join(OUT_DIR, `${Component}.tsx`), code);
    exports.push(`export { ${Component} } from "./${Component}";`);
  }

  writeFileSync(join(OUT_DIR, "index.ts"), exports.join("\n") + "\n");
  console.log(`[icons] generated ${files.length} components → ${OUT_DIR}/`);
}

main();
