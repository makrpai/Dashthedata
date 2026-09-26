'use client';

import { ToggleGroup } from 'radix-ui';
import { cn } from '@/lib/util/cn';

export interface SegmentOption<T extends string> {
  value: T;
  label: React.ReactNode;
  ariaLabel?: string;
}

/** Segmented control: inset track, the selected segment is pressed. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
  size = 'md',
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  ariaLabel: string;
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      aria-label={ariaLabel}
      className={cn(
        'nm-inset inline-flex items-center gap-0.5 rounded-[var(--radius-control)] p-0.5',
        className,
      )}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          aria-label={o.ariaLabel}
          className={cn(
            'inline-flex items-center justify-center gap-1 rounded-[9px] font-semibold text-fg-2 transition-colors duration-[80ms] hover:text-fg data-[state=on]:text-fg data-[state=on]:shadow-nm-pressed [&_svg]:size-4',
            size === 'sm' ? 'h-7 px-2 text-[12px]' : 'h-8 px-3 text-[13px]',
          )}
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
