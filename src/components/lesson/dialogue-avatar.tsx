import { cn } from "@/lib/utils";

/**
 * A small, original mascot shown next to dialogue prompts so "How do you reply?"
 * reads like a real conversation. Deliberately generic (not based on any other
 * app's characters) — a friendly rounded buddy in the app's violet/cyan palette.
 * `seed` gives each prompt a slightly different accent hue so speakers vary.
 */
export function DialogueAvatar({
  className,
  seed = 0,
}: {
  className?: string;
  seed?: number;
}) {
  const uid = `dlg-${seed}`;
  const hues = [
    ["#7c3aed", "#06b6d4"],
    ["#db2777", "#f59e0b"],
    ["#0891b2", "#7c3aed"],
    ["#f97316", "#db2777"],
  ];
  const [from, to] = hues[((seed % hues.length) + hues.length) % hues.length];

  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("shrink-0", className)}
      role="img"
      aria-label="Conversation partner"
    >
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      {/* Rounded body */}
      <rect x="4" y="4" width="56" height="56" rx="20" fill={`url(#${uid}-bg)`} />
      {/* Cheeks */}
      <circle cx="22" cy="40" r="4" fill="#ffffff" opacity="0.28" />
      <circle cx="42" cy="40" r="4" fill="#ffffff" opacity="0.28" />
      {/* Eyes */}
      <circle cx="24" cy="30" r="5.4" fill="#ffffff" />
      <circle cx="40" cy="30" r="5.4" fill="#ffffff" />
      <circle cx="25" cy="31" r="2.4" fill="#0f172a" />
      <circle cx="41" cy="31" r="2.4" fill="#0f172a" />
      {/* Smile */}
      <path
        d="M23 41 Q32 49 41 41"
        fill="none"
        stroke="#ffffff"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
