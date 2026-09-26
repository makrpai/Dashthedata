import { cn } from '@/lib/util/cn';

type Tone = 'light' | 'dark' | 'mono';

const toneVars: Record<Tone, React.CSSProperties> = {
  // light/dark follow the theme tokens (--dtd-ink / --dtd-accent switch with the theme).
  light: {},
  dark: {
    ['--dtd-ink' as string]: 'var(--brand-paper)',
    ['--dtd-accent' as string]: 'var(--brand-accent-on-dark)',
  },
  mono: { ['--dtd-accent' as string]: 'var(--dtd-ink)' },
};

/** Canonical mark (viewBox 120) and the simplified small-size mark (viewBox 32, <= 24 px). */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  if (size <= 24) {
    return (
      <svg viewBox="0 0 32 32" width={size} height={size} className={className} aria-hidden focusable="false">
        <rect
          x="2"
          y="9"
          width="6"
          height="6"
          rx="1.5"
          transform="rotate(-20 5 12)"
          fill="var(--dtd-accent)"
        />
        <circle cx="5.5" cy="22" r="2.8" fill="var(--dtd-accent)" />
        <rect x="12" y="17" width="5" height="12" rx="1.5" fill="var(--dtd-ink)" />
        <rect x="19" y="11" width="5" height="18" rx="1.5" fill="var(--dtd-ink)" />
        <rect x="26" y="4" width="5" height="25" rx="1.5" fill="var(--dtd-ink)" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className={className} aria-hidden focusable="false">
      <rect
        x="9"
        y="58"
        width="14"
        height="14"
        rx="3"
        transform="rotate(-20 16 65)"
        fill="var(--dtd-accent)"
      />
      <circle cx="30" cy="38" r="7" fill="var(--dtd-accent)" />
      <rect
        x="19"
        y="85"
        width="11"
        height="11"
        rx="2.5"
        transform="rotate(14 24.5 90.5)"
        fill="var(--dtd-accent)"
      />
      <rect x="46" y="66" width="17" height="38" rx="4" fill="var(--dtd-ink)" />
      <rect x="70" y="45" width="17" height="59" rx="4" fill="var(--dtd-ink)" />
      <rect x="94" y="22" width="17" height="82" rx="4" fill="var(--dtd-ink)" />
    </svg>
  );
}

/**
 * Dash the Data logo. The wordmark is live text in Bricolage Grotesque 700;
 * "the" is 50 % size, weight 500, same baseline and colour. Always flat (no shadows).
 */
export function Logo({
  variant = 'horizontal',
  tone = 'light',
  size = 32,
  className,
}: {
  variant?: 'horizontal' | 'mark';
  tone?: Tone;
  /** Height of the mark in px. */
  size?: number;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label="Dash the Data"
      className={cn('inline-flex shrink-0 items-center', className)}
      style={{ ...toneVars[tone], gap: size * 0.3 }}
    >
      <LogoMark size={size} />
      {variant === 'horizontal' && (
        <span
          aria-hidden
          className="font-display leading-none font-bold whitespace-nowrap"
          style={{ fontSize: size * 0.82, letterSpacing: '-0.02em', color: 'var(--dtd-ink)' }}
        >
          Dash
          <span style={{ fontSize: '50%', fontWeight: 500, margin: '0 0.12em', letterSpacing: 0 }}>the</span>
          Data
        </span>
      )}
    </span>
  );
}
