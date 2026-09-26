import { cn } from '@/lib/util/cn';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-[var(--radius-control)] bg-[color-mix(in_srgb,var(--fg)_8%,transparent)]',
        className,
      )}
      {...props}
    />
  );
}
