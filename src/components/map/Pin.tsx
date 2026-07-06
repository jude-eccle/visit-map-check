import type { PinStatus } from "@/lib/status";
import { STATUS_META } from "@/lib/status";

export function Pin({
  status,
  size = 22,
  outline = false,
}: {
  status: PinStatus;
  size?: number;
  outline?: boolean;
}) {
  const color = STATUS_META[status].color;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{
        filter: outline
          ? "drop-shadow(0 0 1.5px rgba(255,255,255,0.9)) drop-shadow(0 1px 2px rgba(0,0,0,0.4))"
          : "drop-shadow(0 1px 1.5px rgba(0,0,0,0.35))",
      }}
    >
      <path
        d="M12 2C7.6 2 4 5.5 4 9.8c0 5.4 6.7 11.3 7.3 11.8.4.4 1 .4 1.4 0 .6-.5 7.3-6.4 7.3-11.8C20 5.5 16.4 2 12 2z"
        fill={color}
      />
      <circle cx="12" cy="10" r="2.5" fill="rgba(255,255,255,0.85)" />
    </svg>
  );
}
