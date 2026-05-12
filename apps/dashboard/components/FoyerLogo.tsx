// components/FoyerLogo.tsx
// Drop into your Next.js / Vercel project.
// Usage:
//   <FoyerLogo />                    // full lockup, default size
//   <FoyerLogo variant="icon" />     // icon only
//   <FoyerLogo size={48} />          // custom height in px

type FoyerLogoProps = {
  variant?: 'full' | 'icon';
  size?: number;
  className?: string;
  /** Override the gradient — pass two hex colors */
  colors?: [string, string];
  /** Color of the wordmark text. Defaults to currentColor so it inherits. */
  textColor?: string;
};

export function FoyerLogo({
  variant = 'full',
  size = 40,
  className,
  colors = ['#6366F1', '#8B5CF6'],
  textColor = 'currentColor',
}: FoyerLogoProps) {
  // Stable gradient id so multiple instances on a page don't collide
  const gradId = `foyer-grad-${colors[0].replace('#', '')}-${colors[1].replace('#', '')}`;

  if (variant === 'icon') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 64 64"
        height={size}
        width={size}
        role="img"
        aria-label="Foyer"
        className={className}
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={colors[0]} />
            <stop offset="100%" stopColor={colors[1]} />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="64" height="64" rx="14" fill={`url(#${gradId})`} />
        <path
          d="M 22 16 L 22 56 L 42 56 L 42 16 Q 42 10 36 10 L 28 10 Q 22 10 22 16 Z"
          fill="#FFFFFF"
        />
        <circle cx="38" cy="36" r="2" fill={`url(#${gradId})`} />
      </svg>
    );
  }

  // Full lockup — width scales with size (height)
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 280 100"
      height={size}
      role="img"
      aria-label="Foyer"
      className={className}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={colors[0]} />
          <stop offset="100%" stopColor={colors[1]} />
        </linearGradient>
      </defs>
      <rect x="0" y="10" width="80" height="80" rx="14" fill={`url(#${gradId})`} />
      <path
        d="M 22 28 L 22 90 L 58 90 L 58 28 Q 58 18 48 18 L 32 18 Q 22 18 22 28 Z"
        fill="#FFFFFF"
      />
      <circle cx="51" cy="60" r="3" fill={`url(#${gradId})`} />
      <text
        x="100"
        y="68"
        fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
        fontSize="44"
        fontWeight="500"
        fill={textColor}
        letterSpacing="-1.5"
      >
        Foyer
      </text>
    </svg>
  );
}
