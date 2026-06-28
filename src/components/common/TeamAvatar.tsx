import { cn } from '@/lib/utils';

/** Up to two initials from a team name. */
function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0] ?? '');
  return (letters.join('') || name.slice(0, 2) || '?').toUpperCase();
}

/** Deterministic, pleasant hue from a team name (stable across renders). */
function hueFor(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

/**
 * A circular "crest" stand-in: the team's initials over a deterministic color.
 * The Flashscore feed gives no logo URLs, so this keeps the visual identity of
 * the match header without external images.
 */
export function TeamAvatar({
  name,
  size = 40,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const hue = hueFor(name);
  return (
    <span
      aria-hidden
      className={cn('inline-grid shrink-0 place-items-center rounded-full font-bold', className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.36),
        color: `hsl(${hue} 70% 88%)`,
        backgroundColor: `hsl(${hue} 45% 32%)`,
        boxShadow: `inset 0 0 0 1px hsl(${hue} 50% 60% / 0.4)`,
      }}
    >
      {initials(name)}
    </span>
  );
}
