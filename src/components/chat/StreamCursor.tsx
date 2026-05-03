"use client";

type Props = {
  providerId?: string | null;
};

export function StreamCursor({ providerId }: Props) {
  return (
    <span
      className="stream-cursor"
      data-provider={providerId ?? undefined}
      aria-hidden="true"
    />
  );
}
