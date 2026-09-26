import { cn } from '@/lib/util/cn';

/** View title (Bricolage, 22 px) with an optional description and actions. */
export function ViewHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-5 flex flex-wrap items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        <h1 className="font-display text-[22px] font-bold tracking-[-0.01em]">{title}</h1>
        {description && <p className="mt-1 max-w-[72ch] text-fg-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
