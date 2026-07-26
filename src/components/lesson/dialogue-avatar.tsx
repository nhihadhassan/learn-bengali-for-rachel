import { cn } from "@/lib/utils";

/**
 * An original friendly owl mascot shown next to dialogue prompts so
 * "How do you reply?" reads like a real conversation. Purple, round, and
 * cheerful — designed from scratch, not based on any other app's character.
 * `seed` shifts the purple hue a little so different speakers vary.
 */
export function DialogueAvatar({
  className,
  seed = 0,
}: {
  className?: string;
  seed?: number;
}) {
  const uid = `owl-${seed}`;
  const purples = [
    ["#a855f7", "#7c3aed"],
    ["#8b5cf6", "#6d28d9"],
    ["#c084fc", "#9333ea"],
    ["#a78bfa", "#7e22ce"],
  ];
  const [light, dark] = purples[((seed % purples.length) + purples.length) % purples.length];

  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("shrink-0", className)}
      role="img"
      aria-label="Conversation partner"
    >
      <defs>
        <linearGradient id={`${uid}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
      </defs>

      {/* Ear tufts */}
      <path d="M20 18 L15 7 L28 14 Z" fill={dark} />
      <path d="M44 18 L49 7 L36 14 Z" fill={dark} />

      {/* Wings */}
      <ellipse cx="13" cy="38" rx="8" ry="13" fill={dark} />
      <ellipse cx="51" cy="38" rx="8" ry="13" fill={dark} />

      {/* Body / head */}
      <ellipse cx="32" cy="36" rx="21" ry="23" fill={`url(#${uid}-body)`} />

      {/* Belly highlight */}
      <ellipse cx="32" cy="42" rx="12" ry="14" fill="#ffffff" opacity="0.14" />

      {/* Eyes */}
      <circle cx="24" cy="31" r="9" fill="#ffffff" />
      <circle cx="40" cy="31" r="9" fill="#ffffff" />
      <circle cx="25" cy="32" r="4.4" fill="#1e1b4b" />
      <circle cx="39" cy="32" r="4.4" fill="#1e1b4b" />
      <circle cx="26.6" cy="30.4" r="1.5" fill="#ffffff" />
      <circle cx="40.6" cy="30.4" r="1.5" fill="#ffffff" />

      {/* Beak */}
      <path d="M32 36 L28 40 L36 40 Z" fill="#fb923c" />

      {/* Feet */}
      <ellipse cx="26" cy="58" rx="4" ry="2.4" fill="#fb923c" />
      <ellipse cx="38" cy="58" rx="4" ry="2.4" fill="#fb923c" />
    </svg>
  );
}
